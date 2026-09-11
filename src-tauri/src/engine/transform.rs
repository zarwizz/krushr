use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgb, Rgba};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FitMode {
    Fit,     // Preserves aspect ratio, fits entirely within the box (default)
    Fill,    // Preserves aspect ratio, fills entire box and crops center
    Stretch, // Stretches to exact box dimensions without preserving aspect ratio
}

impl FitMode {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "fill" => FitMode::Fill,
            "stretch" => FitMode::Stretch,
            _ => FitMode::Fit,
        }
    }
}

#[derive(Debug, Clone)]
pub enum ResizeConfig {
    Auto,
    Width(u32),
    Height(u32),
    Scale(u32), // percentage, e.g. 75 for 75%
    Custom {
        width: u32,
        height: u32,
        fit_mode: FitMode,
        no_upscale: bool,
    },
}

pub fn calculate_target_dimensions(orig_w: u32, orig_h: u32, mode: &ResizeConfig) -> (u32, u32) {
    if orig_w == 0 || orig_h == 0 {
        return (orig_w.max(1), orig_h.max(1));
    }

    match mode {
        ResizeConfig::Auto => (orig_w, orig_h),
        ResizeConfig::Width(target_w) => {
            if *target_w == 0 {
                return (orig_w, orig_h);
            }
            let ratio = *target_w as f64 / orig_w as f64;
            let target_h = (orig_h as f64 * ratio).round().max(1.0) as u32;
            (*target_w, target_h)
        }
        ResizeConfig::Height(target_h) => {
            if *target_h == 0 {
                return (orig_w, orig_h);
            }
            let ratio = *target_h as f64 / orig_h as f64;
            let target_w = (orig_w as f64 * ratio).round().max(1.0) as u32;
            (target_w, *target_h)
        }
        ResizeConfig::Scale(percent) => {
            if *percent == 0 {
                return (orig_w, orig_h);
            }
            let factor = *percent as f64 / 100.0;
            let target_w = (orig_w as f64 * factor).round().max(1.0) as u32;
            let target_h = (orig_h as f64 * factor).round().max(1.0) as u32;
            (target_w, target_h)
        }
        ResizeConfig::Custom {
            width,
            height,
            fit_mode,
            no_upscale,
        } => {
            let box_w = (*width).max(1);
            let box_h = (*height).max(1);

            if *no_upscale && orig_w <= box_w && orig_h <= box_h {
                return (orig_w, orig_h);
            }

            match fit_mode {
                FitMode::Fit => {
                    let ratio_w = box_w as f64 / orig_w as f64;
                    let ratio_h = box_h as f64 / orig_h as f64;
                    let ratio = ratio_w.min(ratio_h);
                    let target_w = (orig_w as f64 * ratio).round().max(1.0) as u32;
                    let target_h = (orig_h as f64 * ratio).round().max(1.0) as u32;
                    (target_w, target_h)
                }
                FitMode::Stretch | FitMode::Fill => (box_w, box_h),
            }
        }
    }
}

pub fn resize_image(img: &DynamicImage, target_w: u32, target_h: u32) -> DynamicImage {
    let (orig_w, orig_h) = img.dimensions();
    if orig_w == target_w && orig_h == target_h {
        return img.clone();
    }
    img.resize_exact(target_w, target_h, FilterType::Lanczos3)
}

/// Applies resizing according to the full `ResizeConfig` (including PowerToys-style Custom Fit, Fill, Stretch, and No-upscale).
pub fn apply_resize(img: &DynamicImage, mode: &ResizeConfig) -> DynamicImage {
    let (orig_w, orig_h) = img.dimensions();
    if orig_w == 0 || orig_h == 0 {
        return img.clone();
    }

    match mode {
        ResizeConfig::Auto => img.clone(),
        ResizeConfig::Width(_) | ResizeConfig::Height(_) | ResizeConfig::Scale(_) => {
            let (w, h) = calculate_target_dimensions(orig_w, orig_h, mode);
            resize_image(img, w, h)
        }
        ResizeConfig::Custom {
            width,
            height,
            fit_mode,
            no_upscale,
        } => {
            let box_w = (*width).max(1);
            let box_h = (*height).max(1);

            if *no_upscale && orig_w <= box_w && orig_h <= box_h {
                return img.clone();
            }

            match fit_mode {
                FitMode::Fit => {
                    let ratio_w = box_w as f64 / orig_w as f64;
                    let ratio_h = box_h as f64 / orig_h as f64;
                    let ratio = ratio_w.min(ratio_h);
                    let target_w = (orig_w as f64 * ratio).round().max(1.0) as u32;
                    let target_h = (orig_h as f64 * ratio).round().max(1.0) as u32;
                    resize_image(img, target_w, target_h)
                }
                FitMode::Stretch => resize_image(img, box_w, box_h),
                FitMode::Fill => {
                    let ratio_w = box_w as f64 / orig_w as f64;
                    let ratio_h = box_h as f64 / orig_h as f64;
                    let ratio = ratio_w.max(ratio_h);
                    let scaled_w = (orig_w as f64 * ratio).round().max(1.0) as u32;
                    let scaled_h = (orig_h as f64 * ratio).round().max(1.0) as u32;

                    let scaled_img = if scaled_w == orig_w && scaled_h == orig_h {
                        img.clone()
                    } else {
                        resize_image(img, scaled_w, scaled_h)
                    };

                    if scaled_w == box_w && scaled_h == box_h {
                        scaled_img
                    } else {
                        let crop_x = if scaled_w > box_w {
                            (scaled_w - box_w) / 2
                        } else {
                            0
                        };
                        let crop_y = if scaled_h > box_h {
                            (scaled_h - box_h) / 2
                        } else {
                            0
                        };
                        scaled_img.crop_imm(crop_x, crop_y, box_w, box_h)
                    }
                }
            }
        }
    }
}

/// Flattens RGBA image over an opaque pure white background (`#FFFFFF`),
/// completely removing alpha channel and avoiding black border / transparent halo artifacts in JPEG.
pub fn flatten_alpha_to_white(img: &DynamicImage) -> ImageBuffer<Rgb<u8>, Vec<u8>> {
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let mut rgb_buf = ImageBuffer::new(width, height);

    for (x, y, pixel) in rgba.enumerate_pixels() {
        let Rgba([r, g, b, a]) = *pixel;
        if a == 255 {
            rgb_buf.put_pixel(x, y, Rgb([r, g, b]));
        } else if a == 0 {
            rgb_buf.put_pixel(x, y, Rgb([255, 255, 255]));
        } else {
            let alpha = a as f32 / 255.0;
            let inv_alpha = 1.0 - alpha;
            let r_out = (r as f32 * alpha + 255.0 * inv_alpha).round().min(255.0) as u8;
            let g_out = (g as f32 * alpha + 255.0 * inv_alpha).round().min(255.0) as u8;
            let b_out = (b as f32 * alpha + 255.0 * inv_alpha).round().min(255.0) as u8;
            rgb_buf.put_pixel(x, y, Rgb([r_out, g_out, b_out]));
        }
    }

    rgb_buf
}
