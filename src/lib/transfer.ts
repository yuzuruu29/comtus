import { buildNotebookPayload, parseBackupPayload, type BackupPayload } from "./backup";
import { mergeNotebookPayload, type MergeResult } from "./notebookMerge";

/**
 * Sending a notebook to another device without an account.
 *
 * A transfer code is 24 characters of Crockford base32: the first 8 name
 * the upload on the relay, the other 16 (80 random bits) never leave the
 * two devices and derive the AES-GCM key. The notebook is compressed and
 * sealed before upload, so the relay (api/relay.ts) only ever holds text
 * it cannot read, for an hour at most.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const CODE_CHARS = 24;
const ID_CHARS = 8;
/** Mirrors api/relay.ts. */
export const PART_CHARS = 700_000;
export const MAX_PARTS = 32;

export class TransferError extends Error {}

/* ── Codes ────────────────────────────────────────────────── */

export function newTransferCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_CHARS));
  // 256 is a multiple of 32, so every character is equally likely.
  return Array.from(bytes, (b) => ALPHABET[b & 31]).join("");
}

/** "7K3F-QX9P-M2RT-8WZL-4HCN-6VBD", easy to read aloud and type. */
export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join("-");

/** A typed code or a pasted link, normalised; null when it isn't one.
 *  Crockford reads O as 0 and I or L as 1, so typos in those still work. */
export function parseTransferCode(input: string): string | null {
  const fromLink = /receive=([0-9A-Za-z-]+)/.exec(input)?.[1];
  const code = (fromLink ?? input)
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return code.length === CODE_CHARS && [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}

/** Where the other device opens the transfer: the web app, with the code
 *  after "#" so it never reaches any server. */
export function transferLink(code: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/studio#receive=${code}`;
}

export const transferId = (code: string) => code.slice(0, ID_CHARS);

/* ── Sealing ──────────────────────────────────────────────── */

const encoder = new TextEncoder();

async function keyFor(code: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(code), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: encoder.encode("comtus-transfer-v1"), info: encoder.encode(transferId(code)) },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compressed, then sealed with AES-GCM: IV followed by ciphertext. */
export async function seal(plain: string, code: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const packed = await pipe(encoder.encode(plain), new CompressionStream("gzip"));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(code), packed as BufferSource));
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return toBase64Url(out);
}

export async function unseal(text: string, code: string): Promise<string> {
  const bytes = fromBase64Url(text);
  let packed: ArrayBuffer;
  try {
    packed = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, await keyFor(code), bytes.subarray(12));
  } catch {
    throw new TransferError("That code doesn't match this transfer. Check it and try again.");
  }
  return new TextDecoder().decode(await pipe(new Uint8Array(packed), new DecompressionStream("gzip")));
}

export function splitParts(text: string, size = PART_CHARS): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts;
}

/* ── Relay ────────────────────────────────────────────────── */

export const relayOrigin = () =>
  ((import.meta.env.VITE_API_ORIGIN as string | undefined) || (typeof window !== "undefined" ? window.location.origin : "")).replace(
    /\/+$/,
    "",
  );

async function relay(method: string, query: string, body?: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${relayOrigin()}/api/relay?${query}`, {
      method,
      body,
      headers: body === undefined ? undefined : { "content-type": "text/plain" },
    });
  } catch {
    throw new TransferError("The relay couldn't be reached. Check your connection and try again.");
  }
  if (!res.ok && res.status !== 409) {
    const message = await res
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined);
    throw new TransferError(message ?? `The relay answered ${res.status}.`);
  }
  return res;
}

export interface SentNotebook {
  code: string;
  expiresAt: number;
}

export type Progress = (done: number, total: number) => void;

/** Seals a notebook and uploads it. Chunks aren't sent: the receiver
 *  rebuilds them from the sources, which halves the upload. */
export async function sendNotebook(notebookId: string, onProgress?: Progress): Promise<SentNotebook> {
  const payload = await buildNotebookPayload(notebookId);
  delete payload.data?.chunks;
  const plain = JSON.stringify(payload);

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newTransferCode();
    const parts = splitParts(await seal(plain, code));
    if (parts.length > MAX_PARTS) {
      throw new TransferError("This notebook is too large to send this way. Export it as a file instead.");
    }
    const id = transferId(code);
    const size = parts.reduce((n, p) => n + p.length, 0);
    const created = await relay("POST", `id=${id}&parts=${parts.length}&size=${size}`);
    if (created.status === 409) continue; // a code collision: pick another
    const { expiresAt } = (await created.json()) as { expiresAt: number };
    for (const [i, part] of parts.entries()) {
      onProgress?.(i, parts.length);
      await relay("PUT", `id=${id}&part=${i}`, part);
    }
    onProgress?.(parts.length, parts.length);
    return { code, expiresAt };
  }
  throw new TransferError("The relay is busy. Try again in a moment.");
}

/** Withdraws a transfer nobody will pick up. Best effort. */
export async function forgetTransfer(code: string): Promise<void> {
  await relay("DELETE", `id=${transferId(code)}`).catch(() => undefined);
}

/** Downloads, opens and merges a notebook sent from another device, then
 *  asks the relay to forget it. */
export async function receiveNotebook(input: string, onProgress?: Progress): Promise<MergeResult> {
  const code = parseTransferCode(input);
  if (!code) throw new TransferError("That doesn't look like a transfer code. It has 24 letters and numbers.");
  const id = transferId(code);
  const status = (await (await relay("GET", `id=${id}`)).json()) as { parts: number; ready: boolean };
  if (!status.ready) throw new TransferError("The other device is still sending. Try again in a moment.");

  const parts: string[] = [];
  for (let i = 0; i < status.parts; i++) {
    onProgress?.(i, status.parts);
    parts.push(await (await relay("GET", `id=${id}&part=${i}`)).text());
  }
  onProgress?.(status.parts, status.parts);

  let payload: BackupPayload;
  try {
    payload = parseBackupPayload(await unseal(parts.join(""), code));
  } catch (err) {
    throw err instanceof TransferError ? err : new TransferError("What arrived isn't a Comtus notebook.");
  }
  const result = await mergeNotebookPayload(payload);
  await relay("DELETE", `id=${id}`).catch(() => undefined);
  return result;
}
