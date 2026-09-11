use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

use crate::engine::decoder::decode_image_file;
use crate::engine::encoder::{encode_image, OutputFormat};
use crate::engine::optimizer::optimize_to_target_size;
use crate::engine::transform::{apply_resize, FitMode, ResizeConfig};
use crate::engine::types::{BatchCompletePayload, BatchConfig, ProgressPayload};

pub fn run_batch(app: AppHandle, config: BatchConfig) {
    std::thread::spawn(move || {
        let start_time = Instant::now();
        let total = config.files.len();

        let success_count = Arc::new(AtomicUsize::new(0));
        let error_count = Arc::new(AtomicUsize::new(0));
        let processed_counter = Arc::new(AtomicUsize::new(0));
        let total_original_bytes = Arc::new(AtomicU64::new(0));
        let total_new_bytes = Arc::new(AtomicU64::new(0));
        let last_output_path = Arc::new(Mutex::new(None::<String>));

        let format = OutputFormat::from_str(&config.format);
        let resize_config = match config.resize_mode.as_str() {
            "custom" => {
                let w = config.resize_width.unwrap_or(config.resize_value).max(1);
                let h = config.resize_height.unwrap_or(config.resize_value).max(1);
                let fit = match config.fit_mode.as_deref() {
                    Some(m) => FitMode::from_str(m),
                    None => FitMode::Fit,
                };
                let no_up = config.no_upscale.unwrap_or(false);
                ResizeConfig::Custom {
                    width: w,
                    height: h,
                    fit_mode: fit,
                    no_upscale: no_up,
                }
            }
            "width" => ResizeConfig::Width(config.resize_value),
            "height" => ResizeConfig::Height(config.resize_value),
            "scale" => ResizeConfig::Scale(config.resize_value),
            _ => ResizeConfig::Auto,
        };

        config.files.par_iter().for_each(|file_path_str| {
            let file_path = Path::new(file_path_str);
            let file_id = file_path_str.clone();

            let orig_size = fs::metadata(file_path)
                .map(|m| m.len())
                .unwrap_or(0);

            // Notify UI: processing started
            let current_idx = processed_counter.fetch_add(1, Ordering::Relaxed);
            let _ = app.emit(
                "shrinkr://batch-progress",
                ProgressPayload {
                    index: current_idx + 1,
                    total,
                    id: file_id.clone(),
                    path: file_path_str.clone(),
                    status: "processing".to_string(),
                    original_size: orig_size,
                    new_size: None,
                    output_path: None,
                    output_width: None,
                    output_height: None,
                    error: None,
                },
            );

            // Process image
            match process_single_image(
                file_path,
                &format,
                &resize_config,
                config.quality,
                config.target_size_kb,
                config.output_dir.as_deref(),
                config.suffix.as_deref(),
                config.overwrite_source,
            ) {
                Ok((output_path, new_size, out_w, out_h)) => {
                    success_count.fetch_add(1, Ordering::Relaxed);
                    total_original_bytes.fetch_add(orig_size, Ordering::Relaxed);
                    total_new_bytes.fetch_add(new_size, Ordering::Relaxed);

                    let out_path_str = output_path.to_string_lossy().to_string();
                    if let Ok(mut last_path_lock) = last_output_path.lock() {
                        *last_path_lock = Some(out_path_str.clone());
                    }

                    let _ = app.emit(
                        "shrinkr://batch-progress",
                        ProgressPayload {
                            index: current_idx + 1,
                            total,
                            id: file_id,
                            path: file_path_str.clone(),
                            status: "success".to_string(),
                            original_size: orig_size,
                            new_size: Some(new_size),
                            output_path: Some(out_path_str),
                            output_width: Some(out_w),
                            output_height: Some(out_h),
                            error: None,
                        },
                    );
                }
                Err(err) => {
                    error_count.fetch_add(1, Ordering::Relaxed);

                    let _ = app.emit(
                        "shrinkr://batch-progress",
                        ProgressPayload {
                            index: current_idx + 1,
                            total,
                            id: file_id,
                            path: file_path_str.clone(),
                            status: "error".to_string(),
                            original_size: orig_size,
                            new_size: None,
                            output_path: None,
                            output_width: None,
                            output_height: None,
                            error: Some(err),
                        },
                    );
                }
            }
        });

        // Batch finished: Emit completion event
        let duration = start_time.elapsed().as_millis() as u64;
        let final_last_path = last_output_path.lock().ok().and_then(|guard| guard.clone());

        let _ = app.emit(
            "shrinkr://batch-complete",
            BatchCompletePayload {
                total_files: total,
                success_count: success_count.load(Ordering::Relaxed),
                error_count: error_count.load(Ordering::Relaxed),
                total_original_bytes: total_original_bytes.load(Ordering::Relaxed),
                total_new_bytes: total_new_bytes.load(Ordering::Relaxed),
                duration_ms: duration,
                last_output_path: final_last_path,
            },
        );
    });
}

fn process_single_image(
    input_path: &Path,
    format: &OutputFormat,
    resize_config: &ResizeConfig,
    quality: u8,
    target_size_kb: Option<u64>,
    custom_output_dir: Option<&str>,
    custom_suffix: Option<&str>,
    overwrite_source: bool,
) -> Result<(PathBuf, u64, u32, u32), String> {
    // 1. Decode
    let decoded = decode_image_file(input_path)?;

    // 2. Resize
    let resized_img = apply_resize(&decoded.image, resize_config);

    // 3. Encode & Optimize
    let final_bytes = if let Some(target_kb) = target_size_kb {
        let target_bytes = target_kb * 1024;
        let opt_res = optimize_to_target_size(&resized_img, format, target_bytes, quality)?;
        opt_res.data
    } else {
        encode_image(&resized_img, format, quality)?
    };

    // 4. Determine Destination Directory:
    // If a custom output dir is provided and non-empty, use it.
    // Otherwise, use the input file's parent directory (safe for multi-folder batches!).
    let dest_dir = match custom_output_dir {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir.trim()),
        _ => input_path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from(".")),
    };

    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // 5. Determine Destination Filename & Prevent Accidental Overwrite
    let file_stem = input_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image");

    let ext = format.extension();
    let suffix = custom_suffix.unwrap_or("_shrinkr");

    let output_file_path = if overwrite_source {
        // Direct overwrite requested by user
        dest_dir.join(format!("{}.{}", file_stem, ext))
    } else {
        let direct_candidate = dest_dir.join(format!("{}.{}", file_stem, ext));
        // If direct candidate matches the source file OR already exists on disk, append suffix
        if direct_candidate == input_path || direct_candidate.exists() {
            let suffixed_name = format!("{}{}.{}", file_stem, suffix, ext);
            let suffixed_path = dest_dir.join(&suffixed_name);

            // If even suffixed file already exists, find a unique index
            if suffixed_path.exists() && suffixed_path != input_path {
                let mut counter = 1;
                loop {
                    let numbered_path = dest_dir.join(format!("{}{}_{}.{}", file_stem, suffix, counter, ext));
                    if !numbered_path.exists() {
                        break numbered_path;
                    }
                    counter += 1;
                }
            } else {
                suffixed_path
            }
        } else {
            direct_candidate
        }
    };

    // 6. Write to disk
    fs::write(&output_file_path, &final_bytes)
        .map_err(|e| format!("Failed to write output file {}: {}", output_file_path.display(), e))?;

    let file_size = final_bytes.len() as u64;
    let (out_w, out_h) = (resized_img.width(), resized_img.height());
    Ok((output_file_path, file_size, out_w, out_h))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_process_heic() {
        let input_path = Path::new(r"C:\Users\gilbe\Downloads\IMG_1821.HEIC");
        if !input_path.exists() {
            return;
        }

        let temp_dir = std::env::temp_dir().join("shrinkr_batch_test");
        let _ = fs::create_dir_all(&temp_dir);

        let res = process_single_image(
            input_path,
            &OutputFormat::Jpg,
            &ResizeConfig::Auto,
            85,
            None,
            Some(temp_dir.to_str().unwrap()),
            Some("_test"),
            false,
        );

        assert!(res.is_ok(), "Expected success but got: {:?}", res.err());
        let (out_path, new_size, out_w, out_h) = res.unwrap();
        assert!(out_path.exists());
        assert!(new_size > 0);
        assert_eq!(out_w, 2316);
        assert_eq!(out_h, 3088);

        // Verify that the output is a valid JPEG
        let img = image::open(&out_path).expect("valid jpeg");
        assert_eq!(img.width(), 2316);
        assert_eq!(img.height(), 3088);

        // Cleanup
        let _ = fs::remove_file(out_path);
        let _ = fs::remove_dir_all(temp_dir);
    }
}

