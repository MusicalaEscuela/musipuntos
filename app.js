/* ===============================
   app.js — Musipuntos · Musicala
   =============================== */

const STORAGE_KEY = "musipuntos_data_v3"; // bump por emoji
const DEFAULT_CATS  = ["Concentración","Creatividad","Colaboración","Respeto","Expresión"];
const AVATAR_THEMES = [1,2,3,4,5,6,7,8];
const AVATAR_EMOJIS = ["🎸","🎹","🥁","🎤","🎻","🎼","🎧","🎨","⭐","👏","🔥","😊","🤩","🦄","🌟","💫","🦊","🐯","🐼","🦉","🎮","🧠","💡","🧩","⚽","🏀","🏆","🎯","📚","✏️","📝","🧪","🧬","🛰️","🌈","🌿"];

// Estado
let data = JSON.parse(localStorage.getItem(STORAGE_KEY));
if (!data) {
  // Intentar migrar de versiones previas
  const v2 = JSON.parse(localStorage.getItem("musipuntos_data_v2") || "null");
  const v1 = JSON.parse(localStorage.getItem("musipuntos_data_v1") || "null");
  data = v2 || v1 || { grupos: {} };
}
let grupoActual = null;

/* DOM */
const groupSelect     = document.getElementById("groupSelect");
const btnNewGroup     = document.getElementById("btnNewGroup");
const btnRenameGroup  = document.getElementById("btnRenameGroup");
const btnDeleteGroup  = document.getElementById("btnDeleteGroup");
const btnAddStudent   = document.getElementById("btnAddStudent");
const studentsGrid    = document.getElementById("studentsGrid");
const tplStudentCard  = document.getElementById("tplStudentCard");
const sortSelect      = document.getElementById("sortSelect");
const statStudents    = document.getElementById("statStudents");
const statGroupPoints = document.getElementById("statGroupPoints");
const groupHistory    = document.getElementById("groupHistory");
const quickCategory   = document.getElementById("quickCategory");
const btnGroupPlusOne = document.getElementById("btnGroupPlusOne");
const btnExport       = document.getElementById("btnExport");
const fileImport      = document.getElementById("fileImport");

/* Diálogos texto y edición */
const dlgPrompt       = document.getElementById("dlgPrompt");
const dlgInput        = document.getElementById("dlgInput");
const dlgTitle        = document.getElementById("dlgTitle");
const dlgOk           = document.getElementById("dlgOk");

const dlgEditStudent  = document.getElementById("dlgEditStudent");
const editNameInput   = document.getElementById("editName");
const editOkBtn       = document.getElementById("editOk");
const editPreview     = document.getElementById("editPreview");
const avatarGrid      = document.getElementById("avatarGrid");
const emojiGrid       = document.getElementById("emojiGrid");
const emojiInput      = document.getElementById("emojiInput");
const btnSetEmoji     = document.getElementById("btnSetEmoji");
const btnClearEmoji   = document.getElementById("btnClearEmoji");
const avatarUpload    = document.getElementById("avatarUpload");
const btnClearAvatar  = document.getElementById("btnClearAvatar");

/* Diálogo historial estudiante */
const dlgStudentHistory  = document.getElementById("dlgStudentHistory");
const histTitle          = document.getElementById("histTitle");
const histList           = document.getElementById("histList");
const btnExportHistTxt   = document.getElementById("btnExportHistTxt");
const btnExportHistJson  = document.getElementById("btnExportHistJson");
const btnClearHist       = document.getElementById("btnClearHist");

/* Categorías */
const catsList    = document.getElementById("catsList");
const catInput    = document.getElementById("catInput");
const btnAddCat   = document.getElementById("btnAddCat");
const btnResetCats= document.getElementById("btnResetCats");

/* Persistencia & utils */
function guardar(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

/* Categorías por grupo */
function getCats(){
  const g = data.grupos[grupoActual];
  if(!g.categorias || !Array.isArray(g.categorias) || !g.categorias.length) g.categorias = [...DEFAULT_CATS];
  return g.categorias;
}
function setCats(cats){
  const g = data.grupos[grupoActual];
  g.categorias = [...new Set(cats.map(c=>c.trim()).filter(Boolean))];
  guardar(); renderCatsPanel(); actualizarUI();
}
function addCat(name){ setCats([...getCats(), name]); }
function removeCat(name){ setCats(getCats().filter(c=>c!==name)); }
function resetCats(){ setCats([...DEFAULT_CATS]); }
function renderCatsPanel(){
  if(!grupoActual){ catsList.innerHTML = `<span class="hint">Crea o selecciona un grupo.</span>`; quickCategory.innerHTML=""; return; }
  const cats = getCats();
  catsList.innerHTML = "";
  cats.forEach(cat=>{
    const wrap = document.createElement("div");
    wrap.className = "chip";
    wrap.style.display="inline-flex"; wrap.style.alignItems="center"; wrap.style.gap=".4rem"; wrap.style.userSelect="none";
    wrap.textContent = cat + " ";
    const x = document.createElement("button");
    x.className = "btn ghost"; x.style.padding=".1rem .4rem"; x.title="Eliminar"; x.textContent = "×";
    x.onclick = ()=>removeCat(cat);
    wrap.appendChild(x); catsList.appendChild(wrap);
  });
  quickCategory.innerHTML = "";
  cats.forEach(c=>{ const opt=document.createElement("option"); opt.value=c; opt.textContent=c; quickCategory.appendChild(opt); });
}

/* UI principal */
function actualizarUI(){
  if(!grupoActual || !data.grupos[grupoActual]){
    studentsGrid.innerHTML = `<p class="empty">Selecciona o crea un grupo</p>`;
    statStudents.textContent = 0; statGroupPoints.textContent = 0; groupHistory.innerHTML = ""; renderCatsPanel(); return;
  }
  const grupo = data.grupos[grupoActual];
  if(!grupo.categorias) grupo.categorias = [...DEFAULT_CATS];

  const estudiantes = Object.values(grupo.estudiantes || {});
  statStudents.textContent = estudiantes.length;
  statGroupPoints.textContent = estudiantes.reduce((a,b)=>a+(b.puntos||0),0);

  studentsGrid.innerHTML = "";
  let ordenados = [...estudiantes];
  switch (sortSelect.value) {
    case "az": ordenados.sort((a,b)=>a.nombre.localeCompare(b.nombre)); break;
    case "za": ordenados.sort((a,b)=>b.nombre.localeCompare(a.nombre)); break;
    case "points-desc": ordenados.sort((a,b)=>(b.puntos||0)-(a.puntos||0)); break;
    case "points-asc": ordenados.sort((a,b)=>(a.puntos||0)-(b.puntos||0)); break;
    case "recent": ordenados.sort((a,b)=> (b.timestamp||0)-(a.timestamp||0)); break;
  }

  const cats = getCats();

  for(const est of ordenados){
    const card = tplStudentCard.content.cloneNode(true);
    const el   = card.querySelector(".card");
    el.dataset.id = est.id;

    el.querySelector(".student-name").textContent = est.nombre;
    el.querySelector(".score-badge").textContent = est.puntos ?? 0;
    el.querySelector(".last-action").textContent = est.historial?.[0] || "Sin historial aún";

    // Avatar (prioridad: imagen > emoji > theme)
    const avatar = el.querySelector(".avatar");
    const imgEl  = avatar.querySelector(".avatar-img");
    const emoEl  = avatar.querySelector(".avatar-emoji");
    avatar.className = "avatar";
    avatar.classList.add(`theme-${est.avatarTheme||1}`);
    imgEl.src = ""; emoEl.textContent = "";
    if(est.avatarUrl){
      imgEl.src = est.avatarUrl; avatar.classList.add("has-img");
    } else if (est.avatarEmoji){
      emoEl.textContent = est.avatarEmoji; avatar.classList.add("has-emoji");
    } else {
      // deja el icono musical svg por defecto
    }

    // Categorías
    const sel = el.querySelector(".select-category");
    sel.innerHTML = "";
    cats.forEach(c=>{ const opt=document.createElement("option"); opt.value=c; opt.textContent=c; sel.appendChild(opt); });
    sel.value = est.categoria && cats.includes(est.categoria) ? est.categoria : cats[0];

    // Botones
    el.querySelector(".btn-plus").onclick    = ()=>cambiarPuntos(est.id, 1);
    el.querySelector(".btn-minus").onclick   = ()=>cambiarPuntos(est.id,-1);
    el.querySelector(".btn-reset").onclick   = ()=>reiniciarPuntos(est.id);
    el.querySelector(".btn-remove").onclick  = ()=>eliminarEstudiante(est.id);
    el.querySelector(".btn-edit").onclick    = ()=>abrirEditorEstudiante(est.id);
    el.querySelector(".btn-history").onclick = ()=>abrirHistorialEstudiante(est.id);
    sel.onchange = e=>{ est.categoria = e.target.value; guardar(); };

    studentsGrid.appendChild(card);
  }

  // Historial del grupo
  groupHistory.innerHTML = "";
  (grupo.historial || []).slice(0, 15).forEach(h=>{
    const li = document.createElement("li"); li.textContent = h; groupHistory.appendChild(li);
  });

  renderCatsPanel();
}

/* Grupos */
function refrescarGrupos(){
  groupSelect.innerHTML = `<option value="" disabled ${grupoActual?"":"selected"}>— Selecciona grupo —</option>`;
  Object.keys(data.grupos).forEach(nombre=>{
    const opt=document.createElement("option"); opt.value=nombre; opt.textContent=nombre;
    if(nombre===grupoActual) opt.selected=true; groupSelect.appendChild(opt);
  });
}
function nuevoGrupo(){
  promptDialog("Nombre del nuevo grupo:", nombre=>{
    if(!nombre) return;
    if(data.grupos[nombre]) return alert("Ya existe un grupo con ese nombre");
    data.grupos[nombre] = { estudiantes:{}, historial:[], categorias:[...DEFAULT_CATS] };
    grupoActual = nombre; guardar(); refrescarGrupos(); actualizarUI();
  });
}
function renombrarGrupo(){
  if(!grupoActual) return;
  promptDialog("Nuevo nombre del grupo:", nuevo=>{
    if(!nuevo) return;
    if(data.grupos[nuevo]) return alert("Ya existe un grupo con ese nombre");
    data.grupos[nuevo] = data.grupos[grupoActual]; delete data.grupos[grupoActual];
    grupoActual = nuevo; guardar(); refrescarGrupos(); actualizarUI();
  });
}
function eliminarGrupo(){
  if(!grupoActual) return;
  if(confirm(`¿Eliminar el grupo "${grupoActual}"?`)){
    delete data.grupos[grupoActual]; grupoActual=null; guardar(); refrescarGrupos(); actualizarUI();
  }
}

/* Estudiantes */
function agregarEstudiante(){
  if(!grupoActual) return alert("Selecciona un grupo primero");
  promptDialog("Nombre del estudiante:", nombre=>{
    if(!nombre) return;
    const g = data.grupos[grupoActual]; const id = uid(); const cats = getCats();
    g.estudiantes[id] = { id, nombre, puntos:0, categoria:cats[0], historial:[], timestamp:Date.now(), avatarTheme:1, avatarUrl:"", avatarEmoji:"" };
    g.historial.unshift(`🧑‍🎨 ${nombre} ingresó al grupo`); guardar(); actualizarUI();
  });
}
function eliminarEstudiante(id){
  const g = data.grupos[grupoActual]; const est = g.estudiantes[id];
  if(confirm(`¿Eliminar a ${est.nombre}?`)){
    delete g.estudiantes[id]; g.historial.unshift(`🗑️ ${est.nombre} fue eliminado`); guardar(); actualizarUI();
  }
}

/* Editor estudiante (nombre + avatar: theme/emoji/imagen) */
let editCurrentId = null;

function construirGridAvatares(selected=1){
  avatarGrid.innerHTML = "";
  AVATAR_THEMES.forEach(n=>{
    const opt=document.createElement("div");
    opt.className=`avatar-option avatar theme-${n}`;
    if(n===selected) opt.classList.add("selected");
    opt.onclick=()=>{
      [...avatarGrid.children].forEach(c=>c.classList.remove("selected"));
      opt.classList.add("selected");
      // Theme seleccionado: limpia emoji e imagen en la preview
      editPreview.className=`avatar preview theme-${n}`;
      editPreview.classList.remove("has-img","has-emoji");
      editPreview.querySelector(".avatar-img").src="";
      editPreview.querySelector(".avatar-emoji").textContent="";
      editPreview.dataset.theme=String(n);
      editPreview.dataset.url="";
      editPreview.dataset.emoji="";
    };
    avatarGrid.appendChild(opt);
  });
}

function construirGridEmojis(selectedEmoji=""){
  emojiGrid.innerHTML = "";
  AVATAR_EMOJIS.forEach(em=>{
    const cell = document.createElement("div");
    cell.className = "emoji-cell";
    cell.textContent = em;
    if (em === selectedEmoji) cell.classList.add("selected");
    cell.onclick = ()=>{
      [...emojiGrid.children].forEach(c=>c.classList.remove("selected"));
      cell.classList.add("selected");
      // Establece emoji en preview (quita imagen)
      const theme = editPreview.dataset.theme || "1";
      editPreview.className = `avatar preview theme-${theme}`;
      editPreview.classList.remove("has-img");
      editPreview.classList.add("has-emoji");
      editPreview.querySelector(".avatar-img").src = "";
      editPreview.querySelector(".avatar-emoji").textContent = em;
      editPreview.dataset.url   = "";
      editPreview.dataset.emoji = em;
      emojiInput.value = em;
    };
    emojiGrid.appendChild(cell);
  });
}

function abrirEditorEstudiante(id){
  const est = data.grupos[grupoActual].estudiantes[id];
  editCurrentId = id;

  // Nombre
  editNameInput.value = est.nombre;

  // Preview segun prioridad
  const theme = est.avatarTheme || 1;
  editPreview.className = `avatar preview theme-${theme}`;
  const img = editPreview.querySelector(".avatar-img");
  const emo = editPreview.querySelector(".avatar-emoji");
  img.src=""; emo.textContent="";
  if (est.avatarUrl) {
    img.src = est.avatarUrl; editPreview.classList.add("has-img");
  } else if (est.avatarEmoji) {
    emo.textContent = est.avatarEmoji; editPreview.classList.add("has-emoji");
  }
  editPreview.dataset.theme = String(theme);
  editPreview.dataset.url   = est.avatarUrl || "";
  editPreview.dataset.emoji = est.avatarEmoji || "";

  // Grids
  construirGridAvatares(theme);
  construirGridEmojis(est.avatarEmoji || "");
  emojiInput.value = est.avatarEmoji || "";

  dlgEditStudent.showModal();
}

/* Subir / Quitar imagen (anula emoji) */
avatarUpload.onchange = e=>{
  const f = e.target.files?.[0]; if(!f) return;
  const url = URL.createObjectURL(f);
  editPreview.querySelector(".avatar-img").src = url;
  editPreview.classList.add("has-img");
  editPreview.classList.remove("has-emoji");
  editPreview.querySelector(".avatar-emoji").textContent = "";
  editPreview.dataset.url = url;
  editPreview.dataset.emoji = "";
  // deselecciona emoji en la grid
  [...emojiGrid.children].forEach(c=>c.classList.remove("selected"));
  emojiInput.value = "";
};
btnClearAvatar.onclick = ()=>{
  editPreview.querySelector(".avatar-img").src = "";
  editPreview.classList.remove("has-img");
  editPreview.dataset.url = "";
};

/* Elegir emoji manual (anula imagen) */
btnSetEmoji.onclick = ()=>{
  const value = (emojiInput.value || "").trim();
  if(!value) return;
  const theme = editPreview.dataset.theme || "1";
  editPreview.className = `avatar preview theme-${theme}`;
  editPreview.classList.add("has-emoji");
  editPreview.classList.remove("has-img");
  editPreview.querySelector(".avatar-emoji").textContent = value;
  editPreview.querySelector(".avatar-img").src = "";
  editPreview.dataset.emoji = value;
  editPreview.dataset.url = "";
  [...emojiGrid.children].forEach(c=>c.classList.toggle("selected", c.textContent===value));
};
btnClearEmoji.onclick = ()=>{
  editPreview.classList.remove("has-emoji");
  editPreview.querySelector(".avatar-emoji").textContent = "";
  editPreview.dataset.emoji = "";
  [...emojiGrid.children].forEach(c=>c.classList.remove("selected"));
  emojiInput.value = "";
};

/* Guardar edición */
editOkBtn.onclick = ()=>{
  const g = data.grupos[grupoActual]; const est = g.estudiantes[editCurrentId];
  const name = editNameInput.value.trim(); if(!name) return;
  est.nombre = name; est.timestamp = Date.now();
  est.avatarTheme = parseInt(editPreview.dataset.theme||"1",10);
  est.avatarUrl   = editPreview.dataset.url||"";
  est.avatarEmoji = editPreview.dataset.emoji||"";
  guardar(); dlgEditStudent.close(); actualizarUI();
};

/* Historial por estudiante */
let histCurrentId = null;
function abrirHistorialEstudiante(id){
  const g = data.grupos[grupoActual]; const est = g.estudiantes[id];
  histCurrentId = id;
  histTitle.textContent = `Historial de ${est.nombre}`;
  histList.innerHTML = "";
  (est.historial || []).forEach(item=>{
    const li = document.createElement("li"); li.textContent = item; histList.appendChild(li);
  });
  dlgStudentHistory.showModal();
}
btnExportHistTxt.onclick = ()=>{
  if(!histCurrentId) return;
  const est = data.grupos[grupoActual].estudiantes[histCurrentId];
  const content = (est.historial||[]).join("\n");
  descargarArchivo(`${est.nombre}_historial.txt`, content, "text/plain");
};
btnExportHistJson.onclick = ()=>{
  if(!histCurrentId) return;
  const est = data.grupos[grupoActual].estudiantes[histCurrentId];
  descargarArchivo(`${est.nombre}_historial.json`, JSON.stringify(est.historial||[], null, 2), "application/json");
};
btnClearHist.onclick = ()=>{
  if(!histCurrentId) return;
  const g = data.grupos[grupoActual]; const est = g.estudiantes[histCurrentId];
  if(confirm(`¿Borrar el historial de ${est.nombre}?`)){
    est.historial = []; guardar();
    abrirHistorialEstudiante(histCurrentId); // refrescar listado
    actualizarUI(); // refrescar “última acción”
  }
};

/* Puntos e historial */
function cambiarPuntos(id, delta){
  const g = data.grupos[grupoActual]; const est = g.estudiantes[id];
  est.puntos = Math.max(0,(est.puntos||0)+delta);
  const cat = est.categoria || "General";
  const emoji = delta>0?"✨":"⚠️";
  const msg = `${emoji} ${est.nombre} ${delta>0?"ganó":"perdió"} 1 punto (${cat})`;
  est.historial.unshift(msg); g.historial.unshift(msg);
  guardar(); actualizarUI();
}
function reiniciarPuntos(id){
  const g = data.grupos[grupoActual]; const est = g.estudiantes[id];
  if(confirm(`¿Reiniciar puntos de ${est.nombre}?`)){
    est.puntos = 0; g.historial.unshift(`🔄 Se reiniciaron los puntos de ${est.nombre}`);
    guardar(); actualizarUI();
  }
}

/* Puntos grupales */
function puntosGrupo(delta){
  const g = data.grupos[grupoActual]; const cat = quickCategory.value || "General";
  Object.values(g.estudiantes).forEach(est=>{
    est.puntos = Math.max(0,(est.puntos||0)+delta);
    est.historial.unshift(`${delta>0?"🌟":"⚠️"} Grupo: ${delta>0?"ganó":"perdió"} 1 punto (${cat})`);
  });
  const msg = `${delta>0?"🌟":"⚠️"} Todo el grupo ${delta>0?"ganó":"perdió"} 1 punto (${cat})`;
  g.historial.unshift(msg); guardar(); actualizarUI();
}

/* Export/Import global */
function descargarArchivo(nombre, contenido, mime){
  const blob = new Blob([contenido], {type:mime}); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=nombre; a.click(); URL.revokeObjectURL(url);
}
function exportarDatos(){
  descargarArchivo("musipuntos_data.json", JSON.stringify(data,null,2), "application/json");
}
function importarDatos(e){
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{
    try{
      const json = JSON.parse(ev.target.result);
      if(!json.grupos) throw new Error("Estructura inválida");
      data = json;
      Object.values(data.grupos).forEach(g=>{
        if(!g.categorias || !g.categorias.length) g.categorias=[...DEFAULT_CATS];
        if(!g.estudiantes) g.estudiantes = {};
        Object.values(g.estudiantes).forEach(est=>{
          if(!("avatarTheme" in est)) est.avatarTheme=1;
          if(!("avatarUrl" in est)) est.avatarUrl="";
          if(!("avatarEmoji" in est)) est.avatarEmoji="";
          if(!("historial" in est)) est.historial=[];
        });
      });
      const keys = Object.keys(data.grupos); grupoActual = keys.length? keys[0]: null;
      guardar(); refrescarGrupos(); actualizarUI(); alert("Datos importados correctamente");
    }catch{ alert("Archivo inválido"); }
  };
  reader.readAsText(file);
}

/* Diálogo de texto reutilizable */
function promptDialog(mensaje, callback, valorInicial=""){
  dlgTitle.textContent = mensaje; dlgInput.value = valorInicial;
  dlgPrompt.showModal(); dlgOk.onclick = ()=>{ const val = dlgInput.value.trim(); dlgPrompt.close(); callback(val); };
}

/* Eventos */
btnNewGroup.onclick = nuevoGrupo;
btnRenameGroup.onclick = renombrarGrupo;
btnDeleteGroup.onclick = eliminarGrupo;
groupSelect.onchange = ()=>{ grupoActual = groupSelect.value || null; actualizarUI(); };
btnAddStudent.onclick = agregarEstudiante;
sortSelect.onchange = actualizarUI;
btnGroupPlusOne.onclick = ()=>{ if(!grupoActual) return alert("Selecciona un grupo primero"); puntosGrupo(1); };
btnExport.onclick = exportarDatos;
fileImport.onchange = importarDatos;

btnAddCat.onclick = ()=>{
  if(!grupoActual) return alert("Selecciona un grupo primero");
  const name = (catInput.value||"").trim(); if(!name) return;
  addCat(name); catInput.value="";
};
btnResetCats.onclick = ()=>{
  if(!grupoActual) return alert("Selecciona un grupo primero");
  if(confirm("¿Restablecer categorías predeterminadas?")) resetCats();
};

/* Init */
(function init(){
  data.grupos = data.grupos || {};
  const keys = Object.keys(data.grupos);
  if(keys.length && !grupoActual) grupoActual = keys[0];

  keys.forEach(k=>{
    const g = data.grupos[k];
    if(!g.categorias || !g.categorias.length) g.categorias=[...DEFAULT_CATS];
    if(!g.estudiantes) g.estudiantes={};
    Object.values(g.estudiantes).forEach(est=>{
      if(!("avatarTheme" in est)) est.avatarTheme=1;
      if(!("avatarUrl" in est)) est.avatarUrl="";
      if(!("avatarEmoji" in est)) est.avatarEmoji="";
      if(!("historial" in est)) est.historial=[];
    });
  });

  guardar(); refrescarGrupos(); actualizarUI();
})();
