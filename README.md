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

## 3. Zamówienia
Strona **nie przetwarza płatności i nie zapisuje zamówień ani danych klientów**. Klient przygotowuje koszyk; płatność i potwierdzenie zamówienia odbywają się na Instagramie (nick ustawiasz w panelu: *Ustawienia Instagram*). Zamówienie wysyła automatycznie funkcja serverless z `api/` (Formspree e-mail i/lub Discord) — patrz „Wersja 9”.

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


**Custom w koszyku:** kolor, krój, rozmiar, dziury (styl, pozycja x/y, rozmiar w %) i uwagi trafiają do koszyka i końcowego podsumowania, które klient wysyła na Instagramie.

**Formularz „Napisz do administratora”** (`kontakt.html`): wiadomość → Cloudflare Worker (`contact-worker/`) → webhook Discorda. Adres webhooka jest wyłącznie sekretem Workera, nie ma go nigdzie w kodzie strony. Walidacja (imię ≤ 60, kontakt ≤ 120, wiadomość 10–1000 znaków, maks. 2 linki), pułapka na boty, minimalny czas wypełnienia, limit 3 wiadomości / 10 min / IP, CORS tylko dla Twojej domeny, wiadomość oczyszczana z pingów. Wdrożenie: `contact-worker/README.md`, potem wpisz adres Workera w `config.js` (`CONTACT_API_URL`). Dopóki tego nie zrobisz, formularz pokaże informację o braku konfiguracji.

**Admin/admin i Supabase:** bez zmian — tryb testowy działa lokalnie na placeholderze w `config.js`, a prawdziwy login Supabase przejmuje po wpisaniu danych. Tryb testowy nadal nie wgrywa plików do R2.

## Co dodać później
- Zdjęcia/warstwy PNG zamiast SVG-placeholdera w `index.html` (`#pantsSvg`) — podmień na `<img>` z warstwami nakładanymi przez CSS, albo osobny SVG per kolor.
- Upload zdjęć opcji przez Supabase Storage (bucket publiczny do odczytu, zapis tylko zalogowani) — rozszerzenie `admin.js`.
- Cloudflare Turnstile zamiast samego honeypota, jeśli pojawi się spam.

## Wersja 5 — Czapki / Spodnie / Customowe spodnie, koszyk, opcjonalna wysyłka zamówień, nowy panel

**Migracje SQL (Supabase → SQL Editor):** nowa instalacja = tylko `supabase.sql`. Istniejący projekt: po 004 uruchom `migrations/006_variants_no_orders.sql`, potem `migrations/007_pants_integrations.sql`. Uwaga: 006 usuwa tabelę `orders` (jeśli istniała po wcześniejszej wersji) i oferty promocyjne z 007 (`home_offer`).

**Struktura strony:** `index.html` — dokładnie trzy karty: **Czapki** (`czapki.html`, `czapka.html`), **Spodnie** (`spodnie.html`, `spodnie-produkt.html` — stała oferta, tabela `products`) i **Customowe spodnie** (`customy.html` — konfigurator). Menu u góry ma te same trzy sekcje i koszyk. Czapki nie mają żadnej personalizacji, a konfigurator jest tylko w „Customowych spodniach”.

**Warianty (czapki i gotowe spodnie):** każdy kolor ma własne zdjęcia, rozmiary ze stanami (i opcjonalnymi wymiarami), cenę i opis; klient widzi tylko dane wybranego koloru, niedostępnych rozmiarów nie da się wybrać, a do koszyka trafia dokładny wariant. Starsze „stałe oferty” (bez stanów) wczytują się z rozmiarami z `size_chart` i **stanem 0** — uzupełnij stany w panelu *Gotowe spodnie*.

**Koszyk** (localStorage `cart_v1`, tylko pozycje + kod rabatowy + sposób odbioru): trzy osobne grupy — czapki, gotowe spodnie, spodnie custom. Dane kontaktowe i uwagi są dobrowolne i trzymane wyłącznie w pamięci strony. Kody rabatowe jak wcześniej (`validate_discount` / `redeem_discount`, liczony jest tylko licznik użyć).

**Zamówienia:** patrz „Wersja 9” niżej — funkcje serverless w `api/` (Vercel).

**Panel (menu boczne):** Pulpit (liczniki i lista kontrolna konfiguracji), Czapki, Gotowe spodnie, Customowe spodnie (opcje, style dziur, ceny), Kody rabatowe, Strona główna i nawigacja (teksty/zdjęcia trzech kart + baner), Ustawienia e-mail / Discord / Instagram, Ustawienia ogólne, Wiadomość do admina. Panel nie przechowuje zamówień ani danych klientów.

**Zmiany stanów:** ponieważ zamówienia nie są zapisywane, strona sama nie zmniejsza stanów magazynowych — aktualizujesz je ręcznie po potwierdzeniu zamówienia na Instagramie.

**Tryb testowy:** gdy `config.js` ma placeholder Supabase, katalog, kody i ustawienia działają na `localStorage` przeglądarki — tylko podgląd.

## Wersja 6 — kody zamówień, dekoder, ID produktów, tabele rozmiarów, zabezpieczenia

**Migracja:** `migrations/008_sku_sizecharts_security.sql` (po 006 i 007; nowa instalacja — wystarczy `supabase.sql`). Dodaje ID produktów (`sku`, unikalne), tabele rozmiarów i odbiera przeglądarce prawo zużywania kodów rabatowych (`redeem_discount` tylko dla `service_role`). Przykładowe dane: `migrations/seed_demo_catalog.sql`.

**Zamówienie:** koszyk wysyła do Workera tylko wybory klienta (produkt + kolor + rozmiar + ilość, a dla customów kolor, krój, rozmiar, dziury, uwagi) oraz kod rabatowy i sposób odbioru. **Worker sam wylicza ceny, rabat i sumę z katalogu w Supabase**, sprawdza dostępność i stany, zużywa użycie kodu rabatowego i dopiero wtedy wysyła powiadomienia (e-mail i/lub Discord — niezależnie). Nie zbieramy e-maila, telefonu, adresu ani imienia klienta.

*(Krótki kod zamówienia z wersji 6 został zastąpiony numerem `ORD-RRRRMMDD-NNNN` — patrz wersja 7.)*

**ID produktu:** każdy produkt ma unikalne, edytowalne w panelu ID (np. `H001`, `P014`, customy: `CUSTOM`), widoczne pod produktem z przyciskiem „Kopiuj” i podpowiedzią o Instagramie; jest też w koszyku i powiadomieniach.

**Tabele rozmiarów:** panel *Tabele rozmiarów* — dowolne kolumny i wiersze, tabela domyślna dla czapek / gotowych spodni / customów albo przypisana do konkretnego produktu (w jego edycji). Wyświetlają się pod produktem (przewijane w poziomie na telefonie), a wybrany rozmiar jest podświetlany.

**Zdjęcia:** *Zdjęcia produktów* (wgrywanie, wymiana, usuwanie, kolejność — per kolor) oraz *Zawartość strony głównej* (zdjęcia i kolejność trzech kart). Tylko adresy HTTPS.

**Bezpieczeństwo** (szczegóły i checklista wdrożenia: `DEPLOY.md`): sekrety wyłącznie w zmiennych środowiskowych serwera; RLS w Supabase; upload tylko JPEG/PNG/GIF/WebP rozpoznawany po zawartości, losowe nazwy, limit 5 MB; ceny/rabaty po stronie serwera; nagłówki i CSP (`vercel.json`, `_headers`); panel wylogowuje po 30 min bezczynności; tymczasowe logowanie `admin/admin` na domenie publicznej zostało **usunięte** (działa tylko na localhost, gdy Supabase nie jest skonfigurowany).

## Wersja 9 — automatyczne składanie zamówień przez funkcję serverless (`/api/submit-order`)

**Przepływ:** klient dodaje produkty, wpisuje nazwę użytkownika Instagram i klika **„Złóż zamówienie”**. Strona automatycznie wysyła koszyk (POST) do funkcji serverless `api/submit-order.js` (Vercel). Funkcja liczy ceny/rabat po stronie serwera, nadaje numer zamówienia i wysyła kompletne zamówienie **przez Formspree (e-mail) i/lub na Discord** — według wyboru właściciela w panelu (*Wysyłka zamówień*: tylko e-mail / tylko Discord / oba; domyślnie oba). **Ekran „Zamówienie przyjęte” z numerem pojawia się dopiero, gdy serwer potwierdzi wysyłkę.** Przy błędzie klient widzi jasny komunikat, a koszyk zostaje. Nie ma żadnej „wiadomości do skopiowania” ani wysyłania zamówienia przez Instagram — Instagram służy dopiero po przyjęciu zamówienia (pytania, płatność, potwierdzenie). Nic nie jest zapisywane w SQL ani w innej bazie.

**Zmienne środowiskowe (Vercel → Settings → Environment Variables; patrz `DEPLOY.md`):** `FORMSPREE_ENDPOINT`, `DISCORD_WEBHOOK_URL`, `ORDER_TEST_MODE`, `ORDER_NOTIFY_MODE` (awaryjny wybór `email|discord|both`), opcjonalnie `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `ORDER_SIGNING_SECRET`, `ADMIN_EMAILS`, `ALLOWED_ORIGINS`, `ORDER_RATE_LIMIT`. Żaden sekret nie jest w kodzie strony — `GET /api/submit-order` zwraca tylko tryb, flagę testu i gotowość.

**Tryb testowy:** `ORDER_TEST_MODE=true` — funkcja niczego nie wysyła; strona pokazuje czerwony baner „TRYB TESTOWY — żadna wiadomość NIE została wysłana”, numer testowy i podgląd dokładnie tego, co zostałoby wysłane. Po dodaniu prawdziwych kluczy i usunięciu `ORDER_TEST_MODE` ten sam przycisk wysyła prawdziwe zamówienia — bez zmian we froncie. Bez skonfigurowanego kanału (i bez trybu testowego) przycisk jest wyłączony z komunikatem, a serwer odrzuca zamówienie (503).

**Podwójne kliknięcia:** przycisk blokuje się na czas wysyłki; dodatkowo każda próba ma `submission_id`, więc powtórzone żądanie dostaje ten sam numer i nic nie jest wysyłane drugi raz.

**Numer zamówienia:** `ORD-RRRRMMDD-GGMMSS-XXXX` (bez licznika i bazy). **Temat e-maila:** `New order ORD-… from @nick`. **Treść:** numer, @nick, data i godzina, status, wszystkie produkty (nazwa, ID, kategoria, kolor, rozmiar, ilość, cena jednostkowa), suma częściowa, kod i kwota rabatu, razem, odbiór/wysyłka, uwagi, szczegóły spodni custom (czytelnie) i pełny blok Base64 (w polu `custom_pants_base64_code` oraz w `complete_order`; ta sama treść idzie na Discord).

**Dekoder (panel, tylko admin):** `/api/order-admin` — odczyt bloku Base64 z e-maila (walidacja, opcjonalny podpis). Migracja `009` usuwa stary licznik numerów i ustawia domyślnie oba kanały powiadomień.
