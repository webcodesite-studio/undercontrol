// Wspólny kod dla generatora (app.js), panelu (admin.js) i strony kontakt.
// Jedno miejsce dla: domyślnej ceny dziury i odczytu ceny z ustawień.

// Domyślna cena jednej dziury (zł). Realna wartość jest w bazie: site_settings.hole_price (Ustawienia w panelu).
const DEFAULT_HOLE_PRICE = 15;
function holePriceOf(settings){
  const n = Number(settings?.hole_price);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_HOLE_PRICE;
}
