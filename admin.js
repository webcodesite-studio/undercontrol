const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentCat = "kolor";
let rows = [];

// --- tryb testowy bez Supabase: działa TYLKO dopóki config.js ma placeholder URL ---
// Gdy wpiszesz prawdziwe dane Supabase, ten tryb sam się wyłącza — logowanie admin/admin
// przestanie działać i panel będzie wymagał prawdziwego konta.
const SUPABASE_CONFIGURED = !SUPABASE_URL.includes("TWOJ-PROJEKT");
// Tryb testowy admin/admin: WYŁĄCZNIE lokalnie (localhost / plik) i tylko gdy config.js ma placeholder Supabase.
// Na opublikowanej domenie logowanie wymaga prawdziwego konta Supabase.
const IS_LOCAL_HOST = ["localhost","127.0.0.1","[::1]",""].includes(location.hostname);
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
  if(!SUPABASE_CONFIGURED && !IS_LOCAL_HOST){ showLogin(); loginErr("Logowanie nie jest jeszcze skonfigurowane na tej stronie: w pliku config.js brakuje adresu i klucza Supabase. Uzupełnij je zgodnie z README."); return; }
  let session = null;
  try{ session = (await sb.auth.getSession()).data.session; }catch(e){}
  if(session){ showPanel(); } else { showLogin(); }
}
function showLogin(){ document.getElementById("loginBox").style.display="block"; document.getElementById("panel").style.display="none"; }
function showPanel(){
  document.getElementById("loginBox").style.display="none";
  document.getElementById("panel").style.display="flex";
  document.getElementById("devBadge").style.display = localDevMode ? "block" : "none";
  go("dashboard");
  applyAdminBrand();
}

var loginErr = t => { document.getElementById("loginErr").textContent = t; };
// Logowanie: prawdziwe konto Supabase Auth (sesja w localStorage — przetrwa odświeżenie i nawigację po stronach panelu).
// Błędy są rozróżniane: zły login/hasło ≠ brak konfiguracji ≠ brak połączenia (żeby nie wprowadzać w błąd).
async function doLogin(){
  const btn = document.getElementById("loginBtn");
  const email = document.getElementById("loginEmail").value.trim().toLowerCase();   // spacje i wielkość liter w e-mailu nie mają znaczenia
  const password = document.getElementById("loginPass").value;                       // hasła nie przycinamy
  loginErr("");
  if(!email || !password){ loginErr("Wpisz e-mail i hasło."); return; }
  if(!SUPABASE_CONFIGURED){
    // test lokalny bez Supabase: admin/admin TYLKO na localhost
    if(IS_LOCAL_HOST && email === "admin" && password === "admin"){ localDevMode = true; showPanel(); return; }
    loginErr(IS_LOCAL_HOST
      ? "Błędny mail lub hasło."
      : "Logowanie nie jest jeszcze skonfigurowane na tej stronie: w pliku config.js brakuje adresu i klucza Supabase (SUPABASE_URL, SUPABASE_ANON_KEY). To nie jest błąd hasła — patrz README, krok 1–2.");
    return;
  }
  btn.disabled = true; btn.textContent = "Logowanie…";
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      const bad = error.status === 400 || error.status === 401 || /invalid login|invalid credentials/i.test(error.message||"");
      loginErr(bad ? "Błędny mail lub hasło." : "Nie udało się połączyć z serwerem logowania. Sprawdź połączenie i konfigurację Supabase w config.js.");
      return;
    }
    showPanel();
  }catch(e){ loginErr("Nie udało się połączyć z serwerem logowania. Sprawdź połączenie i konfigurację Supabase w config.js."); }
  finally{ btn.disabled = false; btn.textContent = "Zaloguj"; }
}
document.getElementById("loginBtn").onclick = doLogin;
["loginEmail","loginPass"].forEach(id=>document.getElementById(id).addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); doLogin(); } }));
document.getElementById("logoutBtn").onclick = async ()=>{
  localDevMode = false;
  if(SUPABASE_CONFIGURED) await sb.auth.signOut();
  showLogin();
};

// ---- nawigacja boczna: kategoria → panele do pokazania ----
const SECTIONS = {
  dashboard:["dashboardPanel"], szukaj:["searchPanel"], wysylka:["deliveryPanel"], czapki:["hatsPanel"], spodnie:["spodniePanel"], customy:["customySubtabs"], obrazy:["imagesPanel"], rozmiary:["sizechartsPanel"],
  rabaty:["discountsPanel"], dekoder:["decoderPanel"], strona:["homePanel","campaignsPanel"], email:["emailPanel"], discord:["discordPanel"],
  instagram:["instagramPanel"], bezpieczenstwo:["securityPanel"], ogolne:["generalPanel"], kontakt:["contactPanel"],
};
const SECTION_TITLES = { dashboard:"Pulpit", szukaj:"Wyszukiwarka", wysylka:"Wysyłka zamówień", czapki:"Czapki", spodnie:"Gotowe spodnie", customy:"Customowe spodnie — ustawienia", obrazy:"Zdjęcia produktów", rozmiary:"Tabele rozmiarów",
  rabaty:"Kody rabatowe", dekoder:"Dekoder zamówień", strona:"Zawartość strony głównej", email:"Ustawienia e-mail", discord:"Ustawienia Discord",
  instagram:"Ustawienia Instagram", bezpieczenstwo:"Bezpieczeństwo", ogolne:"Ustawienia ogólne", kontakt:"Wiadomość do admina" };
const navBtns = document.querySelectorAll("#sbNav button[data-cat]");
function closeSidebar(){ document.getElementById("sidebar").classList.remove("open"); document.getElementById("sbBackdrop").classList.remove("open"); document.getElementById("sbToggle").setAttribute("aria-expanded","false"); }
function go(cat){
  currentCat = cat;
  navBtns.forEach(x=>x.classList.toggle("active", x.dataset.cat===cat));
  const shown = SECTIONS[cat] || [];
  Object.values(SECTIONS).flat().forEach(id=>{ const el = document.getElementById(id); if(el) el.style.display = shown.includes(id) ? "block" : "none"; });
  document.getElementById("pageTitle").textContent = SECTION_TITLES[cat] || "";
  closeSidebar(); window.scrollTo({top:0});
  if(cat==="ogolne" || cat==="instagram") loadSettings();
  else if(cat==="strona"){ loadCampaigns(); loadDefaultBanner(); }
  else if(cat==="customy"){ loadSettings(); loadRows(); loadBaseImage(); showHolePriceHint(); }
  window.adminShopTab?.(cat);
}
navBtns.forEach(b=>{ b.onclick = ()=> go(b.dataset.cat); });
document.getElementById("sbToggle").onclick = ()=>{
  const sb = document.getElementById("sidebar"), open = !sb.classList.contains("open");
  sb.classList.toggle("open", open); document.getElementById("sbBackdrop").classList.toggle("open", open); document.getElementById("sbToggle").setAttribute("aria-expanded", open);
};
document.getElementById("sbBackdrop").onclick = closeSidebar;
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
function openModal(html){ modalBox.onclick = null; modalBox.innerHTML = html; modalOverlay.style.display = "flex"; }
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

// wiersz zdjęcia w oknach edycji (czapki / gotowe spodnie)
function imgRowHtml(url){ return `<div class="color-row img-row"><img src="${escapeAttr(url)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px;"><span style="font-size:11px;color:var(--muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeTxt(url.split("/").pop())}</span><button type="button" class="removeRow" aria-label="Usuń zdjęcie">✕</button></div>`; }

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
  if(error){ flash(curSettingsMsg,"Błąd zapisu: "+error.message+(/hole_price|custom_base_price|order_|home_cards/.test(error.message)?" — uruchom najnowszą migrację SQL z README.":""),"err"); return false; }
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
let settingsLoaded = false, curSettingsMsg = "settingsMsg";
async function loadSettings(){
  const data = await fetchSettings();
  if(!data){ flash(curSettingsMsg,"Błąd pobierania ustawień","err"); return; }
  document.getElementById("shopNameInput").value = data.shop_name || "";
  document.getElementById("sellerIgInput").value = data.seller_ig || "";
  document.getElementById("contactTextInput").value = data.contact_text || "";
  document.getElementById("policyMdInput").value = data.policy_md || "";
  document.getElementById("holePriceInput").value = holePriceOf(data);
  document.getElementById("basePriceInput").value = Number(data.custom_base_price) || 0;
  paintIgPreview();
  renderThemeCards(data.theme_accent);
  settingsLoaded = true;
}
function paintIgPreview(){
  const nick = document.getElementById("sellerIgInput").value.trim().replace(/^@/,""), a = document.getElementById("igPreview");
  a.textContent = nick ? "instagram.com/"+nick : "—"; a.href = nick ? "https://www.instagram.com/"+encodeURIComponent(nick)+"/" : "#";
}
document.getElementById("sellerIgInput").addEventListener("input", paintIgPreview);
// każdy panel zapisuje tylko swoje pola (grupa: customy / ig / general)
document.querySelectorAll(".js-save-settings").forEach(btn=>{
  btn.onclick = async ()=>{
    const msgId = btn.dataset.msg, group = btn.dataset.group; curSettingsMsg = msgId;
    if(!settingsLoaded){ flash(msgId,"Ustawienia jeszcze się wczytują — spróbuj za chwilę.","err"); return; }
    const g = id => document.getElementById(id);
    let patch = {}, okMsg = "Zapisano ustawienia.";
    if(group==="ig"){
      const ig = g("sellerIgInput").value.trim(), err = g("sellerIgErr");
      if(ig && !validIG(ig)){ err.style.display="block"; return; }
      err.style.display = "none";
      patch = { seller_ig: ig.replace(/^@/,"") || "twoj_nick" }; okMsg = "Zapisano profil Instagram — linki w koszyku i stopce są już zaktualizowane.";
    } else if(group==="customy"){
      const hp = g("holePriceInput").value.trim(), holePrice = Number(hp);
      if(hp==="" || !Number.isFinite(holePrice) || holePrice < 0 || holePrice > 10000){ flash(msgId,"Cena dziury musi być liczbą od 0 do 10000 zł.","err"); g("holePriceInput").focus(); return; }
      const bp = g("basePriceInput").value.trim(), basePrice = bp==="" ? 0 : Number(bp);
      if(!Number.isFinite(basePrice) || basePrice < 0 || basePrice > 100000){ flash(msgId,"Cena bazowa musi być liczbą od 0 do 100000 zł.","err"); g("basePriceInput").focus(); return; }
      patch = { hole_price: holePrice, custom_base_price: basePrice };
      okMsg = `Zapisano ceny: dziura ${fmtPLN(holePrice)}, baza ${fmtPLN(basePrice)}.`;
    } else {
      patch = { shop_name: g("shopNameInput").value.trim() || DEFAULT_BRAND, contact_text: g("contactTextInput").value.trim(), policy_md: g("policyMdInput").value };
    }
    const ok = await saveSettingsPatch(patch);
    if(ok){ applyAdminBrand(); flash(msgId, okMsg, "ok"); if(group==="customy") showHolePriceHint(); }
  };
});
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

// automatyczne wylogowanie po 30 min bezczynności
(function idleLogout(){
  const LIMIT = 30*60*1000; let t;
  const arm = ()=>{ clearTimeout(t); t = setTimeout(async ()=>{ if(document.getElementById("panel").style.display==="flex"){ localDevMode=false; if(SUPABASE_CONFIGURED) await sb.auth.signOut(); showLogin(); document.getElementById("loginErr").textContent = "Wylogowano z powodu bezczynności."; } }, LIMIT); };
  ["click","keydown","pointerdown","scroll"].forEach(ev=>window.addEventListener(ev, arm, {passive:true})); arm();
})();
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
