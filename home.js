// Strona główna: blok kontaktu (baner jest globalny — nav.js)
const HOME_FALLBACK_CONTACT = "Napisz do nas na Instagramie.";
(async function(){
  const block = document.getElementById("contactBlock");
  let contact = HOME_FALLBACK_CONTACT;
  try{
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await sb.from("site_settings").select("contact_text").eq("id",1).single();
    if(data?.contact_text) contact = data.contact_text;
  }catch(e){ /* Supabase niedostępny / nieskonfigurowany — zostają wartości domyślne */ }
  block.textContent = contact;
})();

// Trzy karty: Czapki / Spodnie / Customowe spodnie (teksty i zdjęcia zarządzane w panelu: „Strona główna i nawigacja”)
const CARD_ART = {
  hats: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><path d="M30 100 Q30 30 100 30 Q170 30 170 100 Z" fill="currentColor" stroke="#2c2c30" stroke-width="2"/><path d="M30 100 L8 116 Q60 136 170 100 Z" fill="currentColor" stroke="#2c2c30" stroke-width="2"/></svg>',
  pants: '<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="currentColor" stroke="#2c2c30" stroke-width="2"/></svg>',
  custom: '<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg"><path d="M60 20 L140 20 L148 240 L112 240 L104 120 L96 120 L88 240 L52 240 Z" fill="currentColor" stroke="#2c2c30" stroke-width="2"/><ellipse cx="82" cy="130" rx="9" ry="14" fill="#111113" stroke="var(--accent)" stroke-width="2"/><ellipse cx="124" cy="170" rx="8" ry="12" fill="#111113" stroke="var(--accent)" stroke-width="2"/></svg>',
};
(async function(){
  const grid = document.getElementById("choiceGrid");
  const cards = await Store.homeCards();
  grid.innerHTML = cards.map(c=>`<a class="choice-card" href="${c.href}" data-card="${c.key}">
      <div class="choice-art" aria-hidden="true">${c.image_url ? `<img src="${escHtml(c.image_url)}" alt="" loading="lazy">` : CARD_ART[c.key]}</div>
      <h2>${escHtml(c.title)}</h2><p>${escHtml(c.description)}</p><span class="choice-cta">${escHtml(c.button_label)}</span></a>`).join("");
})();
