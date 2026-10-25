// Panel: czapki i gotowe spodnie (warianty kolorystyczne), kody rabatowe, karty strony głównej, kanały zamówień, pulpit.
// Panel nie przechowuje ani nie wyświetla zamówień ani danych klientów; adres Formspree i webhook Discorda są tylko w zmiennych środowiskowych serwera.
(function(){
  const lsGet = (k, d) => { try{ const v = JSON.parse(localStorage.getItem(k)); return v ?? d; }catch(e){ return d; } };
  const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const $ = id => document.getElementById(id);
  const migHint = e => /relation|schema cache|function|column/i.test(e.message) ? " — uruchom najnowszą migrację SQL w Supabase (README)." : "";
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const okImg = u => /^https:\/\//i.test(u||"") || /^http:\/\/localhost[:/]/i.test(u||"");   // tylko HTTPS (bez mixed content)
  const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/;

  window.adminShopTab = function(cat){
    if(cat==="czapki") loadCatalog("hats");
    else if(cat==="spodnie") loadCatalog("pants");
    else if(cat==="rabaty") loadDiscounts();
    else if(cat==="strona") loadHomeCards();
    else if(cat==="email" || cat==="discord" || cat==="wysylka") loadChannels();
    else if(cat==="szukaj") loadSearchData();
    else if(cat==="dashboard") loadDashboard();
    else if(cat==="obrazy") loadImages();
    else if(cat==="rozmiary") loadChartsPanel();
    else if(cat==="dekoder") { $("decCode").focus(); }
    else if(cat==="bezpieczenstwo") loadSecurity();
  };

  // ============ KATALOG: czapki i gotowe spodnie (każdy kolor = osobny wariant) ============
  const CFG = {
    hats:  { label:"czapkę",  labelPl:"czapki",  list:"hatsList",  msg:"hatsMsg",  add:"addHatBtn",   flag:"active",    cat:false, empty:"Brak czapek — dodaj pierwszą." },
    pants: { label:"spodnie", labelPl:"spodni",  list:"pantsList", msg:"pantsMsg", add:"addPantsBtn", flag:"available", cat:true,  empty:"Brak gotowych spodni — dodaj pierwsze." },
  };
  const data = { hats:[], pants:[] };
  const K = kind => Store.KINDS[kind];
  const live = (kind, it) => kind==="hats" ? it.active !== false : (it.available !== false && !it.archived);

  async function loadCatalog(kind){
    const C = CFG[kind];
    await loadCharts();
    if(localDevMode){ data[kind] = lsGet(K(kind).local, K(kind).sample).filter(x=>!x.archived).map(Store.norm); renderCatalog(kind); return; }
    const { data:rows, error } = await sb.from(K(kind).table).select("*").order("sort_order",{ascending:true,nullsFirst:true}).order("created_at",{ascending:false});
    if(error){ flash(C.msg,"Błąd: "+error.message+migHint(error),"err"); return; }
    data[kind] = (rows||[]).filter(x=>!x.archived).map(Store.norm); renderCatalog(kind);
  }
  async function saveItem(kind, row, id){
    const C = CFG[kind];
    if(localDevMode){
      const all = lsGet(K(kind).local, K(kind).sample);
      const next = id ? all.map(x=>x.id===id?{...x,...row}:x) : [{...row, id:kind[0]+Date.now(), created_at:new Date().toISOString()}, ...all];
      lsSet(K(kind).local, next); await loadCatalog(kind); return true;
    }
    const { error } = id ? await sb.from(K(kind).table).update(row).eq("id", id) : await sb.from(K(kind).table).insert(row);
    if(error){ flash(C.msg,"Błąd zapisu: "+error.message+migHint(error),"err"); return false; }
    await loadCatalog(kind); return true;
  }
  async function removeItem(kind, id){
    const C = CFG[kind];
    if(localDevMode){ lsSet(K(kind).local, lsGet(K(kind).local, K(kind).sample).filter(x=>x.id!==id)); await loadCatalog(kind); flash(C.msg,"Usunięto.","ok"); return; }
    const { error } = await sb.from(K(kind).table).delete().eq("id", id);
    if(error) flash(C.msg,"Błąd: "+error.message,"err"); else { flash(C.msg,"Usunięto.","ok"); loadCatalog(kind); }
  }
  function renderCatalog(kind){
    const C = CFG[kind], list = $(C.list); list.innerHTML = "";
    data[kind].forEach(h=>{
      const vs = h.variants, total = vs.reduce((s,v)=>s+Store.variantStock(v),0);
      const img = (vs.find(v=>v.images.length)||{images:[]}).images[0], on = live(kind, h);
      const card = document.createElement("div"); card.className = "card";
      card.innerHTML = img ? `<img src="${escapeAttr(img)}" alt="" style="width:46px;height:58px;object-fit:cover;border-radius:8px;flex:0 0 auto;">`
        : `<div class="dot" style="background:${escapeAttr(vs[0]?.hex||"#555")}"></div>`;
      const meta = document.createElement("div"); meta.className = "meta";
      meta.innerHTML = `<div style="font-size:15px;">${escapeTxt(h.name)} <code style="font-size:11px;">${escapeTxt(h.sku||"brak ID")}</code>${h.is_test?' <span class="chip" style="background:#b00020;color:#fff;border-color:#b00020;">TEST</span>':""}${kind==="pants"&&h.category?` <span style="font-size:11px;color:var(--muted);">· ${escapeTxt(h.category)}</span>`:""}</div>
        <div style="font-size:12px;color:${total<1?"#ff6b6b":"var(--muted)"};">od ${fmtPLN(h.price)} · razem ${total} szt.${total<1?" (brak na stanie)":""} · ${vs.length} kol.${on?"":" · ukryte"}</div>
        <div style="margin-top:4px;">${vs.map(v=>`<span class="mini-dot" title="${escapeAttr(v.name)}${v.active?"":" (ukryty)"}" style="background:${escapeAttr(v.hex)};${v.active?"":"opacity:.3;"}"></span>`).join("")}</div>`;
      const sw = document.createElement("div"); sw.className = "switch"+(on?" on":""); sw.title = "Widoczne w sklepie"; sw.setAttribute("role","switch"); sw.setAttribute("aria-checked", on); sw.tabIndex = 0;
      sw.onclick = ()=>{ saveItem(kind, {[C.flag]:!on}, h.id); };
      const edit = document.createElement("button"); edit.className = "edit-btn"; edit.textContent = "Edytuj"; edit.onclick = ()=> openItemModal(kind, h.id);
      card.append(meta, sw, edit); list.appendChild(card);
    });
    if(!data[kind].length) list.innerHTML = `<div class="empty">${C.empty}</div>`;
    const bar = $(kind==="hats"?"hatsTestBar":"pantsTestBar"), nTest = data[kind].filter(x=>x.is_test).length;
    bar.innerHTML = "";
    if(nTest){
      const d = document.createElement("div"); d.className = "test-tools"; d.innerHTML = `<b style="color:#ff6b6b;">TEST</b> — w tej sekcji jest ${nTest} produktów testowych (dane przykładowe).<br>`;
      d.appendChild(twoStepButton("Usuń produkty testowe","Na pewno usunąć wszystkie testowe?",()=>removeTest(kind))); bar.appendChild(d);
    }
  }
  async function removeTest(kind){
    const C = CFG[kind];
    if(localDevMode){ lsSet(K(kind).local, lsGet(K(kind).local, K(kind).sample).filter(x=>!x.is_test)); await loadCatalog(kind); flash(C.msg,"Usunięto produkty testowe.","ok"); return; }
    const { error } = await sb.from(K(kind).table).delete().eq("is_test", true);
    if(error) flash(C.msg,"Błąd: "+error.message+migHint(error),"err"); else { await loadCatalog(kind); flash(C.msg,"Usunięto produkty testowe.","ok"); }
  }
  function nextSku(kind){
    const p = kind==="hats" ? "H" : "P", re = new RegExp("^"+p+"(\\d+)$","i");
    const max = [...data.hats, ...data.pants].reduce((m,x)=>{ const k = re.exec(x.sku||""); return k ? Math.max(m, +k[1]) : m; }, 0);
    return p + String(max+1).padStart(3,"0");
  }
  const sizeRow = z => `<div class="color-row hsz-row">
      <input type="text" class="zSize" list="sizeSuggest" value="${escapeAttr(z.size)}" placeholder="Rozmiar" maxlength="20" aria-label="Rozmiar" style="width:90px;">
      <input type="number" class="zStock" min="0" step="1" value="${z.stock}" aria-label="Stan magazynowy" title="Stan magazynowy (szt.)" style="width:80px;">
      <input type="text" class="zNote sz-note" value="${escapeAttr(z.note||"")}" placeholder="Wymiary (opcjonalnie)" maxlength="120" aria-label="Wymiary">
      <button type="button" class="removeRow" aria-label="Usuń rozmiar">✕</button></div>`;
  function variantBlock(v){
    return `<div class="variant hvar">
      <div class="color-row">
        <input type="color" class="vColor" value="${escapeAttr(HEX.test(v.hex)?v.hex:"#555555")}" aria-label="Kolor">
        <input type="text" class="vName" value="${escapeAttr(v.name)}" placeholder="Nazwa koloru, np. Czarny" maxlength="40">
        <button type="button" class="removeVariant" aria-label="Usuń kolor">✕</button>
      </div>
      <label style="display:flex;align-items:center;gap:8px;margin:6px 0;"><input type="checkbox" class="vActive" ${v.active?"checked":""} style="width:auto;margin:0;"> Wariant aktywny (widoczny w sklepie)</label>
      <label>Osobna cena (zł) <span class="hint">puste = cena podstawowa</span></label><input type="number" class="vPrice" min="0" step="0.01" value="${v.price ?? ""}">
      <label>Opis tego koloru <span class="hint">(opcjonalnie)</span></label><textarea class="vDesc" rows="2" maxlength="500">${escapeTxt(v.description)}</textarea>
      <label>Zdjęcia tego koloru</label>
      <div class="vImgs">${v.images.map(imgRowHtml).join("")}</div>
      <button type="button" class="add-btn vAddImg" style="padding:8px;margin-top:0;">+ Dodaj zdjęcia</button>
      ${localDevMode?'<button type="button" class="add-btn vAddUrl" style="padding:6px;margin-top:4px;font-size:12px;">+ Dodaj zdjęcie z adresu URL (tryb testowy)</button>':""}
      <label>Rozmiary: nazwa · stan magazynowy · wymiary</label>
      <div class="vSizes">${v.sizes.map(sizeRow).join("")}</div>
      <button type="button" class="add-btn vAddSize" style="padding:8px;margin-top:0;">+ Dodaj rozmiar</button>
    </div>`;
  }
  function openItemModal(kind, id, copyOf){
    const C = CFG[kind], src = id ? data[kind].find(x=>x.id===id) : copyOf;
    const h = id ? src : null;
    const variants = src?.variants?.length ? src.variants : [];
    const cat = src?.category || "Baggy", cats = CUT_LIST.includes(cat) ? CUT_LIST : [cat, ...CUT_LIST];
    openModal(`
      <h3>${h?`Edytuj: ${escapeTxt(h.name)}`:`Nowe ${C.labelPl==="czapki"?"czapki":"spodnie"}`}</h3>
      <div id="mErr" class="form-err" role="alert" style="display:none;"></div>
      <label for="hName">Nazwa</label><input type="text" id="hName" maxlength="80" value="${escapeAttr(src?.name)}" placeholder="${kind==="hats"?"np. Dad Cap Classic":"np. Baggy Black"}">
      <label for="hSku">ID produktu <span class="hint">— klient poda je na Instagramie; unikalne, np. ${kind==="hats"?"H001":"P001"}</span></label>
      <input type="text" id="hSku" maxlength="20" value="${escapeAttr(src?.sku && !copyOf ? src.sku : nextSku(kind))}" autocapitalize="characters" style="text-transform:uppercase;">
      <label for="hChart">Tabela rozmiarów pod produktem</label>
      <select id="hChart"><option value="">Domyślna dla kategorii</option>${charts.map(c=>`<option value="${escapeAttr(c.id)}"${src?.size_chart_id===c.id?" selected":""}>${escapeTxt(c.name)}</option>`).join("")}</select>
      ${C.cat?`<label for="hCat">Krój / kategoria</label><select id="hCat">${cats.map(c=>`<option${c===cat?" selected":""}>${escapeTxt(c)}</option>`).join("")}</select>`:""}
      <label for="hDesc">Opis ogólny</label><textarea id="hDesc" rows="3" maxlength="1000">${escapeTxt(src?.description)}</textarea>
      <label for="hPrice">Cena podstawowa (zł)</label><input type="number" id="hPrice" min="0" step="0.01" value="${src?.price ?? ""}">
      <label>Kolory (warianty) <span class="hint">— każdy kolor ma własne zdjęcia, rozmiary, stany i opcjonalnie cenę</span></label>
      <div id="variantRows">${variants.map(variantBlock).join("")}</div>
      <button type="button" class="add-btn" id="addColor" style="padding:8px;">+ Dodaj kolor</button>
      <datalist id="sizeSuggest"><option>Uniwersalny</option><option>S/M</option><option>L/XL</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option></datalist>
      <label style="display:flex;align-items:center;gap:10px;margin-top:16px;"><input type="checkbox" id="hActive" ${(h ? live(kind,h) : false) || (!src)?"checked":""} style="width:auto;margin:0;"> Widoczne w sklepie</label>
      <label style="display:flex;align-items:center;gap:10px;margin-top:8px;"><input type="checkbox" id="hTest" ${src?.is_test?"checked":""} style="width:auto;margin:0;"> Produkt testowy <span class="hint">— oznaczony „TEST” w sklepie, do usunięcia przed startem</span></label>
      <input type="file" id="imgFileInput" accept="image/*" multiple style="display:none;">
      <div class="modal-actions">
        ${h?'<span id="itemDeleteSlot"></span><button class="btn btn-ghost" id="modalDuplicate">Duplikuj</button>':""}
        <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
        <button class="btn btn-primary" id="modalSave">Zapisz</button>
      </div>`);
    const box = $("modalBox");
    const showErr = m => { const e = $("mErr"); e.textContent = m; e.style.display = "block"; e.scrollIntoView({block:"nearest"}); };
    let target = null;
    box.onclick = e=>{
      const t = e.target, vb = t.closest(".hvar");
      if(t.classList.contains("removeRow")) t.closest(".color-row").remove();
      else if(t.classList.contains("removeVariant")) vb.remove();
      else if(t.classList.contains("vAddSize")) vb.querySelector(".vSizes").insertAdjacentHTML("beforeend", sizeRow({size:"",stock:0}));
      else if(t.classList.contains("vAddImg")){ target = vb.querySelector(".vImgs"); $("imgFileInput").click(); }
      else if(t.classList.contains("vAddUrl")){
        const url = prompt("Adres URL zdjęcia (https://...):");
        if(url && okImg(url.trim())) vb.querySelector(".vImgs").insertAdjacentHTML("beforeend", imgRowHtml(url.trim()));
        else if(url) showErr("Adres zdjęcia musi zaczynać się od https://");
      }
    };
    $("addColor").onclick = ()=> $("variantRows").insertAdjacentHTML("beforeend", variantBlock({name:"",hex:"#555555",images:[],active:true,price:null,description:null,sizes:[{size:kind==="hats"?"Uniwersalny":"M",stock:0}]}));
    $("imgFileInput").onchange = async e=>{
      const files = [...e.target.files]; e.target.value = ""; if(!files.length || !target) return;
      const dest = target;
      for(let i=0;i<files.length;i++){
        $("modalSave").disabled = true; $("modalSave").textContent = `Wgrywanie ${i+1}/${files.length}…`;
        const url = await uploadToR2(files[i], showErr);
        if(url) dest.insertAdjacentHTML("beforeend", imgRowHtml(url));
      }
      $("modalSave").disabled = false; $("modalSave").textContent = "Zapisz";
    };
    $("modalCancel").onclick = closeModal;
    if(h){
      $("itemDeleteSlot").replaceWith(twoStepButton("Usuń", "Na pewno usunąć?", ()=>{ closeModal(); removeItem(kind, h.id); }));
      $("modalDuplicate").onclick = ()=>{ closeModal(); openItemModal(kind, null, { ...h, name:h.name+" (kopia)" }); flash(C.msg,"Edytujesz kopię — zapisz, aby ją dodać.","ok"); };
    }
    $("modalSave").onclick = async ()=>{
      const name = $("hName").value.trim();
      if(!name) return showErr("Podaj nazwę.");
      const price = Number($("hPrice").value);
      if($("hPrice").value.trim()==="" || !Number.isFinite(price) || price < 0) return showErr("Cena podstawowa musi być liczbą nie mniejszą niż 0.");
      const sku = $("hSku").value.trim().toUpperCase();
      if(!SKU_RE.test(sku) || sku==="CUSTOM") return showErr("ID produktu: 2–20 znaków (litery, cyfry, „-”), np. "+(kind==="hats"?"H001":"P001")+".");
      if([...data.hats, ...data.pants].some(x=>x.sku && x.sku.toUpperCase()===sku && x.id!==h?.id)) return showErr(`ID „${sku}” jest już użyte przez inny produkt.`);
      const blocks = [...box.querySelectorAll(".hvar")];
      if(!blocks.length) return showErr("Dodaj co najmniej jeden kolor.");
      const vs = [];
      for(const el of blocks){
        const vn = el.querySelector(".vName").value.trim();
        if(!vn) return showErr("Każdy kolor musi mieć nazwę (np. Czarny).");
        const pr = el.querySelector(".vPrice").value.trim();
        if(pr!=="" && !(Number(pr) >= 0)) return showErr(`Kolor ${vn}: osobna cena musi być liczbą ≥ 0 (albo puste).`);
        const sizes = [...el.querySelectorAll(".hsz-row")].map(r=>({ size:r.querySelector(".zSize").value.trim(), stock:r.querySelector(".zStock").value.trim(), note:r.querySelector(".zNote").value.trim() }));
        if(!sizes.length) return showErr(`Kolor ${vn}: dodaj co najmniej jeden rozmiar.`);
        for(const z of sizes){
          if(!z.size) return showErr(`Kolor ${vn}: wpisz nazwę każdego rozmiaru.`);
          if(z.stock==="" || !Number.isInteger(Number(z.stock)) || Number(z.stock) < 0) return showErr(`Kolor ${vn}, rozmiar ${z.size}: stan musi być liczbą całkowitą ≥ 0.`);
        }
        if(new Set(sizes.map(z=>z.size.toLowerCase())).size !== sizes.length) return showErr(`Kolor ${vn}: rozmiary się powtarzają.`);
        vs.push({ name:vn, hex:el.querySelector(".vColor").value, active:el.querySelector(".vActive").checked,
          price: pr==="" ? null : Number(pr), description: el.querySelector(".vDesc").value.trim() || null,
          images:[...el.querySelectorAll(".vImgs img")].map(i=>i.getAttribute("src")),
          sizes:sizes.map(z=>({size:z.size, stock:Number(z.stock), note:z.note||null})) });
      }
      if(new Set(vs.map(v=>v.name.toLowerCase())).size !== vs.length) return showErr("Dwa kolory mają tę samą nazwę.");
      const on = $("hActive").checked;
      const row = { name, sku, is_test:$("hTest").checked, size_chart_id:$("hChart").value || null, description:$("hDesc").value.trim(), price, variants:vs, [C.flag]:on };
      if(kind==="pants"){
        row.category = $("hCat").value; row.archived = false;
        row.colors = vs.map(v=>v.hex); row.images = vs.flatMap(v=>v.images);   // zgodność ze starszymi wersjami strony
      }
      $("modalSave").disabled = true;
      if(await saveItem(kind, row, h?.id)){ closeModal(); flash(C.msg, h?"Zapisano zmiany.":"Dodano do sklepu.", "ok"); }
      else $("modalSave").disabled = false;
    };
  }
  $("addHatBtn").onclick = ()=> openItemModal("hats", null);
  $("addPantsBtn").onclick = ()=> openItemModal("pants", null);

  // ============ KODY RABATOWE ============
  let codes = [];
  async function loadDiscounts(){
    if(localDevMode){ codes = lsGet("localDiscountCodes", []); renderDiscounts(); return; }
    const { data, error } = await sb.from("discount_codes").select("*").order("created_at",{ascending:false});
    if(error){ flash("discountsMsg","Błąd: "+error.message+migHint(error),"err"); return; }
    codes = data || []; renderDiscounts();
  }
  async function saveCode(row, id){
    if(localDevMode){
      if(codes.some(c=>c.code===row.code && c.id!==id)) return "Kod o tej nazwie już istnieje.";
      if(id) codes = codes.map(c=>c.id===id?{...c,...row}:c); else codes = [{...row, id:"d"+Date.now(), used_count:0, created_at:new Date().toISOString()}, ...codes];
      lsSet("localDiscountCodes", codes); renderDiscounts(); return null;
    }
    const { error } = id ? await sb.from("discount_codes").update(row).eq("id", id) : await sb.from("discount_codes").insert(row);
    if(error) return /duplicate|unique/i.test(error.message) ? "Kod o tej nazwie już istnieje." : error.message+migHint(error);
    await loadDiscounts(); return null;
  }
  async function removeCode(id){
    if(localDevMode){ codes = codes.filter(c=>c.id!==id); lsSet("localDiscountCodes", codes); renderDiscounts(); return; }
    const { error } = await sb.from("discount_codes").delete().eq("id", id);
    if(error) flash("discountsMsg","Błąd: "+error.message,"err"); else { flash("discountsMsg","Usunięto kod.","ok"); loadDiscounts(); }
  }
  const todayWarsaw = () => new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Warsaw"});
  function renderDiscounts(){
    const list = $("discountsList"); list.innerHTML = "";
    codes.forEach(c=>{
      const expired = c.expires_at && c.expires_at < todayWarsaw();
      const exhausted = c.usage_limit != null && c.used_count >= c.usage_limit;
      const card = document.createElement("div"); card.className = "card";
      const meta = document.createElement("div"); meta.className = "meta";
      meta.innerHTML = `<div style="font-size:15px;font-weight:500;letter-spacing:.04em;">${escapeTxt(c.code)} <span style="color:var(--accent);">${c.type==="percent"?`−${Number(c.value)}%`:`−${fmtPLN(c.value)}`}</span></div>
        <div style="font-size:12px;color:var(--muted);">użycia: ${c.used_count}${c.usage_limit!=null?` / ${c.usage_limit}`:" (bez limitu)"} · min. zamówienie: ${fmtPLN(c.min_order)} · ${c.expires_at?"do "+c.expires_at:"bezterminowo"}${expired?' · <b style="color:#ff6b6b;">wygasł</b>':""}${exhausted?' · <b style="color:#ff6b6b;">wyczerpany</b>':""}</div>`;
      const sw = document.createElement("div"); sw.className = "switch"+(c.active?" on":""); sw.title = "Aktywny"; sw.setAttribute("role","switch"); sw.setAttribute("aria-checked", !!c.active);
      sw.onclick = async ()=>{ const err = await saveCode({active:!c.active}, c.id); if(err) flash("discountsMsg", err, "err"); };
      const edit = document.createElement("button"); edit.className = "edit-btn"; edit.textContent = "Edytuj"; edit.onclick = ()=> openCodeModal(c.id);
      card.append(meta, sw, edit); list.appendChild(card);
    });
    if(!codes.length) list.innerHTML = `<p style="color:var(--muted);font-size:13px;">Brak kodów rabatowych.</p>`;
  }
  function openCodeModal(id){
    const c = id ? codes.find(x=>x.id===id) : null;
    let type = c?.type || "percent";
    openModal(`
      <h3>${c?"Edytuj kod rabatowy":"Nowy kod rabatowy"}</h3>
      <div id="mErr" class="form-err" role="alert" style="display:none;"></div>
      <label for="dCode">Kod</label><input type="text" id="dCode" maxlength="40" value="${escapeAttr(c?.code)}" placeholder="np. LATO10" style="text-transform:uppercase;" autocapitalize="characters">
      <label>Rodzaj zniżki</label>
      <div class="seg" id="dType"><button type="button" data-t="percent" class="${type==="percent"?"active":""}">Procent (%)</button><button type="button" data-t="fixed" class="${type==="fixed"?"active":""}">Kwota (zł)</button></div>
      <label for="dValue" id="dValueLbl"></label><input type="number" id="dValue" min="0" step="0.01" value="${c?.value ?? ""}">
      <div class="two-col">
        <div><label for="dMin">Minimalna wartość zamówienia (zł)</label><input type="number" id="dMin" min="0" step="0.01" value="${c?.min_order ?? 0}"></div>
        <div><label for="dLimit">Limit użyć <span class="hint">(puste = bez limitu)</span></label><input type="number" id="dLimit" min="1" step="1" value="${c?.usage_limit ?? ""}"></div>
      </div>
      <label for="dExp">Data wygaśnięcia <span class="hint">(ostatni dzień ważności; puste = bezterminowo)</span></label><input type="date" id="dExp" value="${c?.expires_at ?? ""}">
      <label style="display:flex;align-items:center;gap:10px;margin-top:16px;"><input type="checkbox" id="dActive" ${(c?.active ?? true)?"checked":""} style="width:auto;margin:0;"> Aktywny</label>
      <div class="modal-actions">
        ${c?'<span id="dDeleteSlot"></span>':""}
        <button class="btn btn-ghost" id="modalCancel">Anuluj</button>
        <button class="btn btn-primary" id="modalSave">Zapisz</button>
      </div>`);
    const showErr = m => { const e = $("mErr"); e.textContent = m; e.style.display = "block"; e.scrollIntoView({block:"nearest"}); };
    const lbl = ()=>{ $("dValueLbl").textContent = type==="percent" ? "Wartość zniżki (%, 1–100)" : "Wartość zniżki (zł)"; };
    lbl();
    $("dType").onclick = e=>{ const t = e.target.dataset.t; if(!t) return; type = t; [...$("dType").children].forEach(b=>b.classList.toggle("active", b.dataset.t===t)); lbl(); };
    $("modalCancel").onclick = closeModal;
    if(c) $("dDeleteSlot").replaceWith(twoStepButton("Usuń", "Na pewno usunąć?", ()=>{ closeModal(); removeCode(c.id); }));
    $("modalSave").onclick = async ()=>{
      const code = $("dCode").value.trim().toUpperCase();
      if(code.length < 2 || !/^[A-Z0-9_-]+$/.test(code)) return showErr("Kod: min. 2 znaki, tylko litery A–Z, cyfry, „-” i „_”.");
      const value = Number($("dValue").value);
      if($("dValue").value.trim()==="" || !(value > 0)) return showErr("Wartość zniżki musi być większa od 0.");
      if(type==="percent" && value > 100) return showErr("Zniżka procentowa nie może przekraczać 100%.");
      const min = Number($("dMin").value || 0);
      if(!Number.isFinite(min) || min < 0) return showErr("Minimalna wartość zamówienia nie może być ujemna.");
      const limRaw = $("dLimit").value.trim(), lim = limRaw==="" ? null : Number(limRaw);
      if(lim !== null && (!Number.isInteger(lim) || lim < 1)) return showErr("Limit użyć musi być liczbą całkowitą ≥ 1 (albo puste).");
      const row = { code, type, value, min_order:min, usage_limit:lim, expires_at: $("dExp").value || null, active: $("dActive").checked };
      $("modalSave").disabled = true;
      const err = await saveCode(row, c?.id);
      if(err){ showErr(err); $("modalSave").disabled = false; } else { closeModal(); flash("discountsMsg", c?"Zapisano zmiany.":"Dodano kod.", "ok"); }
    };
  }
  $("addDiscountBtn").onclick = ()=> openCodeModal(null);

  // ============ STRONA GŁÓWNA: trzy karty ============
  let cardImgs = {};
  const CARD_LINKS = { hats:"czapki.html", pants:"spodnie.html", custom:"customy.html" };
  const CARD_NAMES = { hats:"Czapki", pants:"Spodnie (gotowe)", custom:"Customowe spodnie" };
  async function loadHomeCards(){
    let s; try{ s = await fetchSettings(); }catch(e){ s = null; }
    if(!s){ flash("homeMsg","Nie udało się wczytać ustawień.","err"); return; }
    const cards = Store.mergeCards(s.home_cards);
    cardImgs = Object.fromEntries(cards.map(c=>[c.key, c.image_url]));
    $("homeCardsForm").innerHTML = cards.map(c=>`<div class="card-edit" data-key="${c.key}">
      <div style="display:flex;align-items:center;gap:6px;"><h4 style="flex:1;margin:0;">${CARD_NAMES[c.key]}</h4><button type="button" class="edit-btn cUpOrd" aria-label="Przesuń kartę wyżej">▲</button><button type="button" class="edit-btn cDnOrd" aria-label="Przesuń kartę niżej">▼</button></div><div class="lnk">Prowadzi do: ${CARD_LINKS[c.key]} (stały link)</div>
      <label>Tytuł karty</label><input type="text" class="cTitle" maxlength="60" value="${escapeAttr(c.title)}">
      <label>Opis</label><textarea class="cDesc" rows="2" maxlength="200">${escapeTxt(c.description)}</textarea>
      <label>Napis na przycisku</label><input type="text" class="cBtn" maxlength="40" value="${escapeAttr(c.button_label)}">
      <label>Zdjęcie karty <span class="hint">(puste = domyślna grafika)</span></label>
      <div class="cImgPrev" style="margin:6px 0;">${c.image_url?`<img src="${escapeAttr(c.image_url)}" alt="" style="max-width:160px;max-height:100px;border-radius:8px;object-fit:cover;">`:""}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="edit-btn cUp">Wgraj zdjęcie</button>
        ${localDevMode?'<button type="button" class="edit-btn cUrl">Z adresu URL (tryb testowy)</button>':""}
        <button type="button" class="edit-btn cRm" style="color:#ff6b6b;${c.image_url?"":"display:none;"}">Usuń zdjęcie</button>
      </div></div>`).join("");
  }
  function paintCardImg(card){
    const key = card.dataset.key, url = cardImgs[key];
    card.querySelector(".cImgPrev").innerHTML = url ? `<img src="${escapeAttr(url)}" alt="" style="max-width:160px;max-height:100px;border-radius:8px;object-fit:cover;">` : "";
    card.querySelector(".cRm").style.display = url ? "" : "none";
  }
  $("homeCardsForm").addEventListener("click", async e=>{
    const card = e.target.closest(".card-edit"); if(!card) return;
    if(e.target.classList.contains("cUpOrd") && card.previousElementSibling) card.parentNode.insertBefore(card, card.previousElementSibling);
    else if(e.target.classList.contains("cDnOrd") && card.nextElementSibling) card.parentNode.insertBefore(card.nextElementSibling, card);
    else if(e.target.classList.contains("cUp")){ card._pick = true; $("cardImgFile").dataset.key = card.dataset.key; $("cardImgFile").click(); }
    else if(e.target.classList.contains("cUrl")){ const u = prompt("Adres URL zdjęcia (https://...):"); if(u && okImg(u.trim())){ cardImgs[card.dataset.key] = u.trim(); paintCardImg(card); } else if(u) flash("homeMsg","Adres musi zaczynać się od https://","err"); }
    else if(e.target.classList.contains("cRm")){ cardImgs[card.dataset.key] = ""; paintCardImg(card); }
  });
  $("cardImgFile").onchange = async e=>{
    const f = e.target.files[0], key = e.target.dataset.key; e.target.value = ""; if(!f) return;
    flash("homeMsg","Wgrywanie zdjęcia…","ok");
    const url = await uploadToR2(f, m=>flash("homeMsg", m, "err"));
    if(url){ cardImgs[key] = url; const card = document.querySelector(`.card-edit[data-key="${key}"]`); if(card) paintCardImg(card); flash("homeMsg","Zdjęcie wgrane — zapisz karty, aby zastosować.","ok"); }
  };
  $("homeSave").onclick = async ()=>{
    const cards = [...document.querySelectorAll(".card-edit")].map(c=>({ key:c.dataset.key, title:c.querySelector(".cTitle").value.trim(), description:c.querySelector(".cDesc").value.trim(),
      button_label:c.querySelector(".cBtn").value.trim(), image_url:cardImgs[c.dataset.key]||"" }));
    if(cards.some(c=>!c.title)){ flash("homeMsg","Każda karta musi mieć tytuł.","err"); return; }
    curSettingsMsg = "homeMsg";
    if(await saveSettingsPatch({ home_cards: cards })) flash("homeMsg","Zapisano karty strony głównej.","ok");
  };

  // ============ KANAŁY ZAMÓWIEŃ (e-mail / Discord) — tylko flagi; sekrety są w zmiennych środowiskowych serwera ============
  const apiOk = typeof ORDER_ADMIN_URL !== "undefined" && !!ORDER_ADMIN_URL;
  // panel → funkcja serverless /api/order-admin (status, test, dekoder); autoryzacja tokenem sesji Supabase admina
  async function orderApi(action, payload = {}){
    if(!apiOk) throw new Error("Adres funkcji zamówień (ORDER_ADMIN_URL w config.js) nie jest ustawiony.");
    if(localDevMode) throw new Error("W trybie testowym (bez Supabase) nie można połączyć się z funkcją zamówień.");
    const { data:{ session } } = await sb.auth.getSession();
    if(!session) throw new Error("Zaloguj się ponownie.");
    let res; try{ res = await fetch(ORDER_ADMIN_URL, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:"Bearer "+session.access_token }, body: JSON.stringify({ action, ...payload }) }); }
    catch(e){ throw new Error("Nie udało się połączyć z funkcją zamówień (/api/order-admin)."); }
    const j = await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(j.error || "HTTP "+res.status);
    return j;
  }
  // Metoda powiadamiania: tylko e-mail (Formspree) / tylko Discord / oba. Zapisywana jako dwie publiczne flagi (bez sekretów); domyślnie oba.
  const deliveryOf = s => { const e = !!s?.order_email_enabled, d = !!s?.order_discord_enabled; return (!s || (!e && !d) || (!("order_email_enabled" in s) && !("order_discord_enabled" in s))) ? "both" : e && d ? "both" : e ? "email" : "discord"; };
  const LABEL = { email:"tylko e-mail (Formspree)", discord:"tylko Discord", both:"e-mail (Formspree) i Discord" };
  const warnOnly = () => { $("discordOnlyWarn").style.display = document.querySelector('input[name="orderDelivery"]:checked')?.value==="discord" ? "block" : "none"; };
  document.querySelectorAll('input[name="orderDelivery"]').forEach(r=>r.addEventListener("change", warnOnly));
  async function loadChannels(){
    let s; try{ s = await fetchSettings(); }catch(e){ s = null; }
    const cur = deliveryOf(s);
    document.querySelectorAll('input[name="orderDelivery"]').forEach(r=>{ r.checked = r.value===cur; }); warnOnly();
    $("deliveryActiveText").innerHTML = `<b>Aktywna metoda:</b> ${LABEL[cur]}`;
    $("deliveryStatus").textContent = "";
    $("emailActive").textContent = (cur==="email"||cur==="both") ? "E-mail przez Formspree jest AKTYWNY (zmienisz to w „Wysyłka zamówień”)." : "E-mail jest wyłączony (włączysz go w „Wysyłka zamówień”).";
    $("discordActive").textContent = (cur==="discord"||cur==="both") ? "Discord jest AKTYWNY (zmienisz to w „Wysyłka zamówień”)." : "Discord jest wyłączony (włączysz go w „Wysyłka zamówień”).";
    ["email","discord"].forEach(ch=>{ $(ch+"Status").textContent = "Sprawdzanie konfiguracji serwera…"; });
    try{
      const st = await orderApi("status");
      ["email","discord"].forEach(ch=>{ $(ch+"Status").innerHTML = st.configured[ch]
        ? "✓ Zmienna środowiskowa tego kanału jest ustawiona na serwerze." : (ch==="email" ? "⚠ Brak zmiennej środowiskowej FORMSPREE_ENDPOINT w Vercel — zamówienia przez e-mail nie mogą być składane. Ustaw ją (instrukcja poniżej)." : "⚠ Brak zmiennej DISCORD_WEBHOOK_URL w Vercel — ten kanał nie zadziała. Ustaw ją (instrukcja poniżej)."); });
    }catch(e){ ["email","discord"].forEach(ch=>{ $(ch+"Status").textContent = "ℹ "+e.message; }); }
  }
  $("deliverySave").onclick = async ()=>{
    const v = document.querySelector('input[name="orderDelivery"]:checked')?.value;
    if(!v){ flash("deliveryMsg","Wybierz metodę powiadamiania.","err"); return; }
    curSettingsMsg = "deliveryMsg";
    if(await saveSettingsPatch({ order_email_enabled: v!=="discord", order_discord_enabled: v!=="email" })){
      flash("deliveryMsg",`Zapisano. Aktywna metoda: ${LABEL[v]}.`+(v==="discord"?" Uwaga: zamówienia NIE będą wysyłane e-mailem.":""),"ok"); loadChannels();
    }
  };
  document.querySelectorAll(".js-test-channel").forEach(b=>{
    b.onclick = async ()=>{
      const ch = b.dataset.channel, label = b.textContent; b.disabled = true; b.textContent = "Wysyłanie…";
      try{
        const r = await orderApi("test", { channel: ch });
        const res = r.results?.[ch];
        if(res==="test_mode") flash(b.dataset.msg,"TRYB TESTOWY (ORDER_TEST_MODE): nic nie zostało wysłane — to nie jest prawdziwe powiadomienie.","err");
        else if(res==="sent") flash(b.dataset.msg,"Wiadomość testowa wysłana — sprawdź "+(ch==="email"?"skrzynkę e-mail.":"kanał Discord."),"ok");
        else if(res==="not_configured") flash(b.dataset.msg,"Worker nie ma sekretów tego kanału — ustaw je i spróbuj ponownie.","err");
        else flash(b.dataset.msg,"Wysyłka nie powiodła się — sprawdź sekrety Workera (klucz API / webhook).","err");
      }catch(e){ flash(b.dataset.msg, e.message, "err"); }
      b.disabled = false; b.textContent = label;
    };
  });


  // ============ TABELE ROZMIARÓW ============
  let charts = [];
  async function loadCharts(){
    try{
      if(localDevMode){ charts = lsGet("localSizeCharts", Store.SAMPLE_CHARTS); return; }
      const { data:rows, error } = await sb.from("size_charts").select("*").order("created_at");
      charts = error ? [] : (rows||[]);
    }catch(e){ charts = []; }
  }
  async function loadChartsPanel(){ await loadCharts(); renderCharts(); }
  const SCOPE_LABEL = { hats:"domyślna: czapki", pants:"domyślna: gotowe spodnie", custom:"domyślna: customowe spodnie" };
  function renderCharts(){
    const list = $("chartsList"); list.innerHTML = "";
    charts.forEach(c=>{
      const card = document.createElement("div"); card.className = "card";
      const meta = document.createElement("div"); meta.className = "meta";
      meta.innerHTML = `<div style="font-size:15px;">${escapeTxt(c.name)}</div><div style="font-size:12px;color:var(--muted);">${(c.rows||[]).length} rozmiarów · ${(c.columns||[]).length} kolumn${c.default_for?` · <b style="color:var(--accent);">${SCOPE_LABEL[c.default_for]}</b>`:""}</div>`;
      const edit = document.createElement("button"); edit.className = "edit-btn"; edit.textContent = "Edytuj"; edit.onclick = ()=> openChartModal(c.id);
      card.append(meta, edit); list.appendChild(card);
    });
    if(!charts.length) list.innerHTML = '<div class="empty">Brak tabel rozmiarów — dodaj pierwszą (np. domyślną dla gotowych spodni).</div>';
  }
  async function writeChart(row, id){
    if(localDevMode){
      let all = lsGet("localSizeCharts", Store.SAMPLE_CHARTS);
      if(row.default_for) all = all.map(c=>c.id!==id && c.default_for===row.default_for ? {...c, default_for:null} : c);
      all = id ? all.map(c=>c.id===id?{...c,...row}:c) : [...all, {...row, id:"c"+Date.now()}];
      lsSet("localSizeCharts", all); await loadCharts(); renderCharts(); return null;
    }
    if(row.default_for){ const q = sb.from("size_charts").update({default_for:null}).eq("default_for", row.default_for); const r = id ? await q.neq("id", id) : await q; if(r.error) return r.error.message+migHint(r.error); }
    const { error } = id ? await sb.from("size_charts").update(row).eq("id", id) : await sb.from("size_charts").insert(row);
    if(error) return error.message+migHint(error);
    await loadCharts(); renderCharts(); return null;
  }
  async function deleteChart(id){
    if(localDevMode){ lsSet("localSizeCharts", lsGet("localSizeCharts", Store.SAMPLE_CHARTS).filter(c=>c.id!==id)); await loadCharts(); renderCharts(); flash("chartsMsg","Usunięto tabelę.","ok"); return; }
    const { error } = await sb.from("size_charts").delete().eq("id", id);
    if(error) flash("chartsMsg","Błąd: "+error.message,"err"); else { await loadCharts(); renderCharts(); flash("chartsMsg","Usunięto tabelę.","ok"); }
  }
  function openChartModal(id){
    const c = id ? charts.find(x=>x.id===id) : null;
    let cols = c ? [...c.columns] : ["Pas (cm)","Długość (cm)"];
    let rowsData = c ? c.rows.map(r=>({size:r.size, values:[...r.values]})) : [{size:"S",values:["",""]},{size:"M",values:["",""]}];
    openModal(`<h3>${c?"Edytuj tabelę rozmiarów":"Nowa tabela rozmiarów"}</h3>
      <div id="mErr" class="form-err" role="alert" style="display:none;"></div>
      <label for="cName">Nazwa tabeli</label><input type="text" id="cName" maxlength="80" value="${escapeAttr(c?.name)}" placeholder="np. Spodnie — standard">
      <label for="cDefault">Użyj jako domyślnej dla</label>
      <select id="cDefault"><option value="">— tylko produkty, którym ją przypiszę —</option><option value="hats">wszystkich czapek</option><option value="pants">wszystkich gotowych spodni</option><option value="custom">customowych spodni</option></select>
      <label>Kolumny i wiersze <span class="hint">— pierwsza kolumna to rozmiar</span></label>
      <div class="chart-grid" id="chartGrid"></div>
      <div style="display:flex;gap:8px;margin-top:8px;"><button type="button" class="add-btn" id="addCol" style="padding:8px;margin:0;">+ Kolumna</button><button type="button" class="add-btn" id="addRowBtn" style="padding:8px;margin:0;">+ Rozmiar</button></div>
      <label for="cNote">Notatka pod tabelą <span class="hint">(opcjonalnie, np. jak mierzyć)</span></label><textarea id="cNote" rows="2" maxlength="300">${escapeTxt(c?.note)}</textarea>
      <div class="modal-actions">${c?'<span id="chartDelSlot"></span>':""}<button class="btn btn-ghost" id="modalCancel">Anuluj</button><button class="btn btn-primary" id="modalSave">Zapisz</button></div>`);
    $("cDefault").value = c?.default_for || "";
    const grid = $("chartGrid");
    const collect = ()=>{ cols = [...grid.querySelectorAll(".cc")].map(i=>i.value); rowsData = [...grid.querySelectorAll(".cr")].map(r=>({ size:r.querySelector(".cs").value, values:[...r.querySelectorAll(".cv")].map(i=>i.value) })); };
    const paint = ()=>{
      const tpl = `grid-template-columns:90px repeat(${cols.length}, minmax(90px,1fr)) 36px`;
      grid.innerHTML = `<div style="display:grid;${tpl};gap:6px;"><span class="hint-line" style="margin:0;align-self:center;">Rozmiar</span>${cols.map((v,i)=>`<div style="display:flex;gap:2px;"><input type="text" class="cc" value="${escapeAttr(v)}" placeholder="Kolumna" maxlength="30" aria-label="Nazwa kolumny ${i+1}"><button type="button" class="removeRow" data-delcol="${i}" aria-label="Usuń kolumnę" style="padding:0 4px;">✕</button></div>`).join("")}<span></span></div>` +
        rowsData.map((r,ri)=>`<div class="cr" style="display:grid;${tpl};gap:6px;"><input type="text" class="cs" value="${escapeAttr(r.size)}" placeholder="Rozmiar" maxlength="20" aria-label="Rozmiar">${cols.map((_,i)=>`<input type="text" class="cv" value="${escapeAttr(r.values[i]??"")}" maxlength="30" aria-label="Wartość">`).join("")}<button type="button" class="removeRow" data-delrow="${ri}" aria-label="Usuń rozmiar">✕</button></div>`).join("");
    };
    paint();
    $("addCol").onclick = ()=>{ collect(); cols.push(""); rowsData.forEach(r=>r.values.push("")); paint(); };
    $("addRowBtn").onclick = ()=>{ collect(); rowsData.push({size:"",values:cols.map(()=>"")}); paint(); };
    grid.onclick = e=>{
      const dc = e.target.dataset.delcol, dr = e.target.dataset.delrow; collect();
      if(dc!==undefined){ cols.splice(+dc,1); rowsData.forEach(r=>r.values.splice(+dc,1)); paint(); }
      else if(dr!==undefined){ rowsData.splice(+dr,1); paint(); }
    };
    const showErr = m=>{ const e=$("mErr"); e.textContent=m; e.style.display="block"; e.scrollIntoView({block:"nearest"}); };
    $("modalCancel").onclick = closeModal;
    if(c) $("chartDelSlot").replaceWith(twoStepButton("Usuń","Na pewno usunąć?",()=>{ closeModal(); deleteChart(c.id); }));
    $("modalSave").onclick = async ()=>{
      collect();
      const name = $("cName").value.trim();
      if(!name) return showErr("Podaj nazwę tabeli.");
      if(!cols.length || cols.some(x=>!x.trim())) return showErr("Dodaj co najmniej jedną kolumnę i nazwij każdą.");
      if(!rowsData.length) return showErr("Dodaj co najmniej jeden rozmiar.");
      if(rowsData.some(r=>!r.size.trim())) return showErr("Każdy wiersz musi mieć nazwę rozmiaru.");
      if(new Set(rowsData.map(r=>r.size.trim().toLowerCase())).size !== rowsData.length) return showErr("Rozmiary się powtarzają.");
      const row = { name, columns:cols.map(x=>x.trim()), rows:rowsData.map(r=>({size:r.size.trim(), values:r.values.map(x=>x.trim())})), note:$("cNote").value.trim()||null, default_for:$("cDefault").value||null };
      $("modalSave").disabled = true;
      const err = await writeChart(row, c?.id);
      if(err){ showErr(err); $("modalSave").disabled = false; } else { closeModal(); flash("chartsMsg", c?"Zapisano tabelę.":"Dodano tabelę.","ok"); }
    };
  }
  $("addChartBtn").onclick = ()=> openChartModal(null);

  // ============ ZDJĘCIA PRODUKTÓW ============
  let imgTarget = null;
  async function loadImages(){ await Promise.all([loadCatalog("hats"), loadCatalog("pants")]); renderImages(); }
  function renderImages(){
    const box = $("imagesList"), open = new Set([...box.querySelectorAll("details[open]")].map(d=>d.dataset.kind+":"+d.dataset.id));
    box.innerHTML = ["hats","pants"].map(kind=>{
      const items = data[kind];
      return `<h3 class="pg-h">${kind==="hats"?"Czapki":"Gotowe spodnie"}</h3>` + (items.length ? items.map(it=>`<details class="img-prod" data-kind="${kind}" data-id="${escapeAttr(it.id)}" ${open.has(kind+":"+it.id)?"open":""}>
        <summary>${escapeTxt(it.name)} <code style="font-size:11px;">${escapeTxt(it.sku||"")}</code> <small>${it.variants.reduce((s,v)=>s+v.images.length,0)} zdjęć</small></summary>
        ${it.variants.map((v,vi)=>`<div class="img-var" data-v="${vi}"><h5><span class="mini-dot" style="background:${escapeAttr(v.hex)}"></span>${escapeTxt(v.name)}</h5>
          <div class="img-strip">${v.images.map((u,i)=>`<div class="img-tile" data-i="${i}"><img src="${escapeAttr(u)}" alt="" loading="lazy">
            <div class="ctl"><button type="button" data-act="left" aria-label="Przesuń w lewo" ${i===0?"disabled":""}>◀</button><button type="button" data-act="del" aria-label="Usuń zdjęcie" style="color:#ff6b6b;">✕</button><button type="button" data-act="right" aria-label="Przesuń w prawo" ${i===v.images.length-1?"disabled":""}>▶</button></div>${i===0?'<div class="main">główne</div>':""}</div>`).join("")}
            <div class="img-tile" style="background:none;border-style:dashed;display:flex;flex-direction:column;gap:4px;justify-content:center;min-height:96px;"><button type="button" class="edit-btn" data-act="up">+ Wgraj</button>${localDevMode?'<button type="button" class="edit-btn" data-act="url" style="font-size:11px;">+ URL</button>':""}</div></div></div>`).join("")}
      </details>`).join("") : '<div class="empty">Brak produktów.</div>');
    }).join("");
  }
  async function saveVariants(kind, id, variants){
    const ok = await saveItem(kind, { variants }, id);
    renderImages(); if(!ok) return;
    flash("imagesMsg","Zapisano zmiany zdjęć.","ok");
  }
  $("imagesList").addEventListener("click", async e=>{
    const act = e.target.dataset.act; if(!act) return;
    const d = e.target.closest("details"), vEl = e.target.closest(".img-var"); if(!d || !vEl) return;
    const kind = d.dataset.kind, it = data[kind].find(x=>x.id===d.dataset.id); if(!it) return;
    const vi = +vEl.dataset.v, variants = it.variants.map(v=>({...v, images:[...v.images]})), imgs = variants[vi].images;
    const ti = e.target.closest(".img-tile")?.dataset.i;
    if(act==="left" && +ti>0){ [imgs[ti-1], imgs[ti]] = [imgs[ti], imgs[ti-1]]; await saveVariants(kind, it.id, variants); }
    else if(act==="right" && +ti<imgs.length-1){ [imgs[+ti+1], imgs[ti]] = [imgs[ti], imgs[+ti+1]]; await saveVariants(kind, it.id, variants); }
    else if(act==="del"){ imgs.splice(+ti,1); await saveVariants(kind, it.id, variants); }
    else if(act==="up"){ imgTarget = { kind, id:it.id, vi }; $("imgPanelFile").click(); }
    else if(act==="url"){ const u = prompt("Adres URL zdjęcia (https://...):"); if(u && okImg(u.trim())){ imgs.push(u.trim()); await saveVariants(kind, it.id, variants); } else if(u) flash("imagesMsg","Adres zdjęcia musi zaczynać się od https://","err"); }
  });
  $("imgPanelFile").onchange = async e=>{
    const files = [...e.target.files]; e.target.value = ""; if(!files.length || !imgTarget) return;
    const { kind, id, vi } = imgTarget, it = data[kind].find(x=>x.id===id); if(!it) return;
    const variants = it.variants.map(v=>({...v, images:[...v.images]}));
    for(let i=0;i<files.length;i++){
      flash("imagesMsg",`Wgrywanie ${i+1}/${files.length}…`,"ok");
      const url = await uploadToR2(files[i], m=>flash("imagesMsg", m, "err"));
      if(url) variants[vi].images.push(url);
    }
    await saveVariants(kind, id, variants);
  };

  // ============ DEKODER ZAMÓWIEŃ (admin; dane odczytuje Worker — numer z KV albo zwalidowany Base64) ============
  const money = n => fmtPLN(n);
  const igUrl = ig => "https://www.instagram.com/"+encodeURIComponent(String(ig).replace(/^@/,""))+"/";
  const fmtWhen = iso => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("pl-PL",{dateStyle:"long",timeStyle:"short",timeZone:"Europe/Warsaw"}); };
  const KIND_LABEL = { hat:"Czapka", pants:"Gotowe spodnie", custom:"Spodnie CUSTOM" };
  function renderRecord(r){
    const box = $("decResult");
    if(!r.record){ box.innerHTML = '<div class="dec-card"><div class="inline-msg err" style="display:block;">Brak danych zamówienia w tym bloku.</div></div>'; return; }
    const o = r.record;
    const ver = r.source!=="base64" ? "" : r.verified===true ? '<span class="chip" style="color:#9be3a4;">✓ podpis zgodny — dane z naszego sklepu</span>'
      : r.verified===false ? '<span class="chip" style="color:#ff9a9a;">✗ podpis NIEZGODNY — dane mogły zostać zmienione, nie ufaj im</span>' : '<span class="chip">ℹ dane niepodpisane (brak ORDER_SIGNING_SECRET)</span>';
    const items = o.items.map((l,n)=>{
      const rows = [["Kategoria", l.category||"—"], ["ID produktu", l.product_id||"—"], ["Kolor", l.color], ["Rozmiar", l.size]];
      if(l.type==="custom"){
        rows.push(["Krój", l.cut], ["Dziury", l.holes?.length ? `${l.holes.length} szt. (${money(l.hole_price)} / szt.)` : "brak"]);
        (l.holes||[]).forEach((h,k)=>rows.push([`Dziura ${k+1}`, `${h.style} · x ${h.x}%, y ${h.y}%, rozmiar ${h.w}×${h.h}%`]));
        rows.push(["Materiał", "standardowy denim (brak wyboru)"], ["Grafiki / pliki", "brak (tylko rozmieszczenie dziur)"], ["Wymiary", l.measurements||"nie podano"], ["Uwagi do projektu", l.notes||"brak"]);
      }
      return `<div style="padding:10px 0;border-top:1px solid var(--border);"><div style="font-size:14px;"><b>${n+1}. ${escapeTxt(l.name)}</b> <span class="chip">${KIND_LABEL[l.type]}</span></div>
        ${rows.map(([k,v])=>`<div style="font-size:12px;color:var(--muted);">${escapeTxt(k)}: <span style="color:var(--text);">${escapeTxt(String(v))}</span></div>`).join("")}
        <div style="font-size:13px;margin-top:4px;">Ilość ${l.qty} × ${money(l.unit)} = <b>${money(l.line_total)}</b></div></div>`;
    }).join("");
    box.innerHTML = `<div class="dec-card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><h3 style="margin:0;flex:1;">${escapeTxt(o.number)}</h3><button class="edit-btn" id="decCopyNo">Kopiuj numer</button></div>
      <div style="margin:8px 0;font-size:14px;">Instagram klienta: <a href="${escapeAttr(igUrl(o.instagram))}" target="_blank" rel="noopener noreferrer"><b>@${escapeTxt(o.instagram)}</b></a></div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">złożone: ${escapeTxt(fmtWhen(o.created))} · status: <b style="color:var(--text);">Awaiting Instagram confirmation</b> · źródło: dane Base64 z e-maila</div>${ver}${o.price_check==="unverified"?'<div class="inline-msg err" style="display:block;margin-top:8px;">⚠ Ceny NIE były zweryfikowane przez serwer (katalog był niedostępny) — sprawdź je przed potwierdzeniem.</div>':""}${o.discount_check==="unverified"?'<div class="inline-msg err" style="display:block;margin-top:8px;">⚠ Kod rabatowy NIE został zweryfikowany przez serwer — sprawdź go przed uznaniem rabatu.</div>':""}
      <div class="cat-label" style="margin-top:10px;">Pozycje</div>${items}
      <div class="summary-list" style="margin-top:10px;">
        <div class="summary-row"><span>Suma produktów</span><b>${money(o.subtotal)}</b></div>
        <div class="summary-row"><span>Kod rabatowy</span><b>${o.discount_code?escapeTxt(o.discount_code):"—"}</b></div>
        <div class="summary-row"><span>Rabat</span><b>−${money(o.discount_amount)}</b></div>
        <div class="summary-row"><span>Razem</span><b style="color:var(--accent);">${money(o.total)}</b></div>
        <div class="summary-row"><span>Sposób odbioru</span><b>${o.delivery==="pickup"?"Odbiór osobisty":"Wysyłka"}</b></div>
        <div class="summary-row"><span>Uwagi klienta</span><b style="text-align:right;white-space:pre-line;">${o.notes?escapeTxt(o.notes):"—"}</b></div>
      </div>
      <p class="hint-line">Następny krok: napisz do @${escapeTxt(o.instagram)} na Instagramie, poproś o potwierdzenie zamówienia ${escapeTxt(o.number)} i ustal płatność.</p>
      </div>`;
    $("decCopyNo").onclick = async e=>{ try{ await navigator.clipboard.writeText(o.number); e.target.textContent = "Skopiowano ✓"; }catch(_){} };
  }
  async function decode(){
    $("decResult").innerHTML = ""; flash("decMsg","","ok");
    const input = $("decCode").value.trim();
    if(!input){ flash("decMsg","Wklej blok Base64 z e-maila z zamówieniem.","err"); return; }
    $("decBtn").disabled = true; $("decBtn").textContent = "Odczytywanie…";
    try{ renderRecord(await orderApi("decode", { input })); }
    catch(e){ flash("decMsg", e.message, "err"); }
    $("decBtn").disabled = false; $("decBtn").textContent = "Odczytaj zamówienie";
  }
  $("decBtn").onclick = decode;
  $("decCode").onkeydown = e=>{ if(e.key==="Enter" && !e.shiftKey && !/^[A-Za-z0-9+\/=\s]{60,}$/.test($("decCode").value)){ e.preventDefault(); decode(); } };

  // ============ WYSZUKIWARKA: produkty (czapki, gotowe spodnie, customy) + zamówienia ============
  let searchOptions = null;
  async function loadSearchData(){
    await Promise.all([loadCatalog("hats"), loadCatalog("pants")]);
    try{ searchOptions = localDevMode ? localOptions() : ((await sb.from("options").select("*")).data || []); }catch(e){ searchOptions = []; }
  }
  const norm = t => String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  const sv = id => $(id).value.trim();
  function productMatches(kind, it, f){
    if(f.cat && f.cat!==(kind==="hats"?"hat":"pants")) return null;
    const live = kind==="hats" ? it.active!==false : (it.available!==false && !it.archived);
    const total = it.variants.reduce((s,v)=>s+Store.variantStock(v),0);
    if(f.avail==="in" && !(live && total>0)) return null;
    if(f.avail==="out" && !(live && total<1)) return null;
    if(f.avail==="hidden" && live && it.variants.some(v=>v.active)) return null;
    const vs = it.variants.filter(v=>(!f.color || norm(v.name).includes(f.color)) && (!f.size || v.sizes.some(z=>norm(z.size)===f.size)));
    if(!vs.length) return null;
    const hay = norm([it.name, it.sku, it.category, it.description, kind==="hats"?"czapka czapki hat":"spodnie pants", ...it.variants.flatMap(v=>[v.name, ...v.sizes.map(z=>z.size)])].join(" "));
    if(f.tokens.some(t=>!hay.includes(t))) return null;
    return { vs, live, total };
  }
  function renderSearch(f){
    const out = [];
    const prods = [];
    for(const kind of ["hats","pants"]) for(const it of data[kind]){ const m = productMatches(kind, it, f); if(m) prods.push({ kind, it, ...m }); }
    // spodnie custom (opcje konfiguratora)
    let custom = null;
    if(!f.avail || f.avail==="in"){
      const cols = (searchOptions||[]).filter(o=>o.category==="kolor"), cuts = (searchOptions||[]).filter(o=>o.category==="kroj");
      const okCat = !f.cat || f.cat==="custom";
      const hay = norm(["custom spodnie customowe", "CUSTOM", ...cols.map(c=>c.name), ...cuts.map(c=>c.name)].join(" "));
      const colMatch = !f.color || cols.some(c=>norm(c.name).includes(f.color));
      if(okCat && colMatch && !f.size && f.tokens.every(t=>hay.includes(t))) custom = { cols: cols.filter(c=>!f.color || norm(c.name).includes(f.color)), cuts };
    }
    out.push(`<h3 class="pg-h">Produkty (${prods.length + (custom?1:0)})</h3>`);
    if(!prods.length && !custom) out.push('<div class="empty">Brak produktów spełniających kryteria.</div>');
    prods.forEach(p=>out.push(`<div class="card search-card" style="flex-wrap:wrap;"><div class="meta" style="min-width:200px;">
      <div style="font-size:15px;">${escapeTxt(p.it.name)} <code style="font-size:11px;">${escapeTxt(p.it.sku||"brak ID")}</code> <span class="chip">${p.kind==="hats"?"Czapka":"Gotowe spodnie"}${p.it.category?" · "+escapeTxt(p.it.category):""}</span>${p.it.is_test?' <span class="chip" style="background:#b00020;color:#fff;">TEST</span>':""}</div>
      <div style="font-size:12px;color:${p.total<1?"#ff6b6b":"var(--muted)"};margin-top:4px;">${fmtPLN(p.it.price)} · ${!p.live?"ukryte · ":""}razem ${p.total} szt.</div>
      <div style="margin-top:6px;">${p.vs.map(v=>`<span class="chip"><span class="mini-dot" style="background:${escapeAttr(v.hex)}"></span>${escapeTxt(v.name)}: ${v.sizes.map(z=>`${escapeTxt(z.size)}×${z.stock}`).join(", ")}</span>`).join("")}</div></div>
      <button class="edit-btn" data-open="${p.kind}:${escapeAttr(p.it.id)}">Edytuj</button></div>`));
    if(custom) out.push(`<div class="card search-card" style="flex-wrap:wrap;"><div class="meta" style="min-width:200px;"><div style="font-size:15px;">Spodnie CUSTOM <code style="font-size:11px;">CUSTOM</code> <span class="chip">Customowe spodnie</span></div>
      <div style="margin-top:6px;">${custom.cols.map(c=>`<span class="chip" style="${c.available?"":"opacity:.45;"}"><span class="mini-dot" style="background:${escapeAttr(c.hex||"#555")}"></span>${escapeTxt(c.name)}${c.available?"":" (niedostępny)"}</span>`).join("")}</div>
      <div style="margin-top:4px;font-size:12px;color:var(--muted);">Kroje: ${custom.cuts.map(c=>escapeTxt(c.name)).join(", ")||"—"}</div></div><button class="edit-btn" data-open="custom">Otwórz ustawienia</button></div>`);
    out.push('<p class="hint-line">Zamówień tu nie szukamy — nie są nigdzie zapisywane. Znajdziesz je w skrzynce e-mail po numerze zamówienia lub @nicku (są w temacie wiadomości).</p>');
    $("searchResults").innerHTML = out.join("");
  }
  async function runSearch(e){
    e?.preventDefault(); flash("searchMsg","","ok");
    if(!data.hats.length && !data.pants.length) await loadSearchData();
    const q = sv("sQ");
    const f = { tokens: norm(q.replace(/^@/,"")).split(/\s+/).filter(Boolean), cat:sv("sCat"), avail:sv("sAvail"), color:norm(sv("sColor")), size:norm(sv("sSize")) };
    renderSearch(f);
  }
  $("searchForm").onsubmit = runSearch;
  $("sReset").onclick = ()=>{ ["sQ","sColor","sSize"].forEach(i=>$(i).value=""); $("sCat").value=""; $("sAvail").value=""; $("searchResults").innerHTML = ""; };
  $("searchResults").addEventListener("click", async e=>{
    const o = e.target.dataset.open;
    if(o==="custom") go("customy");
    else if(o){ const [kind,id] = o.split(":"); go(kind==="hats"?"czapki":"spodnie"); await loadCatalog(kind); openItemModal(kind, id); }
  });

  // ============ BEZPIECZEŃSTWO ============
  async function loadSecurity(){
    const box = $("secChecks"); box.innerHTML = '<div class="empty">Sprawdzanie…</div>';
    const items = [], chk = (cls, title, detail)=> items.push(`<div class="check ${cls}"><span class="ico">${cls==="ok"?"✓":cls==="warn"?"!":"–"}</span><div>${title}${detail?`<small>${detail}</small>`:""}</div></div>`);
    if(localDevMode) chk("warn","Tryb testowy (admin/admin) — tylko lokalnie","Na opublikowanej stronie logowanie wymaga prawdziwego konta Supabase. Skonfiguruj Supabase w config.js.");
    else{ let email = ""; try{ email = (await sb.auth.getUser()).data.user?.email || ""; }catch(e){} chk("ok","Zalogowano kontem Supabase", escapeTxt(email)); }
    const https = location.protocol==="https:" || ["localhost","127.0.0.1"].includes(location.hostname);
    chk(https?"ok":"warn", https?"Połączenie szyfrowane (HTTPS)":"Strona nie jest otwarta przez HTTPS","Na produkcji włącz HTTPS i tryb „Full (strict)” w Cloudflare.");
    if(!apiOk) chk("off","Funkcja zamówień nie jest dostępna","Ustaw ORDER_API_URL w config.js. Bez niego zamówienia nie są weryfikowane po stronie serwera (koszyk kieruje na Instagram).");
    else if(localDevMode) chk("off","Stan Workera zamówień niedostępny w trybie testowym","");
    else{
      try{
        const { configured:c } = await orderApi("status");
        chk(c.catalog?"ok":"warn","Serwer weryfikuje ceny i dostępność", c.catalog?"Ceny, rabaty i stany są odczytywane z katalogu w Supabase (tylko odczyt) — przeglądarka nie może ich zmienić. Gdy katalog jest niedostępny, zamówienie i tak dociera e-mailem z adnotacją „ceny niezweryfikowane”.":"Brak SUPABASE_URL / SUPABASE_ANON_KEY w zmiennych serwera — zamówienia przyjdą e-mailem z adnotacją „ceny niezweryfikowane”.");
        chk(c.discount_limits?"ok":"warn","Limity użyć kodów rabatowych "+(c.discount_limits?"są liczone":"nie są liczone"), c.discount_limits?"Klucz service_role jest tylko w zmiennych środowiskowych serwera.":"Ustaw zmienną SUPABASE_SERVICE_KEY w Vercel, aby limity użyć działały.");
        chk(c.test_mode?"warn":(c.email?"ok":"warn"),c.test_mode?"TRYB TESTOWY (ORDER_TEST_MODE) jest WŁĄCZONY — zamówienia NIE są wysyłane":"E-mail przez Formspree (główny zapis zamówień): "+(c.email?"FORMSPREE_ENDPOINT ustawiony na serwerze":"BRAK FORMSPREE_ENDPOINT — zamówienia nie mogą być składane"),"Zamówienia nie są zapisywane nigdzie poza tym e-mailem.");
        chk(c.signing?"ok":"off","Podpis danych Base64 "+(c.signing?"włączony":"wyłączony"), c.signing?"Dekoder wykryje zmodyfikowane dane.":"Opcjonalnie ustaw zmienną ORDER_SIGNING_SECRET w Vercel.");
        chk(c.discord?"ok":"off","Discord: "+(c.discord?"zmienna DISCORD_WEBHOOK_URL ustawiona na serwerze":"brak webhooka"),"");
      }catch(e){ chk("warn","Nie udało się sprawdzić Workera", escapeTxt(e.message)); }
    }
    chk("ok","Wgrywane pliki: tylko JPEG, PNG, GIF, WebP (do 5 MB)","Typ sprawdzany po zawartości pliku, nazwy są losowe, SVG i HTML są odrzucane.");
    chk("ok","Minimum danych osobowych","Jedyna dana kontaktowa to nazwa użytkownika Instagram podana przez klienta; zamówienie istnieje tylko w e-mailu (nie w bazie).");
    box.innerHTML = items.join("");
  }
  $("pwBtn").onclick = async ()=>{
    const a = $("pwNew").value, b = $("pwNew2").value;
    if(localDevMode){ flash("pwMsg","W trybie testowym nie ma prawdziwego konta.","err"); return; }
    if(a.length < 10){ flash("pwMsg","Hasło musi mieć co najmniej 10 znaków.","err"); return; }
    if(a !== b){ flash("pwMsg","Hasła nie są takie same.","err"); return; }
    const { error } = await sb.auth.updateUser({ password:a });
    if(error) flash("pwMsg","Nie udało się zmienić hasła. Zaloguj się ponownie i spróbuj jeszcze raz.","err");
    else { $("pwNew").value = $("pwNew2").value = ""; flash("pwMsg","Hasło zostało zmienione.","ok"); }
  };
  $("signOutAll").onclick = async ()=>{
    if(localDevMode){ flash("signoutMsg","W trybie testowym nie ma sesji Supabase.","err"); return; }
    await sb.auth.signOut({ scope:"global" }); location.reload();
  };

  // ============ PULPIT ============
  async function loadDashboard(){
    const cards = $("dashCards"), checks = $("dashChecks");
    cards.innerHTML = ""; checks.innerHTML = '<div class="empty">Wczytywanie…</div>';
    await Promise.all([loadCatalog("hats"), loadCatalog("pants")]);
    if(!localDevMode && !codes.length) await loadDiscountsSilently();
    let s = null; try{ s = await fetchSettings(); }catch(e){}
    let colors = "—";
    try{ if(localDevMode) colors = localOptions().filter(o=>o.category==="kolor").length; else { const r = await sb.from("options").select("id",{count:"exact",head:true}).eq("category","kolor"); colors = r.count ?? "—"; } }catch(e){}
    const count = (kind) => data[kind].filter(x=>live(kind,x)).length;
    const codesActive = (localDevMode ? lsGet("localDiscountCodes", []) : codes).filter(c=>c.active).length;
    const tile = (n, label, cat) => `<button class="dash-card" data-go="${cat}"><b>${n}</b><span>${label}</span></button>`;
    cards.innerHTML = tile(count("hats"),"czapki w sklepie","czapki") + tile(count("pants"),"gotowe spodnie w sklepie","spodnie") + tile(colors,"kolory Customów","customy") + tile(codesActive,"aktywne kody rabatowe","rabaty");
    cards.querySelectorAll("[data-go]").forEach(b=>b.onclick = ()=> go(b.dataset.go));
    const items = [];
    const chk = (cls, title, detail, cat) => items.push(`<div class="check ${cls}"><span class="ico">${cls==="ok"?"✓":cls==="warn"?"!":"–"}</span><div>${title}${detail?`<small>${detail}</small>`:""}</div>${cat?`<button class="edit-btn" data-go="${cat}">Otwórz</button>`:""}</div>`);
    if(localDevMode) chk("warn","Tryb testowy bez Supabase","Dane są zapisywane tylko w tej przeglądarce i nie są widoczne dla klientów. Skonfiguruj Supabase w config.js.");
    const ig = (s?.seller_ig||"").trim();
    ig && ig!=="twoj_nick" ? chk("ok","Profil Instagram ustawiony", "instagram.com/"+escapeTxt(ig), "instagram") : chk("warn","Profil Instagram nie jest ustawiony","Klienci kontaktują się ze sklepem przez Instagram — ustaw nick.","instagram");
        const dm = deliveryOf(s);
    chk(apiOk?(dm==="discord"?"warn":"ok"):"warn","Powiadomienia o zamówieniach: "+LABEL[dm], apiOk?(dm==="discord"?"Tryb „tylko Discord” — zamówienia NIE trafiają e-mailem. Zalecany: e-mail (Formspree) jako główny zapis. Nic nie jest zapisywane w bazie ani wysyłane na Instagram.":"Nic nie jest zapisywane w bazie ani wysyłane na Instagram."):"Funkcja zamówień (api/submit-order) nie jest dostępna.","wysylka");
    const nTest = data.hats.filter(x=>x.is_test).length + data.pants.filter(x=>x.is_test).length;
    if(nTest) chk("warn",`Produkty testowe w sklepie (${nTest})`,"Oznaczone „TEST”. Usuń je przed startem sklepu (Czapki / Gotowe spodnie → „Usuń produkty testowe”).","czapki");
    if(!apiOk) chk("off","Funkcja zamówień nie jest dostępna","Ustaw ORDER_API_URL w config.js, jeśli chcesz wysyłać zamówienia ze strony. Bez tego koszyk kieruje klientów na Instagram.");
    ["hats","pants"].forEach(kind=>{
      const empty = data[kind].filter(x=>live(kind,x) && x.variants.every(v=>Store.variantStock(v)<1));
      if(empty.length) chk("warn", `${kind==="hats"?"Czapki":"Spodnie"} bez stanu magazynowego (${empty.length})`, empty.map(x=>escapeTxt(x.name)).join(", ")+" — klienci widzą „wyprzedane”.", kind==="hats"?"czapki":"spodnie");
    });
    checks.innerHTML = items.join("") || '<div class="empty">Wszystko wygląda dobrze.</div>';
    checks.querySelectorAll("[data-go]").forEach(b=>b.onclick = ()=> go(b.dataset.go));
  }
  async function loadDiscountsSilently(){ try{ const { data:d } = await sb.from("discount_codes").select("*"); codes = d||[]; }catch(e){} }

  // sesja przywrócona zanim ten skrypt się wczytał — dociągnij dane bieżącej sekcji
  if($("panel").style.display==="flex") window.adminShopTab(currentCat);
})();
