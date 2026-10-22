// Cloudflare Worker — przyjmuje upload zdjęcia i zapisuje do bucketu R2.
// Autoryzacja: token sesji Supabase (Authorization: Bearer ...) weryfikowany w Supabase Auth
// + lista dozwolonych adresów e-mail adminów (ADMIN_EMAILS).

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Rozpoznaje typ po zawartości pliku (magic bytes) — nazwa i nagłówek Content-Type klienta są ignorowane.
function sniffImage(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { type: "image/png", ext: "png" };
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return { type: "image/gif", ext: "gif" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

async function getAdminUser(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${m[1]}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.email) return null;
  const allowed = (env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.length || !allowed.includes(user.email.toLowerCase())) return null;
  return user;
}

export default {
  async fetch(request, env) {
    const origins = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    const originOk = origin && origins.includes(origin);
    const cors = {
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      ...(originOk ? { "Access-Control-Allow-Origin": origin } : {}),
    };
    const reply = (body, status, extra = {}) =>
      new Response(body, { status, headers: { ...cors, "X-Content-Type-Options": "nosniff", ...extra } });
    const json = (obj, status) => reply(JSON.stringify(obj), status, { "Content-Type": "application/json" });

    if (request.method === "OPTIONS") return originOk ? reply(null, 204) : reply("Forbidden origin", 403);
    if (request.method !== "POST") return reply("Method not allowed", 405);
    if (!originOk) return reply("Forbidden origin", 403);

    const user = await getAdminUser(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const declared = parseInt(request.headers.get("Content-Length") || "", 10);
    if (declared > MAX_BYTES) return json({ error: "File too large (max 5 MB)" }, 413);

    // Czytamy strumień z limitem — nie ufamy nagłówkowi Content-Length.
    const chunks = [];
    let total = 0;
    if (request.body) {
      const reader = request.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_BYTES) { await reader.cancel(); return json({ error: "File too large (max 5 MB)" }, 413); }
        chunks.push(value);
      }
    }
    if (total === 0) return json({ error: "Empty file" }, 400);
    const body = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { body.set(c, off); off += c.length; }

    const kind = sniffImage(body);
    if (!kind) return json({ error: "Only JPEG, PNG, GIF and WebP images are allowed" }, 415);

    const key = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${kind.ext}`;
    await env.PANTS_BUCKET.put(key, body, { httpMetadata: { contentType: kind.type } });

    return json({ url: `${env.PUBLIC_BASE_URL}/${key}` }, 200);
  },
};
