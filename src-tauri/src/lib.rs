pub mod commands;
pub mod engine;

use commands::{get_batch_thumbnails, get_thumbnails, open_folder, process_batch, scan_paths};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            get_thumbnails,
            get_batch_thumbnails,
            process_batch,
            open_folder
        ])
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(img) = image::load_from_memory(include_bytes!("../icons/icon.png")) {
                    let rgba = img.to_rgba8();
                    let (w, h) = rgba.dimensions();
                    let icon = tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                    let _ = window.set_icon(icon);
                } else if let Some(icon) = app.default_window_icon() {
                    let _ = window.set_icon(icon.clone());
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running krushr application");
}