-- Migracja 008 — ID produktów (sku), tabele rozmiarów, kody rabatowe zużywane tylko przez Worker (service_role).
-- Bezpieczna dla istniejących danych; można uruchomić ponownie. Wymaga wcześniejszych migracji 006 i 007.

-- 11) Identyfikatory produktów (ID do podawania na Instagramie), tabele rozmiarów, zabezpieczenie kodów rabatowych
alter table hats add column if not exists sku text;
alter table products add column if not exists sku text;
-- uzupełnij brakujące ID: H001, H002… / P001, P002…
update hats h set sku = 'H' || lpad(n.rn::text, 3, '0') from (select id, row_number() over (order by created_at, id) rn from hats where sku is null) n where h.id = n.id and h.sku is null;
update products p set sku = 'P' || lpad(n.rn::text, 3, '0') from (select id, row_number() over (order by created_at, id) rn from products where sku is null) n where p.id = n.id and p.sku is null;
create unique index if not exists hats_sku_key on hats (upper(sku));
create unique index if not exists products_sku_key on products (upper(sku));

create table if not exists size_charts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  columns jsonb not null default '[]',   -- ["Pas (cm)","Długość (cm)"]
  rows jsonb not null default '[]',      -- [{"size":"S","values":["72","102"]}]
  note text,
  default_for text check (default_for in ('hats','pants','custom')), -- tabela domyślna dla całej kategorii
  created_at timestamptz default now()
);
create unique index if not exists size_charts_default_key on size_charts (default_for) where default_for is not null;
alter table size_charts enable row level security;
drop policy if exists "Public read size_charts" on size_charts;
create policy "Public read size_charts" on size_charts for select using (true);
drop policy if exists "Authenticated write size_charts" on size_charts;
create policy "Authenticated write size_charts" on size_charts for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
alter table hats add column if not exists size_chart_id uuid references size_charts(id) on delete set null;
alter table products add column if not exists size_chart_id uuid references size_charts(id) on delete set null;

-- Zużycie kodu rabatowego tylko przez funkcję serwerową zamówień (klucz service_role) — z przeglądarki nie da się ani zużyć, ani cofnąć użycia.
create or replace function public.release_discount(p_code text)
returns void language sql security definer set search_path = public as $$
  update discount_codes set used_count = greatest(0, used_count - 1) where code = upper(btrim(p_code));
$$;
revoke all on function public.redeem_discount(text, numeric) from public, anon, authenticated;
revoke all on function public.release_discount(text) from public, anon, authenticated;
grant execute on function public.redeem_discount(text, numeric) to service_role;
grant execute on function public.release_discount(text) to service_role;
