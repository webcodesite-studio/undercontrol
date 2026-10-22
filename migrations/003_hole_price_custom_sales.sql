-- Migracja 003 — cena dziury w Ustawieniach + sprzedaż Customów. Bezpieczna dla istniejących danych (tylko dodaje kolumny).

-- Jedno źródło prawdy dla ceny dziury (generator, podgląd, panel, dekoder, sprzedaż)
alter table site_settings add column if not exists hole_price numeric not null default 15 check (hole_price >= 0);

-- Sprzedaż: rozróżnienie ofert stałych i Customów
alter table sales add column if not exists kind text not null default 'offer' check (kind in ('offer','custom'));
alter table sales add column if not exists cut text;           -- krój (Customy)
alter table sales add column if not exists hole_count int;     -- liczba dziur (Customy)
alter table sales add column if not exists hole_price numeric; -- cena dziury obowiązująca w chwili zamówienia
alter table sales add column if not exists custom_code text;   -- wklejony kod konfiguracji
