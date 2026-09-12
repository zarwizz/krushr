use base64::prelude::*;
use image::codecs::jpeg::JpegEncoder;
use image::ImageEncoder;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use tauri::AppHandle;
use walkdir::WalkDir;

use crate::engine::batch::run_batch;
use crate::engine::decoder::decode_image_file;
use crate::engine::types::{BatchConfig, ScannedImage};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "svg", "bmp", "tiff", "tif", "gif", "ico",
];

fn is_supported_image(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailResult {
    pub path: String,
    pub thumbnail: Option<String>,
}

#[tauri::command]
pub async fn scan_paths(paths: Vec<String>) -> Result<Vec<ScannedImage>, String> {
    let mut file_paths = Vec::new();

    for path_str in paths {
        let p = Path::new(&path_str);
        if !p.exists() {
            continue;
        }

        if p.is_dir() {
            // Recursively scan directory
            for entry in WalkDir::new(p).into_iter().filter_map(|e| e.ok()) {
                let entry_path = entry.path();
                if entry_path.is_file() {
                    if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                        if is_supported_image(ext) {
                            file_paths.push(entry_path.to_path_buf());
                        }
                    }
                }
            }
        } else if p.is_file() {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if is_supported_image(ext) {
                    file_paths.push(p.to_path_buf());
                }
            }
        }
    }

    // Process lightweight metadata scanning in parallel across CPU threads
    let results: Vec<ScannedImage> = file_paths
        .into_par_iter()
        .filter_map(|path| scan_single_file(&path))
        .collect();

    Ok(results)
}

fn get_fast_dimensions(path: &Path, ext: &str) -> (Option<u32>, Option<u32>) {
    if ext == "svg" {
        if let Ok(data) = fs::read(path) {
            if let Ok(tree) = usvg::Tree::from_data(&data, &usvg::Options::default()) {
                let s = tree.size().to_int_size();
                return (Some(s.width()), Some(s.height()));
            }
        }
        (None, None)
    } else if ext == "heic" || ext == "heif" {
        if let Ok(data) = fs::read(path) {
            match heic::ImageInfo::from_bytes(&data) {
                Ok(info) => (Some(info.width), Some(info.height)),
                Err(_) => (None, None),
            }
        } else {
            (None, None)
        }
    } else {
        match image::image_dimensions(path) {
            Ok((w, h)) => (Some(w), Some(h)),
            Err(_) => (None, None),
        }
    }
}

fn scan_single_file(path: &Path) -> Option<ScannedImage> {
    let metadata = fs::metadata(path).ok()?;
    let size = metadata.len();
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image")
        .to_string();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // Fast header dimensions without decoding full image pixels
    let (width, height) = get_fast_dimensions(path, &ext);
    let path_str = path.to_string_lossy().to_string();

    Some(ScannedImage {
        id: path_str.clone(),
        path: path_str,
        name,
        size,
        width,
        height,
        format: ext.to_uppercase(),
        status: "pending".to_string(),
        thumbnail: None,
    })
}

// Extract EXIF embedded thumbnail without decoding the high-resolution image
fn extract_exif_jpeg_thumbnail(path: &Path) -> Option<Vec<u8>> {
    let mut file = fs::File::open(path).ok()?;
    // Read up to 128KB header - standard EXIF APP1 metadata is located at the beginning of the file
    let mut header = vec![0u8; 131072];
    let bytes_read = file.read(&mut header).ok()?;
    if bytes_read < 16 {
        return None;
    }
    let header_slice = &header[..bytes_read];

    let (tiff_data, tiff_start_file_pos) = find_tiff_segment(header_slice)?;
    parse_tiff_thumbnail(tiff_data, tiff_start_file_pos, &mut file)
}

fn find_tiff_segment(header: &[u8]) -> Option<(&[u8], u64)> {
    // 1. JPEG APP1 Segment inspection
    if header.len() > 4 && header[0] == 0xFF && header[1] == 0xD8 {
        let mut offset = 2;
        while offset + 4 < header.len() {
            if header[offset] != 0xFF {
                break;
            }
            let marker = header[offset + 1];
            if marker == 0xDA || marker == 0xD9 {
                // Start of scan or end of image
                break;
            }
            let len = u16::from_be_bytes([header[offset + 2], header[offset + 3]]) as usize;
            if offset + 2 + len > header.len() {
                break;
            }
            if marker == 0xE1 && len >= 14 {
                let payload = &header[offset + 4..offset + 2 + len];
                if payload.starts_with(b"Exif\0\0") {
                    let tiff_data = &payload[6..];
                    let tiff_file_pos = (offset + 10) as u64;
                    return Some((tiff_data, tiff_file_pos));
                }
            }
            offset += 2 + len;
        }
    }

    // 2. Direct TIFF magic (Little Endian or Big Endian)
    if (header.starts_with(b"II\x2A\x00") || header.starts_with(b"MM\x00\x2A")) && header.len() >= 8 {
        return Some((header, 0));
    }

    // 3. Fallback scan for Exif marker in first 64KB (HEIC / container formats)
    let search_limit = header.len().min(65536);
    if let Some(pos) = header[..search_limit].windows(6).position(|w| w == b"Exif\0\0") {
        let tiff_data = &header[pos + 6..];
        let tiff_file_pos = (pos + 6) as u64;
        return Some((tiff_data, tiff_file_pos));
    }

    None
}

fn parse_tiff_thumbnail(tiff: &[u8], tiff_start_file_pos: u64, file: &mut fs::File) -> Option<Vec<u8>> {
    if tiff.len() < 8 {
        return None;
    }
    let is_le = match &tiff[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };

    let read_u16 = |buf: &[u8]| -> Option<u16> {
        if buf.len() < 2 {
            return None;
        }
        Some(if is_le {
            u16::from_le_bytes([buf[0], buf[1]])
        } else {
            u16::from_be_bytes([buf[0], buf[1]])
        })
    };

    let read_u32 = |buf: &[u8]| -> Option<u32> {
        if buf.len() < 4 {
            return None;
        }
        Some(if is_le {
            u32::from_le_bytes([buf[0], buf[1], buf[2], buf[3]])
        } else {
            u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]])
        })
    };

    let magic = read_u16(&tiff[2..4])?;
    if magic != 42 {
        return None;
    }

    let ifd0_offset = read_u32(&tiff[4..8])? as usize;
    if ifd0_offset >= tiff.len() {
        return None;
    }

    let ifd0_count = read_u16(&tiff[ifd0_offset..])? as usize;
    let next_ifd_pos = ifd0_offset + 2 + ifd0_count * 12;
    if next_ifd_pos + 4 > tiff.len() {
        return None;
    }

    let ifd1_offset = read_u32(&tiff[next_ifd_pos..])? as usize;
    if ifd1_offset == 0 || ifd1_offset >= tiff.len() {
        return None;
    }

    let ifd1_count = read_u16(&tiff[ifd1_offset..])? as usize;
    let mut thumb_offset = None;
    let mut thumb_len = None;

    for i in 0..ifd1_count {
        let entry_pos = ifd1_offset + 2 + i * 12;
        if entry_pos + 12 > tiff.len() {
            break;
        }
        let tag = read_u16(&tiff[entry_pos..])?;
        let val = read_u32(&tiff[entry_pos + 8..])?;

        if tag == 0x0201 {
            // JPEGInterchangeFormat (Thumbnail Offset)
            thumb_offset = Some(val as usize);
        } else if tag == 0x0202 {
            // JPEGInterchangeFormatLength (Thumbnail Length)
            thumb_len = Some(val as usize);
        }
    }

    if let (Some(offset), Some(len)) = (thumb_offset, thumb_len) {
        if len > 4 && len <= 1_000_000 {
            // Case A: Entire thumbnail stream is already within the 128KB header slice
            if offset + len <= tiff.len() {
                let candidate = &tiff[offset..offset + len];
                if candidate.starts_with(&[0xFF, 0xD8]) {
                    return Some(candidate.to_vec());
                }
            } else {
                // Case B: Thumbnail stream is located further in the file; seek and read raw bytes
                let seek_target = tiff_start_file_pos + offset as u64;
                if file.seek(SeekFrom::Start(seek_target)).is_ok() {
                    let mut thumb_buf = vec![0u8; len];
                    if file.read_exact(&mut thumb_buf).is_ok() && thumb_buf.starts_with(&[0xFF, 0xD8]) {
                        return Some(thumb_buf);
                    }
                }
            }
        }
    }

    None
}

fn generate_svg_fast_thumbnail(path: &Path) -> Option<String> {
    let data = fs::read(path).ok()?;
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_data(&data, &opt).ok()?;
    let size = tree.size().to_int_size();
    let (w, h) = (size.width(), size.height());
    if w == 0 || h == 0 {
        return None;
    }

    let scale = (64.0 / (w.max(h) as f32)).min(1.0);
    let target_w = ((w as f32 * scale).round() as u32).max(1);
    let target_h = ((h as f32 * scale).round() as u32).max(1);

    let mut pixmap = tiny_skia::Pixmap::new(target_w, target_h)?;
    pixmap.fill(tiny_skia::Color::WHITE);

    let transform = tiny_skia::Transform::from_scale(
        target_w as f32 / w as f32,
        target_h as f32 / h as f32,
    );
    resvg::render(&tree, transform, &mut pixmap.as_mut());

    let mut rgb = Vec::with_capacity((target_w * target_h * 3) as usize);
    for pixel in pixmap.pixels() {
        rgb.push(pixel.red());
        rgb.push(pixel.green());
        rgb.push(pixel.blue());
    }

    let mut buf = Vec::with_capacity((target_w * target_h / 2) as usize);
    let encoder = JpegEncoder::new_with_quality(&mut buf, 50);
    encoder
        .write_image(&rgb, target_w, target_h, image::ExtendedColorType::Rgb8)
        .ok()?;

    Some(format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(&buf)))
}

pub fn generate_fast_thumbnail(path: &Path) -> Option<String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    // 1. FAST-PATH EXIF (0-1ms):
    // For JPEG / HEIC, inspect EXIF header for embedded thumbnail.
    // If present, return the raw byte stream directly as base64 without any decode/re-encode.
    if ext == "jpg" || ext == "jpeg" || ext == "heic" || ext == "heif" {
        if let Some(thumb_bytes) = extract_exif_jpeg_thumbnail(path) {
            return Some(format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(&thumb_bytes)));
        }
    }

    // 2. FAST-PATH SVG: Direct vector rasterization to 64x64 via tiny-skia (<1ms)
    if ext == "svg" {
        if let Some(thumb) = generate_svg_fast_thumbnail(path) {
            return Some(thumb);
        }
    }

    // 3. FAST RESIZE FALLBACK (If no EXIF thumbnail or other bitmap formats):
    // Max 64x64 px output with Nearest filter (ultra-fast 0-1ms) and JPEG quality 50
    let decoded = decode_image_file(path).ok()?;
    let resized = decoded.image.resize(64, 64, image::imageops::FilterType::Nearest);

    let rgb_img = if resized.color().has_alpha() {
        crate::engine::transform::flatten_alpha_to_white(&resized)
    } else {
        resized.to_rgb8()
    };

    let (w, h) = rgb_img.dimensions();
    let mut buf = Vec::with_capacity((w * h / 2) as usize);
    let encoder = JpegEncoder::new_with_quality(&mut buf, 50);
    if encoder.write_image(rgb_img.as_raw(), w, h, image::ExtendedColorType::Rgb8).is_ok() {
        Some(format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(&buf)))
    } else {
        None
    }
}

#[tauri::command]
pub async fn get_batch_thumbnails(paths: Vec<String>) -> Result<HashMap<String, String>, String> {
    tokio::task::spawn_blocking(move || {
        let results: HashMap<String, String> = paths
            .into_par_iter()
            .filter_map(|path_str| {
                let p = Path::new(&path_str);
                generate_fast_thumbnail(p).map(|thumb| (path_str, thumb))
            })
            .collect();
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_thumbnails(paths: Vec<String>) -> Result<Vec<ThumbnailResult>, String> {
    tokio::task::spawn_blocking(move || {
        let results: Vec<ThumbnailResult> = paths
            .into_par_iter()
            .map(|path_str| {
                let p = Path::new(&path_str);
                let thumb = generate_fast_thumbnail(p);
                ThumbnailResult {
                    path: path_str,
                    thumbnail: thumb,
                }
            })
            .collect();
        Ok(results)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn process_batch(app: AppHandle, options: BatchConfig) -> Result<(), String> {
    run_batch(app, options);
    Ok(())
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let p = std::path::Path::new(&path);
        if !p.exists() {
            if let Some(parent) = p.parent() {
                if parent.exists() {
                    Command::new("explorer")
                        .arg(parent)
                        .spawn()
                        .map_err(|e| format!("Failed to open explorer: {}", e))?;
                    return Ok(());
                }
            }
            return Err(format!("Path does not exist: {}", path));
        }

        if p.is_file() {
            Command::new("explorer")
                .args(["/select,", &path])
                .spawn()
                .map_err(|e| format!("Failed to open explorer on file: {}", e))?;
        } else {
            Command::new("explorer")
                .arg(&path)
                .spawn()
                .map_err(|e| format!("Failed to open explorer on folder: {}", e))?;
        }
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        let p = std::path::Path::new(&path);
        let target = if p.is_file() {
            p.parent().unwrap_or(p).to_string_lossy().to_string()
        } else {
            path
        };
        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&target)
                .spawn()
                .map_err(|e| format!("Failed to open path: {}", e))?;
        }
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            Command::new("xdg-open")
                .arg(&target)
                .spawn()
                .map_err(|e| format!("Failed to open path: {}", e))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scan_heic_file() {
        let path = Path::new(r"C:\Users\gilbe\Downloads\IMG_1821.HEIC");
        if !path.exists() {
            return;
        }
        let scanned = scan_single_file(path).expect("scanned file");
        assert_eq!(scanned.width, Some(2316));
        assert_eq!(scanned.height, Some(3088));
        assert_eq!(scanned.format, "HEIC");
        assert_eq!(scanned.status, "pending");
    }

    #[test]
    fn test_open_folder_validation() {
        assert!(open_folder("".to_string()).is_err());
        assert!(open_folder("   ".to_string()).is_err());
        assert!(open_folder(r"Z:\non_existent_drive_987654\folder".to_string()).is_err());
    }

    #[test]
    fn test_scan_svg_generates_thumbnail() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let svg_path = manifest_dir.parent().unwrap().join("app-icon.svg");
        assert!(svg_path.exists(), "app-icon.svg must exist");

        let scanned = scan_single_file(&svg_path).expect("scanned svg");
        assert_eq!(scanned.format, "SVG");
        assert_eq!(scanned.width, Some(1024));
        assert_eq!(scanned.height, Some(1024));
        assert!(scanned.thumbnail.is_none(), "scan_single_file is instant and leaves thumbnail for background pipeline");

        let thumb = generate_fast_thumbnail(&svg_path).expect("generate thumbnail for svg");
        assert!(
            thumb.starts_with("data:image/jpeg;base64,"),
            "Thumbnail must be a lightweight JPEG base64 data URL"
        );
        assert!(thumb.len() > 100, "Thumbnail data URL must contain valid base64 payload");
    }

    #[test]
    fn test_scan_bitmap_generates_thumbnail() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let icon_path = manifest_dir.join("icons/32x32.png");
        assert!(icon_path.exists(), "icons/32x32.png must exist");

        let scanned = scan_single_file(&icon_path).expect("scanned png");
        assert_eq!(scanned.format, "PNG");
        assert_eq!(scanned.width, Some(32));
        assert_eq!(scanned.height, Some(32));
        assert!(scanned.thumbnail.is_none(), "scan_single_file is instant and leaves thumbnail for background pipeline");

        let thumb = generate_fast_thumbnail(&icon_path).expect("generate thumbnail for bitmap");
        assert!(thumb.starts_with("data:image/jpeg;base64,"));
        assert!(thumb.len() > 50);
    }

    #[tokio::test]
    async fn test_get_batch_thumbnails() {
        let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        let icon_path = manifest_dir.join("icons/32x32.png").to_string_lossy().to_string();
        let svg_path = manifest_dir.parent().unwrap().join("app-icon.svg").to_string_lossy().to_string();

        let paths = vec![
            icon_path.clone(),
            svg_path.clone(),
            icon_path.clone(),
            svg_path.clone(),
            icon_path.clone(),
            svg_path.clone(),
        ];

        let start = std::time::Instant::now();
        let map = get_batch_thumbnails(paths.clone()).await.expect("batch thumbnails");
        let elapsed = start.elapsed();

        assert_eq!(map.len(), 2, "Duplicate paths map to their respective keys");
        assert!(map.contains_key(&icon_path));
        assert!(map.contains_key(&svg_path));
        println!("6-item batch thumbnail generated in: {:?}", elapsed);
        assert!(elapsed.as_millis() < 500, "Batch of 6 must be blazingly fast");
    }
}
