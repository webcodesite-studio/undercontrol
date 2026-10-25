-- Migracja 006 — usuwa zamówienia z bazy (płatność i potwierdzenie przez Instagram), czapki z wariantami kolorów,
-- zużycie kodu rabatowego bez danych klienta, oferta na stronie głównej.
-- Działa zarówno po 004, jak i po wcześniejszej wersji 005 (czapki + zamówienia). Można uruchomić ponownie.
-- UWAGA: usuwa tabelę orders (zapisane zamówienia i dane klientów), jeśli istnieje.

drop function if exists public.place_order(jsonb, jsonb, text);
drop function if exists public.set_order_status(uuid, text);
drop table if exists orders;

-- 10) Czapki (warianty kolorystyczne), kody rabatowe, oferta na stronie głównej.
-- Strona NIE zapisuje zamówień ani danych klientów — płatność i potwierdzenie odbywają się przez Instagram.
alter table site_settings add column if not exists custom_base_price numeric not null default 0 check (custom_base_price >= 0);

create table if not exists hats (
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
drop policy if exists "Public read active hats" on hats;
create policy "Public read active hats" on hats for select using (active);
drop policy if exists "Authenticated all hats" on hats;
create policy "Authenticated all hats" on hats for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


alter table hats add column if not exists variants jsonb not null default '[]';
do $$
begin
  if exists (select 1 from information_schema.columns where table_name='hats' and column_name='colors') then
    -- stare czapki: każdy kolor → wariant; globalne rozmiary i stan trafiają do każdego rozmiaru (sprawdź stany w panelu!)
    execute $q$
      update hats h set variants = coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', coalesce(nullif(c->>'name',''),'Standard'), 'hex', coalesce(c->>'hex','#555555'),
          'images', case when jsonb_array_length(coalesce(c->'images','[]'::jsonb)) > 0 then c->'images' else h.images end,
          'active', true, 'price', null, 'description', null,
          'sizes', (select coalesce(jsonb_agg(jsonb_build_object('size', s, 'stock', h.stock)), '[]'::jsonb)
                    from jsonb_array_elements_text(case when jsonb_array_length(h.sizes) > 0 then h.sizes else '["Uniwersalny"]'::jsonb end) s)))
        from jsonb_array_elements(case when jsonb_array_length(h.colors) > 0 then h.colors else '[{}]'::jsonb end) c), '[]'::jsonb)
      where h.variants = '[]'::jsonb $q$;
    alter table hats drop column colors, drop column sizes, drop column images, drop column stock;
  end if;
end $$;


create table if not exists discount_codes (
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
drop policy if exists "Authenticated all discount_codes" on discount_codes;
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

-- Oferta promocyjna na stronie głównej (jeden wiersz)
create table if not exists home_offer (
  id int primary key default 1 check (id = 1),
  active boolean not null default false,
  title text default '',
  description text default '',
  promo_text text default '',      -- np. „−20%” albo krótki komunikat
  image_url text,
  button_label text default 'Zobacz',
  button_target text not null default 'hats' check (button_target in ('hats','pants')),
  start_date date,
  end_date date
);
alter table home_offer enable row level security;
drop policy if exists "Public read home_offer" on home_offer;
create policy "Public read home_offer" on home_offer for select using (true);
drop policy if exists "Authenticated write home_offer" on home_offer;
create policy "Authenticated write home_offer" on home_offer for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
insert into home_offer (id) values (1) on conflict do nothing;
