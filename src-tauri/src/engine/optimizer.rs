use crate::engine::encoder::{encode_image, OutputFormat};
use image::DynamicImage;

pub struct OptimizationResult {
    pub data: Vec<u8>,
    pub final_quality: u8,
    pub passes: usize,
}

/// Binary search optimization targeting a maximum file size in bytes.
/// Converges in 5 to 7 iterations by testing midpoint quality levels.
pub fn optimize_to_target_size(
    img: &DynamicImage,
    format: &OutputFormat,
    target_bytes: u64,
    fallback_quality: u8,
) -> Result<OptimizationResult, String> {
    // Lossless PNG cannot be lossy quality-searched
    if matches!(format, OutputFormat::Png) {
        let data = encode_image(img, format, fallback_quality)?;
        return Ok(OptimizationResult {
            data,
            final_quality: fallback_quality,
            passes: 1,
        });
    }

    let mut low: u8 = 5;
    let mut high: u8 = 100;
    let mut best_data: Option<Vec<u8>> = None;
    let mut best_quality: u8 = low;
    let mut passes = 0;
    let max_iterations = 7;

    while low <= high && passes < max_iterations {
        passes += 1;
        let mid = (low as u16 + high as u16) / 2;
        let q = mid as u8;

        match encode_image(img, format, q) {
            Ok(buffer) => {
                let size = buffer.len() as u64;

                if size <= target_bytes {
                    // Fits under target! Record as candidate and try higher quality
                    best_quality = q;
                    best_data = Some(buffer);
                    if q == 100 {
                        break;
                    }
                    low = q + 1;
                } else {
                    // Too large, reduce quality
                    if q <= 5 {
                        // Even lowest quality exceeds target
                        if best_data.is_none() {
                            best_quality = q;
                            best_data = Some(buffer);
                        }
                        break;
                    }
                    high = q - 1;
                }
            }
            Err(e) => return Err(e),
        }
    }

    // If no quality was strictly under target, fallback to the lowest quality achieved
    let data = match best_data {
        Some(d) => d,
        None => encode_image(img, format, 5)?,
    };

    Ok(OptimizationResult {
        data,
        final_quality: best_quality,
        passes,
    })
}
