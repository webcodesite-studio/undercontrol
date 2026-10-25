document.getElementById("igLinkPage").href = `https://ig.me/m/${window.SELLER_IG || IG_NICK}`;
document.addEventListener("siteSettingsReady", ()=>{
  document.getElementById("igLinkPage").href = `https://ig.me/m/${window.SELLER_IG}`;
});
(async function(){
  try{
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from("site_settings").select("contact_text").eq("id",1).single();
    if(error || !data?.contact_text) throw error || new Error("empty");
    document.getElementById("contactText").textContent = data.contact_text;
  }catch(e){ /* zostaje domyślny tekst */ }
})();
