// Uzupełnij po stworzeniu projektu w Supabase (Project Settings → API)
const SUPABASE_URL = "https://TWOJ-PROJEKT.supabase.co";
const SUPABASE_ANON_KEY = "TWOJ_ANON_KEY"; // to jest publiczny klucz, chroniony regułami RLS — OK że jest w kodzie

const FORMSPREE_ENDPOINT = "https://formspree.io/f/TWOJ_ID"; // z formspree.io
const IG_NICK = "twoj_nick"; // bez @

// Upload zdjęć do Cloudflare R2 (przez Worker) — instrukcja w folderze r2-worker/README.md
const R2_UPLOAD_URL = "https://TWOJ-WORKER.workers.dev";
// Upload jest autoryzowany tokenem sesji Supabase (logowanie do panelu) — nie ma już sekretu w kodzie strony.
