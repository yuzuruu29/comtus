#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

fn main() {
    tauri::Builder::default()
        // Must register first — a second launch focuses the existing window.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let new_nb = MenuItem::with_id(app, "new-notebook", "New Notebook", true, Some("CmdOrCtrl+N"))?;
            let settings = MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?;
            let check_updates =
                MenuItem::with_id(app, "check-updates", "Check for Updates…", true, None::<&str>)?;
            let std = MenuItem::with_id(app, "layout-standard", "Standard", true, None::<&str>)?;
            let reading = MenuItem::with_id(app, "layout-reading", "Reading + Chat", true, None::<&str>)?;
            let writing = MenuItem::with_id(app, "layout-writing", "Chat + Studio", true, None::<&str>)?;
            let focus = MenuItem::with_id(app, "layout-focus", "Chat Only", true, None::<&str>)?;

            // Quit lives in the macOS app menu; other platforms get it in File.
            #[cfg(target_os = "macos")]
            let file = SubmenuBuilder::new(app, "File")
                .item(&new_nb)
                .separator()
                .item(&check_updates)
                .separator()
                .item(&settings)
                .build()?;
            #[cfg(not(target_os = "macos"))]
            let file = SubmenuBuilder::new(app, "File")
                .item(&new_nb)
                .separator()
                .item(&check_updates)
                .separator()
                .item(&settings)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
                .build()?;

            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view = SubmenuBuilder::new(app, "View")
                .item(&std)
                .item(&reading)
                .item(&writing)
                .item(&focus)
                .build()?;

            #[cfg(target_os = "macos")]
            let app_menu = SubmenuBuilder::new(app, "Comtus")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            #[cfg(target_os = "macos")]
            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .separator()
                .fullscreen()
                .separator()
                .close_window()
                .build()?;

            #[cfg(target_os = "macos")]
            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &file, &edit, &view, &window_menu])
                .build()?;
            #[cfg(not(target_os = "macos"))]
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
