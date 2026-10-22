// Wspólny kod dla generatora (app.js), panelu (admin.js) i strony kontakt.
// Jedno miejsce dla: domyślnej ceny dziury, odczytu ceny z ustawień oraz kodu konfiguracji Customów.

// Domyślna cena jednej dziury (zł). Realna wartość jest w bazie: site_settings.hole_price (Ustawienia w panelu).
const DEFAULT_HOLE_PRICE = 15;
function holePriceOf(settings){
  const n = Number(settings?.hole_price);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOLE_PRICE;
}

const CONFIG_CODE_VERSION = 2;
function b64encodeUtf8(str){ return btoa(unescape(encodeURIComponent(str))); }
function b64decodeUtf8(b64){ return decodeURIComponent(escape(atob(b64))); }

// Kod konfiguracji: base64(JSON). cfg: {kolor:{name,hex,price_extra}, kroj:{name,price_extra}, rozmiar, holes:[...], hole_price}
function encodeConfig(cfg){
  const holes = (cfg.holes||[]).map(h=>({
    x:Math.round(h.x), y:Math.round(h.y), w:Math.round(h.w), h:Math.round(h.h),
    styleId:h.styleId, styleName:h.styleName || "?"
  }));
  const holePrice = Number(cfg.hole_price);
  const kolorExtra = Number(cfg.kolor?.price_extra)||0, krojExtra = Number(cfg.kroj?.price_extra)||0;
  return b64encodeUtf8(JSON.stringify({
    v: CONFIG_CODE_VERSION,
    kolor: cfg.kolor ? { name:cfg.kolor.name, hex:cfg.kolor.hex||null, extra:kolorExtra } : null,
    kroj: cfg.kroj ? { name:cfg.kroj.name, extra:krojExtra } : null,
    rozmiar: cfg.rozmiar || null,
    holes,
    hole_price: holePrice,
    total: kolorExtra + krojExtra + holes.length*holePrice,
  }));
}

// Zwraca ujednolicony obiekt albo rzuca błąd. Obsługuje też stare kody (tylko tablica dziur).
function decodeConfig(code){
  let data;
  try{ data = JSON.parse(b64decodeUtf8(String(code).trim().replace(/\s+/g,""))); }
  catch(e){ throw new Error("Nieprawidłowy kod — skopiuj go w całości."); }
  const legacy = Array.isArray(data);
  if(!legacy && (typeof data !== "object" || data === null)) throw new Error("Nieprawidłowy kod.");
  const holes = legacy ? data : (Array.isArray(data.holes) ? data.holes : null);
  if(!holes) throw new Error("Kod nie zawiera danych o dziurach.");
  const holePrice = legacy ? null : (Number.isFinite(Number(data.hole_price)) ? Number(data.hole_price) : null);
  return {
    legacy,
    kolor: legacy ? null : (data.kolor || null),
    kroj: legacy ? null : (data.kroj || null),
    rozmiar: legacy ? null : (data.rozmiar || null),
    holes,
    holePrice,
    total: legacy ? null : (Number.isFinite(Number(data.total)) ? Number(data.total) : null),
  };
}
