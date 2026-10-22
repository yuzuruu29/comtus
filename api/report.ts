export const config = { runtime: "edge" };

const MAX_BYTES = 4 * 1024;

/** Client error sink. Logs to the function log and drops anything that looks like a secret. */
export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST,OPTIONS" },
    });
  }
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return new Response(null, { status: 413 });
  if (/sk-|comtus-pass-|Bearer /i.test(text)) {
    console.error("client error: redacted");
  } else {
    console.error("client error:", text);
  }
  return new Response(null, { status: 204, headers: { "access-control-allow-origin": "*" } });
}
