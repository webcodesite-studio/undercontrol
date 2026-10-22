# Konfigurator spodni — instrukcja uruchomienia

Pliki: `index.html` (sklep), `admin.html` (panel), `app.js`, `admin.js`, `style.css`, `config.js`, `supabase.sql`.

## 1. Supabase (baza opcji + logowanie właściciela)
1. Wejdź na **supabase.com** → "New project". Zapisz hasło do bazy.
2. Po utworzeniu: **SQL Editor** → wklej całą zawartość `supabase.sql` → Run. To tworzy tabelę `options`, włącza RLS i wstawia przykładowe opcje.
3. **Authentication → Users → Add user** — dodaj swój mail i mocne hasło. To będzie Twoje logowanie do panelu.
4. **Authentication → Providers → Email** — wyłącz "Allow new users to sign up" (żeby nikt obcy nie założył konta).
5. Jeśli widzisz opcję 2FA — włącz.
6. **Project Settings → API** — skopiuj `Project URL` i `anon public` key.

## 2. Uzupełnij config.js
Otwórz `config.js` i wklej:
- `SUPABASE_URL` i `SUPABASE_ANON_KEY` (z kroku powyżej)
- `IG_NICK` — Twój nick na Instagramie (bez @)
- `FORMSPREE_ENDPOINT` — patrz krok 3

## 3. Formspree (mail z zamówieniem)
1. Wejdź na **formspree.io** → załóż konto (plan darmowy wystarczy na start).
2. "New form" → skopiuj endpoint w formacie `https://formspree.io/f/xxxxxxx`.
3. Wklej do `config.js` jako `FORMSPREE_ENDPOINT`.
4. Pierwsze zamówienie testowe trzeba będzie potwierdzić klikiem w mailu (jednorazowo).

## 4. Deploy na Vercel
1. Wrzuć folder `pants-configurator` do repozytorium na GitHub (osobne repo).
2. Wejdź na **vercel.com** → "Add New → Project" → wybierz to repo.
3. Framework preset: **Other** (to zwykły HTML/CSS/JS, nie trzeba build commandu).
4. Deploy. Dostaniesz adres typu `twoj-sklep.vercel.app` — możesz potem podpiąć własną domenę w Project Settings → Domains.
5. Panel właściciela będzie pod adresem `twoj-sklep.vercel.app/admin.html` — nie udostępniaj tego linku publicznie (choć bez hasła i tak nikt się nie zaloguje).

## 5. Test
1. Otwórz stronę główną, przejdź przez kroki, wyślij testowe zamówienie — sprawdź czy mail przyszedł.
2. Otwórz `/admin.html`, zaloguj się swoim mailem/hasłem z kroku 1.3, wyłącz jakąś opcję suwakiem i odśwież stronę główną — powinna być wyszarzona.

## Bezpieczeństwo — już ogarnięte w kodzie
- `anon key` w `config.js` jest publiczny z założenia — chronią go reguły RLS (czytają wszyscy, zapisują tylko zalogowani).
- Nigdzie nie ma `service_role` key.
- Rejestracja nowych userów wyłączona (krok 1.4).
- Dane z bazy wstawiane przez `textContent`/`escapeText`, nie `innerHTML`.
- W formularzu jest ukryte pole-pułapka (honeypot) przeciw botom.

## Tryb testowy panelu (bez Supabase)
Dopóki w `config.js` zostaje placeholder `TWOJ-PROJEKT.supabase.co`, logowanie w `/admin.html` przyjmie login **admin** / hasło **admin** — dane trzymane są wtedy lokalnie w przeglądarce (localStorage), nic nie zapisuje się do żadnej bazy.

**To wyłącza się samo** — jak tylko wpiszesz prawdziwy `SUPABASE_URL` w `config.js`, logowanie `admin/admin` przestanie działać i panel będzie wymagał prawdziwego konta z Supabase. Nie musisz nic usuwać ręcznie przed wdrożeniem na produkcję — wystarczy uzupełnić klucze.

## Co dodać później
- Zdjęcia/warstwy PNG zamiast SVG-placeholdera w `index.html` (`#pantsSvg`) — podmień na `<img>` z warstwami nakładanymi przez CSS, albo osobny SVG per kolor.
- Upload zdjęć opcji przez Supabase Storage (bucket publiczny do odczytu, zapis tylko zalogowani) — rozszerzenie `admin.js`.
- Cloudflare Turnstile zamiast samego honeypota, jeśli pojawi się spam.
