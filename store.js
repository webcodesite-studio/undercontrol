// Warstwa danych sklepu: czapki i gotowe spodnie (warianty kolorystyczne), kody rabatowe, karty strony głównej, ustawienia zamówień.
// Strona NIE zapisuje zamówień ani danych klientów.
// Produkcja: Supabase. Gdy config.js ma jeszcze placeholder Supabase (test lokalny), dane są w localStorage przeglądarki.
const Store = (function(){
  const LOCAL = typeof SUPABASE_URL === "undefined" || SUPABASE_URL.includes("TWOJ-PROJEKT");
  const sb = LOCAL ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const v = (name, hex, sizes, extra={}) => ({ name, hex, images:[], active:true, price:null, description:null, sizes, ...extra });
  const sz = (size, stock, note) => ({ size, stock, note: note || null });
  const SAMPLE_HATS = [
    {id:"sample-1", sku:"H001", name:"Dad Cap Classic", description:"Bawełniana czapka z daszkiem, regulowany pasek z tyłu.", price:79, active:true, variants:[
      v("Czarny","#1a1a1a",[sz("Uniwersalny",10)]),
      v("Khaki","#8a7a52",[sz("Uniwersalny",4)], {price:85, description:"Wersja khaki z lekko wyblakłym wykończeniem."})]},
    {id:"sample-2", sku:"H002", name:"Beanie Rib", description:"Ciepła czapka zimowa z dzianiny w prążki.", price:59, active:true, variants:[
      v("Grafit","#4a4a4f",[sz("S/M",5),sz("L/XL",0)]),
      v("Écru","#cfc6ae",[sz("S/M",0),sz("L/XL",3)])]},
    {id:"sample-3", sku:"H003", name:"Bucket Hat", description:"Kapelusz typu bucket, lekki i oddychający.", price:89, active:true, variants:[
      v("Czarny","#1a1a1a",[sz("S/M",0)])]},
    {id:"sample-4", sku:"H004", name:"Snapback Pro", description:"Płaski daszek, sztywny front, regulacja z tyłu.", price:99, active:true, variants:[
      v("Czarny","#1a1a1a",[sz("Uniwersalny",12)]),
      v("Biały","#f2f2f0",[sz("Uniwersalny",6)]),
      v("Granat","#1f2a44",[sz("Uniwersalny",1)], {description:"Ostatnia sztuka w kolorze granatowym."}),
      v("Ukryty test","#ff00aa",[sz("Uniwersalny",9)], {active:false})]},
    {id:"sample-5", sku:"H005", name:"Fisherman Beanie", description:"Krótka czapka bez mankietu, miękka dzianina.", price:65, active:true, variants:[
      v("Czarny","#1a1a1a",[sz("S/M",8),sz("L/XL",4)]),
      v("Oliwka","#5a6038",[sz("S/M",2),sz("L/XL",0)], {price:70}),
      v("Burgund","#5c1f24",[sz("S/M",0),sz("L/XL",0)])]},
    {id:"sample-6", sku:"H006", name:"Wool Bucket", description:"Wełniany bucket na chłodniejsze dni.", price:119, active:true, variants:[
      v("Szary","#8a8a8f",[sz("S",3),sz("M",5),sz("L",2),sz("XL",1)])]},
  ];
  const SAMPLE_PANTS = [
    {id:"pants-1", sku:"P001", category:"Baggy", name:"Baggy Black", description:"Luźny krój, przetarcia na kolanach.", price:249, available:true, variants:[
      v("Czarny","#1a1a1a",[sz("S",3,"pas 72 cm, długość 102 cm"),sz("M",2,"pas 78 cm, długość 104 cm"),sz("L",0,"pas 84 cm, długość 106 cm")]),
      v("Grafit","#4a4a4f",[sz("M",1,"pas 78 cm, długość 104 cm")], {price:259})]},
    {id:"pants-2", sku:"P002", category:"Straight", name:"Straight Graphite", description:"Prosty krój, bez przetarć.", price:229, available:true, variants:[
      v("Grafit","#4a4a4f",[sz("M",4,"pas 80 cm, długość 102 cm"),sz("L",2,"pas 86 cm, długość 104 cm")])]},
    {id:"pants-3", sku:"P003", category:"Slim", name:"Slim Écru", description:"Dopasowany krój w jasnym kolorze.", price:259, available:true, variants:[
      v("Écru","#cfc6ae",[sz("S",0,"pas 70 cm, długość 98 cm")])]},
    {id:"pants-4", sku:"P004", category:"Cargo", name:"Cargo Utility", description:"Kieszenie cargo, mocna bawełna, wiązanie przy kostce.", price:289, available:true, variants:[
      v("Khaki","#8a7a52",[sz("S",2,"pas 74 cm, długość 100 cm"),sz("M",5,"pas 80 cm, długość 102 cm"),sz("L",3,"pas 86 cm, długość 104 cm"),sz("XL",1,"pas 92 cm, długość 106 cm")]),
      v("Czarny","#1a1a1a",[sz("M",2,"pas 80 cm, długość 102 cm"),sz("L",0,"pas 86 cm, długość 104 cm")], {price:299, description:"Wersja czarna z matowymi zapięciami."}),
      v("Ukryty test","#ff00aa",[sz("M",4)], {active:false})]},
    {id:"pants-5", sku:"P005", size_chart_id:"chart-wide", category:"Wide leg", name:"Wide Denim", description:"Szerokie nogawki, sprany denim.", price:269, available:true, variants:[
      v("Jasny niebieski","#8fb0d6",[sz("S",1,"pas 72 cm, długość 104 cm"),sz("M",3,"pas 78 cm, długość 106 cm")]),
      v("Granatowy","#1f2a44",[sz("M",2,"pas 78 cm, długość 106 cm"),sz("L",2,"pas 84 cm, długość 108 cm")]),
      v("Czarny sprany","#3a3a3f",[sz("L",0,"pas 84 cm, długość 108 cm")])]},
    {id:"pants-6", sku:"P006", category:"Skinny", name:"Skinny Stretch", description:"Elastyczny materiał, dopasowany krój.", price:219, available:true, variants:[
      v("Czarny","#1a1a1a",[sz("XS",2,"pas 66 cm, długość 98 cm"),sz("S",4,"pas 70 cm, długość 100 cm"),sz("M",6,"pas 76 cm, długość 102 cm")])]},
  ];
  // Produkty TESTOWE (dane przykładowe): is_test + obrazki z assets/test/ — usuń je w panelu („Usuń produkty testowe”), gdy dodasz prawdziwe.
  const slug = t => String(t).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  const markTest = list => list.forEach(it=>{ it.is_test = true; it.variants.forEach(x=>{ if(!x.images.length) x.images = [`assets/test/${it.id}-${slug(x.name)}.svg`]; }); });
  const row = (size, ...values) => ({ size, values });
  const SAMPLE_CHARTS = [
    { id:"chart-hats", name:"Czapki — obwód głowy", default_for:"hats", columns:["Obwód głowy (cm)"], note:"Zmierz obwód głowy na wysokości czoła, miarką krawiecką.",
      rows:[row("S/M","54–57"),row("L/XL","58–61"),row("Uniwersalny","regulacja 54–62")] },
    { id:"chart-pants", name:"Spodnie — standard", default_for:"pants", columns:["Pas (cm)","Biodra (cm)","Długość (cm)"], note:"Wymiary produktu leżącego płasko; tolerancja ±1 cm.",
      rows:[row("XS","66","90","98"),row("S","72","96","100"),row("M","78","102","102"),row("L","84","108","104"),row("XL","90","114","106")] },
    { id:"chart-custom", name:"Customowe spodnie", default_for:"custom", columns:["Pas (cm)","Biodra (cm)","Długość (cm)"], note:"Customy szyjemy według tej tabeli — wybierz rozmiar najbliższy swoim wymiarom.",
      rows:[row("XS","66","90","98"),row("S","72","96","100"),row("M","78","102","102"),row("L","84","108","104"),row("XL","90","114","106"),row("XXL","96","120","108")] },
    { id:"chart-wide", name:"Spodnie — szerokie nogawki", columns:["Pas (cm)","Biodra (cm)","Długość (cm)","Szerokość nogawki (cm)"], note:"Krój wide leg — nogawka szersza o ok. 6 cm.",
      rows:[row("S","72","100","104","28"),row("M","78","106","106","29"),row("L","84","112","108","30")] },
  ];
  markTest(SAMPLE_HATS); markTest(SAMPLE_PANTS);
  // kind → tabela / klucz lokalny / wartości domyślne / czy pozycja jest w sprzedaży
  const KINDS = {
    hats:  { table:"hats",     local:"localHats",     sample:SAMPLE_HATS,  live: h => h.active !== false },
    pants: { table:"products", local:"localProducts", sample:SAMPLE_PANTS, live: p => p.available !== false && !p.archived },
  };

  const lsGet = (k, d) => { try{ const x = JSON.parse(localStorage.getItem(k)); return x ?? d; }catch(e){ return d; } };
  const lsSet = (k, x) => localStorage.setItem(k, JSON.stringify(x));
  const money = n => Math.round(n*100)/100;
  const today = () => new Date().toLocaleDateString("sv-SE", { timeZone:"Europe/Warsaw" });

  const normSizes = arr => (Array.isArray(arr) ? arr : []).map(s=>({ size:String(s.size), stock: Math.max(0, Math.floor(Number(s.stock)||0)), note: s.note || null }));
  const normVariant = x => ({
    name: String(x.name||"").trim() || "Standard", hex: x.hex || x.color || "#555555", images: Array.isArray(x.images) ? x.images : [],
    active: x.active !== false,
    price: x.price === null || x.price === undefined || x.price === "" ? null : Number(x.price),
    description: x.description || null,
    sizes: normSizes(x.sizes),
  });
  // starsze „stałe oferty” (colors/images/size_chart bez stanów): rozmiary z size_chart, stan 0 do czasu uzupełnienia w panelu
  function legacySizes(chart){
    return String(chart||"").split("\n").map(l=>l.trim()).filter(Boolean).map(line=>{
      const [size, ...rest] = line.split(":"); return { size:size.trim(), stock:0, note: rest.join(":").trim() || null };
    }).filter(z=>z.size);
  }
  function norm(h){
    let vs = Array.isArray(h.variants) ? h.variants : [];
    if(!vs.length) vs = (Array.isArray(h.colors) && h.colors.length ? h.colors : ["#555555"]).map((c,i)=>({ name:"", hex:c, images: i===0 ? (h.images||[]) : [] }));
    vs = vs.map(x=> Array.isArray(x.sizes) ? x : { ...x, sizes: legacySizes(h.size_chart) });
    return { ...h, price: Number(h.price)||0, variants: vs.map(normVariant) };
  }
  // wariant widoczny dla klienta; cena, stany
  const variantPrice = (h, x) => x.price != null && Number.isFinite(x.price) ? x.price : h.price;
  const variantStock = x => x.sizes.reduce((s,z)=>s+z.stock, 0);
  const shopVariants = h => h.variants.filter(x=>x.active && x.sizes.length);
  const itemStock = h => shopVariants(h).reduce((s,x)=>s+variantStock(x), 0);

  async function items(kind){
    const K = KINDS[kind];
    if(LOCAL) return lsGet(K.local, K.sample).filter(K.live).map(norm).filter(h=>shopVariants(h).length);
    let q = sb.from(K.table).select("*");
    q = kind==="hats" ? q.eq("active", true) : q.eq("available", true);
    const { data, error } = await q.order("sort_order",{ascending:true,nullsFirst:true}).order("created_at",{ascending:false});
    if(error) throw new Error(/relation|schema cache/i.test(error.message) ? "Sklep nie jest jeszcze skonfigurowany (migracje SQL w README)." : error.message);
    return (data||[]).filter(K.live).map(norm).filter(h=>shopVariants(h).length);
  }
  async function item(kind, id){ return (await items(kind)).find(h=>h.id===id) || null; }

  function localDiscount(code, subtotal, codes){
    const c = String(code||"").trim().toUpperCase();
    if(!c) return { valid:false, error:"Wpisz kod rabatowy." };
    const d = codes.find(x=>x.code===c);
    if(!d) return { valid:false, error:"Nieprawidłowy kod rabatowy." };
    if(!d.active) return { valid:false, error:"Ten kod jest nieaktywny." };
    if(d.expires_at && d.expires_at < today()) return { valid:false, error:"Ten kod wygasł." };
    if(d.usage_limit != null && d.used_count >= d.usage_limit) return { valid:false, error:"Limit użyć tego kodu został wyczerpany." };
    if(subtotal < Number(d.min_order||0)) return { valid:false, error:`Minimalna wartość zamówienia dla tego kodu to ${Number(d.min_order).toFixed(2)} zł.` };
    const discount = d.type==="percent" ? money(subtotal*d.value/100) : Math.min(Number(d.value), subtotal);
    return { valid:true, code:d.code, type:d.type, value:Number(d.value), discount };
  }
  async function validateDiscount(code, subtotal){
    if(LOCAL) return localDiscount(code, subtotal, lsGet("localDiscountCodes", []));
    const { data, error } = await sb.rpc("validate_discount", { p_code: code, p_subtotal: subtotal });
    if(error) throw new Error(/validate_discount|schema cache/i.test(error.message) ? "Kody rabatowe nie są jeszcze skonfigurowane (migracja SQL w README)." : error.message);
    return data;
  }
  // tabele rozmiarów: własna tabela produktu (size_chart_id) albo domyślna dla kategorii (hats / pants / custom)
  const normChart = c => ({ ...c, columns:(Array.isArray(c.columns)?c.columns:[]).map(String),
    rows:(Array.isArray(c.rows)?c.rows:[]).map(r=>({ size:String(r.size||""), values:(Array.isArray(r.values)?r.values:[]).map(x=>String(x??"")) })) });
  async function sizeCharts(){
    if(LOCAL) return lsGet("localSizeCharts", SAMPLE_CHARTS).map(normChart);
    try{
      const { data, error } = await sb.from("size_charts").select("*");
      if(error) throw error; return (data||[]).map(normChart);
    }catch(e){ return []; }   // brak tabeli (starsza baza) — strona działa bez tabel rozmiarów
  }
  async function sizeChartFor(scope, itemObj){
    const all = await sizeCharts();
    return (itemObj?.size_chart_id && all.find(c=>c.id===itemObj.size_chart_id)) || all.find(c=>c.default_for===scope) || null;
  }

  // ustawienia publiczne: karty strony głównej i włączone kanały zamówień (flagi, bez sekretów)
  const DEFAULT_CARDS = [
    { key:"hats",   href:"czapki.html",  title:"Czapki",            description:"Gotowe modele — wybierz kolor i rozmiar, dodaj do koszyka.", image_url:"", button_label:"Przejdź do sklepu →" },
    { key:"pants",  href:"spodnie.html", title:"Spodnie",           description:"Gotowe spodnie ze stałej oferty — kolory, rozmiary i dostępność.", image_url:"", button_label:"Zobacz spodnie →" },
    { key:"custom", href:"customy.html", title:"Customowe spodnie", description:"Zaprojektuj własne: kolor, krój, rozmiar i rozmieszczenie dziur.", image_url:"", button_label:"Zaprojektuj spodnie →" },
  ];
  const cleanUrl = u => /^https:\/\//i.test(u||"") || /^http:\/\/localhost[:/]/i.test(u||"") ? u : "";
  function mergeCards(saved){
    const order = (Array.isArray(saved) ? saved : []).map(x=>x&&x.key).filter((k,i,a)=>DEFAULT_CARDS.some(d=>d.key===k) && a.indexOf(k)===i);
    const keys = [...order, ...DEFAULT_CARDS.map(d=>d.key).filter(k=>!order.includes(k))];   // zapisana kolejność, potem reszta
    return keys.map(k=>DEFAULT_CARDS.find(d=>d.key===k)).map(d=>{
      const s = (Array.isArray(saved) ? saved : []).find(x=>x && x.key===d.key) || {};
      return { ...d, title:(s.title||"").trim() || d.title, description:(s.description||"").trim() || d.description,
        image_url: cleanUrl(s.image_url), button_label:(s.button_label||"").trim() || d.button_label };
    });
  }
  async function publicSettings(){
    if(LOCAL) return lsGet("localSiteSettings", {});
    const { data } = await sb.from("site_settings").select("order_email_enabled,order_discord_enabled,home_cards").eq("id",1).maybeSingle();
    return data || {};
  }
  async function homeCards(){ try{ return mergeCards((await publicSettings()).home_cards); }catch(e){ return mergeCards(null); } }
  // Publiczny, niewrażliwy status usługi zamówień (GET na ORDER_API_URL): wybrany tryb powiadamiania, czy to tryb testowy i czy usługa jest gotowa.
  // Nie zawiera adresów, tokenów ani webhooków. Gdy odczyt się nie uda — status nieznany (ready = null); przycisk i tak próbuje wysłać zamówienie.
  async function orderStatus(){
    const unknown = { mode:"both", test_mode:false, ready:null };
    if(typeof ORDER_API_URL === "undefined") return unknown;
    try{
      const r = await fetch(ORDER_API_URL, { headers:{ Accept:"application/json" }, cache:"no-store" });
      const j = await r.json();
      if(!r.ok || typeof j !== "object") return unknown;
      return { mode: ["email","discord","both"].includes(j.mode) ? j.mode : "both", test_mode: j.test_mode === true, ready: typeof j.ready === "boolean" ? j.ready : null };
    }catch(e){ return unknown; }
  }

  const anyTest = async () => { try{ return (await Promise.all([items("hats"), items("pants")])).some(l=>l.some(x=>x.is_test)); }catch(e){ return false; } };
  return { LOCAL, KINDS, anyTest, DEFAULT_CARDS, items, item, validateDiscount, sizeCharts, sizeChartFor, SAMPLE_CHARTS, homeCards, mergeCards, orderStatus,
           variantPrice, variantStock, shopVariants, itemStock, normVariant, norm };
})();
