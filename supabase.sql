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
  offer_enabled boolean default true,
  offer_text text default 'Wysyłka gratis przy zamówieniu do niedzieli!',
  contact_text text default 'Masz pytania? Napisz do nas na Instagramie.',
  constraint single_row check (id = 1)
);
alter table site_settings enable row level security;
create policy "Public read settings" on site_settings for select using (true);
create policy "Authenticated write settings" on site_settings for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
insert into site_settings (id) values (1);

-- 6) Przykładowe dane startowe opcji
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