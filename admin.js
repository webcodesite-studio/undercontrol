const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentCat = "kolor";
let rows = [];

async function checkSession(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session){ showPanel(); } else { showLogin(); }
}
function showLogin(){ document.getElementById("loginBox").style.display="block"; document.getElementById("panel").style.display="none"; }
function showPanel(){ document.getElementById("loginBox").style.display="none"; document.getElementById("panel").style.display="block"; loadRows(); }

document.getElementById("loginBtn").onclick = async ()=>{
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPass").value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ document.getElementById("loginErr").textContent = "Błędny mail lub hasło"; return; }
  showPanel();
};
document.getElementById("logoutBtn").onclick = async ()=>{ await sb.auth.signOut(); showLogin(); };

document.querySelectorAll(".tabs button").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll(".tabs button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); currentCat = b.dataset.cat; renderList();
  };
});

async function loadRows(){
  const { data, error } = await sb.from("options").select("*").order("category").order("sort_order",{ascending:true, nullsFirst:true});
  if(error){ alert("Błąd pobierania: "+error.message); return; }
  rows = data || [];
  renderList();
}

function renderList(){
  const list = document.getElementById("list"); list.innerHTML = "";
  rows.filter(r=>r.category===currentCat).forEach(r=>{
    const card = document.createElement("div"); card.className="card";
    const dot = document.createElement("div"); dot.className="dot";
    if(currentCat==="kolor") dot.style.background = r.hex || "#555";
    const meta = document.createElement("div"); meta.className="meta";
    const nameInput = document.createElement("input"); nameInput.value = r.name;
    nameInput.onchange = ()=> updateRow(r.id, { name: nameInput.value });
    const priceInput = document.createElement("input"); priceInput.className="price"; priceInput.type="number";
    priceInput.value = r.price_extra || 0; priceInput.placeholder="dopłata zł";
    priceInput.onchange = ()=> updateRow(r.id, { price_extra: Number(priceInput.value) });
    meta.append(nameInput, priceInput);
    const sw = document.createElement("div"); sw.className="switch"+(r.available?" on":"");
    sw.onclick = ()=>{ sw.classList.toggle("on"); updateRow(r.id, { available: sw.classList.contains("on") }); };
    card.append(dot, meta, sw);
    list.appendChild(card);
  });
}

async function updateRow(id, patch){
  const { error } = await sb.from("options").update(patch).eq("id", id);
  if(error) alert("Błąd zapisu: "+error.message);
  else loadRows();
}

document.getElementById("addBtn").onclick = async ()=>{
  const name = prompt("Nazwa opcji:");
  if(!name) return;
  const row = { category: currentCat, name, price_extra:0, available:true };
  if(currentCat==="kolor") row.hex = prompt("Kolor hex (np. #1a1a1a):", "#555555") || "#555555";
  const { error } = await sb.from("options").insert(row);
  if(error) alert("Błąd dodawania: "+error.message);
  else loadRows();
};

checkSession();
