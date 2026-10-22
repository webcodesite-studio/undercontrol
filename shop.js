const FALLBACK_PRODUCTS = [
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
const FALLBACK_CONTACT = "Napisz do nas na Instagramie.";
const FALLBACK_OFFER = "Wysyłka gratis przy zamówieniu do niedzieli!";

function pantsThumb(hex){
  return `<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">
    <path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="${hex}" stroke="#2c2c30" stroke-width="2"/>
  </svg>`;
}

const SAFE_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const safeColor = c => SAFE_COLOR.test(c) ? c : "#555555";
function escapeAttr(s){ return escapeTxt(String(s)).replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function escapeTxt(s){ const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }

async function loadShop(){
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let products = FALLBACK_PRODUCTS;
  try{
    const { data, error } = await sb.from("products").select("*").order("category").order("sort_order",{ascending:true,nullsFirst:true});
    if(error || !data || !data.length) throw error || new Error("empty");
    products = data.filter(p=>!p.archived);
  }catch(e){ console.warn("Supabase niedostępny, pokazuję przykładowe produkty", e); }

  const byCat = {};
  products.forEach(p=>{ (byCat[p.category] ||= []).push(p); });
  const wrap = document.getElementById("shopWrap"); wrap.innerHTML = "";
  Object.keys(byCat).forEach(cat=>{
    wrap.appendChild(Object.assign(document.createElement("div"), {className:"shop-cat", textContent:cat}));
    const grid = document.createElement("div"); grid.className="shop-grid";
    byCat[cat].forEach(p=>{
      const card = document.createElement(p.available ? "a" : "div");
      card.className = "product-card"+(p.available?"":" unavailable");
      if(p.available) card.href = "produkt.html?id="+encodeURIComponent(p.id);
      const variants = Array.isArray(p.variants) && p.variants.length ? p.variants : null;
      const colors = (variants ? variants.map(v=>v.color) : (p.colors && p.colors.length ? p.colors : ["#555555"])).map(safeColor);
      const firstImage = variants ? (variants.find(v=>v.images && v.images.length)?.images[0]) : (p.images && p.images[0]);
      const dots = colors.length>1 ? `<div style="display:flex;gap:4px;margin-top:6px;">${colors.map(c=>`<span style="width:10px;height:10px;border-radius:50%;background:${c};border:1px solid var(--border);display:inline-block;"></span>`).join("")}</div>` : "";
      const thumb = firstImage ? `<img src="${escapeAttr(firstImage)}" alt="${escapeAttr(p.name)}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;">` : pantsThumb(colors[0]);
      card.innerHTML = `<div class="product-thumb">${thumb}${p.available?"":'<span class="soon-badge">wkrótce</span>'}</div>
        <div class="product-info"><div class="pname">${escapeTxt(p.name)}</div><div class="pprice">${p.price} zł</div>${dots}</div>`;
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
  });

  // baner: aktywna kampania (po dacie) ma pierwszeństwo, inaczej domyślna oferta z site_settings
  let bannerText = null;
  try{
    const { data } = await sb.from("campaigns").select("*");
    const today = new Date().toISOString().slice(0,10);
    const active = (data||[]).find(c => c.start_date <= today && today <= c.end_date);
    if(active) bannerText = active.banner_text;
  }catch(e){}
  if(!bannerText){
    try{
      const { data } = await sb.from("site_settings").select("offer_enabled,offer_text,contact_text").eq("id",1).single();
      if(data?.offer_enabled && data.offer_text) bannerText = data.offer_text;
      document.getElementById("contactBlock").textContent = data?.contact_text || FALLBACK_CONTACT;
    }catch(e){ document.getElementById("contactBlock").textContent = FALLBACK_CONTACT; }
  } else {
    document.getElementById("contactBlock").textContent = FALLBACK_CONTACT;
  }
  if(bannerText){
    document.getElementById("offerText").textContent = bannerText;
    document.getElementById("offerBar").style.display = "flex";
  }
}
loadShop();
