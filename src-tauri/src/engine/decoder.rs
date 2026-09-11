use std::fs::File;
use std::io::Read;
use std::path::Path;
use image::{DynamicImage, GenericImageView, ImageReader, RgbaImage};

pub struct DecodedImage {
    pub image: DynamicImage,
    pub original_width: u32,
    pub original_height: u32,
    pub detected_format: String,
}

pub fn decode_image_file<P: AsRef<Path>>(path: P) -> Result<DecodedImage, String> {
    let path_ref = path.as_ref();
    let ext = path_ref
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mut file = File::open(path_ref)
        .map_err(|e| format!("Failed to open file {}: {}", path_ref.display(), e))?;
    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file {}: {}", path_ref.display(), e))?;

    // Handle SVG vector format via resvg & tiny-skia
    if ext == "svg" {
        return decode_svg(&buffer);
    }

    // Handle HEIC/HEIF photo formats via pure-Rust heic crate
    if ext == "heic" || ext == "heif" || is_heic_buffer(&buffer) {
        return decode_heic(&buffer);
    }

    // Handle standard bitmap formats (JPG, PNG, WebP, BMP, TIFF, GIF, ICO, AVIF)
    match ImageReader::new(std::io::Cursor::new(&buffer)).with_guessed_format() {
        Ok(reader) => {
            let format_name = reader
                .format()
                .map(|f| format!("{:?}", f).to_lowercase())
                .unwrap_or_else(|| ext.clone());

            match reader.decode() {
                Ok(img) => {
                    let (w, h) = img.dimensions();
                    Ok(DecodedImage {
                        image: img,
                        original_width: w,
                        original_height: h,
                        detected_format: format_name,
                    })
                }
                Err(e) => {
                    // Fallback 1: direct load_from_memory
                    if let Ok(img) = image::load_from_memory(&buffer) {
                        let (w, h) = img.dimensions();
                        return Ok(DecodedImage {
                            image: img,
                            original_width: w,
                            original_height: h,
                            detected_format: ext,
                        });
                    }

                    // Fallback 2: attempt HEIC decoding if file header might be HEIC
                    if let Ok(heic_img) = decode_heic(&buffer) {
                        return Ok(heic_img);
                    }

                    Err(format!("Unsupported or corrupted image file: {}", e))
                }
            }
        }
        Err(e) => {
            // Fallback: check if it's HEIC even if ImageReader couldn't recognize format
            if let Ok(heic_img) = decode_heic(&buffer) {
                return Ok(heic_img);
            }
            Err(format!("Failed to recognize image format: {}", e))
        }
    }
}

pub fn is_heic_buffer(buffer: &[u8]) -> bool {
    if buffer.len() < 12 {
        return false;
    }
    // Check ISOBMFF box type "ftyp" at offset 4
    if &buffer[4..8] != b"ftyp" {
        return false;
    }
    let brand = &buffer[8..12];
    matches!(
        brand,
        b"heic" | b"heix" | b"hevc" | b"heim" | b"heis" | b"mif1" | b"msf1"
    )
}

fn decode_heic(buffer: &[u8]) -> Result<DecodedImage, String> {
    let decoded = heic::DecoderConfig::new()
        .decode(buffer, heic::PixelLayout::Rgba8)
        .map_err(|e| format!("Failed to decode HEIC image: {:?}", e))?;

    let rgba_image = RgbaImage::from_raw(decoded.width, decoded.height, decoded.data)
        .ok_or_else(|| "Failed to construct RGBA buffer from decoded HEIC pixels".to_string())?;

    Ok(DecodedImage {
        image: DynamicImage::ImageRgba8(rgba_image),
        original_width: decoded.width,
        original_height: decoded.height,
        detected_format: "heic".to_string(),
    })
}

fn decode_svg(svg_bytes: &[u8]) -> Result<DecodedImage, String> {
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_data(svg_bytes, &opt)
        .map_err(|e| format!("Failed to parse SVG data: {}", e))?;

    let size = tree.size().to_int_size();
    let width = size.width();
    let height = size.height();

    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| "Failed to allocate pixel map for SVG".to_string())?;

    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());

    // tiny-skia uses premultiplied RGBA. Un-premultiply alpha for clean image buffer
    let data = pixmap.data();
    let mut rgba_unpremultiplied = Vec::with_capacity(data.len());

    for chunk in data.chunks_exact(4) {
        let a = chunk[3];
        if a == 0 {
            rgba_unpremultiplied.extend_from_slice(&[0, 0, 0, 0]);
        } else {
            let alpha_f = a as f32 / 255.0;
            let r = ((chunk[0] as f32 / alpha_f).min(255.0)) as u8;
            let g = ((chunk[1] as f32 / alpha_f).min(255.0)) as u8;
            let b = ((chunk[2] as f32 / alpha_f).min(255.0)) as u8;
            rgba_unpremultiplied.extend_from_slice(&[r, g, b, a]);
        }
    }

    let rgba_image = RgbaImage::from_raw(width, height, rgba_unpremultiplied)
        .ok_or_else(|| "Failed to create RGBA image from SVG buffer".to_string())?;

    Ok(DecodedImage {
        image: DynamicImage::ImageRgba8(rgba_image),
        original_width: width,
        original_height: height,
        detected_format: "svg".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_heic_real_file() {
        let path = r"C:\Users\gilbe\Downloads\IMG_1821.HEIC";
        if !std::path::Path::new(path).exists() {
            return;
        }

        let decoded = decode_image_file(path).expect("decode heic file");
        assert_eq!(decoded.detected_format, "heic");
        assert_eq!(decoded.original_width, 2316);
        assert_eq!(decoded.original_height, 3088);

        // Verify conversion to JPEG with alpha flattening
        let out_jpg = std::env::temp_dir().join("shrinkr_heic_decode_test.jpg");
        let rgb_img = crate::engine::transform::flatten_alpha_to_white(&decoded.image);
        rgb_img.save_with_format(&out_jpg, image::ImageFormat::Jpeg).expect("save jpeg");
        assert!(out_jpg.exists());
        let meta = std::fs::metadata(&out_jpg).expect("metadata");
        assert!(meta.len() > 1000);
        let _ = std::fs::remove_file(&out_jpg);
    }
}
