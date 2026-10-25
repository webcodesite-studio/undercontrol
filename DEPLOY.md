# Wdrożenie (Vercel) i konfiguracja zamówień

> Ten plik opisuje, co ustawić przy wdrożeniu. Nic tu nie zostało uruchomione na prawdziwym hostingu — kod sprawdzono lokalnie z atrapami Formspree/Discord/Supabase.

Strona jest statyczna; zamówienia obsługują funkcje serverless w katalogu `api/` (Vercel wykrywa je automatycznie): `api/submit-order.js` (składanie zamówień + publiczny status) i `api/order-admin.js` (panel: status, test, dekoder). Uploady zdjęć (`r2-worker/`) i formularz kontaktowy (`contact-worker/`) to osobne Cloudflare Workers, bez zmian.

## Zmienne środowiskowe (Vercel → Project → Settings → Environment Variables)

| Zmienna | Wymagana | Do czego |
|---|---|---|
| `FORMSPREE_ENDPOINT` | tak (dla e-maila) | adres formularza `https://formspree.io/f/…`; odbiorcę ustawiasz w panelu Formspree |
| `DISCORD_WEBHOOK_URL` | tylko dla Discorda | webhook kanału |
| `ORDER_TEST_MODE` | nie | `true` = tryb testowy: nic nie jest wysyłane, strona to wyraźnie pokazuje. **Usuń przed startem sklepu.** |
| `ORDER_NOTIFY_MODE` | nie | `email` / `discord` / `both` — wartość awaryjna, gdy nie da się odczytać wyboru z panelu (domyślnie `both`) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | zalecane | odczyt katalogu (ceny/stany po stronie serwera), kodów rabatowych i wyboru metody z panelu. Bez nich zamówienie dociera z adnotacją „ceny niezweryfikowane”. |
| `SUPABASE_SERVICE_KEY` | nie | tylko do liczenia użyć kodów rabatowych (**tylko tutaj, nigdy w przeglądarce**) |
| `ORDER_SIGNING_SECRET` | nie | podpis bloku Base64 — dekoder wykryje zmienione dane |
| `ADMIN_EMAILS` | dla panelu | adresy adminów (po przecinku) uprawnione do dekodera i testów |
| `ALLOWED_ORIGINS` | nie | dodatkowe adresy stron, jeśli strona stoi poza domeną Vercel z funkcjami |
| `ORDER_RATE_LIMIT` | nie | maks. zamówień z jednego IP na 10 min (domyślnie 6) |

Nie wpisuj tych wartości do repozytorium ani do `config.js`. W `config.js` są tylko ścieżki: `ORDER_API_URL = "/api/submit-order"` i `ORDER_ADMIN_URL = "/api/order-admin"` (przy hostingu strony poza Vercel wpisz pełny adres https).

## Kolejność
1. Supabase: `supabase.sql` (nowa baza) albo migracje 006 → 009; konto admina; wyłącz rejestrację.
2. `config.js`: `SUPABASE_URL` i `SUPABASE_ANON_KEY` (publiczne).
3. Vercel: wdróż repozytorium (preset „Other”, bez build commandu), dodaj zmienne. Zacznij od `ORDER_TEST_MODE=true`, sprawdź przepływ, potem dodaj `FORMSPREE_ENDPOINT` (i `DISCORD_WEBHOOK_URL`) i usuń `ORDER_TEST_MODE`.
4. Panel → *Wysyłka zamówień*: wybierz e-mail / Discord / oba; *Ustawienia e-mail/Discord* pokazują stan zmiennych i wysyłają wiadomość testową.
5. Formspree: przy pierwszym zamówieniu potwierdź adres e-mail właściciela (jednorazowo).

## Nagłówki, cache, bezpieczeństwo
`vercel.json` ustawia CSP, nagłówki bezpieczeństwa i cache (`admin.html` — `no-store`; odpowiedzi funkcji — `no-store`). `.vercelignore` wyklucza `r2-worker/`, `contact-worker/`, `migrations/`, `supabase.sql`, dokumentację. Dla Cloudflare w roli proxy: SSL „Full (strict)”, wyłącz Rocket Loader i Auto Minify, dodaj limit żądań do `/api/submit-order`.

## Znane ograniczenia
- Podgląd kodu rabatowego w koszyku wywołuje publiczną funkcję `validate_discount` w Supabase — ogranicz zgadywanie kodów regułą rate limiting. Ceny końcowe i zużycie kodu liczy funkcja serwerowa.
- Limit żądań i deduplikacja podwójnych wysyłek działają w pamięci instancji funkcji (best-effort). Przycisk blokuje podwójne kliknięcia po stronie przeglądarki.
- Stany magazynowe zmieniasz ręcznie (zamówienia nie są zapisywane, więc nic ich nie odejmuje). E-mail (Formspree) jest jedynym kompletnym zapisem zamówienia — zadbaj o jego kopię.
