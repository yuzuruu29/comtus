// Comtus desktop shell — wraps the same studio the web serves.
// All intelligence and data stay in the webview + IndexedDB; the Rust
// side is deliberately thin.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Comtus");
}
