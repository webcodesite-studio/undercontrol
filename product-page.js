// Strona produktu (czapka albo gotowe spodnie — data-kind na #productPage).
// Każdy kolor to osobny wariant: zdjęcia, rozmiary, stany, cena i opis pochodzą WYŁĄCZNIE z wybranego koloru.
const root = document.getElementById("productPage");
const KIND = root.dataset.kind;                          // "hats" | "pants"
const TYPE = KIND==="hats" ? "hat" : "pants";            // typ pozycji w koszyku
const BACK = KIND==="hats" ? "czapki.html" : "spodnie.html";
const svgFor = hex => KIND==="hats"
  ? `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M30 150 Q30 70 100 70 Q170 70 170 150 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/><path d="M30 150 L10 165 Q60 185 170 150 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/></svg>`
  : `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/></svg>`;
const SAFE_HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeHex = c => SAFE_HEX.test(c) ? c : "#555555";

(async function(){
  let h;
  try{
    const id = new URLSearchParams(location.search).get("id");
    h = id ? await Store.item(KIND, id) : null;
  }catch(e){ root.innerHTML = `<div class="state-box err">Nie udało się wczytać produktu: ${escHtml(e.message)}</div>`; return; }
  if(!h){ root.innerHTML = `<div class="state-box">Nie znaleziono tego produktu. <a href="${BACK}">Wróć do sklepu →</a></div>`; return; }
  document.title = h.name + " — " + (document.title.split(" — ")[1] || "");

  const variants = Store.shopVariants(h);
  let v = variants.find(x=>Store.variantStock(x)>0) || variants[0];   // wybrany kolor (domyślnie pierwszy dostępny)
  let size = null;                                                     // rozmiar klient wybiera zawsze sam (jedyny rozmiar jest wybierany automatycznie)

  root.innerHTML = (h.is_test ? '<div class="test-banner" role="note"><b>PRODUKT TESTOWY</b> — dane przykładowe do sprawdzania sklepu; zostaną usunięte przed startem.</div>' : "") + `
    <div class="gallery">
      <button class="gallery-arrow prev" id="galPrev" aria-label="Poprzednie zdjęcie">‹</button>
      <div class="gallery-track" id="galTrack"></div>
      <button class="gallery-arrow next" id="galNext" aria-label="Następne zdjęcie">›</button>
      <div class="gallery-dots" id="galDots"></div>
    </div>
    <div class="product-detail">
      <h1>${escHtml(h.name)}</h1>
      ${KIND==="pants" && h.category ? `<div class="pcat-line">Krój: ${escHtml(h.category)}</div>` : ""}
      <div class="pdprice" id="itemPrice"></div>
      <p class="pddesc" id="itemDesc"></p>
      <div class="pd-section-label">Kolor: <span id="pdColorName"></span></div>
      <div class="pd-colors" id="pdColors" role="radiogroup" aria-label="Kolor">${variants.map((x,i)=>`<button type="button" role="radio" aria-checked="false" aria-label="${escHtml(x.name)}" title="${escHtml(x.name)}${Store.variantStock(x)<1?" — wyprzedane":""}" class="pd-color${Store.variantStock(x)<1?" soldout":""}" style="background:${safeHex(x.hex)}" data-i="${i}"></button>`).join("")}</div>
      <div class="pd-order">
        <div class="pd-section-label">Rozmiar</div>
        <div class="pd-sizes" id="pdSizes" role="radiogroup" aria-label="Rozmiar"></div>
        <div id="sizeChart"></div>
        <div class="pd-section-label">Ilość</div>
        <div class="qty-row"><div class="qty"><button type="button" id="qMinus" aria-label="Mniej">−</button><input type="number" id="qInput" value="1" min="1" inputmode="numeric" aria-label="Ilość"><button type="button" id="qPlus" aria-label="Więcej">+</button></div>
          <span class="stock-note" id="stockNote"></span></div>
        <button class="btn btn-primary" style="width:100%;" id="addBtn">Dodaj do koszyka</button>
        <p class="form-msg" id="itemMsg" role="status" aria-live="polite"></p>
        <div class="added-actions" id="addedActions" hidden>
          <a class="btn btn-ghost" href="${BACK}">Kontynuuj zakupy</a>
          <a class="btn btn-primary" href="koszyk.html">Przejdź do koszyka</a>
        </div>
      </div>
      ${productIdHtml(h.sku)}
    </div>
    <div class="pp-extra" id="chartBox"></div>`;
  Store.sizeChartFor(KIND, h).then(c=>{ document.getElementById("chartBox").innerHTML = sizeChartHtml(c); highlightChartSize(size); }).catch(()=>{});

  const $ = id => document.getElementById(id);
  const track = $("galTrack"), dotsBox = $("galDots"), prev = $("galPrev"), next = $("galNext");
  const qInput = $("qInput"), msgEl = $("itemMsg");
  let dots = [];
  const msg = (t, kind) => { msgEl.textContent = t; msgEl.className = "form-msg"+(kind?" "+kind:""); };
  const maxQty = () => { const z = v.sizes.find(s=>s.size===size); return z ? Math.max(1, z.stock) : 1; };
  const clampQty = n => Math.max(1, Math.min(maxQty(), Math.floor(Number(n))||1));

  function showSlides(list){
    track.innerHTML = list.join(""); track.scrollTo({left:0});
    dotsBox.innerHTML = list.map((_,i)=>`<span class="gdot${i===0?" active":""}"></span>`).join("");
    dots = [...dotsBox.children];
    const multi = list.length>1; prev.style.display = next.style.display = dotsBox.style.display = multi ? "" : "none";
  }
  track.addEventListener("scroll", ()=> requestAnimationFrame(()=>{ const i = Math.round(track.scrollLeft/(track.clientWidth||1)); dots.forEach((d,k)=>d.classList.toggle("active",k===i)); }));
  prev.onclick = ()=> track.scrollBy({left:-track.clientWidth, behavior:"smooth"});
  next.onclick = ()=> track.scrollBy({left:track.clientWidth, behavior:"smooth"});

  // pokazuje dane TYLKO wybranego koloru
  function renderVariant(){
    $("pdColorName").textContent = v.name;
    document.querySelectorAll(".pd-color").forEach((b,i)=>{ const on = variants[i]===v; b.classList.toggle("active", on); b.setAttribute("aria-checked", on); });
    showSlides(v.images.length
      ? v.images.map(u=>`<div class="gallery-slide"><img src="${escHtml(u)}" alt="${escHtml(h.name+" – "+v.name)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"></div>`)
      : [`<div class="gallery-slide">${svgFor(safeHex(v.hex))}</div>`]);
    $("itemPrice").textContent = zl(Store.variantPrice(h, v));
    $("itemDesc").textContent = v.description || h.description || "";
    $("pdSizes").innerHTML = v.sizes.map(s=>`<button type="button" role="radio" aria-checked="false" class="size-btn wide${s.stock<1?" soldout":""}" data-size="${escHtml(s.size)}" ${s.stock<1?'disabled aria-disabled="true" title="Brak w tym kolorze"':""}>${escHtml(s.size)}</button>`).join("");
    // tabela wymiarów (jeśli podano) — tylko rozmiary wybranego koloru
    $("sizeChart").innerHTML = v.sizes.some(s=>s.note) ? `<table class="size-table"><tbody>${v.sizes.filter(s=>s.note).map(s=>`<tr><td>${escHtml(s.size)}</td><td>${escHtml(s.note)}</td></tr>`).join("")}</tbody></table>` : "";
    size = null; highlightChartSize(null);
    const avail = v.sizes.filter(s=>s.stock>0);
    if(avail.length===1 && v.sizes.length===1) selectSize(avail[0].size);   // jedyny rozmiar (np. uniwersalny) — wybierany automatycznie
    else updateStock();
    msg("", "");
  }
  function selectSize(sz){
    size = sz;
    document.querySelectorAll("#pdSizes .size-btn").forEach(b=>{ const on = b.dataset.size===sz; b.classList.toggle("selected", on); b.setAttribute("aria-checked", on); });
    highlightChartSize(sz);
    qInput.value = clampQty(qInput.value); updateStock();
  }
  function updateStock(){
    const note = $("stockNote"), add = $("addBtn"), total = Store.variantStock(v);
    qInput.max = maxQty();
    if(total<1){ note.textContent = `Kolor ${v.name}: wyprzedane`; note.className = "stock-note out"; add.disabled = true; add.textContent = "Niedostępne"; return; }
    add.disabled = false; add.textContent = "Dodaj do koszyka";
    if(!size){ note.textContent = "Wybierz rozmiar"; note.className = "stock-note"; return; }
    const z = v.sizes.find(s=>s.size===size);
    note.textContent = z.stock<=3 ? `Zostało tylko ${z.stock} szt.` : `Dostępne: ${z.stock} szt.`; note.className = "stock-note"+(z.stock<=3?" low":"");
  }

  $("pdColors").onclick = e=>{ const b = e.target.closest(".pd-color"); if(!b) return; v = variants[+b.dataset.i]; qInput.value = 1; renderVariant(); };
  $("pdSizes").onclick = e=>{ const b = e.target.closest(".size-btn"); if(!b || b.disabled) return; selectSize(b.dataset.size); msg("", ""); };
  $("qMinus").onclick = ()=>{ qInput.value = clampQty(qInput.value-1); };
  $("qPlus").onclick = ()=>{ qInput.value = clampQty(+qInput.value+1); };
  qInput.onchange = ()=>{ qInput.value = clampQty(qInput.value); };

  $("addBtn").onclick = ()=>{
    if(!size){ msg("Wybierz rozmiar.", "err"); $("pdSizes").scrollIntoView({block:"center",behavior:"smooth"}); return; }
    const z = v.sizes.find(s=>s.size===size);
    if(!z || z.stock<1){ msg("Ten rozmiar jest niedostępny w wybranym kolorze.", "err"); return; }
    const qty = clampQty(qInput.value);
    const r = Cart.add({ type:TYPE, id:h.id, sku:h.sku||null, test:!!h.is_test, name:h.name, category:h.category||null, color:v.name, colorHex:safeHex(v.hex), size,
      unitPrice:Store.variantPrice(h, v), image:v.images[0] || null, maxStock:z.stock }, qty);
    if(!r.ok){ msg(r.error, "err"); showToast(r.error, "err"); return; }
    msg(`Dodano do koszyka: ${h.name}, ${v.name}, rozmiar ${size} × ${qty}.`, "ok"); showToast("Dodano do koszyka ✓");
    $("addedActions").hidden = false;
  };
  renderVariant();
})();
