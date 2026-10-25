-- 1) Tabela opcji
create table options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('kolor','dziury','kroj')),
  name text not null,
  hex text,
  price_extra numeric default 0,
  available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 2) Włącz RLS
alter table options enable row level security;

-- 3) Każdy może czytać (strona klienta)
create policy "Public read" on options
  for select using (true);

-- 4) Tylko zalogowani mogą zapisywać (panel właściciela)
create policy "Authenticated write" on options
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5) Ustawienia strony (baner z ofertą + sekcja kontakt) — jeden wiersz
create table site_settings (
  id int primary key default 1,
  shop_name text default 'TWOJA MARKA',
  seller_ig text default 'twoj_nick',
  offer_enabled boolean default true,
  offer_text text default 'Wysyłka gratis przy zamówieniu do niedzieli!',
  contact_text text default 'Masz pytania? Napisz do nas na Instagramie.',
  policy_md text default '# Polityka prywatności

Dane podane w formularzu (nick na Instagramie, opcjonalnie e-mail) wykorzystujemy wyłącznie do kontaktu w sprawie zamówienia.

Nie udostępniamy ich podmiotom trzecim poza dostawcami usług niezbędnych do obsługi zamówienia.',
  theme_bg text default '#111113',
  theme_surface text default '#19191c',
  theme_text text default '#f2f2f0',
  theme_accent text default '#d4ff3f',
  theme_muted text default '#8a8a8f',
  theme_border text default '#2c2c30',
  hole_price numeric not null default 15 check (hole_price >= 0), -- cena jednej dziury w Customach (zł), jedno źródło prawdy
  customy_base_image text, -- URL zdjęcia spodni (z R2) pod edytor dziur w Customach
  constraint single_row check (id = 1)
);
alter table site_settings enable row level security;
create policy "Public read settings" on site_settings for select using (true);
create policy "Authenticated write settings" on site_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
insert into site_settings (id) values (1);

-- 6) Gotowe produkty na stronę główną (sklep)
create table products (
  id uuid primary key default gen_random_uuid(),
  category text not null,          -- np. 'Baggy', 'Straight', 'Slim'
  name text not null,
  price numeric not null default 0,
  colors jsonb default '["#555555"]', -- lista kolorów (placeholder dopóki nie ma zdjęć)
  images jsonb default '[]',          -- lista URL-i zdjęć z R2, jedno na kolor/wariant
  description text,
  size_chart text, -- wymiary, jedna linia na rozmiar, np. "S: pas 76cm, długość 100cm"
  variants jsonb default '[]', -- [{"name":"Czarny","color":"#1a1a1a","images":[...]}] — zdjęcia przypisane do koloru
  archived boolean default false,
  archived_at timestamptz,
  available boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table products enable row level security;
create policy "Public read products" on products for select using (true);
create policy "Authenticated write products" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

insert into products (category,name,price,colors,description,size_chart,sort_order) values
('Baggy','Baggy Black',249,'["#1a1a1a","#4a4a4f"]','Luźny krój, dostępny w 2 kolorach, przetarcia na kolanach.',
 'S: pas 72cm, długość 102cm
M: pas 78cm, długość 104cm
L: pas 84cm, długość 106cm
XL: pas 90cm, długość 108cm',1),
('Baggy','Baggy Khaki',249,'["#8a7a52"]','Luźny krój w kolorze khaki.',
 'S: pas 72cm, długość 102cm
M: pas 78cm, długość 104cm
L: pas 84cm, długość 106cm',2),
('Straight','Straight Graphite',229,'["#4a4a4f"]','Prosty krój, grafit, bez przetarć.',
 'S: pas 74cm, długość 100cm
M: pas 80cm, długość 102cm
L: pas 86cm, długość 104cm',3),
('Slim','Slim Écru',259,'["#cfc6ae"]','Dopasowany krój w jasnym kolorze.',
 'S: pas 70cm, długość 98cm
M: pas 76cm, długość 100cm',4);

-- 6b) Style dziur (zdjęcia przetarć do wyboru w edytorze Customów)
create table hole_styles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table hole_styles enable row level security;
create policy "Public read hole_styles" on hole_styles for select using (true);
create policy "Authenticated write hole_styles" on hole_styles for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 7) Kampanie (planowane banery z harmonogramem)
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  banner_text text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now()
);
alter table campaigns enable row level security;
create policy "Public read campaigns" on campaigns for select using (true);
create policy "Authenticated write campaigns" on campaigns for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 8) Przykładowe dane startowe opcji konfiguratora
insert into options (category,name,hex,price_extra,available,sort_order) values
('kolor','Czarny','#1a1a1a',0,true,1),
('kolor','Grafit','#4a4a4f',0,true,2),
('kolor','Khaki','#8a7a52',0,true,3),
('kolor','Écru','#cfc6ae',10,true,4),
('dziury','Brak',null,0,true,1),
('dziury','Kolana',null,15,true,2),
('dziury','Mocne zniszczenie',null,25,true,3),
('kroj','Baggy',null,0,true,1),
('kroj','Straight',null,0,true,2),
('kroj','Slim',null,0,true,3);

-- 9) Sprzedaż (statystyki stałych ofert; tylko zalogowany admin)
create table sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  size text,
  color_name text,
  color_hex text,
  quantity int not null check (quantity > 0),
  unit_price numeric not null check (unit_price >= 0),
  sold_at date not null default current_date,
  kind text not null default 'offer' check (kind in ('offer','custom')),
  cut text,
  hole_count int,
  hole_price numeric,
  created_at timestamptz default now()
);
alter table sales enable row level security;
create policy "Authenticated all sales" on sales for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 10) Czapki (warianty kolorystyczne), kody rabatowe, oferta na stronie głównej.
-- Strona NIE zapisuje zamówień ani danych klientów — płatność i potwierdzenie odbywają się przez Instagram.
alter table site_settings add column if not exists custom_base_price numeric not null default 0 check (custom_base_price >= 0);

create table hats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric not null default 0 check (price >= 0), -- cena bazowa; wariant może mieć własną
  -- [{"name":"Czarny","hex":"#1a1a1a","images":["https://..."],"active":true,"price":null,"description":null,
  --   "sizes":[{"size":"M","stock":5},{"size":"L","stock":0}]}]
  variants jsonb not null default '[]',
  active boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table hats enable row level security;
create policy "Public read active hats" on hats for select using (active);
create policy "Authenticated all hats" on hats for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create table discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and length(code) between 2 and 40),
  type text not null check (type in ('percent','fixed')),
  value numeric not null check (value > 0 and (type <> 'percent' or value <= 100)),
  expires_at date,
  min_order numeric not null default 0 check (min_order >= 0),
  usage_limit int check (usage_limit is null or usage_limit > 0),
  used_count int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table discount_codes enable row level security;
create policy "Authenticated all discount_codes" on discount_codes for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create or replace function public.calc_discount(p_code text, p_subtotal numeric, p_lock boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d discount_codes; v_code text := upper(btrim(coalesce(p_code,''))); v_amt numeric;
begin
  if v_code = '' then return jsonb_build_object('valid',false,'error','Wpisz kod rabatowy.'); end if;
  if p_lock then select * into d from discount_codes where code = v_code for update;
  else select * into d from discount_codes where code = v_code; end if;
  if not found then return jsonb_build_object('valid',false,'error','Nieprawidłowy kod rabatowy.'); end if;
  if not d.active then return jsonb_build_object('valid',false,'error','Ten kod jest nieaktywny.'); end if;
  if d.expires_at is not null and d.expires_at < (now() at time zone 'Europe/Warsaw')::date then
    return jsonb_build_object('valid',false,'error','Ten kod wygasł.'); end if;
  if d.usage_limit is not null and d.used_count >= d.usage_limit then
    return jsonb_build_object('valid',false,'error','Limit użyć tego kodu został wyczerpany.'); end if;
  if p_subtotal < d.min_order then
    return jsonb_build_object('valid',false,'error','Minimalna wartość zamówienia dla tego kodu to '||to_char(d.min_order,'FM999990.00')||' zł.'); end if;
  v_amt := case when d.type = 'percent' then round(p_subtotal * d.value / 100, 2) else least(d.value, p_subtotal) end;
  return jsonb_build_object('valid',true,'code',d.code,'type',d.type,'value',d.value,'discount',v_amt);
end $$;

-- sprawdzenie kodu (bez zmian w bazie)
create or replace function public.validate_discount(p_code text, p_subtotal numeric)
returns jsonb language sql security definer set search_path = public as $$
  select public.calc_discount(p_code, p_subtotal, false);
$$;
-- zużycie jednego użycia kodu przy zatwierdzeniu podsumowania (zapisuje tylko licznik, żadnych danych klienta)
create or replace function public.redeem_discount(p_code text, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  r := public.calc_discount(p_code, p_subtotal, true);
  if (r->>'valid')::boolean then update discount_codes set used_count = used_count + 1 where code = r->>'code'; end if;
  return r;
end $$;
revoke all on function public.calc_discount(text,numeric,boolean) from public, anon, authenticated;
grant execute on function public.validate_discount(text,numeric) to anon, authenticated;
grant execute on function public.redeem_discount(text,numeric) to anon, authenticated;

-- Ustawienia zamówień i strony głównej (publiczne flagi — NIE zawierają sekretów; adres Formspree / webhook są tylko w zmiennych środowiskowych serwera)
alter table site_settings add column if not exists order_email_enabled boolean not null default true;
alter table site_settings add column if not exists order_discord_enabled boolean not null default true;
alter table site_settings add column if not exists home_cards jsonb; -- [{"key":"hats|pants|custom","title":"","description":"","image_url":"","button_label":""}]

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
