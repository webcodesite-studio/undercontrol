"use strict";
// Logika zamówień dla funkcji serverless Vercel (api/submit-order.js, api/order-admin.js). Czysty Node.js (>=18), bez zależności.
//
// Zmienne środowiskowe (Vercel → Project → Settings → Environment Variables) — NIGDY nie trafiają do przeglądarki:
//   FORMSPREE_ENDPOINT   adres formularza Formspree, np. https://formspree.io/f/abcdwxyz     (e-mail z zamówieniem)
//   DISCORD_WEBHOOK_URL  webhook kanału Discord                                              (opcjonalnie)
//   ORDER_NOTIFY_MODE    email | discord | both — wartość awaryjna; główny wybór robi właściciel w panelu (domyślnie both)
//   ORDER_TEST_MODE      true = tryb testowy: NICZEGO nie wysyła i wyraźnie to komunikuje (do testów przed dodaniem sekretów)
//   SUPABASE_URL, SUPABASE_ANON_KEY   (opcjonalnie) odczyt katalogu (ceny/stany), kodów rabatowych i wyboru metody powiadamiania
//   SUPABASE_SERVICE_KEY (opcjonalnie) liczenie użyć kodów rabatowych (licznik, nie dane zamówień)
//   ORDER_SIGNING_SECRET (opcjonalnie) podpis bloku Base64 — dekoder w panelu wykryje zmienione dane
//   ADMIN_EMAILS         e-maile adminów (po przecinku) uprawnionych do dekodera i testów w panelu
//   ALLOWED_ORIGINS      (opcjonalnie) dodatkowe adresy stron (po przecinku), gdy strona jest hostowana poza tą domeną
//   ORDER_RATE_LIMIT     (opcjonalnie) maks. zamówień z jednego IP na 10 min (domyślnie 6)
// NIC nie jest zapisywane: ani SQL, ani KV, ani żadna kolejka — zamówienie istnieje tylko w wysłanej wiadomości.

const crypto = require("node:crypto");

const MAX_BODY = 20 * 1024;
const RATE = { max: 6, windowMs: 10 * 60 * 1000 };
const RATE_ADMIN = { max: 60, windowMs: 10 * 60 * 1000 };
const MAX_HOLES = 6, MAX_ITEMS = 30, MAX_QTY = 50, MAX_B64 = 30000;
const STATUS = "Awaiting Instagram confirmation";
const TYPE_LABEL = { hat: "Hats", pants: "Regular pants", custom: "Custom pants" };
const DELIVERY = { shipping: "Shipping", pickup: "Personal pickup" };
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const IG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9])?$/;
const SUB_RE = /^[A-Za-z0-9-]{8,64}$/;
const ORDER_NO_RE = /^ORD-\d{8}-\d{6}-[0-9A-HJKMNP-TV-Z]{4}$/;
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const FORMSPREE_RE = /^https:\/\/formspree\.io\/f\/[A-Za-z0-9_-]+$/;
const DISCORD_RE = /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\//i;

const str = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
const num = v => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : NaN);
const pln = n => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
const at = ig => "@" + String(ig).replace(/^@/, "");
const HttpErr = (status, message) => Object.assign(new Error(message), { status });
const unavailable = e => e && (e.status === 502 || e.status === 503);

// ---------- czas i numer zamówienia (bez licznika i bez bazy) ----------
const warsaw = (d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(d).map(x => [x.type, x.value]));
  return { ymd: `${p.year}${p.month}${p.day}`, hms: `${p.hour}${p.minute}${p.second}` };
};
const niceDate = d => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Warsaw" }).format(d) + " (Europe/Warsaw)";
// ORD-RRRRMMDD-GGMMSS-XXXX: data + godzina z sekundami + 4 losowe znaki (kolizja = ta sama sekunda i te same 4 znaki, ~1 do miliona)
function newOrderNumber(now = new Date(), rnd = crypto.randomBytes(4)) {
  const w = warsaw(now);
  return `ORD-${w.ymd}-${w.hms}-${[...rnd].map(b => B32[b & 31]).join("")}`;
}

// ---------- Base64 (kodowanie, NIE szyfrowanie) ----------
const toB64 = obj => Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
function fromB64(input) {
  const clean = String(input || "").replace(/\s+/g, "");
  if (!clean) throw HttpErr(400, "Wklej blok Base64 z e-maila z zamówieniem.");
  if (clean.length > MAX_B64) throw HttpErr(400, "Dane są zbyt długie.");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean) || clean.length % 4 === 1) throw HttpErr(400, "To nie jest poprawny Base64 (niedozwolone znaki lub ucięte dane).");
  let json;
  try { json = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(clean, "base64")); }
  catch { throw HttpErr(400, "Dane Base64 są uszkodzone (nie da się ich odczytać)."); }
  try { return JSON.parse(json); } catch { throw HttpErr(400, "Dane Base64 są uszkodzone (to nie jest zamówienie)."); }
}
const hmacHex = (secret, text) => crypto.createHmac("sha256", secret).update(text).digest("hex");

function cleanRecord(o) {
  if (!o || typeof o !== "object" || !ORDER_NO_RE.test(String(o.number || ""))) throw HttpErr(400, "Dane nie wyglądają na zamówienie z tego sklepu.");
  if (!Array.isArray(o.items) || !o.items.length || o.items.length > MAX_ITEMS) throw HttpErr(400, "Dane zamówienia są niekompletne.");
  const items = o.items.map(i => {
    const type = ["hat", "pants", "custom"].includes(i?.type) ? i.type : null;
    if (!type) throw HttpErr(400, "Dane zamówienia są uszkodzone.");
    const out = { type, product_id: str(i.product_id, 30), name: str(i.name, 120), category: str(i.category, 80), color: str(i.color, 60), size: str(i.size, 30),
      qty: Math.max(1, Math.min(MAX_QTY, Math.floor(Number(i.qty)) || 1)), unit: num(i.unit) || 0, line_total: num(i.line_total) || 0 };
    if (type === "custom") {
      out.cut = str(i.cut, 60); out.measurements = str(i.measurements, 300); out.notes = str(i.notes, 500); out.hole_price = num(i.hole_price) || 0;
      out.holes = (Array.isArray(i.holes) ? i.holes : []).slice(0, MAX_HOLES).map(h => ({ style: str(h?.style, 40), x: num(h?.x) || 0, y: num(h?.y) || 0, w: num(h?.w) || 0, h: num(h?.h) || 0 }));
    }
    return out;
  });
  return { number: o.number, created: str(o.created, 40), instagram: str(o.instagram, 30), delivery: DELIVERY[o.delivery] ? o.delivery : "shipping", items,
    subtotal: num(o.subtotal) || 0, discount_code: str(o.discount_code, 40) || null, discount_amount: num(o.discount_amount) || 0, total: num(o.total) || 0,
    notes: str(o.notes, 500), price_check: o.price_check === "unverified" ? "unverified" : "server", discount_check: o.discount_check === "unverified" ? "unverified" : "server", status: STATUS };
}
const orderForB64 = o => ({ number: o.number, created: o.created, instagram: o.instagram, delivery: o.delivery, items: o.items, subtotal: o.subtotal,
  discount_code: o.discount_code, discount_amount: o.discount_amount, total: o.total, notes: o.notes, price_check: o.price_check, discount_check: o.discount_check });

// ---------- Supabase: tylko ODCZYT katalogu / kodów (i opcjonalny licznik użyć kodu) ----------
async function rest(env, path, { method = "GET", body, key } = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) throw HttpErr(503, "Katalog nie jest skonfigurowany.");
  const k = key || env.SUPABASE_ANON_KEY;
  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, headers: { apikey: k, Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(4000) });
  } catch { throw HttpErr(502, "Katalog jest niedostępny."); }
  if (!res.ok) throw HttpErr(502, "Katalog jest niedostępny.");
  return res.status === 204 ? null : res.json();
}
const normVariant = x => ({ name: str(x?.name, 60) || "Standard", active: x?.active !== false,
  price: x?.price === null || x?.price === undefined || x?.price === "" ? null : num(x.price),
  sizes: (Array.isArray(x?.sizes) ? x.sizes : []).map(s => ({ size: str(s?.size, 30), stock: Math.max(0, Math.floor(Number(s?.stock) || 0)) })) });
function normItem(h) {
  let vs = Array.isArray(h.variants) ? h.variants : [];
  if (!vs.length) vs = [{ name: "", sizes: [] }];
  return { id: h.id, sku: str(h.sku, 20), name: str(h.name, 120), category: str(h.category, 40), price: num(h.price) || 0, variants: vs.map(normVariant),
    live: h.active !== undefined ? h.active !== false : (h.available !== false && !h.archived) };
}

// ---------- tryb powiadamiania (wybór właściciela w panelu) ----------
const testMode = env => /^(1|true|yes|on)$/i.test(String(env.ORDER_TEST_MODE || ""));
const formspreeOn = env => FORMSPREE_RE.test(String(env.FORMSPREE_ENDPOINT || ""));
const discordOn = env => DISCORD_RE.test(String(env.DISCORD_WEBHOOK_URL || "")) || /^https:\/\/discord\.test\//.test(String(env.DISCORD_WEBHOOK_URL || ""));
async function notifyMode(env) {
  try {
    const row = (await rest(env, "site_settings?select=order_email_enabled,order_discord_enabled&id=eq.1"))?.[0];
    const e = !!row?.order_email_enabled, d = !!row?.order_discord_enabled;
    if (row && (e || d)) return e && d ? "both" : e ? "email" : "discord";
  } catch { /* baza niedostępna — wartość z env */ }
  const m = String(env.ORDER_NOTIFY_MODE || "").toLowerCase();
  return ["email", "discord", "both"].includes(m) ? m : "both";
}
// gotowość: kanał WYMAGANY (e-mail, jeśli jest w wyborze; inaczej Discord) musi być skonfigurowany
const requiredReady = (env, mode) => (mode === "discord" ? discordOn(env) : formspreeOn(env));

// ---------- walidacja koszyka ----------
function parseLines(o) {
  const lines = [];
  for (const i of o.items) {
    const type = ["hat", "pants", "custom"].includes(i?.type) ? i.type : null;
    const qty = Number(i?.qty);
    if (!type || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw HttpErr(400, "Nieprawidłowa pozycja zamówienia.");
    if (type !== "custom" && !ID_RE.test(String(i.id || ""))) throw HttpErr(400, "Nieprawidłowa pozycja zamówienia.");
    lines.push({ type, qty, id: String(i.id || ""), color: str(i.color, 60), size: str(i.size, 30), cut: str(i.cut, 60), holes: i.holes, notes: str(i.notes, 500), measurements: str(i.measurements, 300),
      c: { name: str(i.name, 120), sku: str(i.sku, 20), category: str(i.category, 80), unit: num(i.unit_price), hole_price: num(i.hole_price) } });
  }
  return lines;
}
function cleanHoles(hs) {
  const arr = Array.isArray(hs) ? hs : [];
  if (arr.length > MAX_HOLES) throw HttpErr(400, "Zbyt wiele dziur.");
  return arr.map(h => {
    const x = num(h?.x), y = num(h?.y), w = num(h?.w), hh = num(h?.h);
    if (![x, y, w, hh].every(Number.isFinite) || x < 0 || x > 100 || y < 0 || y > 100 || w < 1 || w > 60 || hh < 1 || hh > 60) throw HttpErr(400, "Nieprawidłowe rozmieszczenie dziur.");
    return { style: str(h?.style, 40) || "hole", x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
  });
}
async function priceFromCatalog(env, lines) {
  const ids = { hat: new Set(), pants: new Set() };
  for (const l of lines) if (l.type !== "custom") ids[l.type].add(l.id);
  const cat = { hat: new Map(), pants: new Map() };
  for (const [type, table] of [["hat", "hats"], ["pants", "products"]]) {
    if (!ids[type].size) continue;
    for (const r of (await rest(env, `${table}?select=*&id=in.(${[...ids[type]].join(",")})`)) || []) cat[type].set(String(r.id), normItem(r));
  }
  let opts = null, settings = null;
  if (lines.some(l => l.type === "custom")) {
    opts = await rest(env, "options?select=name,category,price_extra,available&category=in.(kolor,kroj)");
    settings = (await rest(env, "site_settings?select=hole_price,custom_base_price&id=eq.1"))?.[0] || {};
  }
  const stockUsed = new Map(), out = [];
  for (const l of lines) {
    if (l.type === "custom") {
      const colour = (opts || []).find(x => x.category === "kolor" && x.name === l.color && x.available !== false);
      const cut = (opts || []).find(x => x.category === "kroj" && x.name === l.cut && x.available !== false);
      if (!colour || !cut || !l.size) throw HttpErr(400, "Konfiguracja spodni custom jest nieaktualna — zaprojektuj je ponownie.");
      const holes = cleanHoles(l.holes);
      const holePrice = num(settings.hole_price ?? 15), base = num(settings.custom_base_price ?? 0);
      out.push({ type: "custom", product_id: "CUSTOM", name: "Custom pants", category: TYPE_LABEL.custom, color: colour.name, cut: cut.name, size: l.size, holes, hole_price: holePrice,
        measurements: l.measurements, notes: l.notes, qty: l.qty, unit: num(base + (num(colour.price_extra) || 0) + (num(cut.price_extra) || 0) + holes.length * holePrice) });
      continue;
    }
    const it = cat[l.type].get(l.id);
    const v = it?.live ? it.variants.find(x => x.active && x.name === l.color) : null;
    const z = v?.sizes.find(s => s.size === l.size);
    if (!it || !v || !z) throw HttpErr(400, "Jedna z pozycji nie jest już dostępna.");
    const k = `${l.type}|${l.id}|${l.color}|${l.size}`, used = (stockUsed.get(k) || 0) + l.qty;
    if (used > z.stock) throw HttpErr(400, `„${it.name}” (${v.name}, ${z.size}): dostępne tylko ${z.stock} szt.`);
    stockUsed.set(k, used);
    out.push({ type: l.type, product_id: it.sku, name: it.name, category: l.type === "pants" && it.category ? `${TYPE_LABEL.pants} — ${it.category}` : TYPE_LABEL[l.type],
      color: v.name, size: z.size, qty: l.qty, unit: v.price ?? it.price });
  }
  return out;
}
function priceFromClaims(lines) {
  return lines.map(l => {
    const unit = l.c.unit;
    if (!Number.isFinite(unit) || unit < 0 || unit > 100000) throw HttpErr(400, "Nieprawidłowa cena pozycji.");
    if (l.type === "custom") return { type: "custom", product_id: "CUSTOM", name: "Custom pants", category: TYPE_LABEL.custom, color: l.color, cut: l.cut, size: l.size, holes: cleanHoles(l.holes),
      hole_price: Number.isFinite(l.c.hole_price) ? l.c.hole_price : 0, measurements: l.measurements, notes: l.notes, qty: l.qty, unit };
    return { type: l.type, product_id: l.c.sku || "—", name: l.c.name || TYPE_LABEL[l.type], category: l.c.category || TYPE_LABEL[l.type], color: l.color, size: l.size, qty: l.qty, unit };
  });
}
async function priceOrder(env, raw) {
  const o = raw?.order;
  if (!o || !Array.isArray(o.items) || !o.items.length || o.items.length > MAX_ITEMS) throw HttpErr(400, "Koszyk jest pusty lub zbyt duży.");
  const ig = str(o.instagram, 40).replace(/^@/, "");
  if (!IG_RE.test(ig)) throw HttpErr(400, "Podaj poprawną nazwę użytkownika Instagram (np. @twoj_nick).");
  const lines = parseLines(o);
  let items, price_check = "server";
  try {
    if (!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)) throw HttpErr(503, "no catalog");
    items = await priceFromCatalog(env, lines);
  } catch (e) {
    if (!unavailable(e)) throw e;                         // błąd walidacji (np. brak towaru) — odrzucamy
    items = priceFromClaims(lines); price_check = "unverified";   // katalog niedostępny — zamówienie dociera, z wyraźnym ostrzeżeniem
  }
  for (const l of items) l.line_total = num(l.unit * l.qty);
  return { items, price_check, subtotal: num(items.reduce((s, l) => s + l.line_total, 0)), delivery: DELIVERY[o.delivery] ? o.delivery : "shipping", instagram: ig,
    notes: str(o.notes, 500), code: str(o.discount_code, 40).toUpperCase(), claimed_discount: num(o.discount_amount) };
}
async function applyDiscount(env, code, subtotal, claimed, dryRun) {
  if (!code) return { code: null, amount: 0, redeemed: false, check: "server" };
  const args = { p_code: code, p_subtotal: subtotal };
  try {
    if (!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)) throw HttpErr(503, "no catalog");
    const useService = !dryRun && !!env.SUPABASE_SERVICE_KEY;
    const res = useService ? await rest(env, "rpc/redeem_discount", { method: "POST", body: args, key: env.SUPABASE_SERVICE_KEY })
                           : await rest(env, "rpc/validate_discount", { method: "POST", body: args });
    if (!res?.valid) throw HttpErr(400, res?.error || "Nieprawidłowy kod rabatowy.");
    return { code: res.code, amount: num(res.discount), redeemed: useService, check: "server" };
  } catch (e) {
    if (!unavailable(e)) throw e;
    return { code, amount: Number.isFinite(claimed) ? Math.min(Math.max(0, claimed), subtotal) : 0, redeemed: false, check: "unverified" };
  }
}

// ---------- treść (ta sama dla Formspree i Discorda) ----------
function orderText(o, b64) {
  const L = ["NEW ORDER RECEIVED", "", `Order number: ${o.number}`, `Instagram username: ${at(o.instagram)}`, `Order date: ${o.created_text}`, `Status: ${STATUS}`,
    `Final total: ${pln(o.total)}`, `Delivery method: ${DELIVERY[o.delivery]}`];
  if (o.price_check === "unverified") L.push("", "WARNING: PRICES NOT VERIFIED BY THE SERVER (catalog was unavailable). Check all prices before confirming the order.");
  if (o.discount_check === "unverified") L.push("WARNING: DISCOUNT CODE NOT VERIFIED BY THE SERVER. Verify the code and amount before honoring it.");
  L.push("", "PRODUCTS:");
  o.items.forEach((i, n) => L.push(`${n + 1}. ${i.name}`, `   Category: ${i.category}`, `   Product ID: ${i.product_id}`, `   Color: ${i.color}`, `   Size: ${i.size}`, `   Quantity: ${i.qty}`,
    `   Price: ${pln(i.unit)} each — line total ${pln(i.line_total)}`, ""));
  const customs = o.items.filter(i => i.type === "custom");
  if (customs.length) {
    L.push("CUSTOM PANTS DETAILS:");
    customs.forEach((c, n) => {
      L.push(customs.length > 1 ? `Custom pants #${n + 1}:` : "Custom pants:", `- Product ID: ${c.product_id}`, `- Color: ${c.color}`, `- Cut: ${c.cut}`, `- Size: ${c.size}`,
        `- Holes: ${c.holes.length ? `${c.holes.length} (${pln(c.hole_price)} each)` : "none"}`);
      c.holes.forEach((h, k) => L.push(`    hole ${k + 1}: ${h.style}, x ${h.x}%, y ${h.y}%, size ${h.w}×${h.h}%`));
      L.push("- Materials: not applicable (standard denim)", "- Graphics: none (hole placement only)", `- Measurements: ${c.measurements || "none provided"}`, `- Additional notes: ${c.notes || "none"}`, "");
    });
  }
  L.push("ORDER SUMMARY:", `Subtotal: ${pln(o.subtotal)}`, o.discount_code ? `Discount: ${o.discount_code} (−${pln(o.discount_amount)})` : "Discount: none", `Final total: ${pln(o.total)}`,
    `Delivery method: ${DELIVERY[o.delivery]}`, "", "CUSTOMER CONTACT:", `Instagram username: ${at(o.instagram)}`, "", "CUSTOMER NOTES:", o.notes || "none", "",
    "NEXT STEP:", `Contact the customer on Instagram (${at(o.instagram)}) and ask them to confirm order ${o.number}, then arrange payment.`,
    "The order was submitted automatically by the website. It was NOT sent to Instagram; Instagram is used only for questions, payment and final confirmation.");
  if (b64) {
    L.push("", "ENCODED CUSTOM ORDER DATA (Base64 — an encoding, NOT encryption; paste it in Admin panel → Order decoder):");
    for (let i = 0; i < b64.length; i += 90) L.push(b64.slice(i, i + 90));
    L.push("END OF ENCODED DATA");
  }
  return L.join("\n");
}
const subjectFor = o => `New order ${o.number} from ${at(o.instagram)}`;
function formspreeFields(o, text, b64) {
  const f = { _subject: subjectFor(o), order_number: o.number, instagram_username: at(o.instagram), order_date: o.created_text, status: STATUS, subtotal: pln(o.subtotal),
    discount: o.discount_code ? `${o.discount_code} (−${pln(o.discount_amount)})` : "none", final_total: pln(o.total), delivery_method: DELIVERY[o.delivery], customer_notes: o.notes || "none" };
  if (o.price_check === "unverified" || o.discount_check === "unverified") f.warning = "PRICES / DISCOUNT NOT VERIFIED BY THE SERVER — check them before confirming the order.";
  f.complete_order = text;
  if (b64) f.custom_pants_base64_code = b64;
  return f;
}
async function sendFormspree(env, fields) {
  if (!formspreeOn(env)) return "not_configured";
  const res = await fetch(env.FORMSPREE_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(fields), signal: AbortSignal.timeout(8000) });
  if (!res.ok) return "error";
  const j = await res.json().catch(() => ({}));
  return j && j.ok === false ? "error" : "sent";
}
const dClean = s => String(s).replace(/@/g, "@​").replace(/```/g, "'''");
async function sendDiscord(env, text) {
  if (!discordOn(env)) return "not_configured";
  const chunks = []; let cur = "";
  for (const line of dClean(text).split("\n")) { if ((cur + "\n" + line).length > 1850) { chunks.push(cur); cur = line; } else cur = cur ? cur + "\n" + line : line; }
  if (cur) chunks.push(cur);
  for (const c of chunks) {
    const res = await fetch(env.DISCORD_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(8000),
      body: JSON.stringify({ content: "```\n" + c + "\n```", allowed_mentions: { parse: [] } }) });
    if (!res.ok) return "error";
  }
  return "sent";
}

// ---------- HTTP (niezależne od frameworka: działa jako funkcja Vercel i w teście lokalnym) ----------
const memHits = new Map();
function rateLimited(bucket, cfg, ip) {
  const key = bucket + ":" + ip, now = Date.now(), hits = (memHits.get(key) || []).filter(t => now - t < cfg.windowMs);
  if (hits.length >= cfg.max) { memHits.set(key, hits); return true; }
  hits.push(now); memHits.set(key, hits);
  if (memHits.size > 5000) memHits.clear();
  return false;
}
const done = new Map();   // submission_id → odpowiedź (neutralizuje podwójne kliknięcia; w obrębie jednej instancji)
const clientIp = req => String(req.headers["x-forwarded-for"] || req.headers["cf-connecting-ip"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
async function readBody(req) {
  if (req.body !== undefined && req.body !== null && typeof req.body !== "string" && !Buffer.isBuffer(req.body)) return req.body;   // Vercel: już sparsowane
  let raw = typeof req.body === "string" ? req.body : Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
  if (raw === null) { raw = ""; for await (const c of req) { raw += c; if (raw.length > MAX_BODY + 1024) break; } }
  if (raw.length > MAX_BODY) throw HttpErr(413, "Zbyt duże zamówienie.");
  try { return JSON.parse(raw || "{}"); } catch { throw HttpErr(400, "Nieprawidłowe dane."); }
}
function corsFor(req, env) {
  const origin = req.headers.origin, host = req.headers["x-forwarded-host"] || req.headers.host;
  const extra = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  let same = false; try { same = !!origin && new URL(origin).host === host; } catch { /* zły Origin */ }
  const ok = !origin || same || extra.includes(origin);
  return { ok, headers: { "Vary": "Origin", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "600",
    ...(origin && ok ? { "Access-Control-Allow-Origin": origin } : {}) } };
}
function makeSend(res, cors) {
  return (status, obj) => { res.statusCode = status; for (const [k, v] of Object.entries({ ...cors.headers, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" })) res.setHeader(k, v); res.end(JSON.stringify(obj)); };
}
const preflight = (res, cors) => { res.statusCode = cors.ok ? 204 : 403; for (const [k, v] of Object.entries(cors.headers)) res.setHeader(k, v); res.end(); };

// ===== GET/POST /api/submit-order =====
async function submitOrder(req, res, env) {
  const cors = corsFor(req, env), send = makeSend(res, cors);
  try {
    if (req.method === "OPTIONS") return preflight(res, cors);
    if (!cors.ok) return send(403, { error: "Forbidden origin" });
    const mode = await notifyMode(env), test = testMode(env);
    // status publiczny (bez sekretów): tylko tryb, czy to test i czy usługa jest gotowa
    if (req.method === "GET") return send(200, { mode, test_mode: test, ready: test || requiredReady(env, mode) });
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });

    const raw = await readBody(req);
    if (raw.hp) return send(400, { ok: false, error: "Nieprawidłowe dane." });                       // pułapka na boty
    if (rateLimited("order", { ...RATE, max: Number(env.ORDER_RATE_LIMIT) || RATE.max }, clientIp(req))) return send(429, { ok: false, error: "Zbyt wiele zamówień — spróbuj za kilka minut." });
    const sub = SUB_RE.test(String(raw.submission_id || "")) ? String(raw.submission_id) : null;
    if (sub && done.has(sub)) return send(200, { ...done.get(sub), duplicate: true });             // ten sam przycisk kliknięty dwa razy

    if (!test && !requiredReady(env, mode)) return send(503, { ok: false, error: "Składanie zamówień jest chwilowo niedostępne (usługa zamówień nie jest jeszcze skonfigurowana)." });

    const priced = await priceOrder(env, raw);
    const disc = await applyDiscount(env, priced.code, priced.subtotal, priced.claimed_discount, test);
    const now = new Date();
    const order = { number: newOrderNumber(now), created: now.toISOString(), created_text: niceDate(now), instagram: priced.instagram, delivery: priced.delivery, items: priced.items,
      subtotal: priced.subtotal, discount_code: disc.code, discount_amount: disc.amount, total: Math.max(0, num(priced.subtotal - disc.amount)), notes: priced.notes,
      price_check: priced.price_check, discount_check: disc.check, status: STATUS };
    let b64 = null;
    if (order.items.some(i => i.type === "custom")) {
      const data = { v: 1, kind: "order", order: orderForB64(order) };
      if (env.ORDER_SIGNING_SECRET) data.sig = hmacHex(env.ORDER_SIGNING_SECRET, JSON.stringify({ v: 1, kind: "order", order: data.order }));
      b64 = toB64(data);
    }
    const text = orderText(order, b64), fields = formspreeFields(order, text, b64), wantEmail = mode !== "discord", wantDiscord = mode !== "email";

    // ---- TRYB TESTOWY: nic nie jest wysyłane, a odpowiedź to wyraźnie mówi ----
    if (test) {
      const out = { ok: true, test: true, delivered: false, mode, number: order.number, order,
        preview: { ...(wantEmail ? { formspree_fields: fields } : {}), ...(wantDiscord ? { discord_text: text } : {}) } };
      if (sub) done.set(sub, out);
      return send(200, out);
    }

    const results = {};
    const release = async () => { if (disc.redeemed) await rest(env, "rpc/release_discount", { method: "POST", body: { p_code: disc.code }, key: env.SUPABASE_SERVICE_KEY }).catch(() => {}); };
    if (wantEmail) {
      results.email = await sendFormspree(env, fields).catch(() => "error");
      if (results.email !== "sent") results.email = await sendFormspree(env, fields).catch(() => "error");   // jedna ponowna próba
      if (results.email !== "sent") { await release(); return send(502, { ok: false, delivered: false, results, error: "Nie udało się wysłać zamówienia. Spróbuj ponownie za chwilę." }); }
      if (wantDiscord && discordOn(env)) results.discord = await sendDiscord(env, text).catch(() => "error");   // dodatek; jego błąd nie anuluje zamówienia
    } else {
      const dtext = "NOTE: delivery mode is DISCORD ONLY — no e-mail (Formspree) copy of this order was sent.\n\n" + text;
      results.discord = await sendDiscord(env, dtext).catch(() => "error");
      if (results.discord !== "sent") results.discord = await sendDiscord(env, dtext).catch(() => "error");
      if (results.discord !== "sent") { await release(); return send(502, { ok: false, delivered: false, results, error: "Nie udało się wysłać zamówienia. Spróbuj ponownie za chwilę." }); }
    }
    const out = { ok: true, test: false, delivered: true, mode, results, number: order.number, order };
    if (sub) done.set(sub, out);
    if (done.size > 500) done.clear();
    return send(200, out);
  } catch (e) {
    if (e && e.status) return send(e.status, { ok: false, error: e.message });
    return send(500, { ok: false, error: "Wystąpił błąd. Spróbuj ponownie później." });   // bez szczegółów wewnętrznych
  }
}

// ===== POST /api/order-admin (status / test / decode) — tylko zalogowany admin =====
async function getAdminUser(req, env) {
  const m = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i);
  if (!m || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}`, apikey: env.SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const u = await r.json();
    const allowed = String(env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    return u?.email && allowed.includes(u.email.toLowerCase()) ? u : null;
  } catch { return null; }
}
async function orderAdmin(req, res, env) {
  const cors = corsFor(req, env), send = makeSend(res, cors);
  try {
    if (req.method === "OPTIONS") return preflight(res, cors);
    if (!cors.ok) return send(403, { error: "Forbidden origin" });
    if (req.method !== "POST") return send(405, { error: "Method not allowed" });
    if (!(await getAdminUser(req, env))) return send(401, { error: "Unauthorized" });
    const body = await readBody(req), action = String(body.action || "");
    const mode = await notifyMode(env);
    const configured = { email: formspreeOn(env), discord: discordOn(env), catalog: !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY), discount_limits: !!env.SUPABASE_SERVICE_KEY,
      signing: !!env.ORDER_SIGNING_SECRET, test_mode: testMode(env), mode };
    if (action === "status") return send(200, { configured });
    if (rateLimited("admin", RATE_ADMIN, clientIp(req))) return send(429, { error: "Zbyt wiele prób — spróbuj za chwilę." });
    if (action === "test") {
      const text = "TEST — wiadomość testowa z panelu sklepu. Jeśli to widzisz, integracja działa.";
      const results = {};
      if (testMode(env)) results[body.channel === "discord" ? "discord" : "email"] = "test_mode";   // tryb testowy: NIC nie wysłano
      else if (body.channel === "email") results.email = await sendFormspree(env, { _subject: "Test integracji zamówień", message: text }).catch(() => "error");
      else if (body.channel === "discord") results.discord = await sendDiscord(env, text).catch(() => "error");
      return send(200, { configured, results });
    }
    if (action === "decode") {
      const input = String(body.input ?? "").trim();
      if (!input) throw HttpErr(400, "Wklej blok Base64 z e-maila z zamówieniem.");
      if (/^ORD-/i.test(input) && input.length < 40) throw HttpErr(400, "Sam numer zamówienia nie zawiera danych — zamówienia nie są nigdzie zapisywane. Pełne zamówienie jest w e-mailu (numer i @nick są w temacie). Dla spodni custom wklej tutaj blok Base64 z tego e-maila.");
      const data = fromB64(input);
      let verified = null;
      if (env.ORDER_SIGNING_SECRET) { const { sig, ...rest } = data; verified = typeof sig === "string" && sig === hmacHex(env.ORDER_SIGNING_SECRET, JSON.stringify(rest)); }
      return send(200, { source: "base64", number: String(data?.order?.number || ""), record: cleanRecord(data?.order), verified });
    }
    return send(400, { error: "Nieznana akcja." });
  } catch (e) {
    if (e && e.status) return send(e.status, { error: e.message });
    return send(500, { error: "Wystąpił błąd. Spróbuj ponownie później." });
  }
}

const createHandlers = getEnv => ({ submit: (req, res) => submitOrder(req, res, getEnv()), admin: (req, res) => orderAdmin(req, res, getEnv()) });
module.exports = { createHandlers, orderText, formspreeFields, subjectFor, newOrderNumber, toB64, fromB64, ORDER_NO_RE, _done: done, _hits: memHits };
