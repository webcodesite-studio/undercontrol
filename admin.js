const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentCat = "kolor";
let rows = [];

// --- tryb testowy bez Supabase: działa TYLKO dopóki config.js ma placeholder URL ---
// Gdy wpiszesz prawdziwe dane Supabase, ten tryb sam się wyłącza — logowanie admin/admin
// przestanie działać i panel będzie wymagał prawdziwego konta.
const SUPABASE_CONFIGURED = !SUPABASE_URL.includes("TWOJ-PROJEKT");
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
  shop_name:"TWOJA MARKA", seller_ig:"twoj_nick", offer_enabled:true,
  offer_text:"Wysyłka gratis do niedzieli!", contact_text:"Napisz do nas na Instagramie.",
  policy_md:"# Polityka prywatności\n\nDane z formularza wykorzystujemy wyłącznie do kontaktu w sprawie zamówienia.",
  theme_bg:"#111113", theme_surface:"#19191c", theme_text:"#f2f2f0", theme_accent:"#d4ff3f", theme_muted:"#8a8a8f", theme_border:"#2c2c30",
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
}

document.getElementById("loginBtn").onclick = async ()=>{
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;

  if(!SUPABASE_CONFIGURED && email === "admin" && password === "admin"){
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
    const isWyglad = currentCat === "wyglad";
    document.getElementById("customySubtabs").style.display = isCustomy ? "block" : "none";
    document.getElementById("settingsPanel").style.display = isSettings ? "block" : "none";
    document.getElementById("productsPanel").style.display = isProducts ? "block" : "none";
    document.getElementById("campaignsPanel").style.display = isCampaigns ? "block" : "none";
    document.getElementById("wygladPanel").style.display = isWyglad ? "block" : "none";
    if(isSettings) loadSettings();
    else if(isProducts) loadProducts();
    else if(isCampaigns) loadCampaigns();
    else if(isCustomy) renderList();
  };
});
document.querySelectorAll('.tabs button[data-subcat]').forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll('.tabs button[data-subcat]').forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    currentOptionCat = b.dataset.subcat;
    renderList();
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
function escapeAttr(s){ return (s||"").replace(/"/g,"&quot;"); }
function todayStr(){ return new Date().toISOString().slice(0,10); }

// ---- Produkty (oferta na stronie głównej) ----
let products = [];
async function loadProducts(){
  if(localDevMode){ products = JSON.parse(localStorage.getItem("localProducts")||"[]"); renderProducts(); return; }
  const { data, error } = await sb.from("products").select("*").order("category").order("sort_order",{ascending:true,nullsFirst:true});
  if(error){ alert("Błąd: "+error.message); return; }
  products = data || []; renderProducts();
}
function renderProducts(){
  const list = document.getElementById("productsList"); list.innerHTML="";
  products.forEach(p=>{
    const colors = p.colors && p.colors.length ? p.colors : ["#555555"];
    const card = document.createElement("div"); card.className="card";
    const dot = document.createElement("div"); dot.className="dot"; dot.style.background = colors[0];
    const meta = document.createElement("div"); meta.className="meta";
    meta.innerHTML = `<div style="font-size:15px;">${escapeTxt(p.name)}</div>
      <div style="font-size:12px;color:var(--muted);">${escapeTxt(p.category)} · ${p.price} zł${colors.length>1?` · ${colors.length} kolory`:""}</div>`;
    const sw = document.createElement("div"); sw.className="switch"+(p.available?" on":"");
    sw.onclick=()=>{ sw.classList.toggle("on"); updateProduct(p.id,{available:sw.classList.contains("on")}); };
    const editBtn = document.createElement("button"); editBtn.className="edit-btn"; editBtn.textContent="Edytuj";
    editBtn.onclick = ()=> openProductModal(p.id);
    card.append(dot, meta, sw, editBtn); list.appendChild(card);
  });
}
function colorRowHtml(hex){ return `<div class="color-row"><input type="color" value="${hex}"><button type="button" class="removeColorRow">✕</button></div>`; }
function bindColorRemovers(){
  document.querySelectorAll(".removeColorRow").forEach(b=>{
    b.onclick = ()=>{ if(document.querySelectorAll("#colorRows .color-row").length>1) b.closest(".color-row").remove(); };
  });
}
function openProductModal(id){
  const p = id ? products.find(x=>x.id===id) : null;
  const colors = p?.colors?.length ? p.colors : ["#555555"];
  openModal(`
    <h3>${p?"Edytuj produkt":"Nowy produkt"}</h3>
    <label>Nazwa</label><input type="text" id="mName" value="${escapeAttr(p?.name)}" placeholder="np. Baggy Black">
    <label>Kategoria</label><input type="text" id="mCategory" value="${escapeAttr(p?.category || "Baggy")}" placeholder="Baggy / Straight / Slim">
    <label>Cena (zł)</label><input type="number" id="mPrice" value="${p?.price ?? 249}">
    <label>Kolory (dostępne warianty)</label>
    <div id="colorRows">${colors.map(colorRowHtml).join("")}</div>
    <button type="button" class="add-btn" id="addColorRow" style="padding:8px;">+ Dodaj kolor</button>
    <label>Opis</label><textarea id="mDescription" rows="2" placeholder="Krótki opis produktu">${escapeTxt(p?.description)}</textarea>
    <label>Wymiary (jedna linia na rozmiar)</label>
    <textarea id="mSizeChart" rows="4" placeholder="S: pas 72cm, długość 102cm&#10;M: pas 78cm, długość 104cm">${escapeTxt(p?.size_chart)}</textarea>
    <div class="modal-actions">
      ${p?'<button class="btn btn-ghost" id="modalDelete" style="color:#ff6b6b;">Usuń</button>':""}
      <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
      <button class="btn btn-primary" id="modalSave">Zapisz</button>
    </div>`);
  document.getElementById("addColorRow").onclick = ()=>{
    document.getElementById("colorRows").insertAdjacentHTML("beforeend", colorRowHtml("#555555"));
    bindColorRemovers();
  };
  bindColorRemovers();
  document.getElementById("modalCancel").onclick = closeModal;
  if(p) document.getElementById("modalDelete").onclick = ()=>{ closeModal(); deleteProduct(p.id); };
  document.getElementById("modalSave").onclick = ()=>{
    const name = document.getElementById("mName").value.trim();
    if(!name){ alert("Podaj nazwę produktu"); return; }
    const row = {
      name,
      category: document.getElementById("mCategory").value.trim() || "Baggy",
      price: Number(document.getElementById("mPrice").value) || 0,
      colors: [...document.querySelectorAll("#colorRows input[type=color]")].map(i=>i.value),
      description: document.getElementById("mDescription").value.trim(),
      size_chart: document.getElementById("mSizeChart").value.trim(),
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
  if(error) alert("Błąd zapisu: "+error.message); else loadProducts();
}
async function deleteProduct(id){
  if(!confirm("Usunąć produkt?")) return;
  if(localDevMode){ products=products.filter(p=>p.id!==id); localStorage.setItem("localProducts",JSON.stringify(products)); renderProducts(); return; }
  const { error } = await sb.from("products").delete().eq("id", id);
  if(error) alert("Błąd: "+error.message); else loadProducts();
}
document.getElementById("addProductBtn").onclick = ()=> openProductModal(null);

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
async function saveSettingsPatch(patch){
  if(localDevMode){ const merged = {...localSettings(), ...patch}; saveLocalSettings(merged); return true; }
  const { error } = await sb.from("site_settings").update(patch).eq("id",1);
  if(error){ alert("Błąd zapisu: "+error.message); return false; }
  return true;
}

// ---- Ustawienia sklepu ----
async function loadSettings(){
  const data = await fetchSettings();
  if(!data){ alert("Błąd pobierania ustawień"); return; }
  document.getElementById("shopNameInput").value = data.shop_name || "";
  document.getElementById("sellerIgInput").value = data.seller_ig || "";
  document.getElementById("contactTextInput").value = data.contact_text || "";
  document.getElementById("policyMdInput").value = data.policy_md || "";
}
document.getElementById("saveSettingsBtn").onclick = async ()=>{
  const ig = document.getElementById("sellerIgInput").value.trim();
  const err = document.getElementById("sellerIgErr");
  if(ig && !validIG(ig)){ err.style.display="block"; return; }
  err.style.display="none";
  const ok = await saveSettingsPatch({
    shop_name: document.getElementById("shopNameInput").value.trim() || "TWOJA MARKA",
    seller_ig: ig || "twoj_nick",
    contact_text: document.getElementById("contactTextInput").value.trim(),
    policy_md: document.getElementById("policyMdInput").value,
  });
  if(ok) alert("Zapisano");
};

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
  if(ok) alert("Zapisano baner domyślny");
};

async function loadRows(){
  if(localDevMode){ rows = localOptions(); renderList(); return; }
  const { data, error } = await sb.from("options").select("*").order("category").order("sort_order",{ascending:true, nullsFirst:true});
  if(error){ alert("Błąd pobierania: "+error.message); return; }
  rows = data || [];
  renderList();
}

function renderList(){
  const list = document.getElementById("list"); list.innerHTML = "";
  rows.filter(r=>r.category===currentOptionCat).forEach(r=>{
    const card = document.createElement("div"); card.className="card";
    const dot = document.createElement("div"); dot.className="dot";
    if(currentOptionCat==="kolor") dot.style.background = r.hex || "#555";
    const meta = document.createElement("div"); meta.className="meta";
    const nameInput = document.createElement("input"); nameInput.value = r.name;
    nameInput.onchange = ()=> updateRow(r.id, { name: nameInput.value });
    const priceInput = document.createElement("input"); priceInput.className="price"; priceInput.type="number";
    priceInput.value = r.price_extra || 0; priceInput.placeholder="dopłata zł";
    priceInput.onchange = ()=> updateRow(r.id, { price_extra: Number(priceInput.value) });
    meta.append(nameInput, priceInput);
    const sw = document.createElement("div"); sw.className="switch"+(r.available?" on":"");
    sw.onclick = ()=>{ sw.classList.toggle("on"); updateRow(r.id, { available: sw.classList.contains("on") }); };
    card.append(dot, meta, sw);
    list.appendChild(card);
  });
}

async function updateRow(id, patch){
  if(localDevMode){
    rows = rows.map(r=> r.id===id ? {...r, ...patch} : r);
    saveLocalOptions(rows); renderList(); return;
  }
  const { error } = await sb.from("options").update(patch).eq("id", id);
  if(error) alert("Błąd zapisu: "+error.message);
  else loadRows();
}

document.getElementById("addBtn").onclick = async ()=>{
  const name = prompt("Nazwa opcji:");
  if(!name) return;
  const row = { category: currentOptionCat, name, price_extra:0, available:true };
  if(currentOptionCat==="kolor") row.hex = prompt("Kolor hex (np. #1a1a1a):", "#555555") || "#555555";
  if(localDevMode){
    row.id = "l"+Date.now(); row.sort_order = rows.length+1;
    rows = [...rows, row]; saveLocalOptions(rows); renderList(); return;
  }
  const { error } = await sb.from("options").insert(row);
  if(error) alert("Błąd dodawania: "+error.message);
  else loadRows();
};

// ---- Wygląd (motywy kolorystyczne) ----
const THEMES = [
  { name:"Ciemny streetwear", bg:"#111113", surface:"#19191c", text:"#f2f2f0", accent:"#d4ff3f", muted:"#8a8a8f", border:"#2c2c30" },
  { name:"Jasny minimalistyczny", bg:"#f7f6f3", surface:"#ffffff", text:"#171717", accent:"#1a1a1a", muted:"#767676", border:"#e2e0da" },
  { name:"Mono khaki", bg:"#14140f", surface:"#1e1e17", text:"#f2f0e6", accent:"#c9b35a", muted:"#8a8673", border:"#303024" },
  { name:"Czarno-czerwony", bg:"#0f0f10", surface:"#1a1a1b", text:"#f2f2f2", accent:"#ff3b3b", muted:"#8a8a8a", border:"#2a2a2c" },
];
document.getElementById("openThemeModalBtn").onclick = async ()=>{
  const data = await fetchSettings();
  const currentAccent = data?.theme_accent;
  openModal(`
    <h3>Wybierz motyw</h3>
    ${THEMES.map((t,i)=>`
      <div class="theme-card${t.accent===currentAccent?" active":""}" data-i="${i}">
        <div class="theme-swatches"><span style="background:${t.bg}"></span><span style="background:${t.surface}"></span><span style="background:${t.accent}"></span></div>
        <div class="tname">${t.name}</div>
      </div>`).join("")}
    <div class="modal-actions">
      <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
    </div>`);
  document.getElementById("modalCancel").onclick = closeModal;
  document.querySelectorAll(".theme-card").forEach(card=>{
    card.onclick = async ()=>{
      const t = THEMES[+card.dataset.i];
      const ok = await saveSettingsPatch({
        theme_bg:t.bg, theme_surface:t.surface, theme_text:t.text,
        theme_accent:t.accent, theme_muted:t.muted, theme_border:t.border,
      });
      closeModal();
      if(ok){
        const root = document.documentElement.style;
        root.setProperty("--bg",t.bg); root.setProperty("--surface",t.surface); root.setProperty("--text",t.text);
        root.setProperty("--accent",t.accent); root.setProperty("--muted",t.muted); root.setProperty("--border",t.border);
        alert("Zapisano motyw: "+t.name);
      }
    };
  });
};

checkSession();
