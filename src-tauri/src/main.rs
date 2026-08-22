#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let new_nb = MenuItem::with_id(app, "new-notebook", "New Notebook", true, Some("CmdOrCtrl+N"))?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
            let std = MenuItem::with_id(app, "layout-standard", "Standard", true, None::<&str>)?;
            let reading = MenuItem::with_id(app, "layout-reading", "Reading + Chat", true, None::<&str>)?;
            let writing = MenuItem::with_id(app, "layout-writing", "Chat + Studio", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "layout-focus", "Chat Only", true, None::<&str>)?;

            let file = SubmenuBuilder::new(app, "File")
                .item(&new_nb)
                .separator()
                .item(&settings)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            let view = SubmenuBuilder::new(app, "View")
                .item(&std)
                .item(&reading)
                .item(&writing)
                .item(&focus)
                .build()?;

            let menu = MenuBuilder::new(app).items(&[&file, &edit, &view]).build()?;
            app.set_menu(menu)?;

            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "windows")]
                let _ = window.set_decorations(false);
                #[cfg(target_os = "macos")]
                {
                    let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
                    let _ = window.set_title("");
                }
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let _ = app.emit(event.id().0.as_str(), ());
        })
        .run(tauri::generate_context!())
        .expect("error while running Comtus");
}
