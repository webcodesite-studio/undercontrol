// Katalog (czapki albo gotowe spodnie — zależnie od data-kind na .shop-wrap)
const wrap = document.querySelector("[data-kind]");
const KIND = wrap.dataset.kind;                       // "hats" | "pants"
const DETAIL = KIND==="hats" ? "czapka.html" : "spodnie-produkt.html";
const NOUN = KIND==="hats" ? "czapek" : "spodni";
const thumbSvg = hex => KIND==="hats"
  ? `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M30 150 Q30 70 100 70 Q170 70 170 150 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/><path d="M30 150 L10 165 Q60 185 170 150 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/></svg>`
  : `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/></svg>`;
const SAFE_HEX = /^#[0-9a-fA-F]{3,8}$/;
const safeHex = c => SAFE_HEX.test(c) ? c : "#555555";

(async function(){
  const status = document.getElementById("catStatus"), grid = document.getElementById("catGrid");
  try{
    const list = await Store.items(KIND);
    if(!list.length){ status.textContent = `Aktualnie nie mamy ${NOUN} w ofercie. Zajrzyj wkrótce!`; return; }
    status.remove();
    list.forEach(h=>{
      const vs = Store.shopVariants(h), out = Store.itemStock(h) < 1;
      const prices = vs.map(v=>Store.variantPrice(h,v)), min = Math.min(...prices), max = Math.max(...prices);
      const card = document.createElement("a");
      card.className = "product-card"+(out?" unavailable":"");
      card.href = DETAIL+"?id="+encodeURIComponent(h.id);
      const img = (vs.find(v=>v.images.length) || {images:[]}).images[0] || null;
      const dots = vs.length>1 ? `<div class="card-dots">${vs.map(v=>`<span style="background:${safeHex(v.hex)}" title="${escHtml(v.name)}"></span>`).join("")}</div>` : "";
      card.innerHTML = `<div class="product-thumb">${img ? `<img src="${escHtml(img)}" alt="${escHtml(h.name)}" loading="lazy" decoding="async">` : thumbSvg(safeHex(vs[0].hex))}${out?'<span class="soon-badge">wyprzedane</span>':""}${h.is_test?'<span class="soon-badge test" title="Produkt testowy">TEST</span>':""}</div>
        <div class="product-info"><div class="pname">${escHtml(h.name)}</div>${KIND==="pants"&&h.category?`<div class="pcat">${escHtml(h.category)}</div>`:""}<div class="pprice">${min!==max?"od ":""}${zl(min)}</div>${dots}</div>`;
      grid.appendChild(card);
    });
  }catch(e){
    status.className = "state-box err"; status.textContent = `Nie udało się wczytać ${NOUN}: ` + e.message;
  }
})();
