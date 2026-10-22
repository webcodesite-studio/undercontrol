// ---- fallback opcje (gdyby Supabase był pusty/niedostępny) ----
const FALLBACK = {
  kolor: [
    {name:"Czarny", hex:"#1a1a1a", price_extra:0, available:true},
    {name:"Grafit", hex:"#4a4a4f", price_extra:0, available:true},
    {name:"Khaki", hex:"#8a7a52", price_extra:0, available:true},
    {name:"Écru", hex:"#cfc6ae", price_extra:10, available:true},
    {name:"Bordo", hex:"#5c1f24", price_extra:10, available:false},
  ],
  kroj: [
    {name:"Baggy", price_extra:0, available:true},
    {name:"Straight", price_extra:0, available:true},
    {name:"Slim", price_extra:0, available:true},
  ],
};
const SIZES = ["XS","S","M","L","XL","XXL"];

// style dziur (zdjęcia przetarć) — gdy brak w Supabase, pokazujemy 2 kształty zastępcze
const FALLBACK_HOLE_STYLES = [
  { name:"Owalna", image_url:null, fallbackShape:"fallback-oval" },
  { name:"Poszarpana", image_url:null, fallbackShape:"fallback-jagged" },
];
let HOLE_STYLES = FALLBACK_HOLE_STYLES;
async function loadHoleStyles(){
  try{
    const { data, error } = await sbClient.from("hole_styles").select("*").order("sort_order",{ascending:true,nullsFirst:true});
    if(error || !data || !data.length) throw error || new Error("empty");
    HOLE_STYLES = data;
  }catch(e){ HOLE_STYLES = FALLBACK_HOLE_STYLES; }
}

let OPTIONS = null;
const FALLBACK_SETTINGS = {
  offer_enabled: true,
  offer_text: "Wysyłka gratis przy zamówieniu do niedzieli!",
  contact_text: "Masz pytania? Napisz do nas na Instagramie."
};
let SETTINGS = { offer_enabled:false, offer_text:"", contact_text:"" };
const PRICE_PER_HOLE = 15;
const MAX_HOLES = 6;
let state = { step:0, kolor:null, kroj:null, rozmiar:null, holes:[] };
let selectedHoleIdx = null;
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function loadOptions(){
  try{
    const { data, error } = await sbClient.from("options").select("*").order("category").order("sort_order",{ascending:true, nullsFirst:true});
    if(error || !data || !data.length) throw error || new Error("empty");
    OPTIONS = { kolor:[], kroj:[] };
    data.forEach(o=>{ if(OPTIONS[o.category]) OPTIONS[o.category].push(o); });
  }catch(e){
    console.warn("Supabase niedostępny, używam domyślnych opcji", e);
    OPTIONS = FALLBACK;
  }
  await loadSettings();
  await loadHoleStyles();
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
  if(SETTINGS.customy_base_image){
    const img = document.getElementById("holeBaseImg");
    img.src = SETTINGS.customy_base_image; img.style.display = "block";
  }
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

  initHoleDesigner();

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
  holesLayer.innerHTML = state.holes.map(h=>
    `<ellipse cx="${h.x*2}" cy="${h.y*2.6}" rx="${h.w}" ry="${h.h*1.3}" fill="#00000055"/>`
  ).join("");
}

// ---- edytor dziur: zdjęcia przetarć, kilka naraz, niezależna szer./wys., przeciąganie ----
function initHoleDesigner(){
  const box = document.getElementById("holeDesigner");
  box.dataset.init = "1"; // render() może się odpalić ponownie po doładowaniu stylów — bezpieczne, listenery podpinamy raz niżej

  function holeStyleMarkup(h){
    const style = HOLE_STYLES[h.styleId] || HOLE_STYLES[0];
    if(style?.image_url) return `<img src="${style.image_url}" alt="">`;
    return "";
  }
  function markerClass(h, i){
    const style = HOLE_STYLES[h.styleId] || HOLE_STYLES[0];
    const shapeClass = style?.image_url ? "" : " "+(style?.fallbackShape || "fallback-oval");
    return "hole-marker"+shapeClass+(i===selectedHoleIdx?" selected":"");
  }

  function renderStylePicker(){
    const picker = document.getElementById("holeStylePicker");
    if(selectedHoleIdx===null){ picker.style.display = "none"; return; }
    picker.style.display = "flex";
    const current = state.holes[selectedHoleIdx];
    picker.innerHTML = HOLE_STYLES.map((s,i)=>{
      const thumb = s.image_url ? `<img src="${s.image_url}" alt="${escapeText(s.name)}">` :
        `<div style="width:100%;height:100%;background:var(--surface2);" class="${s.fallbackShape}"></div>`;
      return `<div class="hole-style-thumb${i===current.styleId?" selected":""}" data-i="${i}" title="${escapeText(s.name)}">${thumb}</div>`;
    }).join("");
    picker.querySelectorAll(".hole-style-thumb").forEach(t=>{
      t.onclick = ()=>{ if(selectedHoleIdx===null) return; state.holes[selectedHoleIdx].styleId = +t.dataset.i; renderHoles(); };
    });
  }

  function renderHoles(){
    box.querySelectorAll(".hole-marker").forEach(m=>m.remove());
    state.holes.forEach((h,i)=>{
      const m = document.createElement("div"); m.className = markerClass(h,i);
      m.style.left = h.x+"%"; m.style.top = h.y+"%"; m.style.width = h.w+"%"; m.style.height = h.h+"%";
      m.dataset.i = i;
      m.innerHTML = holeStyleMarkup(h);
      box.appendChild(m);
    });
    const label = document.getElementById("holeCountLabel");
    label.textContent = state.holes.length ? `${state.holes.length} dziur(y) — +${state.holes.length*PRICE_PER_HOLE} zł` : "Brak dziur — czyste spodnie.";
    document.getElementById("removeHoleBtn").disabled = selectedHoleIdx===null;
    document.getElementById("holeSizeRow").style.display = selectedHoleIdx===null ? "none" : "flex";
    if(selectedHoleIdx!==null){
      document.getElementById("holeWidthSlider").value = state.holes[selectedHoleIdx].w;
      document.getElementById("holeHeightSlider").value = state.holes[selectedHoleIdx].h;
    }
    renderStylePicker();
    updateBar(); updatePreview();
  }
  holeDesignerRender = renderHoles; // dostępne globalnie, gdyby style dociągnęły się po pierwszym renderze

  function addHole(x,y){
    if(state.holes.length >= MAX_HOLES){ alert("Maksymalnie "+MAX_HOLES+" dziur."); return; }
    state.holes.push({ x: Math.max(5,Math.min(95,x)), y: Math.max(5,Math.min(95,y)), w:12, h:8, styleId:0 });
    selectedHoleIdx = state.holes.length-1;
    renderHoles();
  }

  if(!box.dataset.listeners){
    box.dataset.listeners = "1";
    let dragging = null;
    box.addEventListener("pointerdown", (e)=>{
      const rect = box.getBoundingClientRect();
      const x = (e.clientX-rect.left)/rect.width*100, y = (e.clientY-rect.top)/rect.height*100;
      const marker = e.target.closest(".hole-marker");
      if(marker){
        selectedHoleIdx = +marker.dataset.i; dragging = selectedHoleIdx; box.setPointerCapture(e.pointerId);
      } else {
        addHole(x,y); return;
      }
      renderHoles();
    });
    box.addEventListener("pointermove", (e)=>{
      if(dragging===null) return;
      const rect = box.getBoundingClientRect();
      const x = (e.clientX-rect.left)/rect.width*100, y = (e.clientY-rect.top)/rect.height*100;
      state.holes[dragging].x = Math.max(5,Math.min(95,x));
      state.holes[dragging].y = Math.max(5,Math.min(95,y));
      renderHoles();
    });
    box.addEventListener("pointerup", ()=>{ dragging = null; });
    box.addEventListener("pointercancel", ()=>{ dragging = null; });

    document.getElementById("addHoleBtn").onclick = ()=> addHole(50,50);
    document.getElementById("removeHoleBtn").onclick = ()=>{
      if(selectedHoleIdx===null) return;
      state.holes.splice(selectedHoleIdx,1); selectedHoleIdx=null; renderHoles();
    };
    document.getElementById("holeWidthSlider").oninput = (e)=>{
      if(selectedHoleIdx===null) return;
      state.holes[selectedHoleIdx].w = +e.target.value; renderHoles();
    };
    document.getElementById("holeHeightSlider").oninput = (e)=>{
      if(selectedHoleIdx===null) return;
      state.holes[selectedHoleIdx].h = +e.target.value; renderHoles();
    };
  }
  renderHoles();
}
let holeDesignerRender = null;

function encodeHoles(holes){
  const compact = holes.map(h=>({
    x:Math.round(h.x), y:Math.round(h.y), w:Math.round(h.w), h:Math.round(h.h),
    styleId: h.styleId, styleName: HOLE_STYLES[h.styleId]?.name || "?"
  }));
  return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
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
  if(state.step===2) return !!state.kroj && !!state.rozmiar;
  return true;
}

function totalPrice(){
  return (state.kolor?.price_extra||0)+(state.kroj?.price_extra||0)+(state.holes.length*PRICE_PER_HOLE);
}

function updateBar(){
  document.getElementById("priceTag").textContent = totalPrice() + " zł";
  document.getElementById("nextBtn").disabled = !canAdvance();
}

function buildSummary(){
  const box = document.getElementById("summaryList");
  const rows = [
    ["Kolor", state.kolor?.name],
    ["Dziury", state.holes.length ? `${state.holes.length} szt.` : "Brak"],
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
  const payload = {
    kolor: state.kolor?.name, kroj: state.kroj?.name, rozmiar: state.rozmiar,
    dziury_liczba: state.holes.length,
    dziury_kod: state.holes.length ? encodeHoles(state.holes) : "(brak dziur)",
    cena_dodatkowa: totalPrice()+" zł", instagram: ig, email: mail || "(brak)"
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
