#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{
    Menu, MenuBuilder, MenuEvent, MenuItem, PredefinedMenuItem, Submenu, SubmenuBuilder,
};
#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;
use tauri::{App, AppHandle, Emitter, Manager, Wry};

// Early desktop builds registered the website service worker inside the
// native WebView. A stale shell cache can point at removed hashed assets and
// blank the app before React gets a chance to run, so this migration must be
// injected at document start. It removes only Comtus shell caches and service
// worker registrations; IndexedDB and localStorage remain untouched.
const LEGACY_WEB_CACHE_CLEANUP: &str = r#"
;(() => {
  if (window.top !== window) return;
  if (location.hostname !== "tauri.localhost" && location.protocol !== "tauri:") return;
  const marker = "comtus:legacy-sw-cleanup:v1";
  if (sessionStorage.getItem(marker)) return;
  void (async () => {
    const registrations = "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const names = "caches" in window ? await caches.keys() : [];
    const stale = names.filter((name) => name.startsWith("comtus-shell-"));
    if (registrations.length === 0 && stale.length === 0) return;
    await Promise.allSettled([
      ...registrations.map((registration) => registration.unregister()),
      ...stale.map((name) => caches.delete(name)),
    ]);
    const remainingRegistrations = "serviceWorker" in navigator
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const remainingCaches = "caches" in window
      ? (await caches.keys()).filter((name) => name.startsWith("comtus-shell-"))
      : [];
    if (remainingRegistrations.length === 0 && remainingCaches.length === 0) {
      sessionStorage.setItem(marker, "done");
      location.reload();
      return;
    }
    console.error("[Comtus] legacy web cache cleanup did not complete", {
      registrations: remainingRegistrations.length,
      caches: remainingCaches.length,
    });
  })().catch((error) => console.error("[Comtus] legacy web cache cleanup failed", error));
})();
"#;

struct AppMenuItems {
    home: MenuItem<Wry>,
    new_notebook: MenuItem<Wry>,
    import_sources: MenuItem<Wry>,
    settings: MenuItem<Wry>,
    check_updates: MenuItem<Wry>,
    standard: MenuItem<Wry>,
    reading: MenuItem<Wry>,
    writing: MenuItem<Wry>,
    focus: MenuItem<Wry>,
}

fn create_menu_items(app: &App<Wry>) -> tauri::Result<AppMenuItems> {
    Ok(AppMenuItems {
        home: MenuItem::with_id(app, "home", "Home", true, Some("CmdOrCtrl+Shift+H"))?,
        new_notebook: MenuItem::with_id(
            app,
            "new-notebook",
            "New Notebook",
            true,
            Some("CmdOrCtrl+N"),
        )?,
        import_sources: MenuItem::with_id(
            app,
            "import-sources",
            "Import Sources…",
            true,
            Some("CmdOrCtrl+O"),
        )?,
        settings: MenuItem::with_id(app, "settings", "Settings…", true, Some("CmdOrCtrl+,"))?,
        check_updates: MenuItem::with_id(
            app,
            "check-updates",
            "Check for Updates…",
            true,
            None::<&str>,
        )?,
        standard: MenuItem::with_id(app, "layout-standard", "Standard", true, None::<&str>)?,
        reading: MenuItem::with_id(app, "layout-reading", "Reading + Chat", true, None::<&str>)?,
        writing: MenuItem::with_id(app, "layout-writing", "Chat + Studio", true, None::<&str>)?,
        focus: MenuItem::with_id(app, "layout-focus", "Chat Only", true, None::<&str>)?,
    })
}

#[cfg(target_os = "macos")]
fn build_file_menu(app: &App<Wry>, items: &AppMenuItems) -> tauri::Result<Submenu<Wry>> {
    SubmenuBuilder::new(app, "File")
        .item(&items.new_notebook)
        .item(&items.import_sources)
        .separator()
        .item(&items.check_updates)
        .separator()
        .item(&items.settings)
        .build()
}

#[cfg(not(target_os = "macos"))]
fn build_file_menu(app: &App<Wry>, items: &AppMenuItems) -> tauri::Result<Submenu<Wry>> {
    SubmenuBuilder::new(app, "File")
        .item(&items.new_notebook)
        .item(&items.import_sources)
        .separator()
        .item(&items.check_updates)
        .separator()
        .item(&items.settings)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()
}

fn build_edit_menu(app: &App<Wry>) -> tauri::Result<Submenu<Wry>> {
    SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()
}

fn build_view_menu(app: &App<Wry>, items: &AppMenuItems) -> tauri::Result<Submenu<Wry>> {
    SubmenuBuilder::new(app, "View")
        .item(&items.home)
        .separator()
        .item(&items.standard)
        .item(&items.reading)
        .item(&items.writing)
        .item(&items.focus)
        .build()
}

#[cfg(target_os = "macos")]
fn build_native_menu(
    app: &App<Wry>,
    file: &Submenu<Wry>,
    edit: &Submenu<Wry>,
    view: &Submenu<Wry>,
) -> tauri::Result<Menu<Wry>> {
    let app_menu = SubmenuBuilder::new(app, "Comtus")
        .about(None)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;
    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .fullscreen()
        .separator()
        .close_window()
        .build()?;
    MenuBuilder::new(app)
        .items(&[&app_menu, file, edit, view, &window_menu])
        .build()
}

#[cfg(not(target_os = "macos"))]
fn build_native_menu(
    app: &App<Wry>,
    file: &Submenu<Wry>,
    edit: &Submenu<Wry>,
    view: &Submenu<Wry>,
) -> tauri::Result<Menu<Wry>> {
    MenuBuilder::new(app).items(&[file, edit, view]).build()
}

fn install_app_menu(app: &App<Wry>) -> tauri::Result<()> {
    let items = create_menu_items(app)?;
    let file = build_file_menu(app, &items)?;
    let edit = build_edit_menu(app)?;
    let view = build_view_menu(app, &items)?;
    app.set_menu(build_native_menu(app, &file, &edit, &view)?)?;
    Ok(())
}

fn focus_main_window(app: &AppHandle<Wry>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.unminimize() {
            eprintln!("failed to unminimize the existing Comtus window: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("failed to focus the existing Comtus window: {error}");
        }
    }
}

fn configure_main_window(app: &App<Wry>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "windows")]
        window.set_decorations(false)?;
        #[cfg(target_os = "macos")]
        {
            window.set_title_bar_style(TitleBarStyle::Overlay)?;
            window.set_title("")?;
        }
    }
    Ok(())
}

fn emit_menu_event(app: &AppHandle<Wry>, event: MenuEvent) {
    if let Err(error) = app.emit(event.id().0.as_str(), ()) {
        eprintln!("failed to emit native menu event {}: {error}", event.id().0);
    }
}

fn main() {
    tauri::Builder::default()
        .append_invoke_initialization_script(LEGACY_WEB_CACHE_CLEANUP)
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            install_app_menu(app)?;
            configure_main_window(app)?;
            Ok(())
        })
        .on_menu_event(emit_menu_event)
        .run(tauri::generate_context!())
        .expect("error while running Comtus");
}
