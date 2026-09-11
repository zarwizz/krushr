pub mod commands;
pub mod engine;

use commands::{open_folder, process_batch, scan_paths};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_paths,
            process_batch,
            open_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running shrinkr application");
}
