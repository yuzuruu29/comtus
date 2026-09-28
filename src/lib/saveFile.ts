import { isTauri } from "./desktop";

export interface SaveFileType {
  /** Shown in the desktop save dialog, e.g. "JSON". */
  name: string;
  extensions: string[];
  mime: string;
}

function download(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Saves a text file: the native save dialog on desktop, a download in the
 *  browser. False means the student cancelled. */
export async function saveTextFile(text: string, filename: string, type: SaveFileType): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename, filters: [{ name: type.name, extensions: type.extensions }] });
    if (!path) return false;
    await writeTextFile(path, text);
  } else {
    download(text, filename, type.mime);
  }
  return true;
}
