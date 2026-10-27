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
let BASE_PRICE = 0; // site_settings.custom_base_price — cena bazowa Customa (domyślnie 0)
let HOLE_PRICE = DEFAULT_HOLE_PRICE; // ustawiane z site_settings.hole_price (Ustawienia w panelu)
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
  HOLE_PRICE = holePriceOf(SETTINGS);
  BASE_PRICE = Math.max(0, Number(SETTINGS.custom_base_price) || 0);

  document.getElementById("contactBlock").textContent = SETTINGS.contact_text || "";
  if(SETTINGS.customy_base_image){
    const img = document.getElementById("holeBaseImg");
    img.src = SETTINGS.customy_base_image; img.style.display = "block";
  }
}

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
    b.onclick=()=>{ state.rozmiar=s; [...sb.children].forEach(c=>c.classList.remove("selected")); b.classList.add("selected"); highlightChartSize(s); updateBar(); };
    sb.appendChild(b);
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
    label.textContent = state.holes.length ? `${state.holes.length} dziur(y) — +${state.holes.length*HOLE_PRICE} zł (${HOLE_PRICE} zł / szt.)` : "Brak dziur — czyste spodnie.";
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
  document.getElementById("nextBtn").textContent = i===3 ? "Dodaj do koszyka" : "Dalej";
}

function canAdvance(){
  if(state.step===0) return !!state.kolor;
  if(state.step===2) return !!state.kroj && !!state.rozmiar;
  return true;
}

function totalPrice(){
  return BASE_PRICE+(state.kolor?.price_extra||0)+(state.kroj?.price_extra||0)+(state.holes.length*HOLE_PRICE);
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
    ["Cena sztuki", totalPrice()+" zł"],
  ];
  box.innerHTML = rows.map(([k,v])=>`<div class="summary-row"><span>${k}</span><b>${v?escapeText(v):"-"}</b></div>`).join("");
}

document.getElementById("backBtn").onclick=()=> showStep(Math.max(0, state.step-1));
document.getElementById("nextBtn").onclick=()=>{
  if(!canAdvance()) return;
  if(state.step<3){ showStep(state.step+1); return; }
  addToCart();
};

// Zamiast wysyłki mailem Custom trafia do wspólnego koszyka (cart.js); zamówienie składa się w koszyku/zamówieniu.
function addToCart(){
  const holes = state.holes.map(h=>({ style: HOLE_STYLES[h.styleId]?.name || "dziura", x:Math.round(h.x), y:Math.round(h.y), w:Math.round(h.w), h:Math.round(h.h) }));
  const r = Cart.add({
    type:"custom", name:"Custom spodnie",
    color: state.kolor.name, colorHex: state.kolor.hex || "#555555",
    cut: state.kroj.name, size: state.rozmiar,
    holes, holePrice: HOLE_PRICE,
    notes: document.getElementById("pantsNotes").value.trim() || null,
    measurements: document.getElementById("pantsMeasurements").value.trim() || null,
    unitPrice: totalPrice(),
  }, 1);
  if(!r.ok){ showToast(r.error || "Nie udało się dodać do koszyka", "err"); return; }
  showToast("Dodano do koszyka ✓");
  document.querySelector(".options").querySelectorAll("section.step").forEach(s=>s.style.display="none");
  document.querySelector(".steps").style.display = "none";
  document.getElementById("doneScreen").style.display="block";
  document.getElementById("bottombar").style.display="none";
}
document.getElementById("anotherBtn").onclick = ()=>{
  state = { step:0, kolor:null, kroj:null, rozmiar:null, holes:[] }; selectedHoleIdx = null;
  document.getElementById("pantsNotes").value = ""; document.getElementById("pantsMeasurements").value = "";
  document.querySelectorAll("section.step").forEach(s=>s.style.display="");
  document.querySelector(".steps").style.display = "";
  document.getElementById("doneScreen").style.display="none";
  document.getElementById("bottombar").style.display="";
  document.getElementById("pantsFill").setAttribute("fill","#555");
  render(); updatePreview();
};

// ID produktu i tabela rozmiarów customów
document.getElementById("customPid").innerHTML = productIdHtml("CUSTOM");
Store.sizeChartFor("custom", null).then(c=>{ document.getElementById("customChart").innerHTML = sizeChartHtml(c); highlightChartSize(state.rozmiar); }).catch(()=>{});
// konfiguracja testowa (widoczna tylko, gdy w sklepie są produkty testowe)
Store.anyTest().then(t=>{ if(t) document.getElementById("testTools").hidden = false; });
document.getElementById("loadTestCfg").onclick = ()=>{
  const col = OPTIONS.kolor.find(o=>o.available && o.name!==OPTIONS.kolor[0]?.name) || OPTIONS.kolor.find(o=>o.available);
  state.kolor = col; state.kroj = OPTIONS.kroj.find(o=>o.available) || null; state.rozmiar = "M";
  state.holes = [{ x:38, y:62, w:14, h:9, styleId:0 },{ x:64, y:70, w:11, h:8, styleId:Math.min(1,HOLE_STYLES.length-1) }];
  selectedHoleIdx = null;
  document.getElementById("pantsMeasurements").value = "TEST: pas 80 cm, biodra 100 cm, długość 104 cm";
  document.getElementById("pantsNotes").value = "TEST: przykładowa konfiguracja — do usunięcia";
  render(); updatePreview(); updateSwatchSelection();
  [...document.querySelectorAll("#sizeBtns .size-btn")].forEach(b=>b.classList.toggle("selected", b.textContent==="M"));
  [...document.querySelectorAll("#fitTiles .tile")].forEach((t,i)=>t.classList.toggle("selected", OPTIONS.kroj[i]===state.kroj));
  showStep(3); updateBar();
};
loadOptions();
