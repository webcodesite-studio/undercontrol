-- Migracja 009 — oznaczenie produktów testowych; usunięcie starego licznika numerów zamówień (zamówienia nie trafiają do SQL).
-- Bezpieczna dla istniejących danych; można uruchomić ponownie. Wymaga wcześniejszych migracji (006–008).

-- 12) Oznaczenie produktów testowych (zamówienia NIE są zapisywane w SQL — e-mail jest jedynym pełnym zapisem)
alter table hats add column if not exists is_test boolean not null default false;
alter table products add column if not exists is_test boolean not null default false;

-- (starszy licznik numerów zamówień nie jest już używany — zamówienia nie są niczego zapisywane w SQL)
drop function if exists public.next_order_number();
drop table if exists order_counters;

-- Sposób powiadamiania o zamówieniach: e-mail (Formspree) / Discord / oba (domyślnie oba — do testów). Publiczne flagi, bez sekretów.
alter table site_settings alter column order_email_enabled set default true;
alter table site_settings alter column order_discord_enabled set default true;
update site_settings set order_email_enabled = true, order_discord_enabled = true where not order_email_enabled and not order_discord_enabled;
