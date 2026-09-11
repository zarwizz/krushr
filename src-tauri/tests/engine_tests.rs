use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use shrinkr_lib::engine::decoder::decode_image_file;
use shrinkr_lib::engine::encoder::{encode_image, OutputFormat};
use shrinkr_lib::engine::optimizer::optimize_to_target_size;
use shrinkr_lib::engine::transform::{
    calculate_target_dimensions, flatten_alpha_to_white, resize_image, ResizeConfig,
};

#[test]
fn test_aspect_ratio_calculations() {
    let orig_w = 4000;
    let orig_h = 3000;

    // Width mode: target 2000px width -> height should be 1500px
    let (tw, th) = calculate_target_dimensions(orig_w, orig_h, &ResizeConfig::Width(2000));
    assert_eq!(tw, 2000);
    assert_eq!(th, 1500);

    // Height mode: target 1500px height -> width should be 2000px
    let (tw, th) = calculate_target_dimensions(orig_w, orig_h, &ResizeConfig::Height(1500));
    assert_eq!(tw, 2000);
    assert_eq!(th, 1500);

    // Scale mode: 50% scale -> 2000x1500
    let (tw, th) = calculate_target_dimensions(orig_w, orig_h, &ResizeConfig::Scale(50));
    assert_eq!(tw, 2000);
    assert_eq!(th, 1500);

    // Auto mode: original dimensions
    let (tw, th) = calculate_target_dimensions(orig_w, orig_h, &ResizeConfig::Auto);
    assert_eq!(tw, 4000);
    assert_eq!(th, 3000);
}

#[test]
fn test_transparency_flattening_on_pure_white() {
    // Create an image with transparent pixel (alpha = 0) and semi-transparent red
    let mut rgba_buf = ImageBuffer::new(2, 2);
    // Fully transparent
    rgba_buf.put_pixel(0, 0, Rgba([0, 0, 0, 0]));
    // Semi-transparent red (50% red, 50% white background expected)
    rgba_buf.put_pixel(1, 0, Rgba([255, 0, 0, 128]));
    // Solid blue
    rgba_buf.put_pixel(0, 1, Rgba([0, 0, 255, 255]));
    // Solid green
    rgba_buf.put_pixel(1, 1, Rgba([0, 255, 0, 255]));

    let dyn_img = DynamicImage::ImageRgba8(rgba_buf);
    let rgb_buf = flatten_alpha_to_white(&dyn_img);

    // Transparent pixel must become pure white [255, 255, 255], NOT black [0, 0, 0]!
    let p_transparent = rgb_buf.get_pixel(0, 0);
    assert_eq!(p_transparent.0, [255, 255, 255]);

    // Solid blue must stay solid blue
    let p_blue = rgb_buf.get_pixel(0, 1);
    assert_eq!(p_blue.0, [0, 0, 255]);

    // Semi-transparent red: (255 * 0.502) + (255 * 0.498) = 255 red, (0*0.5 + 255*0.5) = 127 for green and blue
    let p_semi = rgb_buf.get_pixel(1, 0);
    assert_eq!(p_semi.0[0], 255);
    assert!(p_semi.0[1] > 120 && p_semi.0[1] < 135);
    assert!(p_semi.0[2] > 120 && p_semi.0[2] < 135);
}

#[test]
fn test_lanczos3_resize() {
    let mut img_buf = ImageBuffer::new(100, 100);
    for (x, y, pixel) in img_buf.enumerate_pixels_mut() {
        *pixel = Rgba([(x * 2) as u8, (y * 2) as u8, 128, 255]);
    }
    let dyn_img = DynamicImage::ImageRgba8(img_buf);

    let resized = resize_image(&dyn_img, 50, 50);
    assert_eq!(resized.dimensions(), (50, 50));
}

#[test]
fn test_multi_format_encoding() {
    let mut img_buf = ImageBuffer::new(64, 64);
    for (_, _, pixel) in img_buf.enumerate_pixels_mut() {
        *pixel = Rgba([100, 150, 200, 255]);
    }
    let dyn_img = DynamicImage::ImageRgba8(img_buf);

    // Test JPG
    let jpg_bytes = encode_image(&dyn_img, &OutputFormat::Jpg, 85).expect("JPEG encoding failed");
    assert!(!jpg_bytes.is_empty());
    assert_eq!(&jpg_bytes[0..2], &[0xFF, 0xD8]); // JPEG magic header

    // Test PNG
    let png_bytes = encode_image(&dyn_img, &OutputFormat::Png, 85).expect("PNG encoding failed");
    assert!(!png_bytes.is_empty());
    assert_eq!(&png_bytes[0..4], &[0x89, 0x50, 0x4E, 0x47]); // PNG magic header

    // Test WebP
    let webp_bytes = encode_image(&dyn_img, &OutputFormat::Webp, 85).expect("WebP encoding failed");
    assert!(!webp_bytes.is_empty());
    assert_eq!(&webp_bytes[0..4], b"RIFF");
    assert_eq!(&webp_bytes[8..12], b"WEBP");

    // Test AVIF
    let avif_bytes = encode_image(&dyn_img, &OutputFormat::Avif, 80).expect("AVIF encoding failed");
    assert!(!avif_bytes.is_empty());
    assert_eq!(&avif_bytes[4..8], b"ftyp");
}

#[test]
fn test_binary_search_target_size() {
    // Generate a 512x512 gradient test pattern
    let mut img_buf = ImageBuffer::new(512, 512);
    for (x, y, pixel) in img_buf.enumerate_pixels_mut() {
        *pixel = Rgba([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8, 255]);
    }
    let dyn_img = DynamicImage::ImageRgba8(img_buf);

    // Full quality JPG is around ~90KB
    let full_jpg = encode_image(&dyn_img, &OutputFormat::Jpg, 95).unwrap();
    let full_size = full_jpg.len() as u64;

    // Set target size to 40 KB (below full size)
    let target_bytes = 40 * 1024;
    let res = optimize_to_target_size(&dyn_img, &OutputFormat::Jpg, target_bytes, 85)
        .expect("Dichotomy optimization failed");

    // Must converge in <= 7 passes
    assert!(res.passes <= 7, "Passes exceeded 7: {}", res.passes);
    assert!(
        res.data.len() as u64 <= target_bytes,
        "Result size {} exceeded target {} (quality: {})",
        res.data.len(),
        target_bytes,
        res.final_quality
    );
    assert!((res.data.len() as u64) < full_size);
}

#[test]
fn test_svg_rendering() {
    let svg_data = r##"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
        <rect width="100" height="100" fill="#3B82F6"/>
        <circle cx="50" cy="50" r="30" fill="#FFFFFF"/>
    </svg>"##;

    let temp_dir = std::env::temp_dir();
    let svg_path = temp_dir.join("test_shrinkr.svg");
    std::fs::write(&svg_path, svg_data).unwrap();

    let decoded = decode_image_file(&svg_path).expect("SVG decoding failed");
    assert_eq!(decoded.original_width, 100);
    assert_eq!(decoded.original_height, 100);
    assert_eq!(decoded.detected_format, "svg");

    let _ = std::fs::remove_file(svg_path);
}

#[test]
fn test_powertoys_resize_modes() {
    use shrinkr_lib::engine::transform::{apply_resize, FitMode};

    // 800x600 image (4:3)
    let img = DynamicImage::new_rgb8(800, 600);

    // Fit mode: box 400x400 -> fits inside at 400x300
    let fit_config = ResizeConfig::Custom {
        width: 400,
        height: 400,
        fit_mode: FitMode::Fit,
        no_upscale: false,
    };
    let fit_img = apply_resize(&img, &fit_config);
    assert_eq!(fit_img.width(), 400);
    assert_eq!(fit_img.height(), 300);

    // Stretch mode: box 400x400 -> exactly 400x400
    let stretch_config = ResizeConfig::Custom {
        width: 400,
        height: 400,
        fit_mode: FitMode::Stretch,
        no_upscale: false,
    };
    let stretch_img = apply_resize(&img, &stretch_config);
    assert_eq!(stretch_img.width(), 400);
    assert_eq!(stretch_img.height(), 400);

    // Fill mode: box 400x400 -> cropped to exactly 400x400
    let fill_config = ResizeConfig::Custom {
        width: 400,
        height: 400,
        fit_mode: FitMode::Fill,
        no_upscale: false,
    };
    let fill_img = apply_resize(&img, &fill_config);
    assert_eq!(fill_img.width(), 400);
    assert_eq!(fill_img.height(), 400);

    // No upscale: box 1200x1200 with no_upscale -> keep 800x600
    let no_up_config = ResizeConfig::Custom {
        width: 1200,
        height: 1200,
        fit_mode: FitMode::Fit,
        no_upscale: true,
    };
    let no_up_img = apply_resize(&img, &no_up_config);
    assert_eq!(no_up_img.width(), 800);
    assert_eq!(no_up_img.height(), 600);
}
