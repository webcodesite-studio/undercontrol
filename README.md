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

## Tryb testowy (admin/admin) a produkcja
| | Tryb testowy `admin` / `admin` | Prawdziwe logowanie Supabase |
|---|---|---|
| Kiedy działa | tylko gdy `config.js` ma placeholder `TWOJ-PROJEKT` **i** strona jest otwarta lokalnie (`localhost`, `127.0.0.1` lub plik) | gdy w `config.js` jest prawdziwy `SUPABASE_URL` |
| Dane | tylko w `localStorage` Twojej przeglądarki, nic nie trafia do bazy | baza Supabase |
| Dodawanie/edycja produktów | tak (lokalnie, do podglądu) | tak (zapis do bazy) |
| Upload zdjęć do R2 | **nie** — brak tokenu Supabase, Worker odrzuci (401), a panel w ogóle nie wysyła żądania | **tak**, o ile e-mail jest w `ADMIN_EMAILS` Workera |

- Na opublikowanej domenie (np. `*.vercel.app`) `admin/admin` **nie zadziała** nawet przy placeholderze w configu.
- Test lokalny: `python3 -m http.server 8765` w folderze projektu → `http://localhost:8765/admin.html`.
- Produkcja: wpisz prawdziwe `SUPABASE_URL` i `SUPABASE_ANON_KEY` w `config.js`, utwórz konto admina w Supabase i wpisz jego e-mail w `ADMIN_EMAILS` w `r2-worker/wrangler.toml` (patrz `r2-worker/README.md`).

## Panel sklepu — stałe oferty, sprzedaż, kroje (wersja z migracją 002)

**Wymagana migracja bazy (jednorazowo, dla istniejącego projektu Supabase):** SQL Editor → wklej `migrations/002_variants_archive_sales.sql` → Run. Tylko *dodaje* kolumny `variants`, `archived`, `archived_at` do `products` i tabelę `sales`; istniejące produkty i dane zostają nietknięte (można uruchomić ponownie). Nowa instalacja: wystarczy `supabase.sql`, zawiera już wszystko. Bez migracji sklep działa jak dotąd, ale zapis produktu z nowego panelu i zakładka Sprzedaż zgłoszą błąd z przypomnieniem o migracji.

**Stałe oferty**
- **Kolory i zdjęcia:** każdy kolor ma własną nazwę i własną galerię (dowolna liczba zdjęć, można wybrać kilka plików naraz). Na stronie produktu klient widzi tylko zdjęcia wybranego koloru; zmiana koloru podmienia galerię. Kolor bez zdjęć pokazuje placeholder w tym kolorze.
- **Rozmiary:** lista XS–XXL (bez duplikatów), pas (opcjonalnie) i długość spodni wpisywane ręcznie, domyślnie w **cm** (można przełączyć na cale). Panel zapisuje je w polu `size_chart` w dotychczasowym formacie, więc strona klienta działa bez zmian. Starsze wymiary, których nie da się rozpoznać, trafiają do pola „Inne wymiary” i nie giną.
- **Krój/kategoria** wybierany z listy; **Duplikuj** tworzy kopię produktu (jako niedostępną) do edycji, np. w innym kolorze.
- **Archiwizuj** (zamiast usuwania po zakończeniu oferty): produkt znika ze sklepu, ale zostaje w panelu pod „Pokaż archiwum”, skąd można go **Przywrócić**. Usunięcie na stałe nadal jest dostępne; statystyki sprzedaży są wtedy zachowane.
- Produkty sprzed zmiany (pola `colors` + `images`) działają dalej; po pierwszym zapisaniu w nowym panelu dotychczasowe zdjęcia trafiają do pierwszego koloru — przypisz je do właściwych kolorów.
- Walidacja z komunikatami w oknie edycji (nazwa, cena ≥ 0, unikalne nazwy kolorów, długość > 0, brak powtórzonych rozmiarów).

**Sprzedaż** (zakładka „Sprzedaż”)
- Zamówienia dochodzą mailem, więc sprzedaż rejestrujesz ręcznie przyciskiem **Zarejestruj sprzedaż** (produkt, rozmiar, kolor, liczba sztuk, cena, data). Cena domyślnie = cena produktu, ale można ją zmienić (np. promocja).
- Podsumowanie: łączna liczba sztuk i przychód w zł, tabele według produktu oraz według produktu·rozmiaru·koloru, lista ostatnich wpisów z możliwością usunięcia pomyłki.
- Tabela `sales` jest dostępna tylko dla zalogowanego admina (RLS) i trzyma kopię nazwy produktu, więc archiwizacja/usunięcie produktu nie psuje statystyk.

**Customy:** przy dodawaniu kroju wybierasz go z listy (Baggy, Straight, Slim, Skinny, Wide leg, Loose, Tapered, Bootcut, Relaxed, Cargo) — bez wpisywania; już dodane kroje się nie powtarzają. Poprawiono też ładowanie opcji po wejściu w zakładkę Customy.

**Zmiana nazwy:** „Opcje spodni” → „Panel sklepu”.

**Tryb testowy admin/admin:** wszystko powyżej działa lokalnie (dane w `localStorage`); upload do R2 nadal wymaga prawdziwego logowania Supabase, ale w trybie testowym przy kolorze jest przycisk „Dodaj zdjęcie z adresu URL”, żeby można było sprawdzić galerie.

## Wersja 3 — sprzedaż Customów, cena dziury, kontakt, Ustawienia

**Wymagana migracja bazy (jednorazowo, po 002):** SQL Editor → `migrations/003_hole_price_custom_sales.sql` → Run. Tylko *dodaje*: `site_settings.hole_price` (domyślnie 15 zł — tyle co dotychczas) oraz kolumny `kind`, `cut`, `hole_count`, `hole_price` w `sales`. Jeśli uruchomiłeś wcześniejszą wersję tej migracji (z kolumną `custom_code` po usuniętej funkcji kodów), uruchom jeszcze `migrations/004_drop_custom_code.sql` — usuwa tę kolumnę. Istniejące dane i wpisy sprzedaży zostają (stare wpisy to oferty stałe). Nowa instalacja: wystarczy `supabase.sql`.

**Customy (panel)** — bez okienek pop-up: komunikaty pojawiają się w panelu, usuwanie wymaga drugiego kliknięcia („Usuń” → „Na pewno?”).
- Edycja istniejącego koloru w miejscu: kliknij kolorowe kółko (zmiana koloru), zmień nazwę lub dopłatę w polu i zatwierdź; zapisuje się od razu.
- Dodawanie koloru (nazwa + wybór koloru + dopłata) i kroju (lista rozwijana) odbywa się w formularzu pod listą; to samo dla stylów dziur.

**Sprzedaż**
- Formularz u góry zakładki: wybierasz produkt z **aktualnie dostępnych ofert** (niedostępne i zarchiwizowane są pominięte), jego rozmiar i kolor, liczbę sztuk i zapisujesz. Cena podpowiada się z oferty (można zmienić).
- Tryb **Custom**: wybierasz ręcznie kolor, krój, rozmiar i liczbę dziur (z list/pola), wpisujesz liczbę sztuk i zapisujesz. Cena podpowiada się jako dopłata za kolor + dopłata za krój + liczba dziur × aktualna cena dziury z Ustawień; możesz ją zmienić. Zapisujemy też cenę dziury obowiązującą w dniu sprzedaży.
- Statystyki: łączna liczba sztuk i przychód (zł), według produktu, rozmiaru, koloru, osobno Customy (sztuki, przychód, liczba dziur).

**Cena dziury — jedno źródło prawdy:** *Ustawienia → Cena jednej dziury*, zapisana w `site_settings.hole_price`. Czytają ją: generator (podgląd, etykieta, cena końcowa), panel Customy (podpowiedź) i rejestr sprzedaży Customów (podpowiedź ceny + zapis ceny dziury przy sprzedaży). Domyślna wartość awaryjna jest w jednym miejscu: `DEFAULT_HOLE_PRICE` w `shared.js`. Zmiana ceny nie zmienia już zapisanych sprzedaży.

**Ustawienia** zawierają teraz: nazwę sklepu, nick Instagram, kontakt, politykę prywatności, cenę dziury oraz **wygląd (motywy)** — zakładka „Wygląd” została przeniesiona tutaj. Nazwa, IG i motyw są wczytywane na każdej podstronie (nawigacja, stopka, tytuł karty, linki do Instagrama).


**Zamówienie Customa (mail z Formspree)** zawiera kolor, krój, rozmiar, liczbę dziur, cenę dziury, dopłaty łącznie oraz czytelny opis rozmieszczenia dziur (`dziury_opis`: styl, pozycja x/y i rozmiar w %).

**Formularz „Napisz do administratora”** (`kontakt.html`): wiadomość → Cloudflare Worker (`contact-worker/`) → webhook Discorda. Adres webhooka jest wyłącznie sekretem Workera, nie ma go nigdzie w kodzie strony. Walidacja (imię ≤ 60, kontakt ≤ 120, wiadomość 10–1000 znaków, maks. 2 linki), pułapka na boty, minimalny czas wypełnienia, limit 3 wiadomości / 10 min / IP, CORS tylko dla Twojej domeny, wiadomość oczyszczana z pingów. Wdrożenie: `contact-worker/README.md`, potem wpisz adres Workera w `config.js` (`CONTACT_API_URL`). Dopóki tego nie zrobisz, formularz pokaże informację o braku konfiguracji.

**Admin/admin i Supabase:** bez zmian — tryb testowy działa lokalnie na placeholderze w `config.js`, a prawdziwy login Supabase przejmuje po wpisaniu danych. Tryb testowy nadal nie wgrywa plików do R2.

## Co dodać później
- Zdjęcia/warstwy PNG zamiast SVG-placeholdera w `index.html` (`#pantsSvg`) — podmień na `<img>` z warstwami nakładanymi przez CSS, albo osobny SVG per kolor.
- Upload zdjęć opcji przez Supabase Storage (bucket publiczny do odczytu, zapis tylko zalogowani) — rozszerzenie `admin.js`.
- Cloudflare Turnstile zamiast samego honeypota, jeśli pojawi się spam.
