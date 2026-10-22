# Upload zdjęć do Cloudflare R2 — instrukcja

Panel admina wysyła zdjęcia nie bezpośrednio do R2 (klucze R2 nie mogą być w kodzie strony), tylko przez mały Cloudflare Worker, który je odbiera i zapisuje do bucketu. Worker jest darmowy w planie Cloudflare do rozsądnego ruchu.

## 1. Zainstaluj Wrangler (narzędzie Cloudflare)
```
npm install -g wrangler
wrangler login
```

## 2. Stwórz bucket R2
1. Wejdź na dash.cloudflare.com → **R2** → "Create bucket" → nazwa np. `pants-images`.
2. W ustawieniach bucketu włącz **Public access** (żeby zdjęcia były widoczne na stronie) — dostaniesz publiczny URL typu `https://pub-xxxx.r2.dev`. Skopiuj go.
3. (Opcjonalnie, poleca Cloudflare) podepnij własną domenę/subdomenę do bucketu zamiast `r2.dev`.

## 3. Skonfiguruj Workera
1. W `wrangler.toml` w tym folderze: zmień `bucket_name` jeśli nazwałeś bucket inaczej, i wklej publiczny URL z kroku 2 jako `PUBLIC_BASE_URL`.
2. Ustaw sekret (hasło do uploadu, chroni endpoint przed obcymi):
   ```
   wrangler secret put UPLOAD_SECRET
   ```
   Wpisz dowolny długi losowy ciąg — to będzie Twoje hasło do uploadu zdjęć.

## 4. Wdróż Workera
```
cd r2-worker
wrangler deploy
```
Po wdrożeniu dostaniesz adres typu `https://pants-r2-upload.twoj-login.workers.dev` — to jest `R2_UPLOAD_URL`.

## 5. Uzupełnij config.js głównego projektu
W pliku `config.js` (w folderze głównym, obok `index.html`) uzupełnij:
```js
const R2_UPLOAD_URL = "https://pants-r2-upload.twoj-login.workers.dev";
const R2_UPLOAD_SECRET = "ten sam sekret co w kroku 3";
```

**Uwaga:** `R2_UPLOAD_SECRET` w `config.js` jest widoczny w kodzie strony — każdy z dostępem do panelu admina (czyli zalogowany właściciel) może go zobaczyć i użyć do uploadu. To nie jest publiczny klucz jak `anon` z Supabase — nie wklejaj go nigdzie indziej i nie udostępniaj linku do panelu. Dla pełnego bezpieczeństwa docelowo warto przepiąć autoryzację Workera na token Supabase zamiast stałego sekretu — daj znać, jeśli chcesz to dociągnąć.

## Test
Po uzupełnieniu `config.js`, w panelu admina (`admin.html` → Stałe oferty → Edytuj produkt, albo Customy → zdjęcie bazowe) powinieneś móc wybrać plik i zobaczyć podgląd po wgraniu.
