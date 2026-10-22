// Cloudflare Worker — odbiera wiadomość z formularza w PANELU ADMINA i wysyła ją na Discord przez webhook.
// Dostęp tylko z tokenem sesji Supabase admina (jak r2-worker): odwiedzający strony nie mogą z niego korzystać.
// Adres webhooka jest TYLKO tutaj (sekret DISCORD_WEBHOOK_URL) — nigdy w kodzie strony.

const LIMITS = { name: 60, contact: 120, message: 1000, minMessage: 10 };
const RATE = { max: 3, windowSec: 600 };   // 3 wiadomości / 10 min / IP
const MAX_BODY = 8 * 1024;
const memHits = new Map();                 // zapas, gdy nie ma KV (per instancja Workera)

// Neutralizuje formatowanie Discorda i pingi (@everyone, <@id>, linki-embedy)
const clean = s => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
  .replace(/([\\*_`~|>])/g, "\\$1").replace(/@/g, "@\u200b").trim();

async function getAdminUser(request, env) {
  const m = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${m[1]}`, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.email) return null;
  const allowed = (env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(user.email.toLowerCase()) ? user : null;
}

async function rateLimited(env, ip) {
  const key = `rl:${ip}`;
  if (env.RATE_KV) {
    const n = parseInt(await env.RATE_KV.get(key) || "0", 10);
    if (n >= RATE.max) return true;
    await env.RATE_KV.put(key, String(n + 1), { expirationTtl: RATE.windowSec });
    return false;
  }
  const now = Date.now(), hits = (memHits.get(key) || []).filter(t => now - t < RATE.windowSec * 1000);
  if (hits.length >= RATE.max) { memHits.set(key, hits); return true; }
  hits.push(now); memHits.set(key, hits);
  if (memHits.size > 5000) memHits.clear();
  return false;
}

export default {
  async fetch(request, env) {
    const origins = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin");
    const originOk = !!origin && origins.includes(origin);
    const cors = {
      "Vary": "Origin",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      ...(originOk ? { "Access-Control-Allow-Origin": origin } : {}),
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
      status, headers: { ...cors, "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" },
    });

    if (request.method === "OPTIONS") return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!originOk) return json({ error: "Forbidden origin" }, 403);
    if (!(await getAdminUser(request, env))) return json({ error: "Unauthorized" }, 401);
    if (!env.DISCORD_WEBHOOK_URL) return json({ error: "Not configured" }, 500);
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "Expected JSON" }, 415);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: "Request too large" }, 413);
    let body; try { body = JSON.parse(raw); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body !== "object") return json({ error: "Invalid body" }, 400);

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const contact = typeof body.contact === "string" ? body.contact.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!name || name.length > LIMITS.name) return json({ error: `Podaj imię lub nick (maks. ${LIMITS.name} znaków).` }, 400);
    if (!contact || contact.length > LIMITS.contact) return json({ error: `Podaj e-mail lub inny kontakt (maks. ${LIMITS.contact} znaków).` }, 400);
    if (message.length < LIMITS.minMessage || message.length > LIMITS.message)
      return json({ error: `Wiadomość musi mieć od ${LIMITS.minMessage} do ${LIMITS.message} znaków.` }, 400);
    if ((message.match(/https?:\/\//gi) || []).length > 2) return json({ error: "Zbyt wiele linków w wiadomości." }, 400);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (await rateLimited(env, ip)) return json({ error: "Zbyt wiele wiadomości. Spróbuj ponownie za kilka minut." }, 429);

    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Formularz kontaktowy",
        allowed_mentions: { parse: [] },
        embeds: [{
          title: "Nowa wiadomość ze strony",
          color: 0xd4ff3f,
          fields: [
            { name: "Od", value: clean(name).slice(0, 200) || "-" },
            { name: "Kontakt", value: clean(contact).slice(0, 300) || "-" },
            { name: "Wiadomość", value: clean(message).slice(0, 1024) },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
    if (!res.ok) return json({ error: "Nie udało się wysłać wiadomości. Spróbuj później." }, 502);
    return json({ ok: true });
  },
};
