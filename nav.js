(function mobileMenu(){
  const btn = document.getElementById("mobile-menu"), list = document.getElementById("nav-list");
  if(!btn || !list) return;
  btn.setAttribute("aria-controls","nav-list"); btn.setAttribute("aria-expanded","false");
  const set = open => {
    list.classList.toggle("open", open); btn.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open)); btn.setAttribute("aria-label", open ? "Zamknij menu" : "Otwórz menu");
  };
  btn.addEventListener("click", e=>{ e.stopPropagation(); set(!list.classList.contains("open")); });
  list.addEventListener("click", e=>{ if(e.target.closest("a")) set(false); });
  document.addEventListener("click", e=>{ if(!list.contains(e.target)) set(false); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") set(false); });
  window.addEventListener("resize", ()=>{ if(innerWidth > 700) set(false); });
})();

function applyTheme(s){
  const root = document.documentElement.style;
  const map = { "--bg":"theme_bg","--surface":"theme_surface","--text":"theme_text","--accent":"theme_accent","--muted":"theme_muted","--border":"theme_border" };
  Object.entries(map).forEach(([cssVar,key])=>{ if(s[key]) root.setProperty(cssVar, s[key]); });
}

function escHtml(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function buildFooter(shopName, sellerIg){
  shopName = escHtml(shopName); sellerIg = encodeURIComponent(String(sellerIg||"").replace(/^@/,""));
  const f = document.createElement("div"); f.className = "site-footer";
  f.innerHTML = `
    <div class="f-wrap">
      <div class="f-col"><div class="f-brand">${shopName}</div></div>
      <div class="f-col">
        <a href="index.html">Strona główna</a>
        <a href="czapki.html">Czapki</a>
        <a href="spodnie.html">Spodnie</a>
        <a href="customy.html">Customowe spodnie</a>
        <a href="koszyk.html">Koszyk</a>
        <a href="kontakt.html">Kontakt</a>
      </div>
      <div class="f-col">
        <a href="https://ig.me/m/${sellerIg}" target="_blank" rel="noopener">Instagram</a>
        <a href="polityka.html">Polityka prywatności</a>
      </div>
    </div>
    <div class="f-bottom">© ${new Date().getFullYear()} ${shopName}. Wszystkie prawa zastrzeżone.</div>`;
  document.body.appendChild(f);
}

window.SELLER_IG = typeof IG_NICK !== "undefined" ? IG_NICK : "twoj_nick";

(async function loadSiteSettings(){
  let settings = null;
  try{
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from("site_settings").select("*").eq("id",1).single();
    if(error || !data) throw error || new Error("empty");
    settings = data;
  }catch(e){ /* zostają wartości domyślne */ }

  const shopName = brandOf(settings);
  applyBrand(shopName);
  if(settings?.seller_ig) window.SELLER_IG = settings.seller_ig;
  if(settings) applyTheme(settings);
  buildFooter(shopName, window.SELLER_IG);
  document.dispatchEvent(new CustomEvent("siteSettingsReady", { detail: settings }));
})();
