// Koszyk: pozycje pogrupowane (czapki / gotowe spodnie / spodnie custom), kod rabatowy, sposób odbioru, nazwa użytkownika Instagram.
// „Złóż zamówienie” wysyła kompletne zamówienie AUTOMATYCZNIE do funkcji serverless (/api/submit-order), która przekazuje je przez Formspree
// (e-mail) i/lub na Discord — zgodnie z wyborem właściciela w panelu. Potwierdzenie pokazujemy WYŁĄCZNIE po udanej wysyłce.
// Instagram służy dopiero potem: pytania, płatność, potwierdzenie. Nie ma tu żadnego ręcznego kopiowania ani „wiadomości do wysłania”.
const body = document.getElementById("cartBody"), notesBox = document.getElementById("cartNotes");
const GROUPS = [
  { type:"hat",    title:"Czapki",             tag:"Czapka",          add:["czapki.html","+ Dodaj czapki"] },
  { type:"pants",  title:"Spodnie (gotowe)",   tag:"Spodnie",         add:["spodnie.html","+ Dodaj gotowe spodnie"] },
  { type:"custom", title:"Spodnie Custom",     tag:"Custom",          add:["customy.html","+ Zaprojektuj spodnie"] },
];
// jedyne dane od klienta: nazwa użytkownika Instagram (wymagana) i opcjonalne uwagi — tylko w pamięci strony, nie w localStorage
let igName = "", orderNotes = "";
const IG_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._]{0,28}[A-Za-z0-9])?$/;
const cleanIg = v => String(v||"").trim().replace(/^@/,"");
function readFields(){ const a = document.getElementById("fIg"), b = document.getElementById("fNotes"); if(a) igName = a.value; if(b) orderNotes = b.value; }
let discount = null, discountErr = "", busy = false, testUi = false;
let orderStatus = { mode:"both", test_mode:false, ready:null };   // publiczny, niewrażliwy status z /api/submit-order
let attemptId = null;                                             // jeden identyfikator na próbę złożenia (ochrona przed podwójnym wysłaniem)
let delivery = "shipping";
try{ const d = localStorage.getItem("cart_delivery"); if(d==="pickup"||d==="shipping") delivery = d; }catch(e){}

const hexOk = c => /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#555";
function showNotes(list){ notesBox.innerHTML = list.map(n=>`<div class="inline-msg warn" role="status">${escHtml(n)}</div>`).join(""); }
const totals = () => {
  const sub = Cart.subtotal(), d = discount?.valid ? discount.discount : 0;
  return { sub, d, total: Math.max(0, Math.round((sub-d)*100)/100) };
};

function lineHtml(i, g){
  const thumb = i.image ? `<img src="${escHtml(i.image)}" alt="" loading="lazy">`
    : `<div class="line-ph ${i.type==="hat"?"":"pants"}" style="background:${hexOk(i.colorHex)}"></div>`;
  const det = itemDetails(i).map(([k,v])=>`<div class="line-det"><span>${escHtml(k)}</span><b>${escHtml(v)}</b></div>`).join("");
  const href = i.type==="hat" ? `<a href="czapka.html?id=${encodeURIComponent(i.id)}">${escHtml(i.name)}</a>`
    : i.type==="pants" ? `<a href="spodnie-produkt.html?id=${encodeURIComponent(i.id)}">${escHtml(i.name)}</a>` : escHtml(i.name);
  return `<div class="cart-line${i.unavailable?" bad":""}" data-key="${escHtml(i.key)}">
    <div class="line-thumb">${thumb}</div>
    <div class="line-main">
      <div class="line-title">${href} <span class="tag tag-${i.type}">${g.tag}</span>${i.test?' <span class="tag tag-test">TEST</span>':""}</div>
      ${i.unavailable?'<div class="line-warn">Niedostępne — usuń z koszyka, aby kontynuować.</div>':""}
      <div class="line-dets">${det}</div>
      <div class="line-ctrl">
        <div class="qty"><button type="button" data-act="minus" aria-label="Mniej">−</button><input type="number" min="1" max="${i.type!=="custom"&&i.maxStock?i.maxStock:50}" value="${i.qty}" data-act="qty" inputmode="numeric" aria-label="Ilość" ${i.unavailable?"disabled":""}><button type="button" data-act="plus" aria-label="Więcej" ${i.unavailable?"disabled":""}>+</button></div>
        <button type="button" class="link-btn" data-act="remove">Usuń</button>
      </div>
    </div>
    <div class="line-price"><b>${zl(i.unitPrice*i.qty)}</b>${i.qty>1?`<small>${zl(i.unitPrice)} / szt.</small>`:""}</div>
  </div>`;
}

const modeLabel = () => orderStatus.mode==="email" ? "Email only enabled" : orderStatus.mode==="discord" ? "Discord only enabled" : "Email and Discord enabled";
const modeText = () => orderStatus.mode==="email" ? "e-mailem (Formspree)" : orderStatus.mode==="discord" ? "na Discord" : "e-mailem (Formspree) i na Discord";
const notReady = () => orderStatus.ready===false && !orderStatus.test_mode;
function render(){
  const items = Cart.items();
  if(!items.length){
    body.innerHTML = `<div class="empty-cart"><p>Twój koszyk jest pusty.</p>
      <div class="added-actions"><a class="btn btn-primary" href="czapki.html">Czapki</a><a class="btn btn-primary" href="spodnie.html">Spodnie</a><a class="btn btn-ghost" href="customy.html">Customowe spodnie</a></div></div>`;
    return;
  }
  const { sub, d, total } = totals();
  const blocked = items.some(i=>i.unavailable);
  const groups = GROUPS.map(g=>{
    const list = items.filter(i=>i.type===g.type); if(!list.length) return "";
    return `<section class="cart-group"><h2>${g.title} <span class="cnt">${list.reduce((s,i)=>s+i.qty,0)} szt.</span></h2>${list.map(i=>lineHtml(i,g)).join("")}</section>`;
  }).join("");
  body.innerHTML = paymentNoticeHtml() + `
    <div class="cart-grid">
      <div class="cart-lines">${groups}
        <div class="added-actions" style="justify-content:flex-start;margin-top:14px;">${GROUPS.map(g=>`<a class="btn btn-ghost" href="${g.add[0]}">${g.add[1]}</a>`).join("")}</div>
      </div>
      <aside class="cart-summary">
        <h2>Podsumowanie</h2>
        <form id="codeForm" class="code-row" novalidate>
          <input type="text" id="codeInput" placeholder="Kod rabatowy" autocomplete="off" autocapitalize="characters" value="${escHtml(Cart.code())}" aria-label="Kod rabatowy">
          <button class="btn btn-ghost" id="codeBtn" type="submit">Zastosuj</button>
        </form>
        <div id="codeMsg" class="code-msg ${discount?.valid?"ok":discountErr?"err":""}" role="status" aria-live="polite">${
          discount?.valid ? `Kod <b>${escHtml(discount.code)}</b> zastosowany ✓ <button type="button" class="link-btn" id="codeRemove">usuń</button>` : escHtml(discountErr)}</div>
        <div class="sum-row"><span>Produkty (${Cart.count()} szt.)</span><b>${zl(sub)}</b></div>
        ${discount?.valid?`<div class="sum-row disc"><span>Rabat ${discount.type==="percent"?`(−${discount.value}%)`:""}</span><b>−${zl(d)}</b></div>`:""}
        <div class="sum-row total"><span>Razem</span><b>${zl(total)}</b></div>

        <div class="field-ig">
          <label for="fIg">Twoja nazwa użytkownika na Instagramie <b class="req">*</b></label>
          <input type="text" id="fIg" placeholder="@twoj_nick" maxlength="31" autocomplete="off" autocapitalize="off" spellcheck="false" value="${escHtml(igName)}" aria-required="true">
          <div class="ferr" id="igErr" role="alert"></div>
          <small class="hint-small">Potrzebujemy jej tylko po to, żeby napisać do Ciebie na Instagramie i potwierdzić zamówienie. Nie prosimy o e-mail ani telefon.</small>
        </div>
        <label class="lbl" for="fNotes">Uwagi do zamówienia <span class="muted">(opcjonalnie)</span></label>
        <textarea id="fNotes" rows="2" maxlength="500" class="notes-input">${escHtml(orderNotes)}</textarea>
        <input class="hp" type="text" id="fHp" tabindex="-1" autocomplete="off" aria-hidden="true">
        <fieldset class="opt-group"><legend>Sposób odbioru</legend>
          <label class="opt"><input type="radio" name="delivery" value="shipping" ${delivery==="shipping"?"checked":""}> Wysyłka</label>
          <label class="opt"><input type="radio" name="delivery" value="pickup" ${delivery==="pickup"?"checked":""}> Odbiór osobisty</label>
        </fieldset>
        ${testUi ? `<div class="test-status" id="notifyStatus" role="status">TEST · Order notifications: ${modeLabel()}${orderStatus.test_mode?" · server TEST MODE: nothing is actually sent":""}</div>` : ""}
        <div id="actionErr" class="inline-msg err" role="alert" hidden></div>
        ${blocked ? '<div class="inline-msg warn">Usuń niedostępne pozycje, aby kontynuować.</div>' : ""}
        ${notReady() ? '<div class="inline-msg err" style="display:block;margin-bottom:10px;"><b>Składanie zamówień jest chwilowo niedostępne</b> — usługa zamówień nie jest jeszcze skonfigurowana. Twój koszyk zostaje zapamiętany.</div>' : ""}
        <button class="btn btn-primary" id="sendBtn" type="button" style="width:100%;" ${blocked||notReady()?"disabled":""}>Złóż zamówienie</button>
        <p class="hint-small" style="margin:6px 0 12px;">${orderStatus.test_mode ? "Tryb testowy: zamówienie NIE zostanie nigdzie wysłane." : `Zamówienie zostanie wysłane automatycznie do sklepu ${modeText()}.`} Zamówienia nie wysyłasz na Instagram — po złożeniu dostaniesz numer, z którym napiszesz do nas na Instagramie w sprawie płatności i potwierdzenia.</p>
        <button type="button" class="link-btn" id="clearBtn" style="margin-top:14px;">Wyczyść koszyk</button>
      </aside>
    </div>`;
  refreshIgLinks();
}

function summaryHtml(items, sub, d, code, total){
  const label = { hat:"Czapka", pants:"Spodnie", custom:"Custom" };
  return `<div class="sum-items">${items.map(i=>`<div class="sum-item"><div><b>${escHtml(i.name)}</b> <span class="tag tag-${i.type}">${label[i.type]}</span> × ${i.qty}
      <div class="sum-det">${itemDetails(i).map(([k,v])=>`${escHtml(k)}: ${escHtml(v)}`).join(" · ")}</div></div><span>${zl(i.unitPrice*i.qty)}</span></div>`).join("")}</div>
    <div class="sum-row"><span>Produkty</span><b>${zl(sub)}</b></div>
    ${d>0?`<div class="sum-row disc"><span>Rabat ${escHtml(code)}</span><b>−${zl(d)}</b></div>`:""}
    <div class="sum-row total"><span>Razem</span><b>${zl(total)}</b></div>
    <div class="sum-det">Sposób odbioru: ${delivery==="pickup"?"odbiór osobisty":"wysyłka"}${orderNotes.trim()?`<br>Uwagi: ${escHtml(orderNotes.trim())}`:""}</div>`;
}

// ---- ekran po udanym wysłaniu (albo po teście — wtedy wyraźnie oznaczony i bez udawania dostarczenia) ----
function showFinal(data, items){
  const so = data.order, ig = cleanIg(so.instagram), isTest = data.test === true;
  const sub = items.reduce((s,i)=>s+i.unitPrice*i.qty,0);
  const preview = isTest ? `<details class="test-preview"><summary>Podgląd tego, co zostałoby wysłane (tylko test)</summary>
      ${data.preview?.formspree_fields ? `<p class="hint-small">E-mail (Formspree) — temat: <b>${escHtml(data.preview.formspree_fields._subject)}</b></p><pre>${escHtml(data.preview.formspree_fields.complete_order)}</pre>${data.preview.formspree_fields.custom_pants_base64_code?`<p class="hint-small">Kod Base64 (pole <code>custom_pants_base64_code</code>):</p><pre>${escHtml(data.preview.formspree_fields.custom_pants_base64_code)}</pre>`:""}` : ""}
      ${data.preview?.discord_text && !data.preview?.formspree_fields ? `<p class="hint-small">Discord:</p><pre>${escHtml(data.preview.discord_text)}</pre>` : ""}
    </details>` : "";
  notesBox.innerHTML = "";
  body.innerHTML = isTest ? `<div class="confirm">
    <div class="test-banner" style="max-width:600px;margin:0 auto 14px;text-align:left;"><b>TRYB TESTOWY</b> — to tylko test. <b>Żadna wiadomość e-mail ani Discord NIE została wysłana</b>, zamówienie nie dotarło do sklepu. Po dodaniu prawdziwych kluczy ten sam przycisk wyśle prawdziwe zamówienie.</div>
    <h2>Test zamówienia — nic nie wysłano</h2>
    <div class="order-code" aria-label="Numer testowy"><span>Numer testowy</span><b id="orderCode">${escHtml(data.number)}</b></div>
    <p class="muted">Nazwa użytkownika Instagram: <b>@${escHtml(ig)}</b></p>
    ${preview}
  </div>
  <div class="cart-summary" style="max-width:640px;margin:0 auto;text-align:left;"><h3>Podsumowanie testowego zamówienia</h3>${summaryHtml(items, sub, so.discount_amount, so.discount_code, so.total)}
    <a href="index.html" class="link-btn">← Wróć na stronę główną</a></div>`
  : `<div class="confirm">
    <div class="big">✓</div>
    <h2>Zamówienie przyjęte</h2>
    <p class="muted">Order accepted</p>
    <div class="order-code" aria-label="Numer zamówienia"><span>Numer zamówienia</span><b id="orderCode">${escHtml(data.number)}</b><button type="button" class="btn btn-ghost" id="copyCodeBtn">Skopiuj numer</button></div>
    <div class="next-steps" role="note">
      <p><b>Twoje zamówienie zostało przyjęte.</b> Nazwa użytkownika Instagram: <b>@${escHtml(ig)}</b></p>
      <p><b>Skontaktuj się z nami na Instagramie</b> i wyślij nam swoją nazwę użytkownika wraz z tym numerem zamówienia. Potwierdzimy zamówienie i ustalimy z Tobą płatność.</p>
      <p class="pay-pl">Your order has been accepted. Order number: ${escHtml(data.number)}. Please contact us on Instagram and send us your Instagram username together with this order number. We will confirm the order and arrange payment with you.</p>
      <p class="hint-small">Strona nie przetwarza płatności. Status zamówienia: <b>oczekuje na potwierdzenie na Instagramie</b>.</p>
    </div>
    <div class="added-actions" style="max-width:520px;margin:14px auto 0;"><a class="btn btn-primary ig-link" href="${igProfileUrl(window.SELLER_IG)}" target="_blank" rel="noopener noreferrer">Otwórz Instagram sklepu</a></div>
  </div>
  <div class="cart-summary" style="max-width:640px;margin:0 auto;text-align:left;">
    <h3>Podsumowanie zamówienia</h3>${summaryHtml(items, sub, so.discount_amount, so.discount_code, so.total)}
    <a href="index.html" class="link-btn">← Wróć na stronę główną</a>
  </div>`;
  const cc = document.getElementById("copyCodeBtn");
  if(cc) cc.onclick = async ()=>{ const o = cc.textContent; try{ await navigator.clipboard.writeText(data.number); cc.textContent = "Skopiowano ✓"; }catch(e){ cc.textContent = "Zaznacz numer i skopiuj"; } setTimeout(()=>{ cc.textContent = o; }, 1800); };
  refreshIgLinks(); window.scrollTo({top:0, behavior:"smooth"});
}

// ---- kod rabatowy ----
async function refreshDiscount(){
  discount = null; discountErr = "";
  if(!Cart.code()) return;
  try{
    const r = await resolveDiscount();
    if(r?.valid) discount = r; else { discountErr = r?.error || "Nieprawidłowy kod."; Cart.setCode("", true); }
  }catch(e){ discountErr = "Nie udało się sprawdzić kodu: "+e.message; }
}
async function rerender(){ readFields(); await refreshDiscount(); render(); }

// ---- „Złóż zamówienie”: automatyczna wysyłka; potwierdzenie dopiero po sukcesie ----
async function placeOrder(){
  if(busy) return;                                           // podwójne kliknięcie
  readFields();
  const err = document.getElementById("actionErr"); err.hidden = true;
  if(document.getElementById("fHp")?.value) return;          // pułapka na boty
  const igErr = document.getElementById("igErr"), igIn = document.getElementById("fIg");
  igErr.textContent = ""; igIn.classList.remove("invalid");
  if(!cleanIg(igName)){ igErr.textContent = "Podaj swoją nazwę użytkownika na Instagramie — bez niej nie będziemy wiedzieć, jak się z Tobą skontaktować."; igIn.classList.add("invalid"); igIn.focus(); return; }
  if(!IG_RE.test(cleanIg(igName))){ igErr.textContent = "Niepoprawna nazwa użytkownika (litery, cyfry, kropki i podkreślenia, do 30 znaków)."; igIn.classList.add("invalid"); igIn.focus(); return; }
  const btn = document.getElementById("sendBtn"), label = btn.textContent;
  busy = true; btn.disabled = true; btn.textContent = "Wysyłanie zamówienia…";
  const fail = msg => { err.hidden = false; err.textContent = msg; btn.disabled = false; btn.textContent = label; busy = false; err.scrollIntoView({block:"center", behavior:"smooth"}); };
  if(!ORDER_API_URL) return fail("Automatyczne składanie zamówień nie jest tu jeszcze skonfigurowane (hosting statyczny — wymaga zewnętrznej funkcji serverless, patrz DEPLOY.md). Koszyk został zachowany — napisz do nas na Instagramie.");
  const items = Cart.items().map(i=>({...i})), sub = Cart.subtotal();
  try{
    let d = 0;
    if(Cart.code()){
      const r = await Store.validateDiscount(Cart.code(), sub);
      if(!r.valid){ discountErr = r.error; Cart.setCode("", true); discount = null; busy = false; render(); const e2 = document.getElementById("actionErr"); e2.hidden = false; e2.textContent = "Kod rabatowy nie może zostać użyty: "+r.error+" Podsumowanie zaktualizowano."; return; }
      d = r.discount;
    }
    attemptId ||= (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+"-"+Math.random().toString(36).slice(2,10));
    const payload = { submission_id: attemptId, hp:"", order:{
      // wybory klienta + wyświetlane dane; serwer, gdy ma dostęp do katalogu, zastępuje je własnymi (ceny/nazwy/ID); inaczej oznacza zamówienie jako „niezweryfikowane”
      items: items.map(i=> i.type==="custom"
        ? { type:"custom", color:i.color, cut:i.cut, size:i.size, holes:i.holes||[], notes:i.notes||"", measurements:i.measurements||"", qty:i.qty, unit_price:i.unitPrice, hole_price:i.holePrice }
        : { type:i.type, id:i.id, sku:i.sku||"", name:i.name, category:i.category||"", color:i.color, size:i.size, qty:i.qty, unit_price:i.unitPrice }),
      instagram: cleanIg(igName), notes: orderNotes.trim(), discount_code: Cart.code() || "", discount_amount: d, delivery } };
    let res, data = {};
    const ctl = new AbortController(), timer = setTimeout(()=>ctl.abort(), 30000);
    try{
      res = await fetch(ORDER_API_URL, { method:"POST", headers:{ "Content-Type":"application/json", "Accept":"application/json" }, body: JSON.stringify(payload), signal: ctl.signal });
      data = await res.json().catch(()=>({}));
    }catch(e){ return fail("Nie udało się połączyć z serwerem zamówień. Zamówienie NIE zostało wysłane — Twój koszyk został zachowany, spróbuj ponownie."); }
    finally{ clearTimeout(timer); }
    // sukces TYLKO gdy serwer wprost potwierdził wysyłkę (albo wyraźnie oznaczony test) i nadał numer
    const okReal = res.ok && data.ok === true && data.delivered === true && data.test !== true && typeof data.number === "string" && data.order;
    const okTest = res.ok && data.ok === true && data.test === true && data.delivered === false && typeof data.number === "string" && data.order;
    if(!okReal && !okTest) return fail((data && data.error ? data.error : "Nie udało się wysłać zamówienia.")+" Zamówienie NIE zostało wysłane — Twój koszyk został zachowany, możesz spróbować ponownie.");
    if(okReal && data.duplicate){ /* ta sama próba, już przyjęta — pokazujemy ten sam numer */ }
    const shown = data.order.items.map(l=>({ type:l.type, name:l.name, sku:l.product_id, color:l.color, size:l.size, cut:l.cut, holes:l.holes, holePrice:l.hole_price, notes:l.notes, measurements:l.measurements, qty:l.qty, unitPrice:l.unit }));
    Cart.clear(); attemptId = null; busy = false;
    showFinal(data, shown);
  }catch(e){ fail("Wystąpił błąd. Zamówienie NIE zostało wysłane — Twój koszyk został zachowany, spróbuj ponownie."); }
}

body.addEventListener("click", e=>{
  const act = e.target.dataset.act, line = e.target.closest(".cart-line");
  if(act && line){
    const key = line.dataset.key, it = Cart.items().find(i=>i.key===key);
    if(act==="remove"){ Cart.remove(key); showToast("Usunięto z koszyka"); }
    else if(act==="minus" || act==="plus"){ const r = Cart.setQty(key, it.qty + (act==="plus"?1:-1)); if(!r.ok && r.error) showToast(r.error,"err"); }
    return;
  }
  if(e.target.id==="codeRemove"){ Cart.setCode(""); return; }
  if(e.target.id==="sendBtn") return placeOrder();
  if(e.target.id==="clearBtn"){
    if(e.target.dataset.armed){ Cart.clear(); return; }
    e.target.dataset.armed = "1"; e.target.textContent = "Na pewno? Kliknij ponownie";
    setTimeout(()=>{ if(e.target.isConnected){ delete e.target.dataset.armed; e.target.textContent = "Wyczyść koszyk"; } }, 3500);
  }
});
body.addEventListener("change", e=>{
  if(e.target.dataset.act==="qty"){
    const key = e.target.closest(".cart-line").dataset.key;
    const r = Cart.setQty(key, Number(e.target.value));
    if(!r.ok && r.error){ showToast(r.error,"err"); if(r.qty) Cart.setQty(key, r.qty); else render(); }
  }
  if(e.target.name==="delivery"){ delivery = e.target.value; try{ localStorage.setItem("cart_delivery", delivery); }catch(_){} }
});
body.addEventListener("submit", async e=>{
  if(e.target.id!=="codeForm") return;
  e.preventDefault(); readFields();
  const v = document.getElementById("codeInput").value.trim();
  const msg = document.getElementById("codeMsg"), btn = document.getElementById("codeBtn");
  if(!v){ msg.className="code-msg err"; msg.textContent="Wpisz kod rabatowy."; return; }
  btn.disabled = true; btn.textContent = "Sprawdzam…";
  try{
    const r = await Store.validateDiscount(v, Cart.subtotal());
    if(r.valid){ Cart.setCode(v, true); discount = r; discountErr = ""; showToast("Kod rabatowy zastosowany ✓"); }
    else { discount = null; discountErr = r.error; }
  }catch(err){ discountErr = "Nie udało się sprawdzić kodu: "+err.message; }
  render(); document.getElementById("codeInput").value = v;
});

let first = true;
document.addEventListener("cartchange", ()=>{ attemptId = null; if(!first && !busy) rerender(); });   // zmiana koszyka = nowa próba
(async function init(){
  try{ orderStatus = await Store.orderStatus(); }catch(e){}
  try{ testUi = (await Store.anyTest()) || orderStatus.test_mode || Cart.items().some(i=>i.test); }catch(e){}
  try{ showNotes(await Cart.refresh()); }
  catch(e){ showNotes(["Nie udało się odświeżyć cen i stanów produktów: "+e.message]); }
  await rerender(); first = false;
})();
