use std::io::Cursor;
use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType as PngFilterType, PngEncoder};
use image::{DynamicImage, ImageEncoder};
use crate::engine::transform::flatten_alpha_to_white;

pub enum OutputFormat {
    Jpg,
    Png,
    Webp,
    Avif,
}

impl OutputFormat {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "jpg" | "jpeg" => OutputFormat::Jpg,
            "png" => OutputFormat::Png,
            "webp" => OutputFormat::Webp,
            "avif" => OutputFormat::Avif,
            _ => OutputFormat::Jpg,
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            OutputFormat::Jpg => "jpg",
            OutputFormat::Png => "png",
            OutputFormat::Webp => "webp",
            OutputFormat::Avif => "avif",
        }
    }
}

pub fn encode_image(
    img: &DynamicImage,
    format: &OutputFormat,
    quality: u8,
) -> Result<Vec<u8>, String> {
    let q = quality.clamp(1, 100);

    match format {
        OutputFormat::Jpg => {
            // Flatten alpha to pure white background to avoid black edge artifacts
            let rgb = flatten_alpha_to_white(img);
            let (w, h) = rgb.dimensions();
            let mut buf = Vec::with_capacity((w * h / 2) as usize);
            let encoder = JpegEncoder::new_with_quality(&mut buf, q);
            encoder
                .write_image(
                    rgb.as_raw(),
                    w,
                    h,
                    image::ExtendedColorType::Rgb8,
                )
                .map_err(|e| format!("JPEG encoding failed: {}", e))?;
            Ok(buf)
        }

        OutputFormat::Png => {
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            let mut buf = Vec::new();
            let encoder = PngEncoder::new_with_quality(
                Cursor::new(&mut buf),
                CompressionType::Best,
                PngFilterType::Adaptive,
            );
            encoder
                .write_image(
                    rgba.as_raw(),
                    w,
                    h,
                    image::ExtendedColorType::Rgba8,
                )
                .map_err(|e| format!("PNG encoding failed: {}", e))?;
            Ok(buf)
        }

        OutputFormat::Webp => {
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            let encoder = webp::Encoder::from_rgba(rgba.as_raw(), w, h);
            let memory = if q >= 100 {
                encoder.encode_lossless()
            } else {
                encoder.encode(q as f32)
            };
            Ok(memory.to_vec())
        }

        OutputFormat::Avif => {
            let rgba = img.to_rgba8();
            let (w, h) = rgba.dimensions();
            let raw = rgba.as_raw();
            let pixels: &[rgb::RGBA8] = bytemuck::cast_slice(raw);
            let img_ref = ravif::Img::new(pixels, w as usize, h as usize);

            let enc = ravif::Encoder::new()
                .with_quality(q as f32)
                .with_speed(8);

            let res = enc
                .encode_rgba(img_ref)
                .map_err(|e| format!("AVIF encoding failed: {}", e))?;

            Ok(res.avif_file)
        }
    }
}
