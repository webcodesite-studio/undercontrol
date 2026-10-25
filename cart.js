// Wspólny koszyk (czapki + customowe spodnie), zapisywany w localStorage — przetrwa odświeżenie i przejścia między stronami.
const CART_KEY = "cart_v1";
const MAX_QTY = 50;
const zl = n => new Intl.NumberFormat("pl-PL",{style:"currency",currency:"PLN"}).format(Number(n)||0);

const Cart = (function(){
  function read(){
    try{
      const c = JSON.parse(localStorage.getItem(CART_KEY));
      if(c && Array.isArray(c.items)) return { items:c.items.filter(i=>i && i.key && i.qty>0).map(i=> (i.type==="pants" && (Array.isArray(i.holes) || i.cut)) ? { ...i, type:"custom" } : i), code:String(c.code||"") };
    }catch(e){}
    return { items:[], code:"" };
  }
  let state = read();
  function save(){
    try{ localStorage.setItem(CART_KEY, JSON.stringify(state)); }catch(e){ /* tryb prywatny — koszyk działa do końca sesji strony */ }
    document.dispatchEvent(new CustomEvent("cartchange"));
  }
  window.addEventListener("storage", e=>{ if(e.key===CART_KEY){ state = read(); document.dispatchEvent(new CustomEvent("cartchange")); } });

  const isCatalog = t => t==="hat" || t==="pants";   // czapki i gotowe spodnie: dokładny wariant (kolor + rozmiar)
  const itemKey = h => [h.type, h.id, h.color||"", h.size||""].join("|");
  return {
    items: ()=> state.items,
    code: ()=> state.code,
    setCode(c, silent){ state.code = String(c||"").trim().toUpperCase(); if(silent){ try{ localStorage.setItem(CART_KEY, JSON.stringify(state)); }catch(e){} } else save(); },
    count: ()=> state.items.reduce((s,i)=>s+i.qty,0),
    subtotal: ()=> Math.round(state.items.reduce((s,i)=>s+i.unitPrice*i.qty,0)*100)/100,
    // item: {type:"hat", id,name,color,colorHex,size,unitPrice,image,maxStock} albo {type:"pants", color,cut,size,holes,holePrice,unitPrice,...}
    // Czapka = dokładny wariant (czapka + kolor + rozmiar); maxStock to stan tego wariantu.
    add(item, qty=1){
      if(isCatalog(item.type) && (!item.color || !item.size)) return { ok:false, error:"Wybierz kolor i rozmiar." };
      const key = isCatalog(item.type) ? itemKey(item) : "pants|"+Date.now()+"|"+Math.random().toString(36).slice(2,6);
      const ex = state.items.find(i=>i.key===key);
      const have = ex ? ex.qty : 0;
      if(isCatalog(item.type) && item.maxStock!=null && have+qty > item.maxStock){
        return { ok:false, error: item.maxStock>0 ? `Dostępne tylko ${item.maxStock} szt. tego wariantu (masz już ${have} w koszyku).` : "Ten wariant jest niedostępny." };
      }
      if(ex){ ex.qty = Math.min(MAX_QTY, ex.qty+qty); ex.maxStock = item.maxStock; ex.unitPrice = item.unitPrice; }
      else state.items.push({ ...item, key, qty:Math.min(MAX_QTY, qty) });
      save(); return { ok:true };
    },
    setQty(key, qty){
      const it = state.items.find(i=>i.key===key); if(!it) return { ok:false };
      qty = Math.max(1, Math.min(MAX_QTY, Math.floor(qty)||1));
      if(isCatalog(it.type) && it.maxStock!=null && qty > it.maxStock){
        return { ok:false, error:`Dostępne tylko ${it.maxStock} szt. tego wariantu.`, qty: Math.max(1,it.maxStock) };
      }
      it.qty = qty; save(); return { ok:true };
    },
    remove(key){ state.items = state.items.filter(i=>i.key!==key); save(); },
    clear(){ state = { items:[], code:"" }; save(); },
    // odśwież cenę/stan według aktualnych danych sklepu (dokładny wariant: kolor + rozmiar); zwraca uwagi dla klienta
    syncCatalog(lists){   // lists = { hat:[...], pants:[...] } z Store.items(...)
      const notes = [];
      state.items.forEach(i=>{
        if(!isCatalog(i.type)) return;
        const h = (lists[i.type]||[]).find(x=>x.id===i.id);
        const v = h?.variants.find(x=>x.active && x.name===i.color);
        const z = v?.sizes.find(x=>x.size===i.size);
        if(!z || z.stock<1){ i.unavailable = true; i.maxStock = 0; notes.push(`„${i.name}” (${i.color}, ${i.size}) nie jest już dostępna.`); return; }
        delete i.unavailable;
        const price = Store.variantPrice(h, v);
        if(price !== i.unitPrice){ notes.push(`Cena „${i.name}” (${i.color}) zmieniła się na ${zl(price)}.`); i.unitPrice = price; }
        i.maxStock = z.stock; i.colorHex = v.hex;
        if(i.qty > z.stock){ i.qty = z.stock; notes.push(`Ilość „${i.name}” (${i.color}, ${i.size}) zmniejszona do dostępnej (${z.stock} szt.).`); }
      });
      save(); return notes;
    },
    // odświeża ceny/stany wszystkich pozycji katalogowych w koszyku
    async refresh(){
      const need = { hat:state.items.some(i=>i.type==="hat"), pants:state.items.some(i=>i.type==="pants") };
      if(!need.hat && !need.pants) return [];
      const lists = { hat:[], pants:[] };
      if(need.hat) lists.hat = await Store.items("hats");
      if(need.pants) lists.pants = await Store.items("pants");
      return this.syncCatalog(lists);
    },
  };
})();

// ---- komunikat (toast) ----
function showToast(msg, kind){
  let box = document.getElementById("toastBox");
  if(!box){ box = document.createElement("div"); box.id = "toastBox"; box.setAttribute("role","status"); box.setAttribute("aria-live","polite"); document.body.appendChild(box); }
  const t = document.createElement("div"); t.className = "toast"+(kind==="err"?" err":"");
  t.textContent = msg; box.appendChild(t);
  setTimeout(()=>{ t.classList.add("out"); setTimeout(()=>t.remove(), 300); }, kind==="err" ? 5000 : 3000);
}

// ---- nawigacja: Czapki / Spodnie / Customowe spodnie + koszyk, na każdej stronie ----
const NAV_LINKS = [
  ["index.html","Strona główna"], ["czapki.html","Czapki"], ["spodnie.html","Spodnie"], ["customy.html","Customowe spodnie"],
  ["polityka.html","Polityka prywatności"], ["kontakt.html","Kontakt"],
];
// strona szczegółów produktu podświetla swoją sekcję
const NAV_SECTION = { "czapka.html":"czapki.html", "spodnie-produkt.html":"spodnie.html" };
(function navCart(){
  const list = document.getElementById("nav-list"); if(!list) return;
  const file = location.pathname.split("/").pop() || "index.html";
  const active = NAV_SECTION[file] || file;
  list.innerHTML = NAV_LINKS.map(([h,t])=>`<li><a href="${h}"${h===active?' class="active" aria-current="page"':""}>${t}</a></li>`).join("") +
    `<li><a href="koszyk.html" class="cart-link${file==="koszyk.html"?" active":""}" aria-label="Koszyk">Koszyk <span class="cart-badge" id="cartBadge" hidden>0</span></a></li>`;
  const upd = ()=>{ const b = document.getElementById("cartBadge"); const n = Cart.count(); b.textContent = n; b.hidden = !n; };
  document.addEventListener("cartchange", upd); upd();
})();

// ---- wspólne helpery widoku koszyka / zamówienia ----
const holesText = holes => (holes||[]).map((h,i)=>`${i+1}) ${h.style||"dziura"}: x ${Math.round(h.x)}%, y ${Math.round(h.y)}%, ${Math.round(h.w)}×${Math.round(h.h)}%`).join("; ");
// [etykieta, wartość] — szczegóły pozycji (czapka albo customowe spodnie)
function itemDetails(i){
  if(i.type==="hat" || i.type==="pants") return [["Wariant", `${i.color}, rozmiar ${i.size}`], ...(i.sku ? [["ID produktu", i.sku]] : [])];
  const rows = [["ID produktu", "CUSTOM"],["Kolor", i.color],["Krój", i.cut],["Rozmiar", i.size],
    ["Dziury", i.holes?.length ? `${i.holes.length} szt. (${zl(i.holePrice)} / szt.)` : "Brak"]];
  if(i.holes?.length) rows.push(["Rozmieszczenie dziur", holesText(i.holes)]);
  if(i.measurements) rows.push(["Wymiary", i.measurements]);
  if(i.notes) rows.push(["Uwagi", i.notes]);
  return rows;
}
// Sprawdza kod z koszyka na serwerze; zwraca {valid, error, discount, code...} albo null gdy brak kodu
async function resolveDiscount(){
  const code = Cart.code(); if(!code) return null;
  return Store.validateDiscount(code, Cart.subtotal());
}

// ---- Instagram: płatność i potwierdzenie zamówienia odbywają się wyłącznie tam ----
const igProfileUrl = nick => "https://www.instagram.com/" + encodeURIComponent(String(nick||"").replace(/^@/,"")) + "/";
function paymentNoticeHtml(){
  return `<div class="pay-notice" role="note">
    <div class="pay-title">Zamówienie składasz tutaj — płatność i potwierdzenie ustalamy potem na Instagramie</div>
    <p>Payment and order confirmation are handled through Instagram. After placing your order, contact us on Instagram with your order number to confirm the details and arrange payment.</p>
    <p class="pay-pl">Płatność i potwierdzenie zamówienia odbywają się przez Instagram. Po złożeniu zamówienia dostaniesz numer — napisz do nas na Instagramie, podając ten numer, aby potwierdzić szczegóły i ustalić płatność.</p>
    <ul>
      <li>Kliknięcie „Złóż zamówienie” wysyła zamówienie do sklepu automatycznie — nie musisz niczego kopiować ani wysyłać ręcznie.</li>
      <li>Strona nie przetwarza płatności i niczego nie pobiera.</li>
      <li>Prosimy tylko o nazwę użytkownika na Instagramie — nie zbieramy e-maila, telefonu ani adresu.</li>
    </ul>
    <a class="btn btn-primary ig-link" href="${igProfileUrl(window.SELLER_IG)}" target="_blank" rel="noopener noreferrer">Instagram sklepu</a>
  </div>`;
}
// linki .ig-link zawsze wskazują aktualny profil (nick z ustawień panelu ładuje się chwilę po starcie strony)
function refreshIgLinks(){ document.querySelectorAll("a.ig-link").forEach(a=>{ a.href = igProfileUrl(window.SELLER_IG); }); }
document.addEventListener("siteSettingsReady", refreshIgLinks);

// ---- ID produktu (do podania na Instagramie) i tabela rozmiarów ----
function productIdHtml(sku){
  if(!sku) return "";
  return `<div class="pid"><span class="pid-label">ID produktu</span><code>${escHtml(sku)}</code>
    <button type="button" class="pid-copy" data-copy="${escHtml(sku)}">Kopiuj</button>
    <small>Użyj tego ID, pytając o ten produkt na Instagramie.</small></div>`;
}
document.addEventListener("click", async e=>{
  const b = e.target.closest("[data-copy]"); if(!b) return;
  const t = b.textContent;
  try{ await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Skopiowano ✓"; }catch(_){ b.textContent = "Zaznacz i skopiuj"; }
  setTimeout(()=>{ b.textContent = t; }, 1800);
});
function sizeChartHtml(chart){
  if(!chart || !chart.rows.length) return "";
  return `<section class="size-chart" aria-label="Tabela rozmiarów"><h3>${escHtml(chart.name||"Tabela rozmiarów")}</h3>
    <div class="sc-scroll"><table><thead><tr><th scope="col">Rozmiar</th>${chart.columns.map(c=>`<th scope="col">${escHtml(c)}</th>`).join("")}</tr></thead>
    <tbody>${chart.rows.map(r=>`<tr data-size="${escHtml(r.size)}"><th scope="row">${escHtml(r.size)}</th>${chart.columns.map((_,i)=>`<td>${escHtml(r.values[i]??"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    ${chart.note?`<p class="sc-note">${escHtml(chart.note)}</p>`:""}</section>`;
}
// podświetla wiersz wybranego rozmiaru w tabeli
function highlightChartSize(size){
  document.querySelectorAll(".size-chart tbody tr").forEach(tr=>tr.classList.toggle("sel", !!size && tr.dataset.size===size));
}
