// Uzupełnij po stworzeniu projektu w Supabase (Project Settings → API)
const SUPABASE_URL = "https://TWOJ-PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "TWOJ_ANON_KEY"; // to jest publiczny klucz, chroniony regułami RLS — OK że jest w kodzie

// Formularz „Napisz do administratora” — adres Workera z contact-worker/ (webhook Discorda jest tylko w Workerze, nie tutaj)
const CONTACT_API_URL = "https://TWOJ-CONTACT-WORKER.workers.dev";
const IG_NICK = "twoj_nick"; // bez @

// Upload zdjęć do Cloudflare R2 (przez Worker) — instrukcja w folderze r2-worker/README.md
const R2_UPLOAD_URL = "https://TWOJ-WORKER.workers.dev";
// Upload jest autoryzowany tokenem sesji Supabase (logowanie do panelu) — nie ma już sekretu w kodzie strony.

// Zamówienia: funkcje serverless w katalogu api/ (Vercel). „Złóż zamówienie” wysyła koszyk automatycznie na ORDER_API_URL; funkcja przekazuje
// zamówienie przez Formspree (e-mail) i/lub na Discord. Adresy Formspree/Discord i inne sekrety są WYŁĄCZNIE zmiennymi środowiskowymi po stronie
// serwera (patrz DEPLOY.md) — nie ma ich w tym pliku. Ścieżki względne działają, gdy strona i funkcje są na tej samej domenie Vercel;
// przy hostingu strony gdzie indziej wpisz pełny adres https://twoja-domena.vercel.app/api/submit-order.
// Na GitHub Pages (statyczny hosting) nie ma funkcji serverless — wtedy zostaje puste (koszyk kieruje na Instagram), dopóki nie wpiszesz pełnego adresu zewnętrznego.
const ON_GH_PAGES = /\.github\.io$/.test(location.hostname);
const ORDER_API_URL = ON_GH_PAGES ? "" : "/api/submit-order";
const ORDER_ADMIN_URL = ON_GH_PAGES ? "" : "/api/order-admin";   // panel: status integracji, wiadomość testowa, dekoder Base64
