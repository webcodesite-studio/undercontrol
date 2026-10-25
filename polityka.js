// bardzo prosty konwerter Markdown -> HTML (nagłówki, pogrubienie, listy, akapity)
function mdToHtml(md){
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = (md||"").split("\n");
  let html = "", inList = false;
  for(let raw of lines){
    let line = raw.trim();
    if(!line){ if(inList){ html+="</ul>"; inList=false; } continue; }
    line = esc(line).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    if(line.startsWith("### ")){ if(inList){html+="</ul>";inList=false;} html += `<h3>${line.slice(4)}</h3>`; }
    else if(line.startsWith("## ")){ if(inList){html+="</ul>";inList=false;} html += `<h2>${line.slice(3)}</h2>`; }
    else if(line.startsWith("# ")){ if(inList){html+="</ul>";inList=false;} html += `<h1>${line.slice(2)}</h1>`; }
    else if(line.startsWith("- ")){ if(!inList){html+="<ul>";inList=true;} html += `<li>${line.slice(2)}</li>`; }
    else { if(inList){html+="</ul>";inList=false;} html += `<p>${line}</p>`; }
  }
  if(inList) html += "</ul>";
  return html;
}
const FALLBACK_POLICY = "# Polityka prywatności\n\nDane podane w formularzu (nick na Instagramie, opcjonalnie e-mail) wykorzystujemy wyłącznie do kontaktu w sprawie zamówienia.\n\nNie udostępniamy ich podmiotom trzecim poza dostawcami usług niezbędnych do obsługi zamówienia.";
(async function(){
  let md = FALLBACK_POLICY;
  try{
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from("site_settings").select("policy_md").eq("id",1).single();
    if(error || !data?.policy_md) throw error || new Error("empty");
    md = data.policy_md;
  }catch(e){}
  document.getElementById("policyContent").innerHTML = mdToHtml(md);
})();
