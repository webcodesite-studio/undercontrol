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
W `wrangler.toml` ustaw:
- `bucket_name` (jeśli bucket nazwałeś inaczej) i `PUBLIC_BASE_URL` (publiczny URL z kroku 2),
- `SUPABASE_URL` i `SUPABASE_ANON_KEY` (Supabase → Project Settings → API; anon key jest publiczny),
- `ALLOWED_ORIGINS` — adres Twojej strony, np. `https://twoj-sklep.vercel.app` (kilka po przecinku; do testów lokalnych dodaj `http://localhost:8765`),
- `ADMIN_EMAILS` — e-mail(e) kont Supabase, które mogą wgrywać zdjęcia. **Bez tego upload jest zablokowany.**

Nie ma już `UPLOAD_SECRET` — jeśli ustawiłeś go wcześniej: `wrangler secret delete UPLOAD_SECRET`.

## 4. Wdróż Workera
```
cd r2-worker
wrangler deploy
```
Po wdrożeniu dostaniesz adres typu `https://pants-r2-upload.twoj-login.workers.dev` — to jest `R2_UPLOAD_URL`.

## 5. Uzupełnij config.js głównego projektu
```js
const R2_UPLOAD_URL = "https://pants-r2-upload.twoj-login.workers.dev";
```
Żadnego sekretu w kodzie strony już nie ma. Panel wysyła token sesji Supabase (po zalogowaniu), a Worker sprawdza go w Supabase Auth.

## Co egzekwuje Worker
- poprawny token Supabase **i** e-mail z `ADMIN_EMAILS`,
- tylko JPEG / PNG / GIF / WebP — typ rozpoznawany po zawartości pliku; nazwa pliku, rozszerzenie i nagłówek Content-Type od klienta są ignorowane (SVG i HTML odrzucane),
- maks. 5 MB (limit egzekwowany także przy czytaniu strumienia),
- CORS tylko dla domen z `ALLOWED_ORIGINS`.

Upload działa tylko po zalogowaniu przez Supabase (tryb testowy `admin/admin` nie obsługuje uploadu).

## Test
Po uzupełnieniu `config.js`, w panelu admina (`admin.html` → Stałe oferty → Edytuj produkt, albo Customy → zdjęcie bazowe) powinieneś móc wybrać plik i zobaczyć podgląd po wgraniu.
