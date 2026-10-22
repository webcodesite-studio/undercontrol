-- Migracja 002 — warianty kolorystyczne, archiwizacja ofert, statystyki sprzedaży.
-- Bezpieczna dla istniejących danych: tylko dodaje kolumny/tabelę, niczego nie usuwa i można ją uruchomić ponownie.

-- 1) Produkty: kolory ze zdjęciami przypisanymi do koloru + archiwum
alter table products add column if not exists variants jsonb default '[]';  -- [{"name":"Czarny","color":"#1a1a1a","images":["https://..."]}]
alter table products add column if not exists archived boolean default false;
alter table products add column if not exists archived_at timestamptz;
-- Stare kolumny `colors` i `images` zostają (panel nadal je uzupełnia dla zgodności).
-- Istniejące produkty bez `variants` działają dalej: strona użyje `colors` + `images`.

-- 2) Sprzedaż (tylko dla zalogowanego admina — brak publicznego odczytu)
create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null, -- usunięcie produktu nie kasuje statystyk
  product_name text not null,                                 -- kopia nazwy z chwili sprzedaży
  size text,
  color_name text,
  color_hex text,
  quantity int not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  sold_at date not null default current_date,
  created_at timestamptz default now()
);
alter table sales enable row level security;
drop policy if exists "Authenticated all sales" on sales;
create policy "Authenticated all sales" on sales for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
