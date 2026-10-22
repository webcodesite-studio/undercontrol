// Cloudflare Worker — przyjmuje upload zdjęcia i zapisuje do bucketu R2.
// Chronione prostym sekretem w nagłówku (ustawianym w panelu admina).

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Upload-Secret, X-File-Name",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

    const secret = request.headers.get("X-Upload-Secret");
    if (!secret || secret !== env.UPLOAD_SECRET) {
      return new Response("Unauthorized", { status: 401, headers: cors });
    }

    const fileName = request.headers.get("X-File-Name") || "upload";
    const contentType = request.headers.get("Content-Type") || "application/octet-stream";
    const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
    const key = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const body = await request.arrayBuffer();
    await env.PANTS_BUCKET.put(key, body, { httpMetadata: { contentType } });

    const publicUrl = `${env.PUBLIC_BASE_URL}/${key}`;
    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};
