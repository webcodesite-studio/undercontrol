// Wspólny kod dla generatora (app.js), panelu (admin.js) i strony kontakt.
// Jedno miejsce dla: domyślnej ceny dziury i odczytu ceny z ustawień.

// Domyślna cena jednej dziury (zł). Realna wartość jest w bazie: site_settings.hole_price (Ustawienia w panelu).
const DEFAULT_HOLE_PRICE = 15;
function holePriceOf(settings){
  const n = Number(settings?.hole_price);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOLE_PRICE;
}

// Jedno źródło prawdy dla nazwy marki: site_settings.shop_name (Ustawienia w panelu).
const DEFAULT_BRAND = "TWOJA MARKA";
function brandOf(settings){
  const n = String(settings?.shop_name ?? "").trim();
  return n || DEFAULT_BRAND;
}
// Wstawia markę we wszystkie miejsca: elementy [data-brand], tytuł karty, meta description, og:site_name.
function applyBrand(brand){
  document.querySelectorAll("[data-brand], #shopName").forEach(el=>{ el.textContent = brand; });
  const base = document.documentElement.dataset.baseTitle ?? (document.documentElement.dataset.baseTitle = document.title.split(" — ")[0]);
  document.title = base + " — " + brand;
  const meta = document.querySelector('meta[name="description"]');
  if(meta){
    const tpl = meta.dataset.tpl ?? (meta.dataset.tpl = meta.getAttribute("content"));
    meta.setAttribute("content", tpl.replace(/^/, brand + " — "));
  }
}
