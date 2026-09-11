use std::fs;
use std::path::Path;
use tauri::AppHandle;
use walkdir::WalkDir;

use crate::engine::batch::run_batch;
use crate::engine::types::{BatchConfig, ScannedImage};

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "avif", "heic", "heif", "svg", "bmp", "tiff", "tif", "gif",
    "ico",
];

fn is_supported_image(ext: &str) -> bool {
    SUPPORTED_EXTENSIONS.contains(&ext.to_lowercase().as_str())
}

#[tauri::command]
pub async fn scan_paths(paths: Vec<String>) -> Result<Vec<ScannedImage>, String> {
    let mut results = Vec::new();

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
                            if let Some(item) = scan_single_file(entry_path) {
                                results.push(item);
                            }
                        }
                    }
                }
            }
        } else if p.is_file() {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if is_supported_image(ext) {
                    if let Some(item) = scan_single_file(p) {
                        results.push(item);
                    }
                }
            }
        }
    }

    Ok(results)
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

    // Quickly read dimensions from header if possible
    let (width, height) = if ext == "svg" {
        // Read SVG dimensions quickly via usvg or simple regex/header
        if let Ok(data) = fs::read(path) {
            if let Ok(tree) = usvg::Tree::from_data(&data, &usvg::Options::default()) {
                let s = tree.size().to_int_size();
                (Some(s.width()), Some(s.height()))
            } else {
                (None, None)
            }
        } else {
            (None, None)
        }
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
            Err(_) => {
                if let Ok(data) = fs::read(path) {
                    if let Ok(info) = heic::ImageInfo::from_bytes(&data) {
                        (Some(info.width), Some(info.height))
                    } else {
                        (None, None)
                    }
                } else {
                    (None, None)
                }
            }
        }
    };

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
    })
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
}

