# Formularz kontaktowy → Discord (Cloudflare Worker)

Strona **nie zna** adresu webhooka Discorda — formularz wysyła wiadomość do Workera, a Worker (z sekretem) przekazuje ją na Discord.

## 1. Webhook na Discordzie
Serwer → kanał → ⚙ Edytuj kanał → Integracje → Webhooki → Nowy webhook → Kopiuj URL webhooka.
Traktuj go jak hasło: kto go zna, może pisać na Twój kanał. Jeśli kiedykolwiek wycieknie, usuń go i utwórz nowy.

## 2. Wdrożenie
```
cd contact-worker
# w wrangler.toml ustaw ALLOWED_ORIGINS (adres Twojej strony)
wrangler secret put DISCORD_WEBHOOK_URL     # wklej URL webhooka
wrangler deploy
```
Adres Workera wpisz w `config.js` jako `CONTACT_API_URL`.

## 3. Opcjonalnie: limit wiadomości między serwerami (zalecane)
```
wrangler kv namespace create RATE_KV
```
Wklej `id` w `wrangler.toml` (odkomentuj sekcję `kv_namespaces`) i `wrangler deploy`. Bez KV limit działa tylko w obrębie jednej instancji Workera.

## Zabezpieczenia
- Webhook tylko jako sekret Workera (nie w repozytorium, nie w `config.js`, nie w odpowiedziach).
- CORS tylko dla domen z `ALLOWED_ORIGINS`.
- Walidacja i limity: imię ≤ 60, kontakt ≤ 120, wiadomość 10–1000 znaków, maks. 2 linki, body ≤ 8 KB.
- Anty-spam: ukryte pole-pułapka, minimalny czas wypełnienia (3 s), limit 3 wiadomości / 10 min / IP.
- Wiadomość jest oczyszczana: bez pingów (`@everyone`, wzmianki), bez formatowania Markdown Discorda.
- Dla większej ochrony można dodać Cloudflare Turnstile (darmowy).
