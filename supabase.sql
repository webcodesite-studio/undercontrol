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
  custom_code text,
  created_at timestamptz default now()
);
alter table sales enable row level security;
create policy "Authenticated all sales" on sales for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
