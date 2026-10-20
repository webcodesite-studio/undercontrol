// ---- fallback opcje (gdyby Supabase był pusty/niedostępny) ----
const FALLBACK = {
  kolor: [
    {name:"Czarny", hex:"#1a1a1a", price_extra:0, available:true},
    {name:"Grafit", hex:"#4a4a4f", price_extra:0, available:true},
    {name:"Khaki", hex:"#8a7a52", price_extra:0, available:true},
    {name:"Écru", hex:"#cfc6ae", price_extra:10, available:true},
    {name:"Bordo", hex:"#5c1f24", price_extra:10, available:false},
  ],
  dziury: [
    {name:"Brak", price_extra:0, available:true},
    {name:"Kolana", price_extra:15, available:true},
    {name:"Mocne zniszczenie", price_extra:25, available:true},
    {name:"Rozcięcia", price_extra:20, available:false},
  ],
  kroj: [
    {name:"Baggy", price_extra:0, available:true},
    {name:"Straight", price_extra:0, available:true},
    {name:"Slim", price_extra:0, available:true},
  ],
};
const SIZES = ["XS","S","M","L","XL","XXL"];

let OPTIONS = null;
const FALLBACK_SETTINGS = {
  offer_enabled: true,
  offer_text: "Wysyłka gratis przy zamówieniu do niedzieli!",
  contact_text: "Masz pytania? Napisz do nas na Instagramie."
};
let SETTINGS = { offer_enabled:false, offer_text:"", contact_text:"" };
let state = { step:0, kolor:null, dziury:null, kroj:null, rozmiar:null };
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadOptions(){
  try{
    const { data, error } = await sbClient.from("options").select("*").order("category").order("sort_order",{ascending:true, nullsFirst:true});
    if(error || !data || !data.length) throw error || new Error("empty");
    OPTIONS = { kolor:[], dziury:[], kroj:[] };
    data.forEach(o=>{ if(OPTIONS[o.category]) OPTIONS[o.category].push(o); });
  }catch(e){
    console.warn("Supabase niedostępny, używam domyślnych opcji", e);
    OPTIONS = FALLBACK;
  }
  await loadSettings();
  render();
}

async function loadSettings(){
  try{
    const { data, error } = await sbClient.from("site_settings").select("*").eq("id",1).single();
    if(error || !data) throw error || new Error("empty");
    SETTINGS = data;
  }catch(e){
    console.warn("Supabase niedostępny, używam domyślnego banera/kontaktu", e);
    SETTINGS = FALLBACK_SETTINGS;
  }

  const bar = document.getElementById("offerBar");
  if(SETTINGS.offer_enabled && SETTINGS.offer_text){
    document.getElementById("offerText").textContent = SETTINGS.offer_text;
    bar.style.display = "flex";
  } else {
    bar.style.display = "none";
  }
  document.getElementById("contactBlock").textContent = SETTINGS.contact_text || "";
}
document.getElementById("offerClose").onclick = ()=> document.getElementById("offerBar").style.display="none";

function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }

function render(){
  // kolory
  const cw = document.getElementById("colorSwatches"); cw.innerHTML="";
  OPTIONS.kolor.forEach(o=>{
    const wrap = el("div","swatch-wrap");
    const sw = el("div","swatch"+(o.available?"":" unavailable"));
    sw.style.background = o.hex || "#666";
    if(o.available) sw.onclick=()=>{ state.kolor=o; updateSwatchSelection(); updatePreview(); updateBar(); };
    const label = el("div","swatch-label"); label.textContent = o.name + (o.price_extra?` +${o.price_extra}zł`:"");
    wrap.append(sw,label); cw.appendChild(wrap);
  });

  // dziury
  const ht = document.getElementById("holesTiles"); ht.innerHTML="";
  OPTIONS.dziury.forEach(o=>{
    const t = el("div","tile"+(o.available?"":" unavailable"));
    t.innerHTML = `<div class="tile-icon"></div>${escapeText(o.name)}${o.price_extra?`<br><small>+${o.price_extra}zł</small>`:""}${o.available?"":'<span class="soon">wkrótce</span>'}`;
    if(o.available) t.onclick=()=>{ state.dziury=o; refreshTileSelection(ht,t); updatePreview(); updateBar(); };
    ht.appendChild(t);
  });

  // krój
  const ft = document.getElementById("fitTiles"); ft.innerHTML="";
  OPTIONS.kroj.forEach(o=>{
    const t = el("div","tile"+(o.available?"":" unavailable"));
    t.innerHTML = `<div class="tile-icon"></div>${escapeText(o.name)}${o.price_extra?`<br><small>+${o.price_extra}zł</small>`:""}${o.available?"":'<span class="soon">wkrótce</span>'}`;
    if(o.available) t.onclick=()=>{ state.kroj=o; refreshTileSelection(ft,t); updateBar(); };
    ft.appendChild(t);
  });

  // rozmiary
  const sb = document.getElementById("sizeBtns"); sb.innerHTML="";
  SIZES.forEach(s=>{
    const b = el("button","size-btn", s);
    b.onclick=()=>{ state.rozmiar=s; [...sb.children].forEach(c=>c.classList.remove("selected")); b.classList.add("selected"); updateBar(); };
    sb.appendChild(b);
  });

  document.getElementById("igLink").href = `https://ig.me/m/${window.SELLER_IG || IG_NICK}`;
  document.addEventListener("siteSettingsReady", ()=>{
    document.getElementById("igLink").href = `https://ig.me/m/${window.SELLER_IG}`;
  });
  showStep(0);
  updateBar();
}

function escapeText(s){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
function updateSwatchSelection(){
  [...document.querySelectorAll("#colorSwatches .swatch")].forEach(s=>s.classList.remove("selected"));
  if(!state.kolor) return;
  const idx = OPTIONS.kolor.findIndex(o=>o===state.kolor);
  document.querySelectorAll("#colorSwatches .swatch")[idx]?.classList.add("selected");
}
function refreshTileSelection(container, chosen){
  [...container.children].forEach(c=>c.classList.remove("selected"));
  chosen.classList.add("selected");
}
function updatePreview(){
  const fill = document.getElementById("pantsFill");
  if(state.kolor) fill.setAttribute("fill", state.kolor.hex || "#555");
  const holesLayer = document.getElementById("holesLayer");
  holesLayer.innerHTML = "";
  if(state.dziury && state.dziury.name !== "Brak"){
    holesLayer.innerHTML = `<circle cx="95" cy="150" r="9" fill="#00000055"/><circle cx="118" cy="165" r="6" fill="#00000055"/>`;
  }
}

const STEPS = [0,1,2,3];
function showStep(i){
  state.step = i;
  document.querySelectorAll("section.step").forEach(s=> s.classList.toggle("active", +s.dataset.step===i));
  document.querySelectorAll(".step-dot").forEach(d=>{
    const di = +d.dataset.dot;
    d.classList.toggle("active", di===i);
    d.classList.toggle("done", di<i);
  });
  if(i===3) buildSummary();
  document.getElementById("backBtn").disabled = i===0;
  document.getElementById("nextBtn").textContent = i===3 ? "Wyślij zamówienie" : "Dalej";
}

function canAdvance(){
  if(state.step===0) return !!state.kolor;
  if(state.step===1) return !!state.dziury;
  if(state.step===2) return !!state.kroj && !!state.rozmiar;
  return true;
}

function updateBar(){
  const total = (state.kolor?.price_extra||0)+(state.dziury?.price_extra||0)+(state.kroj?.price_extra||0);
  document.getElementById("priceTag").textContent = total + " zł";
  document.getElementById("nextBtn").disabled = !canAdvance();
}

function buildSummary(){
  const box = document.getElementById("summaryList");
  const rows = [
    ["Kolor", state.kolor?.name],
    ["Dziury", state.dziury?.name],
    ["Krój", state.kroj?.name],
    ["Rozmiar", state.rozmiar],
  ];
  box.innerHTML = rows.map(([k,v])=>`<div class="summary-row"><span>${k}</span><b>${v?escapeText(v):"-"}</b></div>`).join("");
}

document.getElementById("backBtn").onclick=()=> showStep(Math.max(0, state.step-1));
document.getElementById("nextBtn").onclick=()=>{
  if(!canAdvance()) return;
  if(state.step<3){ showStep(state.step+1); return; }
  submitOrder();
};

function validIG(nick){ return /^@?[a-zA-Z0-9](?:[a-zA-Z0-9._]{0,28}[a-zA-Z0-9])?$/.test(nick); }

async function submitOrder(){
  if(document.getElementById("hpField").value){ return; } // honeypot — bot złapany, nic nie rób
  const ig = document.getElementById("igInput").value.trim();
  const mail = document.getElementById("emailInput").value.trim();
  if(!ig || !validIG(ig)){
    document.getElementById("igInput").focus();
    document.getElementById("igInput").style.borderColor = "#ff6b6b";
    return;
  }
  document.getElementById("igInput").style.borderColor = "";
  const total = (state.kolor?.price_extra||0)+(state.dziury?.price_extra||0)+(state.kroj?.price_extra||0);
  const payload = {
    kolor: state.kolor?.name, dziury: state.dziury?.name, kroj: state.kroj?.name,
    rozmiar: state.rozmiar, cena_dodatkowa: total+" zł", instagram: ig, email: mail || "(brak)"
  };
  document.getElementById("nextBtn").disabled = true;
  document.getElementById("nextBtn").textContent = "Wysyłanie...";
  try{
    await fetch(FORMSPREE_ENDPOINT, {
      method:"POST",
      headers:{ "Content-Type":"application/json", "Accept":"application/json" },
      body: JSON.stringify(payload)
    });
  }catch(e){ console.error(e); }
  document.querySelector(".options").querySelectorAll("section.step").forEach(s=>s.style.display="none");
  document.getElementById("doneScreen").style.display="block";
  document.getElementById("bottombar").style.display="none";
}

loadOptions();
