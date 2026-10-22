const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentCat = "kolor";
let rows = [];

// --- tryb testowy bez Supabase: działa TYLKO dopóki config.js ma placeholder URL ---
// Gdy wpiszesz prawdziwe dane Supabase, ten tryb sam się wyłącza — logowanie admin/admin
// przestanie działać i panel będzie wymagał prawdziwego konta.
const SUPABASE_CONFIGURED = !SUPABASE_URL.includes("TWOJ-PROJEKT");
// admin/admin działa tylko lokalnie (localhost / plik) — nigdy na opublikowanej domenie
// TYMCZASOWO: obejście testowe dla GitHub Pages — usuń razem z banerem NOT SECURE, gdy skonfigurujesz Supabase.
const TEMP_BYPASS_HOSTS = ["webcodesite-studio.github.io"];
const IS_LOCAL_HOST = ["localhost","127.0.0.1","[::1]",""].includes(location.hostname) || TEMP_BYPASS_HOSTS.includes(location.hostname);
const SHOW_NOT_SECURE = !SUPABASE_CONFIGURED && TEMP_BYPASS_HOSTS.includes(location.hostname);
if(SHOW_NOT_SECURE){
  const b = document.createElement("div");
  b.textContent = "NOT SECURE — tymczasowe logowanie admin/admin. Skonfiguruj konto Supabase i poproś o usunięcie obejścia.";
  b.style.cssText = "position:sticky;top:0;z-index:100;background:#b00020;color:#fff;font-weight:700;text-align:center;padding:10px 12px;font-size:14px;";
  document.body.prepend(b);
}
let localDevMode = false;
const LOCAL_FALLBACK_OPTIONS = [
  {id:"l1",category:"kolor",name:"Czarny",hex:"#1a1a1a",price_extra:0,available:true,sort_order:1},
  {id:"l2",category:"kolor",name:"Grafit",hex:"#4a4a4f",price_extra:0,available:true,sort_order:2},
  {id:"l3",category:"kolor",name:"Khaki",hex:"#8a7a52",price_extra:0,available:true,sort_order:3},
  {id:"l4",category:"dziury",name:"Brak",hex:null,price_extra:0,available:true,sort_order:1},
  {id:"l5",category:"dziury",name:"Kolana",hex:null,price_extra:15,available:true,sort_order:2},
  {id:"l6",category:"kroj",name:"Baggy",hex:null,price_extra:0,available:true,sort_order:1},
  {id:"l7",category:"kroj",name:"Straight",hex:null,price_extra:0,available:true,sort_order:2},
];
const LOCAL_FALLBACK_SETTINGS = {
  shop_name:DEFAULT_BRAND, seller_ig:"twoj_nick", offer_enabled:true,
  offer_text:"Wysyłka gratis do niedzieli!", contact_text:"Napisz do nas na Instagramie.",
  policy_md:"# Polityka prywatności\n\nDane z formularza wykorzystujemy wyłącznie do kontaktu w sprawie zamówienia.",
  theme_bg:"#111113", theme_surface:"#19191c", theme_text:"#f2f2f0", theme_accent:"#d4ff3f", theme_muted:"#8a8a8f", theme_border:"#2c2c30",
  hole_price: DEFAULT_HOLE_PRICE,
};
function localOptions(){ return JSON.parse(localStorage.getItem("localOptions") || JSON.stringify(LOCAL_FALLBACK_OPTIONS)); }
function saveLocalOptions(d){ localStorage.setItem("localOptions", JSON.stringify(d)); }
function localSettings(){ return JSON.parse(localStorage.getItem("localSiteSettings") || JSON.stringify(LOCAL_FALLBACK_SETTINGS)); }
function saveLocalSettings(d){ localStorage.setItem("localSiteSettings", JSON.stringify(d)); }

async function checkSession(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session){ showPanel(); } else { showLogin(); }
}
function showLogin(){ document.getElementById("loginBox").style.display="block"; document.getElementById("panel").style.display="none"; }
function showPanel(){
  document.getElementById("loginBox").style.display="none";
  document.getElementById("panel").style.display="block";
  document.getElementById("devBadge").style.display = localDevMode ? "block" : "none";
  loadProducts();
  applyAdminBrand();
}

document.getElementById("loginBtn").onclick = async ()=>{
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  if(!SUPABASE_CONFIGURED && IS_LOCAL_HOST && email === "admin" && password === "admin"){
    localDevMode = true;
    showPanel();
    return;
  }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ document.getElementById("loginErr").textContent = "Błędny mail lub hasło"; return; }
  showPanel();
};
document.getElementById("logoutBtn").onclick = async ()=>{
  localDevMode = false;
  if(SUPABASE_CONFIGURED) await sb.auth.signOut();
  showLogin();
};

const mainTabs = document.querySelectorAll('.tabs button[data-cat]');
mainTabs.forEach(b=>{
  b.onclick=()=>{
    mainTabs.forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); currentCat = b.dataset.cat;
    const isSettings = currentCat === "ustawienia";
    const isProducts = currentCat === "produkty";
    const isCampaigns = currentCat === "kampanie";
    const isCustomy = currentCat === "customy";
    const isSales = currentCat === "sprzedaz";
    const isContact = currentCat === "kontakt";
    document.getElementById("contactPanel").style.display = isContact ? "block" : "none";
    document.getElementById("salesPanel").style.display = isSales ? "block" : "none";
    document.getElementById("customySubtabs").style.display = isCustomy ? "block" : "none";
    document.getElementById("settingsPanel").style.display = isSettings ? "block" : "none";
    document.getElementById("productsPanel").style.display = isProducts ? "block" : "none";
    document.getElementById("campaignsPanel").style.display = isCampaigns ? "block" : "none";
    if(isSettings) loadSettings();
    else if(isProducts) loadProducts();
    else if(isCampaigns) loadCampaigns();
    else if(isSales) loadSales();
    else if(isCustomy){ loadRows(); loadBaseImage(); showHolePriceHint(); }
  };
});
document.querySelectorAll('.tabs button[data-subcat]').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.tabs button[data-subcat]').forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    currentOptionCat = b.dataset.subcat;
    const isStyleDziur = currentOptionCat === "style_dziur";
    document.getElementById("list").style.display = isStyleDziur ? "none" : "block";
    document.getElementById("holeStylesPanel").style.display = isStyleDziur ? "block" : "none";
    if(isStyleDziur) loadHoleStyles(); else renderList();
  };
});
let currentOptionCat = "kolor";

// ---- popup (modal) — wspólny dla produktów i kampanii ----
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
function openModal(html){ modalBox.innerHTML = html; modalOverlay.style.display = "flex"; }
function closeModal(){ modalOverlay.style.display = "none"; modalBox.innerHTML = ""; }
modalOverlay.onclick = (e)=>{ if(e.target === modalOverlay) closeModal(); };
function escapeTxt(s){ const d=document.createElement("div"); d.textContent=s||""; return d.innerHTML; }
function escapeAttr(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

// ---- Komunikaty inline (zamiast okienek alert/confirm) ----
function flash(id, text, kind){
  const el = document.getElementById(id); if(!el) return;
  el.textContent = text; el.className = "inline-msg " + (kind||"ok"); el.style.display = text ? "block" : "none";
  clearTimeout(el._t); if(kind==="ok" && text) el._t = setTimeout(()=>{ el.style.display="none"; }, 4000);
}
// Przycisk z potwierdzeniem w dwóch krokach (zamiast confirm())
function twoStepButton(label, confirmLabel, onConfirm){
  const b = document.createElement("button"); b.className = "edit-btn"; b.style.color = "#ff6b6b"; b.textContent = label;
  let armed = false, t;
  b.onclick = ()=>{
    if(!armed){ armed = true; b.textContent = confirmLabel; b.classList.add("armed"); t = setTimeout(()=>{ armed=false; b.textContent=label; b.classList.remove("armed"); }, 3500); }
    else { clearTimeout(t); onConfirm(); }
  };
  return b;
}

// ---- Upload zdjęć do R2 (przez Worker) ----
async function uploadToR2(file, notify = alert){
  if(R2_UPLOAD_URL.includes("TWOJ-WORKER")){
    notify("Upload zdjęć nie jest jeszcze skonfigurowany — uzupełnij R2_UPLOAD_URL w config.js (instrukcja w r2-worker/README.md).");
    return null;
  }
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if(!session){ notify("Upload wymaga zalogowania przez Supabase (tryb testowy admin/admin nie obsługuje uploadu)."); return null; }
    if(file.size > 5*1024*1024){ notify("Plik jest za duży (maks. 5 MB)."); return null; }
    const res = await fetch(R2_UPLOAD_URL, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream", "Authorization": "Bearer "+session.access_token },
      body: file,
    });
    if(!res.ok){
      let detail = ""; try{ detail = (await res.json()).error || ""; }catch(_){}
      throw new Error("HTTP "+res.status+(detail?" — "+detail:""));
    }
    const data = await res.json();
    return data.url;
  }catch(e){ notify("Błąd uploadu: "+e.message); return null; }
}

// ---- Produkty (oferta na stronie głównej) ----
const SIZE_LIST = ["XS","S","M","L","XL","XXL"];
const CUT_LIST = ["Baggy","Straight","Slim","Skinny","Wide leg","Loose","Tapered","Bootcut","Relaxed","Cargo"];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const fmtPLN = n => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN"}).format(n||0);

// Warianty kolorystyczne: [{name, color, images:[url,...]}].
// Produkty sprzed tej zmiany (tylko colors + images) są traktowane jako warianty bez przypisanych zdjęć:
// zdjęcia ze starego pola `images` trafiają do pierwszego wariantu, żeby nic nie zginęło.
function variantsOf(p){
  if(Array.isArray(p?.variants) && p.variants.length) return p.variants.map(v=>({name:v.name||"", color:v.color||"#555555", images:[...(v.images||[])]}));
  const colors = p?.colors?.length ? p.colors : ["#555555"];
  return colors.map((c,i)=>({name:"", color:c, images: i===0 ? [...(p?.images||[])] : []}));
}

// size_chart (tekst, format czytany przez stronę klienta) <-> wiersze edytora
function parseSizeChart(text){
  const rows = [], extra = [];
  let unit = "cm";
  (text||"").split("\n").map(l=>l.trim()).filter(Boolean).forEach(line=>{
    const [sizeRaw, ...rest] = line.split(":");
    const size = sizeRaw.trim().toUpperCase(), tail = rest.join(":");
    const w = tail.match(/pas\s*([\d.,]+)\s*(cm|in)?/i), l = tail.match(/d[łl]ugo[śs][ćc]\s*([\d.,]+)\s*(cm|in)?/i);
    if(SIZE_LIST.includes(size) && l && !rows.some(r=>r.size===size)){
      const u = (l[2]||w?.[2]||"").toLowerCase(); if(u==="in") unit = "in";
      rows.push({size, waist: w ? w[1].replace(",",".") : "", length: l[1].replace(",",".")});
    } else extra.push(line);
  });
  return { rows, extra, unit };
}
function buildSizeChart(rows, unit, extra){
  const sorted = [...rows].sort((a,b)=>SIZE_LIST.indexOf(a.size)-SIZE_LIST.indexOf(b.size));
  const lines = sorted.map(r=>`${r.size}: ${r.waist!==""?`pas ${r.waist}${unit}, `:""}długość ${r.length}${unit}`);
  return [...lines, ...extra].join("\n");
}

let products = [];
let showArchived = false;
async function loadProducts(){
  if(localDevMode){ products = JSON.parse(localStorage.getItem("localProducts")||"[]"); renderProducts(); return; }
  const { data, error } = await sb.from("products").select("*").order("category").order("sort_order",{ascending:true,nullsFirst:true});
  if(error){ alert("Błąd: "+error.message); return; }
  products = data || []; renderProducts();
}
function renderProducts(){
  const list = document.getElementById("productsList"); list.innerHTML="";
  const archivedCount = products.filter(p=>p.archived).length;
  const toggle = document.getElementById("toggleArchiveBtn");
  toggle.textContent = showArchived ? "Pokaż aktywne produkty" : `Pokaż archiwum (${archivedCount})`;
  products.filter(p=>!!p.archived === showArchived).forEach(p=>{
    const vs = variantsOf(p);
    const card = document.createElement("div"); card.className="card";
    const dot = document.createElement("div"); dot.className="dot"; dot.style.background = vs[0].color;
    const meta = document.createElement("div"); meta.className="meta";
    meta.innerHTML = `<div style="font-size:15px;">${escapeTxt(p.name)}</div>
      <div style="font-size:12px;color:var(--muted);">${escapeTxt(p.category)} · ${p.price} zł${vs.length>1?` · ${vs.length} kolory`:""}${p.archived?" · archiwum":""}</div>`;
    const editBtn = document.createElement("button"); editBtn.className="edit-btn"; editBtn.textContent="Edytuj";
    editBtn.onclick = ()=> openProductModal(p.id);
    if(p.archived){
      const restoreBtn = document.createElement("button"); restoreBtn.className="edit-btn"; restoreBtn.textContent="Przywróć";
      restoreBtn.onclick = ()=> updateProduct(p.id,{archived:false, archived_at:null});
      card.append(dot, meta, restoreBtn, editBtn);
    } else {
      const sw = document.createElement("div"); sw.className="switch"+(p.available?" on":"");
      sw.title = "Dostępny w sklepie";
      sw.onclick=()=>{ sw.classList.toggle("on"); updateProduct(p.id,{available:sw.classList.contains("on")}); };
      card.append(dot, meta, sw, editBtn);
    }
    list.appendChild(card);
  });
  if(!list.children.length) list.innerHTML = `<p style="color:var(--muted);font-size:13px;">${showArchived?"Archiwum jest puste.":"Brak produktów — dodaj pierwszy."}</p>`;
}
document.getElementById("toggleArchiveBtn").onclick = ()=>{ showArchived = !showArchived; renderProducts(); };

function imgRowHtml(url){ return `<div class="color-row img-row"><img src="${escapeAttr(url)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;"><span style="font-size:11px;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeTxt(url.split("/").pop())}</span><button type="button" class="removeRow" aria-label="Usuń zdjęcie">✕</button></div>`; }
function variantHtml(v){
  return `<div class="variant">
    <div class="color-row">
      <input type="color" class="vColor" value="${escapeAttr(v.color)}" aria-label="Kolor">
      <input type="text" class="vName" value="${escapeAttr(v.name)}" placeholder="Nazwa koloru, np. Czarny" maxlength="40">
      <button type="button" class="removeVariant" aria-label="Usuń kolor">✕</button>
    </div>
    <div class="vImgs">${v.images.map(imgRowHtml).join("")}</div>
    <button type="button" class="add-btn vAddImg" style="padding:8px;margin-top:0;">+ Dodaj zdjęcia tego koloru</button>
    ${localDevMode?'<button type="button" class="add-btn vAddUrl" style="padding:6px;margin-top:4px;font-size:12px;">+ Dodaj zdjęcie z adresu URL (tryb testowy)</button>':""}
  </div>`;
}
function sizeRowHtml(r){
  return `<div class="color-row size-row">
    <select class="sSize" aria-label="Rozmiar">${SIZE_LIST.map(s=>`<option${s===r.size?" selected":""}>${s}</option>`).join("")}</select>
    <input type="number" class="sWaist" min="1" step="0.5" value="${escapeAttr(r.waist)}" placeholder="Pas" aria-label="Pas">
    <input type="number" class="sLength" min="1" step="0.5" value="${escapeAttr(r.length)}" placeholder="Długość" aria-label="Długość spodni">
    <button type="button" class="removeRow" aria-label="Usuń rozmiar">✕</button>
  </div>`;
}
function openProductModal(id){
  const p = id ? products.find(x=>x.id===id) : null;
  const variants = variantsOf(p);
  const parsed = parseSizeChart(p?.size_chart);
  const sizeRows = parsed.rows.sort((a,b)=>SIZE_LIST.indexOf(a.size)-SIZE_LIST.indexOf(b.size));
  const cat = p?.category || "Baggy";
  const cats = CUT_LIST.includes(cat) ? CUT_LIST : [cat, ...CUT_LIST];
  openModal(`
    <h3>${p?"Edytuj produkt":"Nowy produkt"}</h3>
    <div id="mErr" class="form-err" role="alert" style="display:none;"></div>
    <label for="mName">Nazwa</label><input type="text" id="mName" value="${escapeAttr(p?.name)}" placeholder="np. Baggy Black" maxlength="80">
    <label for="mCategory">Krój / kategoria</label>
    <select id="mCategory">${cats.map(c=>`<option${c===cat?" selected":""}>${escapeTxt(c)}</option>`).join("")}</select>
    <label for="mPrice">Cena (zł)</label><input type="number" id="mPrice" min="0" step="1" value="${p?.price ?? 249}">
    <label>Kolory i zdjęcia <span class="hint">— klient zobaczy tylko zdjęcia wybranego koloru</span></label>
    <div id="variantRows">${variants.map(variantHtml).join("")}</div>
    <button type="button" class="add-btn" id="addVariant" style="padding:8px;">+ Dodaj kolor</button>
    <label for="mDescription">Opis</label><textarea id="mDescription" rows="2" placeholder="Krótki opis produktu">${escapeTxt(p?.description)}</textarea>
    <label>Rozmiary i wymiary <span class="hint">— jednostka:</span>
      <select id="mUnit" style="width:auto;display:inline-block;padding:4px 8px;"><option value="cm"${parsed.unit==="cm"?" selected":""}>cm</option><option value="in"${parsed.unit==="in"?" selected":""}>cale</option></select></label>
    <div class="size-head"><span>Rozmiar</span><span>Pas</span><span>Długość</span><span></span></div>
    <div id="sizeRows">${sizeRows.map(sizeRowHtml).join("")}</div>
    <button type="button" class="add-btn" id="addSize" style="padding:8px;">+ Dodaj rozmiar</button>
    ${parsed.extra.length?`<label for="mExtra">Inne wymiary (tekst z poprzedniej wersji — zachowane)</label><textarea id="mExtra" rows="2">${escapeTxt(parsed.extra.join("\n"))}</textarea>`:""}
    <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none;">
    <div class="modal-actions">
      ${p?`<button class="btn btn-ghost" id="modalDuplicate">Duplikuj</button>`:""}
      ${p?`<button class="btn btn-ghost" id="modalArchive">${p.archived?"Przywróć":"Archiwizuj"}</button>`:""}
      ${p?'<button class="btn btn-ghost" id="modalDelete" style="color:#ff6b6b;">Usuń</button>':""}
      <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
      <button class="btn btn-primary" id="modalSave">Zapisz</button>
    </div>`);

  const box = document.getElementById("modalBox");
  let uploadTarget = null;
  box.onclick = async (e)=>{
    const t = e.target;
    if(t.classList.contains("removeRow")){ t.closest(".color-row").remove(); }
    else if(t.classList.contains("removeVariant")){
      if(box.querySelectorAll(".variant").length>1) t.closest(".variant").remove();
      else showErr("Produkt musi mieć co najmniej jeden kolor.");
    }
    else if(t.classList.contains("vAddImg")){ uploadTarget = t.closest(".variant"); document.getElementById("imgFileInput").click(); }
    else if(t.classList.contains("vAddUrl")){
      const url = prompt("Adres URL zdjęcia (https://...):");
      if(url && /^https?:\/\//i.test(url.trim())) t.closest(".variant").querySelector(".vImgs").insertAdjacentHTML("beforeend", imgRowHtml(url.trim()));
      else if(url) showErr("Adres zdjęcia musi zaczynać się od http:// lub https://");
    }
  };
  function showErr(msg){ const e=document.getElementById("mErr"); e.textContent=msg; e.style.display="block"; e.scrollIntoView({block:"nearest"}); }
  document.getElementById("addVariant").onclick = ()=>{
    document.getElementById("variantRows").insertAdjacentHTML("beforeend", variantHtml({name:"",color:"#555555",images:[]}));
  };
  document.getElementById("addSize").onclick = ()=>{
    const used = [...box.querySelectorAll(".sSize")].map(s=>s.value);
    const next = SIZE_LIST.find(s=>!used.includes(s));
    if(!next){ showErr("Dodano już wszystkie dostępne rozmiary (XS–XXL)."); return; }
    document.getElementById("sizeRows").insertAdjacentHTML("beforeend", sizeRowHtml({size:next,waist:"",length:""}));
  };
  document.getElementById("imgFileInput").onchange = async (e)=>{
    const files = [...e.target.files]; e.target.value = "";
    if(!files.length || !uploadTarget) return;
    const btn = uploadTarget.querySelector(".vAddImg"), target = uploadTarget;
    for(let i=0;i<files.length;i++){
      btn.textContent = `Wgrywanie ${i+1}/${files.length}...`;
      const url = await uploadToR2(files[i]);
      if(url) target.querySelector(".vImgs").insertAdjacentHTML("beforeend", imgRowHtml(url));
    }
    btn.textContent = "+ Dodaj zdjęcia tego koloru";
  };
  document.getElementById("modalCancel").onclick = closeModal;
  if(p){
    document.getElementById("modalDelete").onclick = ()=>{ closeModal(); deleteProduct(p.id); };
    document.getElementById("modalArchive").onclick = ()=>{
      closeModal();
      updateProduct(p.id, p.archived ? {archived:false, archived_at:null} : {archived:true, archived_at:new Date().toISOString(), available:false});
    };
    document.getElementById("modalDuplicate").onclick = ()=>{
      closeModal();
      const { id:_i, created_at:_c, archived:_a, archived_at:_aa, ...copy } = p;
      createProduct({...copy, name: p.name+" (kopia)", available:false});
    };
  }
  document.getElementById("modalSave").onclick = ()=>{
    const name = document.getElementById("mName").value.trim();
    if(!name) return showErr("Podaj nazwę produktu.");
    const price = Number(document.getElementById("mPrice").value);
    if(!Number.isFinite(price) || price < 0) return showErr("Cena musi być liczbą nie mniejszą niż 0.");

    const vs = [...box.querySelectorAll(".variant")].map(el=>({
      name: el.querySelector(".vName").value.trim(),
      color: el.querySelector(".vColor").value,
      images: [...el.querySelectorAll(".vImgs img")].map(i=>i.getAttribute("src")),
    }));
    if(!vs.length) return showErr("Dodaj co najmniej jeden kolor.");
    if(vs.length>1 && vs.some(v=>!v.name)) return showErr("Gdy produkt ma kilka kolorów, każdy kolor musi mieć nazwę (np. Czarny).");
    const names = vs.map(v=>(v.name||v.color).toLowerCase());
    if(new Set(names).size !== names.length) return showErr("Dwa kolory mają tę samą nazwę — nazwy muszą się różnić.");
    if(vs.some(v=>!HEX_RE.test(v.color))) return showErr("Nieprawidłowy kolor.");

    const unit = document.getElementById("mUnit").value;
    const sizes = [...box.querySelectorAll(".size-row")].map(r=>({
      size: r.querySelector(".sSize").value,
      waist: r.querySelector(".sWaist").value.trim(),
      length: r.querySelector(".sLength").value.trim(),
    }));
    for(const s of sizes){
      if(s.length==="" || !(Number(s.length)>0)) return showErr(`Rozmiar ${s.size}: podaj długość spodni (liczba większa od 0, w ${unit==="cm"?"cm":"calach"}).`);
      if(s.waist!=="" && !(Number(s.waist)>0)) return showErr(`Rozmiar ${s.size}: pas musi być liczbą większą od 0 (albo zostaw puste).`);
    }
    const dup = sizes.map(s=>s.size).find((s,i,a)=>a.indexOf(s)!==i);
    if(dup) return showErr(`Rozmiar ${dup} został dodany dwa razy.`);
    const extra = (document.getElementById("mExtra")?.value || "").split("\n").map(l=>l.trim()).filter(Boolean);

    const row = {
      name, price,
      category: document.getElementById("mCategory").value,
      variants: vs,
      // pola zgodne wstecz (starsze wersje strony czytają colors/images):
      colors: vs.map(v=>v.color),
      images: vs.flatMap(v=>v.images),
      description: document.getElementById("mDescription").value.trim(),
      size_chart: buildSizeChart(sizes, unit, extra),
      available: p?.available ?? true,
    };
    closeModal();
    if(p) updateProduct(p.id, row); else createProduct(row);
  };
}
async function createProduct(row){
  if(localDevMode){ row.id="p"+Date.now(); products=[...products,row]; localStorage.setItem("localProducts",JSON.stringify(products)); renderProducts(); return; }
  const { error } = await sb.from("products").insert(row);
  if(error) alert("Błąd: "+error.message); else loadProducts();
}
async function updateProduct(id, patch){
  if(localDevMode){ products = products.map(p=>p.id===id?{...p,...patch}:p); localStorage.setItem("localProducts",JSON.stringify(products)); renderProducts(); return; }
  const { error } = await sb.from("products").update(patch).eq("id", id);
  if(error) alert("Błąd zapisu: "+error.message+(/variants|archived/.test(error.message)?"\nUruchom migrację SQL z README (migrations/002_*.sql).":"")); else loadProducts();
}
async function deleteProduct(id){
  if(!confirm("Usunąć produkt na stałe? Statystyki sprzedaży zostaną zachowane. Jeśli oferta tylko się skończyła, lepiej użyj „Archiwizuj”.")) return;
  if(localDevMode){ products=products.filter(p=>p.id!==id); localStorage.setItem("localProducts",JSON.stringify(products)); renderProducts(); return; }
  const { error } = await sb.from("products").delete().eq("id", id);
  if(error) alert("Błąd: "+error.message); else loadProducts();
}
document.getElementById("addProductBtn").onclick = ()=> openProductModal(null);

// ---- Sprzedaż (statystyki ofert stałych i Customów) ----
// Zamówienia przychodzą mailem (Formspree), więc sprzedaż rejestrujesz tu po potwierdzeniu zamówienia.
const CUSTOM_LABEL = "Custom (na zamówienie)";
let sales = [];
let saleMode = "offer";
async function ensureOptions(){
  if(rows.length) return;
  if(localDevMode){ rows = localOptions(); return; }
  const { data } = await sb.from("options").select("*").order("category").order("sort_order",{ascending:true,nullsFirst:true});
  rows = data || [];
}
async function loadSales(){
  if(localDevMode){ sales = JSON.parse(localStorage.getItem("localSales")||"[]"); }
  else {
    const { data, error } = await sb.from("sales").select("*").order("sold_at",{ascending:false}).order("created_at",{ascending:false});
    if(error){ flash("saleMsg","Błąd wczytywania sprzedaży: "+error.message+(/sales|kind|column/.test(error.message)?" — uruchom migracje SQL z README (002, 003).":""),"err"); return; }
    sales = data || [];
  }
  if(!products.length) await loadProductsSilently();
  await ensureOptions();
  setupSaleForm();
  renderSales();
}
async function loadProductsSilently(){
  if(localDevMode){ products = JSON.parse(localStorage.getItem("localProducts")||"[]"); return; }
  const { data } = await sb.from("products").select("*"); products = data || [];
}
const isCustomSale = r => r.kind === "custom";
function renderSales(){
  const items = sales.reduce((s,r)=>s+r.quantity,0);
  const revenue = sales.reduce((s,r)=>s+r.quantity*Number(r.unit_price),0);
  const custom = sales.filter(isCustomSale);
  const cItems = custom.reduce((s,r)=>s+r.quantity,0), cRev = custom.reduce((s,r)=>s+r.quantity*Number(r.unit_price),0);
  const cHoles = custom.reduce((s,r)=>s+r.quantity*(r.hole_count||0),0);
  document.getElementById("salesSummary").innerHTML = `
    <div class="stat"><div class="stat-n" id="statItems">${items}</div><div class="stat-l">sprzedanych sztuk</div></div>
    <div class="stat"><div class="stat-n" id="statRevenue">${fmtPLN(revenue)}</div><div class="stat-l">łączny przychód</div></div>
    <div class="stat"><div class="stat-n" id="statCustomItems">${cItems}</div><div class="stat-l">w tym Customy (szt.)</div></div>
    <div class="stat"><div class="stat-n" id="statCustomRevenue">${fmtPLN(cRev)}</div><div class="stat-l">przychód z Customów${cHoles?` · ${cHoles} dziur`:""}</div></div>`;
  const group = (keyFn, labelFn) => {
    const m = new Map();
    sales.forEach(r=>{ const k=keyFn(r); const e=m.get(k)||{label:labelFn(r),qty:0,sum:0}; e.qty+=r.quantity; e.sum+=r.quantity*Number(r.unit_price); m.set(k,e); });
    return [...m.values()].sort((a,b)=>b.qty-a.qty);
  };
  const table = (rows_, head) => rows_.length
    ? `<table class="stat-table"><thead><tr><th>${head}</th><th>Szt.</th><th>Przychód</th></tr></thead><tbody>${rows_.map(e=>`<tr><td>${e.label}</td><td>${e.qty}</td><td>${fmtPLN(e.sum)}</td></tr>`).join("")}</tbody></table>`
    : `<p style="color:var(--muted);font-size:13px;">Brak danych.</p>`;
  const pname = r => isCustomSale(r) ? CUSTOM_LABEL : r.product_name;
  const dot = hex => `<span class="mini-dot" style="background:${HEX_RE.test(hex||"")?hex:"#555"}"></span>`;
  document.getElementById("salesByProduct").innerHTML = table(group(r=>pname(r), r=>escapeTxt(pname(r))), "Produkt");
  document.getElementById("salesBySize").innerHTML = table(
    group(r=>r.size||"-", r=>escapeTxt(r.size||"-")).sort((a,b)=>SIZE_LIST.indexOf(a.label)-SIZE_LIST.indexOf(b.label)), "Rozmiar");
  document.getElementById("salesByColor").innerHTML = table(group(r=>(r.color_name||"-").toLowerCase(), r=>dot(r.color_hex)+escapeTxt(r.color_name||"-")), "Kolor");
  // tabela Customów liczona tylko z wpisów custom:
  const cg = new Map();
  custom.forEach(r=>{ const k=[r.cut,r.size,r.color_name,r.hole_count].join("|"); const e=cg.get(k)||{label:`${escapeTxt(r.cut||"-")} · ${escapeTxt(r.size||"-")} · ${dot(r.color_hex)}${escapeTxt(r.color_name||"-")} · ${r.hole_count||0} dziur`,qty:0,sum:0}; e.qty+=r.quantity; e.sum+=r.quantity*Number(r.unit_price); cg.set(k,e); });
  document.getElementById("salesCustom").innerHTML = table([...cg.values()].sort((a,b)=>b.qty-a.qty), "Krój · rozmiar · kolor · dziury");
  const recent = document.getElementById("salesRecent"); recent.innerHTML = "";
  sales.slice(0,30).forEach(r=>{
    const card = document.createElement("div"); card.className="card";
    const meta = document.createElement("div"); meta.className="meta";
    meta.innerHTML = `<div style="font-size:14px;">${r.quantity} × ${escapeTxt(pname(r))} (${escapeTxt(r.size||"-")}, ${escapeTxt(r.color_name||"-")}${isCustomSale(r)?`, ${r.hole_count||0} dziur`:""})</div>
      <div style="font-size:12px;color:var(--muted);">${escapeTxt(r.sold_at)} · ${fmtPLN(r.quantity*Number(r.unit_price))}</div>`;
    card.append(meta, twoStepButton("Usuń", "Na pewno?", ()=>deleteSale(r.id)));
    recent.appendChild(card);
  });
  if(!sales.length) recent.innerHTML = '<p style="color:var(--muted);font-size:13px;">Nie zarejestrowano jeszcze sprzedaży.</p>';
}

// --- formularz sprzedaży (inline, bez okienek) ---
const $s = id => document.getElementById(id);
function offersForSale(){ return products.filter(p=>!p.archived && p.available); }
function setupSaleForm(){
  const offers = offersForSale();
  const prev = $s("sProduct").value;
  $s("sProduct").innerHTML = offers.length
    ? offers.map(p=>`<option value="${escapeAttr(p.id)}">${escapeTxt(p.name)} — ${p.price} zł</option>`).join("")
    : '<option value="">Brak dostępnych ofert</option>';
  if(prev && offers.some(p=>String(p.id)===prev)) $s("sProduct").value = prev;
  fillOfferFields();
  // opcje Customów: kolory i kroje z konfiguratora + rozmiary
  const colors = rows.filter(r=>r.category==="kolor"), cuts = rows.filter(r=>r.category==="kroj");
  $s("sCColor").innerHTML = colors.map(c=>`<option value="${escapeAttr(c.name)}" data-hex="${escapeAttr(c.hex||"")}">${escapeTxt(c.name)}</option>`).join("") || "<option value=''>—</option>";
  $s("sCCut").innerHTML = cuts.map(c=>`<option>${escapeTxt(c.name)}</option>`).join("") || "<option value=''>—</option>";
  $s("sCSize").innerHTML = SIZE_LIST.map(s=>`<option>${s}</option>`).join("");
  $s("sDate").value = $s("sDate").value || todayStr();
  setSaleMode(saleMode);
}
function fillOfferFields(){
  const p = products.find(x=>String(x.id)===$s("sProduct").value);
  if(!p){ $s("sSize").innerHTML = "<option value=''>—</option>"; $s("sColor").innerHTML = "<option value=''>—</option>"; return; }
  const sizes = parseSizeChart(p.size_chart).rows.map(r=>r.size);
  const names = sizes.length ? sizes : (p.size_chart||"").split("\n").map(l=>l.split(":")[0].trim()).filter(Boolean);
  $s("sSize").innerHTML = names.length ? names.map(s=>`<option>${escapeTxt(s)}</option>`).join("") : "<option value=''>—</option>";
  $s("sColor").innerHTML = variantsOf(p).map((v,i)=>`<option value="${i}">${escapeTxt(v.name||v.color)}</option>`).join("");
  $s("sPrice").value = p.price;
}
function setSaleMode(mode){
  saleMode = mode;
  document.querySelectorAll("#saleModes button").forEach(b=>b.classList.toggle("active", b.dataset.mode===mode));
  $s("saleOffer").style.display = mode==="offer" ? "block" : "none";
  $s("saleCustom").style.display = mode==="custom" ? "block" : "none";
  salePriceTouched = false;
  if(mode==="offer") fillOfferFields(); else updateCustomPrice();
}
document.querySelectorAll("#saleModes button").forEach(b=> b.onclick = ()=> setSaleMode(b.dataset.mode));
$s("sProduct").onchange = fillOfferFields;

function showSaleErr(msg){ const e=$s("saleErr"); e.textContent=msg; e.style.display = msg ? "block" : "none"; }
let salePriceTouched = false;
$s("sPrice").addEventListener("input", ()=>{ salePriceTouched = true; });
// Podpowiedź ceny Customa: dopłata za kolor + dopłata za krój + liczba dziur × aktualna cena dziury (można nadpisać ręcznie)
async function updateCustomPrice(){
  if(saleMode!=="custom") return;
  const holePrice = holePriceOf(await fetchSettings());
  const color = rows.find(r=>r.category==="kolor" && r.name===$s("sCColor").value);
  const cut = rows.find(r=>r.category==="kroj" && r.name===$s("sCCut").value);
  const holes = Math.max(0, parseInt($s("sCHoles").value,10) || 0);
  const total = (Number(color?.price_extra)||0) + (Number(cut?.price_extra)||0) + holes*holePrice;
  $s("sCInfo").textContent = `Dopłaty: kolor ${fmtPLN(color?.price_extra||0)} + krój ${fmtPLN(cut?.price_extra||0)} + ${holes} × ${fmtPLN(holePrice)} (cena dziury z Ustawień) = ${fmtPLN(total)}`;
  if(!salePriceTouched) $s("sPrice").value = total;
}
["sCColor","sCCut","sCHoles"].forEach(id=> $s(id).addEventListener("input", updateCustomPrice));
$s("sCColor").addEventListener("change", updateCustomPrice); $s("sCCut").addEventListener("change", updateCustomPrice);

$s("saleSaveBtn").onclick = async ()=>{
  showSaleErr("");
  const qty = Number($s("sQty").value), price = Number($s("sPrice").value), sold_at = $s("sDate").value;
  if(!Number.isInteger(qty) || qty < 1) return showSaleErr("Liczba sztuk musi być liczbą całkowitą ≥ 1.");
  if(!Number.isFinite(price) || price < 0) return showSaleErr("Podaj poprawną cenę za sztukę (zł).");
  if(!sold_at) return showSaleErr("Podaj datę sprzedaży.");
  let row;
  if(saleMode==="offer"){
    const p = products.find(x=>String(x.id)===$s("sProduct").value);
    if(!p) return showSaleErr("Wybierz produkt z listy (dodaj ofertę w zakładce „Stałe oferty”).");
    if(!$s("sSize").value) return showSaleErr("Ten produkt nie ma rozmiarów — dodaj je w edycji produktu.");
    const v = variantsOf(p)[+$s("sColor").value];
    row = { product_id:p.id, product_name:p.name, size:$s("sSize").value, color_name:v.name||v.color, color_hex:v.color, quantity:qty, unit_price:price, sold_at };
  } else {
    const colorOpt = $s("sCColor").selectedOptions[0];
    if(!$s("sCColor").value || !$s("sCCut").value) return showSaleErr("Wybierz kolor i krój (dodaj je w zakładce Customy, jeśli lista jest pusta).");
    const holes = Number($s("sCHoles").value);
    if(!Number.isInteger(holes) || holes < 0 || holes > 50) return showSaleErr("Liczba dziur musi być liczbą całkowitą od 0 do 50.");
    row = { kind:"custom", product_id:null, product_name:CUSTOM_LABEL, size:$s("sCSize").value, color_name:$s("sCColor").value,
      color_hex: colorOpt?.dataset.hex || null, cut:$s("sCCut").value,
      hole_count: holes, hole_price: holePriceOf(await fetchSettings()),
      quantity:qty, unit_price:price, sold_at };
  }
  const ok = await addSale(row);
  if(ok){
    flash("saleMsg", `Zapisano: ${qty} × ${row.product_name} (${row.size}, ${row.color_name}) — ${fmtPLN(qty*price)}`, "ok");
    $s("sQty").value = 1;
    salePriceTouched = false;
    if(saleMode==="custom"){ $s("sCHoles").value = 0; updateCustomPrice(); }
    $s("sQty").focus();
  }
};
async function addSale(row){
  if(localDevMode){ row.id="s"+Date.now()+Math.random().toString(36).slice(2,5); sales=[row,...sales]; localStorage.setItem("localSales",JSON.stringify(sales)); renderSales(); return true; }
  const { error } = await sb.from("sales").insert(row);
  if(error){ showSaleErr("Błąd zapisu sprzedaży: "+error.message+(/column|kind|cut|hole/.test(error.message)?" — uruchom migrację 003 z README.":"")); return false; }
  await loadSales(); return true;
}
async function deleteSale(id){
  if(localDevMode){ sales=sales.filter(s=>s.id!==id); localStorage.setItem("localSales",JSON.stringify(sales)); renderSales(); return; }
  const { error } = await sb.from("sales").delete().eq("id", id);
  if(error) flash("saleMsg","Błąd: "+error.message,"err"); else loadSales();
}

// ---- Kampanie (planowane banery z harmonogramem) ----
let campaigns = [];
function campaignStatus(c){
  const today = todayStr();
  if(today < c.start_date) return ["planned","Zaplanowana"];
  if(today > c.end_date) return ["ended","Zakończona"];
  return ["active","Aktywna teraz"];
}
async function loadCampaigns(){
  loadDefaultBanner();
  if(localDevMode){ campaigns = JSON.parse(localStorage.getItem("localCampaigns")||"[]"); renderCampaigns(); return; }
  const { data, error } = await sb.from("campaigns").select("*").order("start_date");
  if(error){ alert("Błąd: "+error.message); return; }
  campaigns = data || []; renderCampaigns();
}
function renderCampaigns(){
  const list = document.getElementById("campaignsList"); list.innerHTML="";
  if(!campaigns.length) list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Brak zaplanowanych kampanii.</p>';
  campaigns.forEach(c=>{
    const [cls,label] = campaignStatus(c);
    const card = document.createElement("div"); card.className="campaign-card";
    card.innerHTML = `<span class="campaign-status status-${cls}">${label}</span>
      <div style="font-size:15px;margin-bottom:4px;">${escapeTxt(c.title)}</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:10px;">${escapeTxt(c.banner_text)}</div>
      <div style="font-size:12px;color:var(--muted);">${c.start_date} → ${c.end_date}</div>`;
    const editBtn = document.createElement("button"); editBtn.className="edit-btn"; editBtn.style.marginTop="10px"; editBtn.textContent="Edytuj";
    editBtn.onclick = ()=> openCampaignModal(c.id);
    card.appendChild(editBtn); list.appendChild(card);
  });
}
function openCampaignModal(id){
  const c = id ? campaigns.find(x=>x.id===id) : null;
  openModal(`
    <h3>${c?"Edytuj kampanię":"Nowa kampania"}</h3>
    <label>Nazwa kampanii</label><input type="text" id="mTitle" value="${escapeAttr(c?.title)}" placeholder="np. Black Friday">
    <label>Treść banera</label><textarea id="mBanner" rows="2" placeholder="np. -20% na wszystko do niedzieli!">${escapeTxt(c?.banner_text)}</textarea>
    <label>Data startu</label><input type="date" id="mStart" value="${c?.start_date || todayStr()}">
    <label>Data końca</label><input type="date" id="mEnd" value="${c?.end_date || todayStr()}">
    <div class="modal-actions">
      ${c?'<button class="btn btn-ghost" id="modalDelete" style="color:#ff6b6b;">Usuń</button>':""}
      <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
      <button class="btn btn-primary" id="modalSave">Zapisz</button>
    </div>`);
  document.getElementById("modalCancel").onclick = closeModal;
  if(c) document.getElementById("modalDelete").onclick = ()=>{ closeModal(); deleteCampaign(c.id); };
  document.getElementById("modalSave").onclick = ()=>{
    const title = document.getElementById("mTitle").value.trim();
    if(!title){ alert("Podaj nazwę kampanii"); return; }
    const row = {
      title,
      banner_text: document.getElementById("mBanner").value.trim(),
      start_date: document.getElementById("mStart").value,
      end_date: document.getElementById("mEnd").value,
    };
    closeModal();
    if(c) updateCampaign(c.id, row); else createCampaign(row);
  };
}
async function createCampaign(row){
  if(localDevMode){ row.id="c"+Date.now(); campaigns=[...campaigns,row]; localStorage.setItem("localCampaigns",JSON.stringify(campaigns)); renderCampaigns(); return; }
  const { error } = await sb.from("campaigns").insert(row);
  if(error) alert("Błąd: "+error.message); else loadCampaigns();
}
async function updateCampaign(id, patch){
  if(localDevMode){ campaigns=campaigns.map(c=>c.id===id?{...c,...patch}:c); localStorage.setItem("localCampaigns",JSON.stringify(campaigns)); renderCampaigns(); return; }
  const { error } = await sb.from("campaigns").update(patch).eq("id", id);
  if(error) alert("Błąd zapisu: "+error.message); else loadCampaigns();
}
async function deleteCampaign(id){
  if(!confirm("Usunąć kampanię?")) return;
  if(localDevMode){ campaigns=campaigns.filter(c=>c.id!==id); localStorage.setItem("localCampaigns",JSON.stringify(campaigns)); renderCampaigns(); return; }
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if(error) alert("Błąd: "+error.message); else loadCampaigns();
}
document.getElementById("addCampaignBtn").onclick = ()=> openCampaignModal(null);

function validIG(nick){ return /^@?[a-zA-Z0-9](?:[a-zA-Z0-9._]{0,28}[a-zA-Z0-9])?$/.test(nick); }

async function fetchSettings(){
  return localDevMode ? localSettings() : (await sb.from("site_settings").select("*").eq("id",1).single()).data;
}
async function applyAdminBrand(){
  try{ applyBrand(brandOf(await fetchSettings())); }catch(e){ applyBrand(DEFAULT_BRAND); }
  document.title = "Panel — " + document.title.split(" — ").pop();
}
async function saveSettingsPatch(patch){
  if(localDevMode){ const merged = {...localSettings(), ...patch}; saveLocalSettings(merged); return true; }
  const { error } = await sb.from("site_settings").update(patch).eq("id",1);
  if(error){ flash("settingsMsg","Błąd zapisu: "+error.message+(/hole_price/.test(error.message)?" — uruchom migrację 003 z README.":""),"err"); return false; }
  return true;
}

// ---- Ustawienia sklepu (nazwa, Instagram, wygląd, cena dziury) ----
// Jedno źródło prawdy: wiersz site_settings (id=1). Strona klienta czyta go przy każdym wejściu (nav.js / app.js).
const THEMES = [
  { name:"Ciemny streetwear", bg:"#111113", surface:"#19191c", text:"#f2f2f0", accent:"#d4ff3f", muted:"#8a8a8f", border:"#2c2c30" },
  { name:"Jasny minimalistyczny", bg:"#f7f6f3", surface:"#ffffff", text:"#171717", accent:"#1a1a1a", muted:"#767676", border:"#e2e0da" },
  { name:"Mono khaki", bg:"#14140f", surface:"#1e1e17", text:"#f2f0e6", accent:"#c9b35a", muted:"#8a8673", border:"#303024" },
  { name:"Czarno-czerwony", bg:"#0f0f10", surface:"#1a1a1b", text:"#f2f2f2", accent:"#ff3b3b", muted:"#8a8a8a", border:"#2a2a2c" },
];
function applyThemeLocally(t){
  const root = document.documentElement.style;
  [["--bg",t.bg],["--surface",t.surface],["--text",t.text],["--accent",t.accent],["--muted",t.muted],["--border",t.border]].forEach(([k,v])=>root.setProperty(k,v));
}
function renderThemeCards(currentAccent){
  const box = document.getElementById("themeCards"); box.innerHTML = "";
  THEMES.forEach(t=>{
    const card = document.createElement("button"); card.type = "button";
    card.className = "theme-card"+(t.accent===currentAccent?" active":"");
    card.innerHTML = `<div class="theme-swatches"><span style="background:${t.bg}"></span><span style="background:${t.surface}"></span><span style="background:${t.accent}"></span></div><div class="tname">${t.name}</div>`;
    card.onclick = async ()=>{
      const ok = await saveSettingsPatch({ theme_bg:t.bg, theme_surface:t.surface, theme_text:t.text, theme_accent:t.accent, theme_muted:t.muted, theme_border:t.border });
      if(ok){ applyThemeLocally(t); renderThemeCards(t.accent); flash("settingsMsg","Zapisano motyw: "+t.name+" — widoczny na całej stronie.","ok"); }
    };
    box.appendChild(card);
  });
}
async function loadSettings(){
  const data = await fetchSettings();
  if(!data){ flash("settingsMsg","Błąd pobierania ustawień","err"); return; }
  document.getElementById("shopNameInput").value = data.shop_name || "";
  document.getElementById("sellerIgInput").value = data.seller_ig || "";
  document.getElementById("contactTextInput").value = data.contact_text || "";
  document.getElementById("policyMdInput").value = data.policy_md || "";
  document.getElementById("holePriceInput").value = holePriceOf(data);
  renderThemeCards(data.theme_accent);
}
document.getElementById("saveSettingsBtn").onclick = async ()=>{
  const ig = document.getElementById("sellerIgInput").value.trim();
  const err = document.getElementById("sellerIgErr");
  if(ig && !validIG(ig)){ err.style.display="block"; return; }
  err.style.display="none";
  const hp = document.getElementById("holePriceInput").value.trim();
  const holePrice = Number(hp);
  if(hp==="" || !Number.isFinite(holePrice) || holePrice < 0 || holePrice > 10000){
    flash("settingsMsg","Cena dziury musi być liczbą od 0 do 10000 zł.","err"); document.getElementById("holePriceInput").focus(); return;
  }
  const ok = await saveSettingsPatch({
    shop_name: document.getElementById("shopNameInput").value.trim() || DEFAULT_BRAND,
    seller_ig: ig || "twoj_nick",
    contact_text: document.getElementById("contactTextInput").value.trim(),
    policy_md: document.getElementById("policyMdInput").value,
    hole_price: holePrice,
  });
  if(ok) applyAdminBrand();
  if(ok) flash("settingsMsg","Zapisano ustawienia. Cena dziury ("+fmtPLN(holePrice)+") obowiązuje teraz w całym sklepie.","ok");
};
async function showHolePriceHint(){
  const data = await fetchSettings();
  document.getElementById("holePriceHint").textContent = "Cena jednej dziury: "+fmtPLN(holePriceOf(data))+" (zmienisz ją w Ustawieniach).";
}

// ---- Baner domyślny (w zakładce Kampanie) ----
async function loadDefaultBanner(){
  const data = await fetchSettings();
  if(!data) return;
  document.getElementById("offerSwitch").classList.toggle("on", !!data.offer_enabled);
  document.getElementById("offerTextInput").value = data.offer_text || "";
}
document.getElementById("offerSwitch").onclick = (e)=> e.target.classList.toggle("on");
document.getElementById("saveDefaultBannerBtn").onclick = async ()=>{
  const ok = await saveSettingsPatch({
    offer_enabled: document.getElementById("offerSwitch").classList.contains("on"),
    offer_text: document.getElementById("offerTextInput").value.trim(),
  });
  if(ok) flash("bannerMsg","Zapisano baner domyślny","ok");
};

async function loadRows(){
  if(localDevMode){ rows = localOptions(); renderList(); return; }
  const { data, error } = await sb.from("options").select("*").order("category").order("sort_order",{ascending:true, nullsFirst:true});
  if(error){ flash("customyMsg","Błąd pobierania: "+error.message,"err"); return; }
  rows = data || [];
  renderList();
}

function renderList(){
  const list = document.getElementById("list"); list.innerHTML = "";
  rows.filter(r=>r.category===currentOptionCat).forEach(r=>{
    const card = document.createElement("div"); card.className="card";
    let dot;
    if(currentOptionCat==="kolor"){
      // edycja koloru w miejscu: kliknięcie w kółko otwiera wybór koloru
      dot = document.createElement("input"); dot.type = "color"; dot.className = "dot-color";
      dot.value = HEX_RE.test(r.hex||"") ? r.hex : "#555555"; dot.title = "Zmień kolor"; dot.setAttribute("aria-label","Kolor: "+r.name);
      dot.onchange = ()=> updateRow(r.id, { hex: dot.value }, "Zapisano kolor „"+r.name+"”");
    } else { dot = document.createElement("div"); dot.className = "dot"; }
    const meta = document.createElement("div"); meta.className="meta";
    const nameInput = document.createElement("input"); nameInput.value = r.name; nameInput.setAttribute("aria-label","Nazwa");
    nameInput.onchange = ()=>{
      const v = nameInput.value.trim();
      if(!v){ nameInput.value = r.name; flash("customyMsg","Nazwa nie może być pusta.","err"); return; }
      updateRow(r.id, { name: v }, "Zapisano nazwę");
    };
    const priceInput = document.createElement("input"); priceInput.className="price"; priceInput.type="number"; priceInput.min = "0";
    priceInput.value = r.price_extra || 0; priceInput.placeholder="dopłata zł"; priceInput.setAttribute("aria-label","Dopłata (zł)");
    priceInput.onchange = ()=>{
      const v = Number(priceInput.value);
      if(!Number.isFinite(v) || v < 0){ priceInput.value = r.price_extra || 0; flash("customyMsg","Dopłata musi być liczbą ≥ 0.","err"); return; }
      updateRow(r.id, { price_extra: v }, "Zapisano dopłatę");
    };
    meta.append(nameInput, priceInput);
    const sw = document.createElement("div"); sw.className="switch"+(r.available?" on":""); sw.title = "Dostępny dla klientów";
    sw.onclick = ()=>{ sw.classList.toggle("on"); updateRow(r.id, { available: sw.classList.contains("on") }); };
    card.append(dot, meta, sw);
    list.appendChild(card);
  });
  renderAddForm();
}

async function updateRow(id, patch, okMsg){
  if(localDevMode){
    rows = rows.map(r=> r.id===id ? {...r, ...patch} : r);
    saveLocalOptions(rows); renderList(); if(okMsg) flash("customyMsg",okMsg,"ok"); return;
  }
  const { error } = await sb.from("options").update(patch).eq("id", id);
  if(error) flash("customyMsg","Błąd zapisu: "+error.message,"err");
  else { await loadRows(); if(okMsg) flash("customyMsg",okMsg,"ok"); }
}

// Formularz dodawania opcji (inline): kolor = nazwa + wybór koloru + dopłata; krój = lista rozwijana + dopłata
function renderAddForm(){
  const box = document.getElementById("addOptionForm");
  const cat = currentOptionCat;
  if(cat==="style_dziur"){ box.style.display="none"; return; }
  box.style.display = "block";
  const usedCuts = rows.filter(r=>r.category==="kroj").map(r=>r.name.toLowerCase());
  const freeCuts = CUT_LIST.filter(c=>!usedCuts.includes(c.toLowerCase()));
  const canAdd = cat!=="kroj" || freeCuts.length > 0;
  let nameField;
  if(cat==="kroj"){
    nameField = freeCuts.length
      ? `<label for="aoCut">Krój</label><select id="aoCut">${freeCuts.map(c=>`<option>${escapeTxt(c)}</option>`).join("")}</select>`
      : '<p class="hint" style="margin:0 0 8px;">Wszystkie dostępne kroje zostały już dodane.</p>';
  } else {
    nameField = `<label for="aoName">Nazwa koloru</label><input type="text" id="aoName" maxlength="40" placeholder="np. Czarny">
      <label for="aoColor">Kolor</label><input type="color" id="aoColor" value="#555555" style="width:60px;height:38px;padding:0;border:none;background:none;">`;
  }
  box.innerHTML = `<div class="add-form"><div class="add-form-title">${cat==="kroj"?"Dodaj krój":"Dodaj kolor"}</div>${nameField}
    ${canAdd?`<label for="aoPrice">Dopłata (zł)</label><input type="number" id="aoPrice" min="0" step="1" value="0">
    <button type="button" class="btn btn-primary" id="aoAdd" style="width:100%;margin-top:12px;">Dodaj</button>`:""}</div>`;
  if(canAdd) document.getElementById("aoAdd").onclick = async ()=>{
    const price_extra = Number(document.getElementById("aoPrice").value);
    if(!Number.isFinite(price_extra) || price_extra < 0) return flash("customyMsg","Dopłata musi być liczbą ≥ 0.","err");
    const row = { category:cat, price_extra, available:true };
    if(cat==="kroj") row.name = document.getElementById("aoCut").value;
    else {
      row.name = document.getElementById("aoName").value.trim();
      if(!row.name) return flash("customyMsg","Podaj nazwę koloru.","err");
      if(rows.some(r=>r.category==="kolor" && r.name.toLowerCase()===row.name.toLowerCase())) return flash("customyMsg","Kolor o tej nazwie już istnieje — możesz go edytować na liście.","err");
      row.hex = document.getElementById("aoColor").value;
    }
    await insertOption(row);
    flash("customyMsg","Dodano: "+row.name,"ok");
  };
}
async function insertOption(row){
  if(localDevMode){
    row.id = "l"+Date.now(); row.sort_order = rows.length+1;
    rows = [...rows, row]; saveLocalOptions(rows); renderList(); return;
  }
  const { error } = await sb.from("options").insert(row);
  if(error) flash("customyMsg","Błąd dodawania: "+error.message,"err");
  else await loadRows();
}

// ---- Zdjęcie bazowe do edytora dziur (Customy) ----
async function loadBaseImage(){
  const data = await fetchSettings();
  const url = data?.customy_base_image;
  const img = document.getElementById("baseImgPreview");
  if(url){ img.src = url; img.style.display = "block"; } else { img.style.display = "none"; }
}
document.getElementById("baseImgBtn").onclick = ()=> document.getElementById("baseImgFile").click();
document.getElementById("baseImgFile").onchange = async (e)=>{
  const file = e.target.files[0]; if(!file) return;
  document.getElementById("baseImgBtn").textContent = "Wgrywanie...";
  const url = await uploadToR2(file, m=>flash("customyMsg",m,"err"));
  document.getElementById("baseImgBtn").textContent = "Wgraj zdjęcie";
  if(url){
    await saveSettingsPatch({ customy_base_image: url });
    loadBaseImage();
    flash("customyMsg","Zapisano zdjęcie bazowe","ok");
  }
  e.target.value = "";
};

// ---- Style dziur (zdjęcia przetarć w edytorze Customów) ----
let holeStyles = [];
async function loadHoleStyles(){
  if(localDevMode){ holeStyles = JSON.parse(localStorage.getItem("localHoleStyles")||"[]"); renderHoleStyles(); return; }
  const { data, error } = await sb.from("hole_styles").select("*").order("sort_order",{ascending:true,nullsFirst:true});
  if(error){ flash("customyMsg","Błąd: "+error.message,"err"); return; }
  holeStyles = data || []; renderHoleStyles();
}
function renderHoleStyles(){
  const list = document.getElementById("holeStylesList"); list.innerHTML = "";
  if(!holeStyles.length) list.innerHTML = '<p style="color:var(--muted);font-size:13px;">Brak dodanych stylów — klient zobaczy 2 domyślne kształty zastępcze (owal/poszarpana).</p>';
  holeStyles.forEach(s=>{
    const card = document.createElement("div"); card.className="card";
    const img = document.createElement("img"); img.src = s.image_url; img.style.cssText = "width:40px;height:40px;object-fit:cover;border-radius:8px;";
    const meta = document.createElement("div"); meta.className="meta";
    meta.innerHTML = `<div style="font-size:15px;">${escapeTxt(s.name)}</div>`;
    const del = twoStepButton("Usuń", "Na pewno?", ()=> deleteHoleStyle(s.id));
    card.append(img, meta, del); list.appendChild(card);
  });
}
async function deleteHoleStyle(id){
  if(localDevMode){ holeStyles=holeStyles.filter(s=>s.id!==id); localStorage.setItem("localHoleStyles",JSON.stringify(holeStyles)); renderHoleStyles(); return; }
  const { error } = await sb.from("hole_styles").delete().eq("id", id);
  if(error) flash("customyMsg","Błąd: "+error.message,"err"); else loadHoleStyles();
}
let hsUploadedUrl = null;
document.getElementById("hsImgBtn").onclick = ()=> document.getElementById("hsImgFile").click();
document.getElementById("hsImgFile").onchange = async (e)=>{
  const file = e.target.files[0]; e.target.value = ""; if(!file) return;
  const btn = document.getElementById("hsImgBtn"); btn.textContent = "Wgrywanie...";
  const url = await uploadToR2(file, m=>flash("customyMsg",m,"err"));
  btn.textContent = "Wgraj zdjęcie";
  if(url){ hsUploadedUrl = url; document.getElementById("hsImgPreview").innerHTML = `<img src="${escapeAttr(url)}" alt="" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">`; }
};
document.getElementById("addHoleStyleBtn").onclick = async ()=>{
  const name = document.getElementById("hsName").value.trim();
  if(!name) return flash("customyMsg","Podaj nazwę stylu.","err");
  if(!hsUploadedUrl) return flash("customyMsg","Wgraj zdjęcie stylu.","err");
  const row = { name, image_url: hsUploadedUrl, sort_order: holeStyles.length+1 };
  const reset = ()=>{ hsUploadedUrl = null; document.getElementById("hsName").value=""; document.getElementById("hsImgPreview").innerHTML=""; flash("customyMsg","Dodano styl: "+name,"ok"); };
  if(localDevMode){ row.id="hs"+Date.now(); holeStyles=[...holeStyles,row]; localStorage.setItem("localHoleStyles",JSON.stringify(holeStyles)); renderHoleStyles(); reset(); return; }
  const { error } = await sb.from("hole_styles").insert(row);
  if(error) flash("customyMsg","Błąd: "+error.message,"err"); else { loadHoleStyles(); reset(); }
};

checkSession();

// ---- Kontakt → Discord (tylko dla zalogowanego admina; webhook jest wyłącznie w Workerze) ----
(function(){
  const form = document.getElementById("contactForm"), msg = document.getElementById("cfMsg"), btn = document.getElementById("cfSend");
  const $ = id => document.getElementById(id);
  $("cfMessage").addEventListener("input", ()=>{ $("cfCount").textContent = $("cfMessage").value.length+" / 1000"; });
  function show(text, ok){ msg.textContent = text; msg.className = "cf-msg " + (ok ? "ok" : "err"); }
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const name = $("cfName").value.trim(), contact = $("cfContact").value.trim(), message = $("cfMessage").value.trim();
    if(!name) return show("Podaj imię lub nick.", false);
    if(!contact) return show("Podaj e-mail lub inny sposób kontaktu.", false);
    if(/@/.test(contact) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return show("Ten adres e-mail wygląda na niepoprawny.", false);
    if(message.length < 10) return show("Wiadomość jest za krótka (min. 10 znaków).", false);
    if(localDevMode || typeof CONTACT_API_URL === "undefined" || CONTACT_API_URL.includes("TWOJ-CONTACT-WORKER"))
      return show("Formularz nie jest skonfigurowany (Worker kontaktowy / prawdziwe logowanie).", false);
    const { data:{ session } } = await sb.auth.getSession();
    if(!session) return show("Sesja wygasła — zaloguj się ponownie.", false);
    btn.disabled = true; btn.textContent = "Wysyłanie..."; show("", true);
    try{
      const res = await fetch(CONTACT_API_URL, {
        method:"POST", headers:{ "Content-Type":"application/json", "Authorization":"Bearer "+session.access_token },
        body: JSON.stringify({ name, contact, message }),
      });
      const data = await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.error || "Nie udało się wysłać wiadomości.");
      form.reset(); $("cfCount").textContent = "0 / 1000";
      show("Wysłano na Discord.", true);
    }catch(err){
      show(err instanceof TypeError ? "Brak połączenia z serwerem." : err.message, false);
    }finally{ btn.disabled = false; btn.textContent = "Wyślij na Discord"; }
  });
})();
