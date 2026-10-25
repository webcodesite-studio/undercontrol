-- Migracja 007 — strona główna z 3 kartami (usuwa ofertę promocyjną), flagi kanałów zamówień (e-mail / Discord).
-- Bezpieczna dla istniejących danych; można uruchomić ponownie. Wymaga wcześniejszej migracji 006 lub supabase.sql.
drop table if exists home_offer;
alter table site_settings add column if not exists order_email_enabled boolean not null default false;
alter table site_settings add column if not exists order_discord_enabled boolean not null default false;
alter table site_settings add column if not exists home_cards jsonb;
-- Gotowe spodnie (tabela products) zostają bez zmian; kolory, rozmiary i stany są zapisywane w kolumnie variants (panel: „Gotowe spodnie”).
