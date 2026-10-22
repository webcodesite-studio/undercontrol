const FALLBACK_PRODUCTS_P = [
  {id:"fb1", category:"Baggy", name:"Baggy Black", price:249, colors:["#1a1a1a","#4a4a4f"], available:true,
   description:"Luźny krój, dostępny w 2 kolorach, przetarcia na kolanach.",
   size_chart:"S: pas 72cm, długość 102cm\nM: pas 78cm, długość 104cm\nL: pas 84cm, długość 106cm\nXL: pas 90cm, długość 108cm"},
  {id:"fb2", category:"Baggy", name:"Baggy Khaki", price:249, colors:["#8a7a52"], available:true,
   description:"Luźny krój w kolorze khaki.", size_chart:"S: pas 72cm, długość 102cm\nM: pas 78cm, długość 104cm\nL: pas 84cm, długość 106cm"},
  {id:"fb3", category:"Straight", name:"Straight Graphite", price:229, colors:["#4a4a4f"], available:true,
   description:"Prosty krój, grafit, bez przetarć.", size_chart:"S: pas 74cm, długość 100cm\nM: pas 80cm, długość 102cm\nL: pas 86cm, długość 104cm"},
  {id:"fb4", category:"Slim", name:"Slim Écru", price:259, colors:["#cfc6ae"], available:false,
   description:"Dopasowany krój w jasnym kolorze.", size_chart:"S: pas 70cm, długość 98cm\nM: pas 76cm, długość 100cm"},
];
const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = c => SAFE_COLOR.test(c) ? c : "#555555";
function escAttr(s){ return escTxt(String(s)).replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function escTxt(s){ const d=document.createElement("div"); d.textContent=s||""; return d.innerHTML; }
function pantsSvg(hex){
  return `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/>
  </svg>`;
}

async function loadProduct(){
  const id = new URLSearchParams(location.search).get("id");
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let p = null;
  try{
    if(!id) throw new Error("brak id");
    const { data, error } = await sb.from("products").select("*").eq("id", id).single();
    if(error || !data) throw error || new Error("not found");
    p = data;
  }catch(e){
    p = FALLBACK_PRODUCTS_P.find(x=>x.id===id) || FALLBACK_PRODUCTS_P[0];
  }
  render(p);
}

function render(p){
  // warianty: każdy kolor ma własne zdjęcia; produkty bez `variants` używają starych pól colors + images
  const variants = (Array.isArray(p.variants) && p.variants.length)
    ? p.variants.map(v=>({ name:v.name||"", color:safeColor(v.color), images:Array.isArray(v.images)?v.images:[] }))
    : (p.colors && p.colors.length ? p.colors : ["#555555"]).map((c,i)=>({ name:"", color:safeColor(c), images: i===0 ? (p.images||[]) : [] }));
  const legacyImages = !(Array.isArray(p.variants) && p.variants.length) && p.images && p.images.length;
  const colors = variants.map(v=>v.color);
  const slidesFor = v => legacyImages
    ? (p.images||[]).map(url=>`<div class="gallery-slide"><img src="${escAttr(url)}" alt="${escAttr(p.name)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"></div>`)
    : (v.images.length
        ? v.images.map(url=>`<div class="gallery-slide"><img src="${escAttr(url)}" alt="${escAttr(p.name+(v.name?" – "+v.name:""))}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;"></div>`)
        : [`<div class="gallery-slide">${pantsSvg(v.color)}</div>`]);
  const slides = slidesFor(variants[0]);
  const sizeRows = (p.size_chart||"").split("\n").filter(Boolean).map(line=>{
    const [size, ...rest] = line.split(":");
    return `<tr><td>${escTxt(size.trim())}</td><td>${escTxt(rest.join(":").trim())}</td></tr>`;
  }).join("");
  const sizeNames = (p.size_chart||"").split("\n").filter(Boolean).map(l=>l.split(":")[0].trim());

  document.getElementById("productPage").innerHTML = `
    <div class="gallery">
      <button class="gallery-arrow prev" id="galPrev">‹</button>
      <div class="gallery-track" id="galTrack">${slides.join("")}</div>
      <button class="gallery-arrow next" id="galNext">›</button>
      <div class="gallery-dots" id="galDots"></div>
    </div>
    <div class="product-detail">
      <h1>${escTxt(p.name)}</h1>
      <div class="pdprice">${p.price} zł</div>
      <p class="pddesc">${escTxt(p.description||"")}</p>

      ${variants.length>1?`<div class="pd-section-label">Kolor: <span id="pdColorName">${escTxt(variants[0].name)}</span></div>
      <div class="pd-colors" id="pdColors" role="radiogroup" aria-label="Kolor">${variants.map((v,i)=>`<button type="button" role="radio" aria-checked="${i===0}" aria-label="${escAttr(v.name||v.color)}" title="${escAttr(v.name||v.color)}" class="pd-color${i===0?" active":""}" style="background:${v.color}" data-i="${i}"></button>`).join("")}</div>`:""}

      ${sizeRows?`<div class="pd-section-label">Wymiary</div>
      <table class="size-table"><tbody>${sizeRows}</tbody></table>`:""}

      <div class="pd-order">
        <div class="pd-section-label">Zamów</div>
        <div class="pd-sizes" id="pdSizes">${sizeNames.map(s=>`<button type="button" class="size-btn" data-size="${escTxt(s)}">${escTxt(s)}</button>`).join("")}</div>
        <input type="text" id="pdIg" placeholder="Twój nick na IG (@nick)">
        <input class="hp" type="text" id="pdHp" tabindex="-1" autocomplete="off">
        <button class="btn btn-primary" style="width:100%;" id="pdOrderBtn">Wyślij zamówienie</button>
        <p id="pdMsg" style="font-size:12px;color:var(--muted);margin-top:8px;"></p>
      </div>
    </div>`;

  // galeria — pokazuje tylko zdjęcia aktualnie wybranego koloru
  const track = document.getElementById("galTrack");
  const dotsBox = document.getElementById("galDots");
  const prevBtn = document.getElementById("galPrev"), nextBtn = document.getElementById("galNext");
  let dots = [];
  function setActiveDot(){
    const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
    dots.forEach((d,idx)=> d.classList.toggle("active", idx===i));
  }
  function showSlides(list){
    track.innerHTML = list.join("");
    track.scrollTo({left:0});
    dotsBox.innerHTML = list.map((_,i)=>`<span class="gdot${i===0?" active":""}"></span>`).join("");
    dots = [...dotsBox.querySelectorAll(".gdot")];
    const multi = list.length > 1;
    prevBtn.style.display = nextBtn.style.display = multi ? "" : "none";
    dotsBox.style.display = multi ? "" : "none";
  }
  track.addEventListener("scroll", ()=> requestAnimationFrame(setActiveDot));
  prevBtn.onclick = ()=> track.scrollBy({left:-track.clientWidth, behavior:"smooth"});
  nextBtn.onclick = ()=> track.scrollBy({left:track.clientWidth, behavior:"smooth"});
  showSlides(slides);

  // kolory
  let selectedColor = variants[0].name || colors[0];
  document.querySelectorAll("#pdColors .pd-color").forEach(el=>{
    el.onclick = ()=>{
      document.querySelectorAll("#pdColors .pd-color").forEach(x=>{ x.classList.remove("active"); x.setAttribute("aria-checked","false"); });
      el.classList.add("active"); el.setAttribute("aria-checked","true");
      const v = variants[+el.dataset.i];
      selectedColor = v.name || v.color;
      document.getElementById("pdColorName").textContent = v.name;
      if(!legacyImages) showSlides(slidesFor(v));
      else track.scrollTo({left:0, behavior:"smooth"});
    };
  });

  // rozmiary
  let selectedSize = null;
  document.querySelectorAll("#pdSizes .size-btn").forEach(b=>{
    b.onclick = ()=>{ document.querySelectorAll("#pdSizes .size-btn").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); selectedSize=b.dataset.size; };
  });

  // zamówienie
  function validIG(nick){ return /^@?[a-zA-Z0-9](?:[a-zA-Z0-9._]{0,28}[a-zA-Z0-9])?$/.test(nick); }

  document.getElementById("pdOrderBtn").onclick = async ()=>{
    if(document.getElementById("pdHp").value) return;
    const ig = document.getElementById("pdIg").value.trim();
    const msg = document.getElementById("pdMsg");
    if(!ig || !validIG(ig)){ msg.textContent="Podaj poprawny nick na Instagramie"; msg.style.color="#ff6b6b"; return; }
    if(sizeNames.length && !selectedSize){ msg.textContent="Wybierz rozmiar"; msg.style.color="#ff6b6b"; return; }
    const payload = { produkt:p.name, kolor:selectedColor, rozmiar:selectedSize||"-", cena:p.price+" zł", instagram:ig };
    document.getElementById("pdOrderBtn").disabled = true;
    document.getElementById("pdOrderBtn").textContent = "Wysyłanie...";
    try{
      const res = await fetch(FORMSPREE_ENDPOINT, { method:"POST", headers:{ "Content-Type":"application/json","Accept":"application/json" }, body: JSON.stringify(payload) });
      if(!res.ok) throw new Error("HTTP "+res.status);
    }catch(e){
      console.error(e);
      document.getElementById("pdOrderBtn").disabled = false;
      document.getElementById("pdOrderBtn").textContent = "Wyślij zamówienie";
      msg.style.color = "#ff6b6b"; msg.textContent = "Nie udało się wysłać. Spróbuj ponownie lub napisz do nas na IG.";
      return;
    }
    document.getElementById("pdOrderBtn").textContent = "Wysłano ✓";
    msg.style.color = "var(--muted)"; msg.textContent = "Dzięki, odezwiemy się na IG.";
  };
}

loadProduct();
