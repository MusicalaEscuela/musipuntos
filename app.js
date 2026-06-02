/* ===========================================================
   app.js — MusiPuntos · Musicala (GlowUp v4)
   Secciones:
     1. Constantes y catálogos
     2. Estado y persistencia
     3. Utilidades
     4. Migración v3 -> v4
     5. Monstruos (render)
     6. Categorías
     7. Render principal (dashboard, tarjetas, meta)
     8. Acciones de puntos / historial / insignias
     9. Estudiantes
    10. Equipos
    11. Recompensas
    12. Reportes
    13. Modo clase
    14. Modales utilitarios (prompt, puntos, perfil, etc.)
    15. Exportar / Importar
    16. Datos demo
    17. Eventos e init
   =========================================================== */

/* ============ 1. CONSTANTES Y CATÁLOGOS ============ */
const STORAGE_KEY = "musipuntos_data_v4";

const MONSTER_TYPES = [
  { id:"ciclope",   nombre:"Cíclope",   acc:"" },
  { id:"peludo",    nombre:"Peludo",    acc:"" },
  { id:"antenas",   nombre:"Antenitas", acc:"" },
  { id:"cuernos",   nombre:"Cuernitos", acc:"" },
  { id:"sonriente", nombre:"Sonriente", acc:"😄", smile:true },
  { id:"timido",    nombre:"Tímido",    acc:"", cheeks:true },
  { id:"rockero",   nombre:"Rockero",   acc:"🎸" },
  { id:"bailarin",  nombre:"Bailarín",  acc:"💃" },
  { id:"pintor",    nombre:"Pintor",    acc:"🎨" },
  { id:"teatral",   nombre:"Teatral",   acc:"🎭" },
  { id:"musical",   nombre:"Musical",   acc:"🎵" },
  { id:"estrella",  nombre:"Estrella",  acc:"⭐" },
];

const MONSTER_COLORS = [
  ["#9b5de5","#c77dff"], ["#0C41C4","#5b8def"], ["#16b673","#5ee0a8"],
  ["#f15bb5","#ff9ad5"], ["#f5a64b","#ffd29a"], ["#00bbf9","#7fe1ff"],
  ["#e23b5a","#ff8aa0"], ["#680DBF","#a45cff"], ["#ffbd00","#ffe066"],
  ["#0e9c84","#4fd8c0"], ["#CE0071","#ff6ab5"], ["#5a6acf","#9aa6ff"],
];

const DEFAULT_CATS = [
  { nombre:"Participación",        icono:"🙋", color:"#16b673", pts:2, tipo:"positivo" },
  { nombre:"Concentración",        icono:"🎯", color:"#0C41C4", pts:2, tipo:"positivo" },
  { nombre:"Creatividad",          icono:"🎨", color:"#680DBF", pts:2, tipo:"positivo" },
  { nombre:"Respeto",              icono:"🤝", color:"#00bbf9", pts:2, tipo:"positivo" },
  { nombre:"Trabajo en equipo",    icono:"👥", color:"#0e9c84", pts:3, tipo:"positivo" },
  { nombre:"Esfuerzo",             icono:"💪", color:"#f5a64b", pts:2, tipo:"positivo" },
  { nombre:"Práctica en casa",     icono:"🏠", color:"#9b5de5", pts:3, tipo:"positivo" },
  { nombre:"Ayuda a un compañero", icono:"💞", color:"#CE0071", pts:2, tipo:"positivo" },
  { nombre:"Avance artístico",     icono:"🌟", color:"#ffbd00", pts:3, tipo:"positivo" },
  { nombre:"Buena energía",        icono:"⚡", color:"#f15bb5", pts:1, tipo:"positivo" },
  { nombre:"Interrumpe la clase",  icono:"🔇", color:"#e23b5a", pts:1, tipo:"mejora", resta:true },
  { nombre:"Falta de escucha",     icono:"👂", color:"#e8943a", pts:1, tipo:"mejora", resta:true },
  { nombre:"No trae materiales",   icono:"🎒", color:"#e8943a", pts:1, tipo:"mejora", resta:false },
  { nombre:"Se distrae mucho",     icono:"💭", color:"#e8943a", pts:1, tipo:"mejora", resta:true },
  { nombre:"Observación",          icono:"📝", color:"#6B6385", pts:0, tipo:"observacion" },
];

const DEFAULT_REWARDS = [
  { nombre:"Elegir canción de calentamiento", desc:"Tú eliges con qué arrancamos", costo:10, tipo:"individual", icono:"🎵", activa:true, descuenta:true },
  { nombre:"Ayudante del día",                desc:"Acompañas al profe en la clase", costo:15, tipo:"individual", icono:"🦸", activa:true, descuenta:true },
  { nombre:"Minuto creativo",                 desc:"Un minuto para tu idea artística", costo:8, tipo:"individual", icono:"💡", activa:true, descuenta:true },
  { nombre:"Monstruo destacado del día",      desc:"Tu monstruo brilla en el tablero", costo:12, tipo:"individual", icono:"👑", activa:true, descuenta:false },
  { nombre:"Elegir juego de cierre",          desc:"El equipo decide el juego final", costo:20, tipo:"equipo", icono:"🎲", activa:true, descuenta:true },
  { nombre:"Clase temática",                  desc:"Una clase especial para el grupo", costo:50, tipo:"grupal", icono:"🎉", activa:true, descuenta:false },
];

const BADGES = [
  { id:"estrella",   icono:"🌟", nombre:"Energía positiva", cond:s=>s.puntosPos>=20 },
  { id:"concentrado",icono:"🎯", nombre:"Artista concentrado", cond:s=>countCat(s,"Concentración")>=3 },
  { id:"colaborador",icono:"🤝", nombre:"Monstruo colaborador", cond:s=>countCat(s,"Trabajo en equipo")+countCat(s,"Ayuda a un compañero")>=3 },
  { id:"creativo",   icono:"🎨", nombre:"Explorador creativo", cond:s=>countCat(s,"Creatividad")>=3 },
  { id:"lider",      icono:"🦸", nombre:"MusiLíder", cond:s=>s.puntosPos>=40 },
  { id:"puntual",    icono:"⏰", nombre:"Monstruo puntual", cond:s=>countCat(s,"Práctica en casa")>=3 },
];

const STAT_DEFS = []; // placeholder

/* ============ 2. ESTADO Y PERSISTENCIA ============ */
let data = null;
let grupoActual = null;          // id de grupo
let vistaActual = "clase";
let undoStack = [];              // snapshots para deshacer
let selectMode = false;
let selectedIds = new Set();
let applyingRemote = false;      // true mientras aplicamos datos venidos de la nube

function guardar(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Sincroniza con la escuela (Firestore) si está disponible y no es un eco remoto
  if(window.MusiCloud && window.MusiCloud.enabled && !applyingRemote){
    try{ window.MusiCloud.save(data); }catch(e){ /* offline: queda en localStorage */ }
  }
}
function snapshot(){ undoStack.push(JSON.stringify(data)); if(undoStack.length>30) undoStack.shift(); updateUndoBtn(); }
function deshacer(){
  if(!undoStack.length) return;
  data = JSON.parse(undoStack.pop());
  guardar(); refreshAll(); updateUndoBtn();
  toast("Acción deshecha","↩️");
}
function updateUndoBtn(){ const b=$("#btnUndo"); if(b) b.disabled = undoStack.length===0; }

/* ============ 3. UTILIDADES ============ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const uid = ()=> Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const grupo = ()=> data.grupos[grupoActual];
const esHoy = iso => { const d=new Date(iso); const n=new Date(); return d.toDateString()===n.toDateString(); };
const fmtFecha = iso => new Date(iso).toLocaleString("es",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function countCat(s, catNombre){ return (s.historial||[]).filter(h=>h.categoriaNombre===catNombre && h.puntos>0).length; }
function descargar(nombre, contenido, mime){
  const blob=new Blob([contenido],{type:mime}); const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download=nombre; a.click(); URL.revokeObjectURL(url);
}

/* ============ 4. MIGRACIÓN v3 -> v4 ============ */
function nuevoGrupoObj(nombre){
  return {
    id: uid(), nombre,
    mascota: { tipo:"sonriente", color: rndInt(MONSTER_COLORS.length) },
    puntosGrupo: 0,
    meta: null,
    estudiantes: {},
    equipos: {},
    categorias: DEFAULT_CATS.map(c=>({ id:uid(), resta:false, ...c })),
    recompensas: DEFAULT_REWARDS.map(r=>({ id:uid(), ...r })),
    historial: [],
  };
}
function rndInt(n){ return Math.floor(Math.random()*n); }

function cargarYMigrar(){
  let raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if(raw && raw.version===4){ data = raw; return; }

  // Buscar versiones anteriores
  const prev = JSON.parse(localStorage.getItem("musipuntos_data_v3") || "null")
            || JSON.parse(localStorage.getItem("musipuntos_data_v2") || "null")
            || JSON.parse(localStorage.getItem("musipuntos_data_v1") || "null");

  data = { version:4, grupos:{} };
  if(prev && prev.grupos){
    Object.entries(prev.grupos).forEach(([nombre, g])=>{
      const ng = nuevoGrupoObj(nombre);
      // Categorías antiguas (strings) -> categorías positivas
      if(Array.isArray(g.categorias) && g.categorias.length){
        const extra = g.categorias
          .filter(c=>typeof c==="string")
          .filter(c=>!ng.categorias.some(x=>x.nombre.toLowerCase()===c.toLowerCase()))
          .map(c=>({ id:uid(), nombre:c, icono:"⭐", color:"#680DBF", pts:1, tipo:"positivo", resta:false }));
        ng.categorias = [...ng.categorias, ...extra];
      }
      // Estudiantes
      Object.values(g.estudiantes||{}).forEach(est=>{
        const colorIdx = ((est.avatarTheme||1)-1) % MONSTER_COLORS.length;
        const tipo = est.avatarEmoji ? "musical" : "sonriente";
        const nuevo = {
          id: est.id || uid(),
          nombre: est.nombre || "Estudiante",
          monstruo: { tipo, color: colorIdx<0?0:colorIdx },
          legacyEmoji: est.avatarEmoji || "",
          legacyImg: est.avatarUrl || "",
          equipoId: null,
          puntosPos: Math.max(0, est.puntos||0),
          puntosNeg: 0,
          insignias: [],
          recompensas: [],
          historial: [],
          timestamp: est.timestamp || Date.now(),
        };
        // Historial antiguo (strings) -> eventos simples
        (est.historial||[]).slice().reverse().forEach(str=>{
          nuevo.historial.unshift({
            id:uid(), fecha:new Date(nuevo.timestamp).toISOString(), tipo:"puntos_individuales",
            grupoId:ng.id, grupoNombre:nombre, estudianteId:nuevo.id, estudianteNombre:nuevo.nombre,
            puntos:0, nota:"", mensaje:String(str)
          });
        });
        ng.estudiantes[nuevo.id] = nuevo;
      });
      // Historial de grupo antiguo
      (g.historial||[]).forEach(str=>{
        ng.historial.push({ id:uid(), fecha:new Date().toISOString(), tipo:"nota",
          grupoId:ng.id, grupoNombre:nombre, puntos:0, nota:"", mensaje:String(str) });
      });
      data.grupos[ng.id] = ng;
    });
  }
  guardar();
}

/* ============ 5. MONSTRUOS ============ */
function monsterHTML(tipo="sonriente", colorIdx=0){
  const t = MONSTER_TYPES.find(m=>m.id===tipo) || MONSTER_TYPES[0];
  const c = MONSTER_COLORS[(colorIdx||0) % MONSTER_COLORS.length] || MONSTER_COLORS[0];
  const acc = t.acc ? `<span class="m-acc">${t.acc}</span>` : "";
  const cheeks = t.cheeks ? `<span class="m-cheek l"></span><span class="m-cheek r"></span>` : "";
  const mouth = t.smile ? `<span class="m-mouth smile"></span>` : `<span class="m-mouth"></span>`;
  return `<div class="monster" data-tipo="${t.id}" style="--m:${c[0]};--m2:${c[1]}">
    <div class="m-body">
      ${acc}
      <div class="m-eyes"><span class="m-eye"></span><span class="m-eye"></span></div>
      ${cheeks}${mouth}
    </div>
  </div>`;
}
function setMonster(holder, tipo, colorIdx){ if(holder) holder.innerHTML = monsterHTML(tipo, colorIdx); }

/* ============ 6. CATEGORÍAS ============ */
function getCats(){ const g=grupo(); if(!g.categorias||!g.categorias.length) g.categorias=DEFAULT_CATS.map(c=>({id:uid(),resta:false,...c})); return g.categorias; }

function renderCatEditor(){
  const ed = $("#catEditor"); if(!ed) return;
  ed.innerHTML = "";
  getCats().forEach(c=>{
    const row=document.createElement("div"); row.className="cat-row";
    row.innerHTML = `<span class="c-ico">${c.icono}</span>
      <span class="c-name">${escapeHtml(c.nombre)}</span>
      <span class="tag">${c.tipo==="positivo"?"+"+c.pts:c.tipo==="mejora"?(c.resta?"-"+c.pts:"reg "+c.pts):"0"}</span>
      <button class="btn ghost tiny" title="Eliminar">🗑️</button>`;
    row.querySelector("button").onclick=()=>{
      snapshot(); grupo().categorias = getCats().filter(x=>x.id!==c.id); guardar(); renderCatEditor();
    };
    ed.appendChild(row);
  });
}

/* ============ 7. RENDER PRINCIPAL ============ */
function refreshAll(){
  refrescarGrupos();
  updateGroupMascot();
  const hayGrupo = !!grupoActual && !!grupo();
  $("#emptyState").hidden = hayGrupo;
  $("#groupContent").hidden = !hayGrupo;
  if(hayGrupo){
    renderDashboard(); renderGoal(); renderStudents();
  }
  if(vistaActual==="equipos") renderTeams();
  if(vistaActual==="recompensas") renderRewards();
  if(vistaActual==="reportes") renderReports();
}

function refrescarGrupos(){
  const sel=$("#groupSelect");
  sel.innerHTML = `<option value="" disabled ${grupoActual?"":"selected"}>— Selecciona un grupo —</option>`;
  Object.values(data.grupos).forEach(g=>{
    const o=document.createElement("option"); o.value=g.id; o.textContent=g.nombre;
    if(g.id===grupoActual) o.selected=true; sel.appendChild(o);
  });
}
function updateGroupMascot(){
  const el=$("#groupMascot");
  if(grupoActual && grupo()){ setMonster(el, grupo().mascota.tipo, grupo().mascota.color); }
  else el.innerHTML="";
}

function estudiantes(){ return Object.values(grupo().estudiantes||{}); }
function neto(s){ return (s.puntosPos||0) - (s.puntosNeg||0); }

function renderDashboard(){
  const g=grupo(); const ests=estudiantes();
  const hoyPos = g.historial.filter(h=>esHoy(h.fecha)&&h.puntos>0).reduce((a,b)=>a+b.puntos,0);
  const hoyNeg = g.historial.filter(h=>esHoy(h.fecha)&&h.puntos<0).reduce((a,b)=>a+Math.abs(b.puntos),0);
  const dest = ests.slice().sort((a,b)=>neto(b)-neto(a))[0];
  const equipos = Object.values(g.equipos||{});
  const equipoDest = equipos.slice().sort((a,b)=>(b.puntos||0)-(a.puntos||0))[0];
  // categoría más usada
  const catCount={};
  g.historial.forEach(h=>{ if(h.categoriaNombre) catCount[h.categoriaNombre]=(catCount[h.categoriaNombre]||0)+1; });
  const catTop = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];
  const ultima = g.historial[0];

  const cards = [
    { ico:"🧑‍🎓", val:ests.length, lab:"Estudiantes" },
    { ico:"😊", val:"+"+hoyPos, lab:"Positivos hoy" },
    { ico:"🌱", val:hoyNeg, lab:"A mejorar hoy" },
    { ico:"🌟", val:g.puntosGrupo, lab:"Puntos de grupo", accent:true },
    { ico:"🏆", val: dest? dest.nombre : "—", lab:"Estudiante destacado" },
    { ico:"🛡️", val: equipoDest? equipoDest.nombre : "—", lab:"Equipo destacado" },
    { ico:"🏷️", val: catTop? catTop[0] : "—", lab:"Categoría más usada" },
    { ico:"🕑", val: ultima? fmtFecha(ultima.fecha):"—", lab:"Última actividad" },
  ];
  $("#dashboard").innerHTML = cards.map(c=>`
    <div class="stat-card ${c.accent?"accent":""}">
      <span class="s-ico">${c.ico}</span>
      <span class="s-val" title="${escapeHtml(String(c.val))}">${escapeHtml(String(c.val))}</span>
      <span class="s-lab">${c.lab}</span>
    </div>`).join("");
}

function renderGoal(){
  const g=grupo(); const card=$("#goalCard");
  if(!g.meta){ card.className="goal-card"; card.innerHTML=""; return; }
  const pct = Math.min(100, Math.round(g.puntosGrupo / g.meta.objetivo * 100));
  card.className="goal-card show";
  card.innerHTML = `
    <div class="goal-head">
      <b>🎯 Meta grupal: ${escapeHtml(g.meta.recompensa||"Recompensa")}</b>
      <span>${g.puntosGrupo} / ${g.meta.objetivo} pts ${pct>=100?"🎉 ¡Lograda!":""}</span>
    </div>
    <div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div>`;
}

function renderStudents(){
  const grid=$("#studentsGrid"); grid.innerHTML="";
  let ests=estudiantes();
  if(!ests.length){ grid.innerHTML=`<p class="hint" style="grid-column:1/-1;text-align:center;padding:2rem">Aún no hay estudiantes. ¡Agrega el primero! 🎶</p>`; return; }
  const g=grupo();
  const sort=$("#sortSelect").value;
  ests = ests.slice().sort((a,b)=>{
    switch(sort){
      case "az": return a.nombre.localeCompare(b.nombre);
      case "za": return b.nombre.localeCompare(a.nombre);
      case "points-desc": return neto(b)-neto(a);
      case "points-asc": return neto(a)-neto(b);
      case "recent": return (b.timestamp||0)-(a.timestamp||0);
    }
  });
  const tpl=$("#tplStudentCard");
  ests.forEach(s=>{
    const node=tpl.content.cloneNode(true);
    const card=node.querySelector(".student-card");
    card.dataset.id=s.id;
    setMonster(node.querySelector(".monster-holder"), s.monstruo.tipo, s.monstruo.color);
    node.querySelector(".student-name").textContent=s.nombre;
    node.querySelector(".net-badge").textContent=neto(s);
    node.querySelector(".pos-val").textContent=s.puntosPos||0;
    node.querySelector(".neg-val").textContent=s.puntosNeg||0;
    // equipo
    const teamEl=node.querySelector(".student-team");
    const team = s.equipoId && g.equipos[s.equipoId];
    if(team){ teamEl.textContent="🛡️ "+team.nombre; teamEl.style.color=MONSTER_COLORS[team.color][0]; }
    // insignias
    const br=node.querySelector(".badges-row");
    (s.insignias||[]).forEach(bid=>{ const b=BADGES.find(x=>x.id===bid); if(b){ const sp=document.createElement("span"); sp.className="badge-pill"; sp.title=b.nombre; sp.textContent=b.icono; br.appendChild(sp); } });
    // última acción
    const last=s.historial[0];
    node.querySelector(".last-action").textContent = last ? last.mensaje : "Sin actividad aún";
    // selección
    if(selectMode){ card.classList.add("selectable"); if(selectedIds.has(s.id)){ card.classList.add("selected"); node.querySelector(".select-tick").hidden=false; } }
    // eventos
    node.querySelector(".btn-plus").onclick=e=>{ e.stopPropagation(); abrirPuntos({estudianteIds:[s.id]}); };
    node.querySelector(".btn-minus").onclick=e=>{ e.stopPropagation(); abrirPuntos({estudianteIds:[s.id], kind:"mejora"}); };
    node.querySelector(".btn-profile").onclick=e=>{ e.stopPropagation(); abrirPerfil(s.id); };
    node.querySelector(".btn-edit").onclick=e=>{ e.stopPropagation(); abrirEditor(s.id); };
    node.querySelector(".btn-remove").onclick=e=>{ e.stopPropagation(); eliminarEstudiante(s.id); };
    node.querySelector(".net-badge").onclick=e=>{ e.stopPropagation(); abrirPerfil(s.id); };
    if(selectMode){ card.onclick=()=>toggleSelect(s.id); }
    grid.appendChild(node);
  });
}

function toggleSelect(id){
  if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  $("#btnGivePointsSelected").hidden = selectedIds.size===0;
  $("#btnGivePointsSelected").textContent = `＋ Dar a ${selectedIds.size} seleccionado(s)`;
  renderStudents();
}

/* ============ 8. PUNTOS / HISTORIAL / INSIGNIAS ============ */
function registrarEvento(ev){ grupo().historial.unshift({ id:uid(), fecha:new Date().toISOString(), grupoId:grupo().id, grupoNombre:grupo().nombre, nota:"", puntos:0, ...ev }); }

function aplicarPuntosEstudiante(s, cat, puntos, nota){
  const g=grupo();
  const delta = puntos;
  if(delta>=0) s.puntosPos = (s.puntosPos||0)+delta;
  else s.puntosNeg = (s.puntosNeg||0)+Math.abs(delta);
  s.timestamp = Date.now();
  const verbo = delta>0?"ganó":delta<0?"registró":"recibió una observación de";
  const signo = delta>0?`+${delta}`:delta<0?`${delta}`:"0";
  const mensaje = delta===0
    ? `📝 ${s.nombre}: ${cat.nombre}${nota?" — "+nota:""}`
    : `${delta>0?"✨":"🌱"} ${s.nombre} ${verbo} ${signo} pts por ${cat.nombre}.`;
  const ev = {
    tipo:"puntos_individuales", estudianteId:s.id, estudianteNombre:s.nombre,
    categoriaId:cat.id, categoriaNombre:cat.nombre, puntos:delta, nota:nota||"", mensaje
  };
  registrarEvento(ev);
  s.historial.unshift({ ...ev, id:uid(), fecha:new Date().toISOString() });
  // insignias
  checkBadges(s);
}

function checkBadges(s){
  BADGES.forEach(b=>{
    if(!s.insignias.includes(b.id) && b.cond(s)){
      s.insignias.push(b.id);
      registrarEvento({ tipo:"insignia", estudianteId:s.id, estudianteNombre:s.nombre, mensaje:`🏅 ${s.nombre} desbloqueó la insignia "${b.nombre}" ${b.icono}` });
      toast(`${s.nombre} ganó insignia ${b.icono} ${b.nombre}`,"🏅");
    }
  });
}

function confirmarPuntos({ estudianteIds=[], equipoId=null, grupoCompleto=false, cat, puntos, nota }){
  snapshot();
  const g=grupo();
  let afectados=[];
  if(grupoCompleto){
    estudiantes().forEach(s=>{ aplicarPuntosEstudiante(s, cat, puntos, nota); });
    g.puntosGrupo = Math.max(0, g.puntosGrupo + (puntos>0?puntos:0));
    registrarEvento({ tipo:"puntos_grupales", categoriaId:cat.id, categoriaNombre:cat.nombre, puntos, nota,
      mensaje:`${puntos>0?"🌟":"🌱"} El grupo ${g.nombre} ${puntos>0?"ganó":"registró"} ${puntos>0?"+"+puntos:puntos} pts por ${cat.nombre}.` });
    afectados = estudiantes();
  } else if(equipoId){
    const team=g.equipos[equipoId];
    team.puntos = Math.max(0,(team.puntos||0)+puntos);
    const miembros = estudiantes().filter(s=>s.equipoId===equipoId);
    miembros.forEach(s=> aplicarPuntosEstudiante(s, cat, puntos, nota));
    registrarEvento({ tipo:"puntos_equipo", equipoId, equipoNombre:team.nombre, categoriaId:cat.id, categoriaNombre:cat.nombre, puntos, nota,
      mensaje:`${puntos>0?"🛡️":"🌱"} Equipo ${team.nombre} ${puntos>0?"ganó":"registró"} ${puntos>0?"+"+puntos:puntos} pts por ${cat.nombre}.` });
    afectados = miembros;
  } else {
    estudianteIds.forEach(id=>{ const s=g.estudiantes[id]; if(s){ aplicarPuntosEstudiante(s, cat, puntos, nota); afectados.push(s);} });
  }
  guardar(); refreshAll();
  // animaciones
  afectados.forEach(s=> animarTarjeta(s.id, puntos, cat));
  const verbo = puntos>0?`+${puntos}`:puntos<0?`${puntos}`:"observación";
  toast(`${verbo} ${cat.nombre}`, puntos>0?"✨":puntos<0?"🌱":"📝", puntos>0?"pos":puntos<0?"neg":"");
  checkMeta();
}

function animarTarjeta(id, puntos, cat){
  const card=$(`.student-card[data-id="${id}"]`);
  if(!card) return;
  card.classList.remove("bump"); void card.offsetWidth; card.classList.add("bump");
  const f=document.createElement("div");
  f.className="float-pts "+(puntos>0?"pos":puntos<0?"neg":"");
  f.textContent = puntos===0?`📝 ${cat.icono}`:`${puntos>0?"+":""}${puntos} ${cat.icono}`;
  card.appendChild(f); setTimeout(()=>f.remove(),1000);
}

function checkMeta(){
  const g=grupo();
  if(g.meta && !g.meta._lograda && g.puntosGrupo>=g.meta.objetivo){
    g.meta._lograda = true; guardar();
    confetti(); toast(`🎉 ¡Meta grupal lograda: ${g.meta.recompensa}!`,"🎉","pos");
    registrarEvento({ tipo:"nota", mensaje:`🎉 El grupo alcanzó la meta: ${g.meta.recompensa}` });
  }
}

/* ============ 9. ESTUDIANTES ============ */
function agregarEstudiante(){
  if(!grupoActual) return toast("Crea o selecciona un grupo primero","⚠️");
  promptDialog({ titulo:"Nuevo estudiante", label:"Nombre del estudiante" }, nombre=>{
    if(!nombre) return;
    snapshot();
    const id=uid();
    grupo().estudiantes[id] = {
      id, nombre, monstruo:{ tipo:MONSTER_TYPES[rndInt(MONSTER_TYPES.length)].id, color:rndInt(MONSTER_COLORS.length) },
      equipoId:null, puntosPos:0, puntosNeg:0, insignias:[], recompensas:[], historial:[], timestamp:Date.now()
    };
    registrarEvento({ tipo:"nota", estudianteId:id, estudianteNombre:nombre, mensaje:`🧑‍🎨 ${nombre} se unió al grupo.` });
    guardar(); refreshAll(); toast(`${nombre} se unió 🎶`,"➕","pos");
  });
}
function eliminarEstudiante(id){
  const s=grupo().estudiantes[id];
  if(confirm(`¿Eliminar a ${s.nombre}? Esta acción se puede deshacer.`)){
    snapshot(); delete grupo().estudiantes[id];
    registrarEvento({ tipo:"nota", mensaje:`🗑️ ${s.nombre} fue eliminado del grupo.` });
    guardar(); refreshAll();
  }
}

/* Editor de estudiante (monstruo + equipo) */
let editId=null, editTipo=null, editColor=null;
function abrirEditor(id){
  const s=grupo().estudiantes[id]; editId=id; editTipo=s.monstruo.tipo; editColor=s.monstruo.color;
  $("#editName").value=s.nombre;
  // equipos
  const teamSel=$("#editTeam");
  teamSel.innerHTML=`<option value="">— Sin equipo —</option>`;
  Object.values(grupo().equipos||{}).forEach(t=>{ const o=document.createElement("option"); o.value=t.id; o.textContent=t.nombre; if(s.equipoId===t.id)o.selected=true; teamSel.appendChild(o); });
  // galería
  const gal=$("#monsterGallery"); gal.innerHTML="";
  MONSTER_TYPES.forEach(m=>{
    const b=document.createElement("button"); b.type="button"; b.className="m-pick"+(m.id===editTipo?" selected":"");
    b.innerHTML=monsterHTML(m.id, editColor); b.title=m.nombre;
    b.onclick=()=>{ editTipo=m.id; $$("#monsterGallery .m-pick").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); updateEditPreview(); refreshGalleryColors(gal); };
    gal.appendChild(b);
  });
  // colores
  const cr=$("#colorRow"); cr.innerHTML="";
  MONSTER_COLORS.forEach((c,i)=>{
    const d=document.createElement("button"); d.type="button"; d.className="color-dot"+(i===editColor?" selected":"");
    d.style.background=`linear-gradient(135deg,${c[1]},${c[0]})`;
    d.onclick=()=>{ editColor=i; $$("#colorRow .color-dot").forEach(x=>x.classList.remove("selected")); d.classList.add("selected"); updateEditPreview(); refreshGalleryColors(gal); };
    cr.appendChild(d);
  });
  updateEditPreview();
  $("#dlgEditStudent").showModal();
}
function refreshGalleryColors(gal){ $$(".m-pick",gal).forEach((b,i)=>{ b.innerHTML=monsterHTML(MONSTER_TYPES[i].id, editColor); }); }
function updateEditPreview(){ setMonster($("#editMonsterHolder"), editTipo, editColor); }
$("#editOk").onclick=()=>{
  const s=grupo().estudiantes[editId]; const nombre=$("#editName").value.trim(); if(!nombre) return;
  snapshot();
  s.nombre=nombre; s.monstruo={ tipo:editTipo, color:editColor };
  const newTeam=$("#editTeam").value||null; s.equipoId=newTeam;
  s.timestamp=Date.now(); guardar(); $("#dlgEditStudent").close(); refreshAll(); toast("Guardado","💾");
};

/* ============ 10. EQUIPOS ============ */
let teamEditId=null, teamColor=0, teamTipo="estrella", teamMembers=new Set();
function renderTeams(){
  const grid=$("#teamsGrid");
  if(!grupoActual||!grupo()){ grid.innerHTML=`<p class="hint">Selecciona un grupo.</p>`; return; }
  const g=grupo(); const teams=Object.values(g.equipos||{});
  if(!teams.length){ grid.innerHTML=`<p class="hint" style="grid-column:1/-1;text-align:center;padding:2rem">Aún no hay equipos. Crea el primero para fomentar el trabajo en equipo 🛡️</p>`; return; }
  const ranked=teams.slice().sort((a,b)=>(b.puntos||0)-(a.puntos||0));
  grid.innerHTML="";
  ranked.forEach((t,i)=>{
    const members=estudiantes().filter(s=>s.equipoId===t.id);
    const card=document.createElement("article"); card.className="card team-card";
    const c=MONSTER_COLORS[t.color];
    card.innerHTML=`
      <div class="t-flag" style="background:linear-gradient(90deg,${c[0]},${c[1]})"></div>
      <div class="card-top"><div class="monster-holder" style="width:64px;height:64px">${monsterHTML(t.tipo,t.color)}</div>
        <button class="net-badge">${t.puntos||0}</button></div>
      <h3 class="student-name">${i===0?"👑 ":""}${escapeHtml(t.nombre)}</h3>
      <p class="t-members">${members.length} integrante(s): ${members.map(m=>escapeHtml(m.nombre)).join(", ")||"—"}</p>
      <div class="card-actions">
        <button class="btn success bp">＋ Puntos</button>
        <button class="btn warn bm">A mejorar</button>
      </div>
      <div class="card-actions secondary">
        <button class="btn ghost tiny be">✏️ Editar</button>
        <button class="btn ghost tiny bd">🗑️</button>
      </div>`;
    card.querySelector(".bp").onclick=()=>abrirPuntos({equipoId:t.id});
    card.querySelector(".bm").onclick=()=>abrirPuntos({equipoId:t.id, kind:"mejora"});
    card.querySelector(".be").onclick=()=>abrirEditorEquipo(t.id);
    card.querySelector(".bd").onclick=()=>{ if(confirm(`¿Eliminar equipo ${t.nombre}?`)){ snapshot(); estudiantes().forEach(s=>{ if(s.equipoId===t.id)s.equipoId=null; }); delete g.equipos[t.id]; guardar(); renderTeams(); refreshAll(); } };
    grid.appendChild(card);
  });
}
function abrirEditorEquipo(id){
  const g=grupo();
  teamEditId=id;
  const t = id? g.equipos[id] : null;
  teamColor = t? t.color : rndInt(MONSTER_COLORS.length);
  teamTipo = t? t.tipo : "estrella";
  teamMembers = new Set(estudiantes().filter(s=>s.equipoId===id).map(s=>s.id));
  $("#teamDlgTitle").textContent = t? "Editar equipo":"Nuevo equipo";
  $("#teamName").value = t? t.nombre : "";
  // colores
  const cr=$("#teamColorRow"); cr.innerHTML="";
  MONSTER_COLORS.forEach((c,i)=>{ const d=document.createElement("button"); d.type="button"; d.className="color-dot"+(i===teamColor?" selected":""); d.style.background=`linear-gradient(135deg,${c[1]},${c[0]})`; d.onclick=()=>{ teamColor=i; $$("#teamColorRow .color-dot").forEach(x=>x.classList.remove("selected")); d.classList.add("selected"); refreshTeamGallery(); }; cr.appendChild(d); });
  // galería
  refreshTeamGallery();
  // miembros
  const ml=$("#teamMemberList"); ml.innerHTML="";
  estudiantes().forEach(s=>{
    const row=document.createElement("label"); row.className="member-row";
    row.innerHTML=`<input type="checkbox" ${teamMembers.has(s.id)?"checked":""}/><div class="monster-holder">${monsterHTML(s.monstruo.tipo,s.monstruo.color)}</div><span>${escapeHtml(s.nombre)}</span>`;
    row.querySelector("input").onchange=e=>{ if(e.target.checked)teamMembers.add(s.id); else teamMembers.delete(s.id); };
    ml.appendChild(row);
  });
  $("#dlgTeam").showModal();
}
function refreshTeamGallery(){
  const gal=$("#teamMonsterGallery"); gal.innerHTML="";
  MONSTER_TYPES.forEach(m=>{ const b=document.createElement("button"); b.type="button"; b.className="m-pick"+(m.id===teamTipo?" selected":""); b.innerHTML=monsterHTML(m.id,teamColor); b.onclick=()=>{ teamTipo=m.id; refreshTeamGallery(); }; gal.appendChild(b); });
}
$("#teamOk").onclick=()=>{
  const nombre=$("#teamName").value.trim(); if(!nombre) return toast("Ponle nombre al equipo","⚠️");
  snapshot(); const g=grupo();
  let id=teamEditId;
  if(!id){ id=uid(); g.equipos[id]={ id, nombre, color:teamColor, tipo:teamTipo, puntos:0 }; }
  else { g.equipos[id].nombre=nombre; g.equipos[id].color=teamColor; g.equipos[id].tipo=teamTipo; }
  // asignar miembros
  estudiantes().forEach(s=>{ if(teamMembers.has(s.id)) s.equipoId=id; else if(s.equipoId===id) s.equipoId=null; });
  guardar(); $("#dlgTeam").close(); renderTeams(); refreshAll(); toast("Equipo guardado","🛡️","pos");
};

/* ============ 11. RECOMPENSAS ============ */
let rewardEditId=null;
function renderRewards(){
  const grid=$("#rewardsGrid");
  if(!grupoActual||!grupo()){ grid.innerHTML=`<p class="hint">Selecciona un grupo.</p>`; return; }
  const rewards=grupo().recompensas||[];
  if(!rewards.length){ grid.innerHTML=`<p class="hint" style="grid-column:1/-1;text-align:center;padding:2rem">No hay recompensas. ¡Crea la primera! 🎁</p>`; return; }
  grid.innerHTML="";
  rewards.forEach(r=>{
    const card=document.createElement("article"); card.className="card reward-card"+(r.activa?"":" inactive");
    card.innerHTML=`
      <div class="r-ico">${r.icono}</div>
      <h3 class="student-name">${escapeHtml(r.nombre)}</h3>
      <p class="last-action">${escapeHtml(r.desc||"")}</p>
      <div class="mini-stats"><span class="reward-cost">${r.costo} pts</span> <span class="tag">${r.tipo}</span> ${r.descuenta?'<span class="tag">descuenta</span>':'<span class="tag">logro</span>'}</div>
      <div class="card-actions">
        <button class="btn primary br" ${r.activa?"":"disabled"}>🎁 Canjear</button>
      </div>
      <div class="card-actions secondary">
        <button class="btn ghost tiny be">✏️ Editar</button>
        <button class="btn ghost tiny bd">🗑️</button>
      </div>`;
    card.querySelector(".br").onclick=()=>abrirCanje(r.id);
    card.querySelector(".be").onclick=()=>abrirEditorRecompensa(r.id);
    card.querySelector(".bd").onclick=()=>{ if(confirm(`¿Eliminar recompensa ${r.nombre}?`)){ snapshot(); grupo().recompensas=rewards.filter(x=>x.id!==r.id); guardar(); renderRewards(); } };
    grid.appendChild(card);
  });
}
function abrirEditorRecompensa(id){
  rewardEditId=id; const r=id? grupo().recompensas.find(x=>x.id===id):null;
  $("#rewardDlgTitle").textContent=r?"Editar recompensa":"Nueva recompensa";
  $("#rewardName").value=r?r.nombre:""; $("#rewardDesc").value=r?r.desc:"";
  $("#rewardCost").value=r?r.costo:10; $("#rewardIcon").value=r?r.icono:"🎁";
  $("#rewardType").value=r?r.tipo:"individual"; $("#rewardActive").value=r?String(r.activa):"true";
  $("#rewardDeduct").checked=r?!!r.descuenta:true;
  $("#dlgReward").showModal();
}
$("#rewardOk").onclick=()=>{
  const nombre=$("#rewardName").value.trim(); if(!nombre) return toast("Nombre requerido","⚠️");
  snapshot(); const g=grupo();
  const obj={ nombre, desc:$("#rewardDesc").value.trim(), costo:+$("#rewardCost").value||0, icono:$("#rewardIcon").value||"🎁", tipo:$("#rewardType").value, activa:$("#rewardActive").value==="true", descuenta:$("#rewardDeduct").checked };
  if(rewardEditId){ Object.assign(g.recompensas.find(x=>x.id===rewardEditId), obj); }
  else g.recompensas.push({ id:uid(), ...obj });
  guardar(); $("#dlgReward").close(); renderRewards(); toast("Recompensa guardada","🎁","pos");
};
let redeemId=null;
function abrirCanje(id){
  redeemId=id; const r=grupo().recompensas.find(x=>x.id===id);
  $("#redeemTitle").textContent=`Canjear: ${r.nombre}`;
  $("#redeemSub").textContent=`${r.icono} ${r.costo} pts · ${r.descuenta?"descuenta puntos":"queda como logro"}`;
  const sel=$("#redeemTarget"); sel.innerHTML="";
  if(r.tipo==="grupal"){ const o=document.createElement("option"); o.value="grupo"; o.textContent="Todo el grupo"; sel.appendChild(o); }
  else if(r.tipo==="equipo"){ Object.values(grupo().equipos||{}).forEach(t=>{ const o=document.createElement("option"); o.value="team:"+t.id; o.textContent="🛡️ "+t.nombre; sel.appendChild(o); }); }
  else { estudiantes().forEach(s=>{ const o=document.createElement("option"); o.value="est:"+s.id; o.textContent=`${s.nombre} (${neto(s)} pts)`; sel.appendChild(o); }); }
  if(!sel.children.length){ toast("No hay destinatarios para esta recompensa","⚠️"); return; }
  $("#dlgRedeem").showModal();
}
$("#redeemOk").onclick=()=>{
  const r=grupo().recompensas.find(x=>x.id===redeemId); const target=$("#redeemTarget").value;
  snapshot(); const g=grupo();
  let nombreDest="";
  if(target==="grupo"){
    if(r.descuenta){ if(g.puntosGrupo<r.costo) return toast("Puntos de grupo insuficientes","⚠️","neg"); g.puntosGrupo-=r.costo; }
    nombreDest="el grupo "+g.nombre;
  } else if(target.startsWith("team:")){
    const t=g.equipos[target.slice(5)];
    if(r.descuenta){ if((t.puntos||0)<r.costo) return toast("Puntos del equipo insuficientes","⚠️","neg"); t.puntos-=r.costo; }
    nombreDest="el equipo "+t.nombre;
  } else {
    const s=g.estudiantes[target.slice(4)];
    if(r.descuenta){ if(neto(s)<r.costo) return toast("Puntos insuficientes","⚠️","neg"); s.puntosNeg=(s.puntosNeg||0)+r.costo; }
    s.recompensas.push({ id:uid(), nombre:r.nombre, icono:r.icono, fecha:new Date().toISOString() });
    s.historial.unshift({ id:uid(), fecha:new Date().toISOString(), tipo:"recompensa", grupoId:g.id, grupoNombre:g.nombre, estudianteId:s.id, estudianteNombre:s.nombre, puntos: r.descuenta?-r.costo:0, mensaje:`🎁 ${s.nombre} canjeó: ${r.nombre}` });
    nombreDest=s.nombre;
  }
  registrarEvento({ tipo:"recompensa", puntos: r.descuenta?-r.costo:0, mensaje:`🎁 ${nombreDest} canjeó la recompensa: ${r.nombre} ${r.icono}` });
  guardar(); $("#dlgRedeem").close(); refreshAll(); renderRewards(); confetti(); toast(`Recompensa canjeada 🎁`,"🎉","pos");
};

/* ============ 12. REPORTES ============ */
function renderReports(){
  if(!grupoActual||!grupo()){ $("#reportFilters").innerHTML=""; $("#reportBody").innerHTML=`<p class="hint">Selecciona un grupo.</p>`; return; }
  const g=grupo();
  const ests=estudiantes();
  const totalPos=ests.reduce((a,s)=>a+(s.puntosPos||0),0);
  const totalNeg=ests.reduce((a,s)=>a+(s.puntosNeg||0),0);
  const rankEst=ests.slice().sort((a,b)=>neto(b)-neto(a)).slice(0,10);
  const rankTeam=Object.values(g.equipos||{}).slice().sort((a,b)=>(b.puntos||0)-(a.puntos||0));
  $("#reportFilters").innerHTML=`<span class="chip">📅 ${ests.length} estudiantes</span><span class="chip">🛡️ ${rankTeam.length} equipos</span><span class="chip">🌟 ${g.puntosGrupo} pts de grupo</span>`;
  $("#reportBody").innerHTML=`
    <div class="report-grid">
      <div class="report-panel">
        <h3>Resumen</h3>
        <ul class="rank-list">
          <li class="rank-item">😊 Positivos <span class="r-pts">+${totalPos}</span></li>
          <li class="rank-item">🌱 A mejorar <span class="r-pts">${totalNeg}</span></li>
          <li class="rank-item">🌟 Puntos de grupo <span class="r-pts">${g.puntosGrupo}</span></li>
          <li class="rank-item">📜 Eventos registrados <span class="r-pts">${g.historial.length}</span></li>
        </ul>
      </div>
      <div class="report-panel">
        <h3>🏆 Ranking de estudiantes</h3>
        <ol class="rank-list">${rankEst.map((s,i)=>`<li class="rank-item"><span class="rank-pos">${i+1}</span><div class="monster-holder">${monsterHTML(s.monstruo.tipo,s.monstruo.color)}</div>${escapeHtml(s.nombre)}<span class="r-pts">${neto(s)}</span></li>`).join("")||"<li class='hint'>Sin datos</li>"}</ol>
      </div>
      <div class="report-panel">
        <h3>🛡️ Ranking de equipos</h3>
        <ol class="rank-list">${rankTeam.map((t,i)=>`<li class="rank-item"><span class="rank-pos">${i+1}</span><div class="monster-holder">${monsterHTML(t.tipo,t.color)}</div>${escapeHtml(t.nombre)}<span class="r-pts">${t.puntos||0}</span></li>`).join("")||"<li class='hint'>Sin equipos</li>"}</ol>
      </div>
      <div class="report-panel">
        <h3>🕑 Actividad reciente</h3>
        <ul class="timeline">${g.historial.slice(0,15).map(h=>timelineLi(h)).join("")||"<li class='hint'>Sin actividad</li>"}</ul>
      </div>
    </div>`;
}
function timelineLi(h){
  const cls = h.puntos>0?"pos":h.puntos<0?"neg":["recompensa","insignia"].includes(h.tipo)?"special":"";
  return `<li class="${cls}"><span class="t-date">${fmtFecha(h.fecha)}</span>${escapeHtml(h.mensaje)}</li>`;
}
function exportReporteCSV(){
  const g=grupo(); const rows=[["fecha","tipo","estudiante","equipo","categoria","puntos","mensaje"]];
  g.historial.forEach(h=>rows.push([h.fecha,h.tipo,h.estudianteNombre||"",h.equipoNombre||"",h.categoriaNombre||"",h.puntos||0,(h.mensaje||"").replace(/"/g,"'")]));
  const csv=rows.map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
  descargar(`reporte_${g.nombre}.csv`, csv, "text/csv");
}

/* ============ 13. MODO CLASE ============ */
function abrirModoClase(){
  if(!grupoActual||!grupo()) return toast("Selecciona un grupo primero","⚠️");
  renderModoClase(); $("#classMode").hidden=false; $("#classMode").classList.add("show"); document.body.style.overflow="hidden";
}
function cerrarModoClase(){ $("#classMode").classList.remove("show"); $("#classMode").hidden=true; document.body.style.overflow=""; }
function renderModoClase(){
  const g=grupo(); const ests=estudiantes().slice().sort((a,b)=>neto(b)-neto(a));
  const goal = g.meta? (()=>{ const pct=Math.min(100,Math.round(g.puntosGrupo/g.meta.objetivo*100));
    return `<div class="cm-goal"><div class="goal-head"><b>🎯 ${escapeHtml(g.meta.recompensa)}</b><span>${g.puntosGrupo}/${g.meta.objetivo}</span></div><div class="goal-bar"><div class="goal-fill" style="width:${pct}%"></div></div></div>`; })() : "";
  $("#classMode").innerHTML=`
    <div class="cm-top">
      <div class="cm-title"><div class="monster-holder">${monsterHTML(g.mascota.tipo,g.mascota.color)}</div><h2>${escapeHtml(g.nombre)}</h2></div>
      <button class="btn class" id="cmClose">✖ Salir</button>
    </div>
    ${goal}
    <div class="cm-grid">${ests.map(s=>`
      <div class="cm-card" data-id="${s.id}">
        <div class="monster-holder">${monsterHTML(s.monstruo.tipo,s.monstruo.color)}</div>
        <div class="cm-name">${escapeHtml(s.nombre)}</div>
        <div class="cm-net">${neto(s)}</div>
        <div class="cm-btns"><button class="btn success cmp">＋1</button><button class="btn warn cmm">－1</button></div>
      </div>`).join("")}</div>`;
  $("#cmClose").onclick=cerrarModoClase;
  $$(".cm-card").forEach(card=>{
    const id=card.dataset.id;
    card.querySelector(".cmp").onclick=()=>{ quickPoint(id,1); };
    card.querySelector(".cmm").onclick=()=>{ quickPoint(id,-1); };
  });
}
function quickPoint(id, delta){
  const cat = getCats().find(c=> delta>0? c.tipo==="positivo" : c.tipo==="mejora") || getCats()[0];
  confirmarPuntos({ estudianteIds:[id], cat, puntos: delta>0?1:-1, nota:"" });
  const card=$(`.cm-card[data-id="${id}"]`);
  if(card){ const s=grupo().estudiantes[id]; card.querySelector(".cm-net").textContent=neto(s); card.classList.add("bump"); setTimeout(()=>card.classList.remove("bump"),450); }
}

/* ============ 14. MODALES UTILITARIOS ============ */
function promptDialog({titulo, label, valor=""}, cb){
  $("#dlgTitle").textContent=titulo; $("#dlgLabel").textContent=label; $("#dlgInput").value=valor;
  const dlg=$("#dlgPrompt"); dlg.showModal();
  $("#dlgOk").onclick=()=>{ const v=$("#dlgInput").value.trim(); dlg.close(); cb(v); };
}

/* Modal de puntos */
let puntosCtx=null, puntosKind="positivo", puntosCat=null;
function abrirPuntos(ctx){
  if(!grupoActual) return;
  puntosCtx=ctx; puntosKind=ctx.kind||"positivo"; puntosCat=null;
  // título
  let target="";
  if(ctx.grupoCompleto) target="Todo el grupo";
  else if(ctx.equipoId) target="Equipo "+grupo().equipos[ctx.equipoId].nombre;
  else if(ctx.estudianteIds.length===1) target=grupo().estudiantes[ctx.estudianteIds[0]].nombre;
  else target=ctx.estudianteIds.length+" estudiantes";
  $("#pointsTitle").textContent="Asignar puntos";
  $("#pointsTarget").textContent="Para: "+target;
  $("#pointsNote").value="";
  $$("#pointsTabs .seg").forEach(b=>b.classList.toggle("active", b.dataset.kind===puntosKind));
  renderPointsCats();
  $("#manualRow").hidden = puntosKind!=="manual";
  updatePointsPreview();
  $("#dlgPoints").showModal();
}
function renderPointsCats(){
  const grid=$("#pointsCatGrid"); grid.innerHTML="";
  if(puntosKind==="manual"){ grid.innerHTML=`<p class="hint">Ajusta los puntos manualmente abajo y confirma.</p>`; puntosCat={ id:"manual", nombre:"Manual", icono:"✍️", color:"#680DBF", tipo:"manual" }; updatePointsPreview(); return; }
  const cats=getCats().filter(c=>c.tipo===puntosKind);
  if(!cats.length){ grid.innerHTML=`<p class="hint">No hay categorías de este tipo. Edítalas desde el menú del grupo.</p>`; }
  cats.forEach(c=>{
    const b=document.createElement("button"); b.className="cat-btn "+(c.tipo==="positivo"?"pos":c.tipo==="mejora"?"neg":"");
    const ptsLabel = c.tipo==="observacion"?"0":c.tipo==="mejora"?(c.resta?"-"+c.pts:"reg"):"+"+c.pts;
    b.innerHTML=`<span class="c-ico">${c.icono}</span><span>${escapeHtml(c.nombre)}</span><span class="c-pts">${ptsLabel}</span>`;
    b.onclick=()=>{ puntosCat=c; $$("#pointsCatGrid .cat-btn").forEach(x=>x.classList.remove("selected")); b.classList.add("selected"); updatePointsPreview(); };
    grid.appendChild(b);
  });
}
function calcPuntos(){
  if(!puntosCat) return null;
  if(puntosKind==="manual") return +$("#manualPoints").value||0;
  if(puntosCat.tipo==="observacion") return 0;
  if(puntosCat.tipo==="mejora") return puntosCat.resta? -puntosCat.pts : 0;
  return puntosCat.pts;
}
function updatePointsPreview(){
  const p=calcPuntos(); const prev=$("#pointsPreview"); const btn=$("#pointsConfirm");
  if(puntosCat==null){ prev.textContent="Selecciona una categoría"; prev.classList.remove("active"); btn.disabled=true; return; }
  prev.classList.add("active"); btn.disabled=false;
  const signo=p>0?`+${p}`:p<0?`${p}`:"observación (0)";
  prev.textContent=`${puntosCat.icono} ${puntosCat.nombre}: ${signo}`;
}
$("#pointsConfirm").onclick=()=>{
  const p=calcPuntos();
  const nota=$("#pointsNote").value.trim();
  const cat = puntosCat.id==="manual" ? { id:"manual", nombre: nota||"Ajuste manual", icono:"✍️" } : puntosCat;
  confirmarPuntos({ ...puntosCtx, cat, puntos:p, nota });
  $("#dlgPoints").close();
  selectMode=false; selectedIds.clear(); applySelectMode();
};
$$("#pointsTabs .seg").forEach(b=> b.onclick=()=>{ puntosKind=b.dataset.kind; puntosCat=null; $$("#pointsTabs .seg").forEach(x=>x.classList.remove("active")); b.classList.add("active"); $("#manualRow").hidden=puntosKind!=="manual"; renderPointsCats(); updatePointsPreview(); });
$("#manualPoints").oninput=updatePointsPreview;

/* Perfil */
function abrirPerfil(id){
  const s=grupo().estudiantes[id]; const g=grupo();
  const team=s.equipoId&&g.equipos[s.equipoId];
  const catCount={}; s.historial.forEach(h=>{ if(h.categoriaNombre&&h.puntos>0)catCount[h.categoriaNombre]=(catCount[h.categoriaNombre]||0)+1; });
  const topCats=Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const badges=(s.insignias||[]).map(bid=>{ const b=BADGES.find(x=>x.id===bid); return b?`<span class="badge-pill" title="${b.nombre}">${b.icono}</span>`:""; }).join("")||"<span class='hint'>Aún ninguna</span>";
  const rewards=(s.recompensas||[]).map(r=>`<span class="tag">${r.icono} ${escapeHtml(r.nombre)}</span>`).join(" ")||"<span class='hint'>Ninguna</span>";
  $("#profileContent").innerHTML=`
    <div class="profile-head">
      <div class="monster-holder">${monsterHTML(s.monstruo.tipo,s.monstruo.color)}</div>
      <div>
        <h3>${escapeHtml(s.nombre)}</h3>
        <p class="dialog-sub">${team?"🛡️ "+escapeHtml(team.nombre):"Sin equipo"}</p>
        <div class="badges-row" style="justify-content:flex-start">${badges}</div>
      </div>
    </div>
    <div class="profile-stats">
      <div class="ps"><b style="color:var(--pos)">+${s.puntosPos||0}</b>Positivos</div>
      <div class="ps"><b style="color:var(--neg)">${s.puntosNeg||0}</b>A mejorar</div>
      <div class="ps"><b style="color:var(--violeta)">${neto(s)}</b>Neto</div>
    </div>
    <div class="profile-section"><h4>🎁 Recompensas canjeadas</h4>${rewards}</div>
    <div class="profile-section"><h4>🏷️ Categorías frecuentes</h4>${topCats.map(([n,c])=>`<span class="tag">${escapeHtml(n)} ×${c}</span>`).join(" ")||"<span class='hint'>Sin datos</span>"}</div>
    <div class="profile-section"><h4>📜 Historial</h4><ul class="timeline">${s.historial.slice(0,30).map(h=>timelineLi(h)).join("")||"<li class='hint'>Sin actividad</li>"}</ul></div>
    <div class="dialog-actions">
      <button class="btn ghost" id="profTxt">⬇️ TXT</button>
      <button class="btn ghost" id="profJson">⬇️ JSON</button>
      <button class="btn primary" id="profClose">Cerrar</button>
    </div>`;
  $("#profClose").onclick=()=>$("#dlgProfile").close();
  $("#profTxt").onclick=()=>descargar(`${s.nombre}.txt`, `Reporte de ${s.nombre}\nPositivos: ${s.puntosPos}\nA mejorar: ${s.puntosNeg}\nNeto: ${neto(s)}\n\n`+s.historial.map(h=>`${fmtFecha(h.fecha)} · ${h.mensaje}`).join("\n"), "text/plain");
  $("#profJson").onclick=()=>descargar(`${s.nombre}.json`, JSON.stringify(s,null,2), "application/json");
  $("#dlgProfile").showModal();
}

/* Toast / confeti */
function toast(msg, ico="✅", tipo="", conUndo=false){
  const host=$("#toastHost"); const t=document.createElement("div"); t.className="toast "+tipo;
  t.innerHTML=`<span>${ico}</span><span>${escapeHtml(msg)}</span>`;
  if(conUndo){ const b=document.createElement("button"); b.textContent="Deshacer"; b.onclick=()=>{ deshacer(); t.remove(); }; t.appendChild(b); }
  host.appendChild(t); setTimeout(()=>{ t.style.opacity="0"; setTimeout(()=>t.remove(),250); }, conUndo?4500:2200);
}
function confetti(){
  const host=$("#confettiHost"); const colors=["#9b5de5","#16b673","#0C41C4","#CE0071","#ffbd00","#f15bb5"];
  for(let i=0;i<60;i++){
    const c=document.createElement("div"); c.className="confetti";
    c.style.left=Math.random()*100+"vw"; c.style.top="-20px";
    c.style.background=colors[rndInt(colors.length)];
    c.style.animationDuration=(1.5+Math.random()*1.5)+"s"; c.style.animationDelay=(Math.random()*.3)+"s";
    host.appendChild(c); setTimeout(()=>c.remove(),3200);
  }
}

/* ============ 15. EXPORTAR / IMPORTAR ============ */
function exportarDatos(){ descargar("musipuntos_data.json", JSON.stringify(data,null,2), "application/json"); }
function importarDatos(e){
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try{
      const json=JSON.parse(ev.target.result);
      if(!json.grupos) throw 0;
      if(json.version===4){ data=json; }
      else { // reusar migración tratándolo como prev
        localStorage.setItem("musipuntos_data_v3", JSON.stringify(json));
        localStorage.removeItem(STORAGE_KEY); cargarYMigrar();
      }
      // sanear
      Object.values(data.grupos).forEach(saneaGrupo);
      grupoActual = Object.keys(data.grupos)[0]||null;
      guardar(); refreshAll(); toast("Datos importados","✅","pos");
    }catch{ toast("Archivo inválido","⚠️","neg"); }
  };
  reader.readAsText(f);
  e.target.value="";
}
function saneaGrupo(g){
  g.mascota = g.mascota||{tipo:"sonriente",color:0};
  g.puntosGrupo = g.puntosGrupo||0;
  g.estudiantes = g.estudiantes||{}; g.equipos=g.equipos||{}; g.historial=g.historial||[];
  if(!g.categorias||!g.categorias.length) g.categorias=DEFAULT_CATS.map(c=>({id:uid(),resta:false,...c}));
  if(!g.recompensas) g.recompensas=DEFAULT_REWARDS.map(r=>({id:uid(),...r}));
  Object.values(g.estudiantes).forEach(s=>{
    s.monstruo=s.monstruo||{tipo:"sonriente",color:0};
    s.puntosPos=s.puntosPos||0; s.puntosNeg=s.puntosNeg||0;
    s.insignias=s.insignias||[]; s.recompensas=s.recompensas||[]; s.historial=s.historial||[];
    if(!("equipoId" in s)) s.equipoId=null;
  });
}

/* ============ 16. DATOS DEMO ============ */
function cargarDemo(){
  snapshot();
  const g=nuevoGrupoObj("Musicalitos");
  g.mascota={tipo:"musical",color:0};
  g.meta={ objetivo:60, recompensa:"Clase temática de percusión", _lograda:false };
  const nombres=["Sofía","Mateo","Valentina","Samuel","Isabella","Tomás","Luciana","Emilio"];
  const ids=[];
  nombres.forEach((n,i)=>{
    const id=uid(); ids.push(id);
    g.estudiantes[id]={ id, nombre:n, monstruo:{ tipo:MONSTER_TYPES[i%MONSTER_TYPES.length].id, color:i%MONSTER_COLORS.length }, equipoId:null, puntosPos:0, puntosNeg:0, insignias:[], recompensas:[], historial:[], timestamp:Date.now()+i };
  });
  // equipos
  const t1=uid(), t2=uid();
  g.equipos[t1]={ id:t1, nombre:"Monstruos Rítmicos", color:2, tipo:"rockero", puntos:0 };
  g.equipos[t2]={ id:t2, nombre:"Estrellas Melódicas", color:10, tipo:"estrella", puntos:0 };
  ids.forEach((id,i)=> g.estudiantes[id].equipoId = i%2===0? t1 : t2 );
  data.grupos[g.id]=g; grupoActual=g.id;
  // acciones de ejemplo
  const pos=g.categorias.filter(c=>c.tipo==="positivo");
  ids.forEach((id,i)=>{ const s=g.estudiantes[id]; const c=pos[i%pos.length]; aplicarPuntosEstudiante(s,c,c.pts,""); if(i%3===0) aplicarPuntosEstudiante(s,pos[(i+1)%pos.length],pos[(i+1)%pos.length].pts,""); });
  g.equipos[t1].puntos=8; g.equipos[t2].puntos=6; g.puntosGrupo=15;
  registrarEvento({ tipo:"puntos_grupales", puntos:5, categoriaNombre:"Buena energía", mensaje:"🌟 El grupo Musicalitos ganó +5 pts por buena energía." });
  guardar(); refreshAll(); toast("¡Demo cargada! 🎉","✨","pos"); confetti();
}

/* ============ 17. EVENTOS E INIT ============ */
function setView(v){
  vistaActual=v;
  $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.view===v));
  $$(".view").forEach(s=>s.hidden = s.id!=="view-"+v);
  if(v==="equipos")renderTeams(); if(v==="recompensas")renderRewards(); if(v==="reportes")renderReports();
}
function applySelectMode(){
  $("#btnSelectMode").setAttribute("aria-pressed", String(selectMode));
  $("#btnSelectMode").textContent = selectMode? "✖ Cancelar selección" : "☑️ Seleccionar";
  $("#btnGivePointsSelected").hidden = !selectMode || selectedIds.size===0;
  renderStudents();
}

function bindEventos(){
  $$(".tab").forEach(t=> t.onclick=()=>setView(t.dataset.view));
  $("#groupSelect").onchange=e=>{ grupoActual=e.target.value||null; refreshAll(); };
  $("#btnNewGroup").onclick = $("#btnEmptyNewGroup").onclick = ()=>{
    promptDialog({titulo:"Nuevo grupo", label:"Nombre del grupo"}, nombre=>{
      if(!nombre) return; snapshot();
      const g=nuevoGrupoObj(nombre); data.grupos[g.id]=g; grupoActual=g.id; guardar(); refreshAll(); toast("Grupo creado 🎵","➕","pos");
    });
  };
  $("#btnLoadDemo").onclick=cargarDemo;
  $("#btnGroupMenu").onclick=()=>{ if(!grupoActual) return toast("Selecciona un grupo","⚠️"); $("#dlgGroupMenu").showModal(); };
  $$("#dlgGroupMenu .menu-item").forEach(b=> b.onclick=()=>{ $("#dlgGroupMenu").close(); handleGroupMenu(b.dataset.act); });
  $("#btnAddStudent").onclick=agregarEstudiante;
  $("#btnGroupPoints").onclick=()=> abrirPuntos({ grupoCompleto:true });
  $("#btnSelectMode").onclick=()=>{ selectMode=!selectMode; if(!selectMode)selectedIds.clear(); applySelectMode(); };
  $("#btnGivePointsSelected").onclick=()=>{ if(selectedIds.size) abrirPuntos({ estudianteIds:[...selectedIds] }); };
  $("#btnRandom").onclick=()=>{ const e=estudiantes(); if(!e.length) return; const s=e[rndInt(e.length)]; toast(`🎲 ¡Le toca a ${s.nombre}!`,"🎲"); abrirPerfil(s.id); };
  $("#btnUndo").onclick=deshacer;
  $("#sortSelect").onchange=renderStudents;
  $("#btnClassMode").onclick=abrirModoClase;
  $("#btnExport").onclick=exportarDatos;
  $("#fileImport").onchange=importarDatos;
  $("#btnNewTeam").onclick=()=>{ if(!grupoActual) return toast("Selecciona un grupo","⚠️"); abrirEditorEquipo(null); };
  $("#btnNewReward").onclick=()=>{ if(!grupoActual) return toast("Selecciona un grupo","⚠️"); abrirEditorRecompensa(null); };
  $("#btnReportCsv").onclick=()=>{ if(grupoActual) exportReporteCSV(); };
  $("#btnReportJson").onclick=()=>{ if(grupoActual) descargar(`reporte_${grupo().nombre}.json`, JSON.stringify(grupo(),null,2),"application/json"); };
  // cerrar diálogos
  $$("[data-close]").forEach(b=> b.onclick=()=> b.closest("dialog").close());
  // categorías
  $("#btnAddCat").onclick=()=>{
    const n=$("#catNewName").value.trim(); if(!n) return;
    snapshot(); const tipo=$("#catNewType").value;
    getCats().push({ id:uid(), nombre:n, icono:$("#catNewIcon").value||"⭐", color:"#680DBF", pts:+$("#catNewPts").value||1, tipo, resta:tipo==="mejora" });
    $("#catNewName").value=""; guardar(); renderCatEditor();
  };
  $("#btnResetCats").onclick=()=>{ if(confirm("¿Restablecer categorías por defecto?")){ snapshot(); grupo().categorias=DEFAULT_CATS.map(c=>({id:uid(),resta:false,...c})); guardar(); renderCatEditor(); } };
  // meta
  $("#goalOk").onclick=()=>{ snapshot(); grupo().meta={ objetivo:+$("#goalTarget").value||50, recompensa:$("#goalReward").value.trim()||"Recompensa especial", _lograda:false }; guardar(); $("#dlgGoal").close(); refreshAll(); toast("Meta guardada","🎯","pos"); };
  $("#goalClear").onclick=()=>{ snapshot(); grupo().meta=null; guardar(); $("#dlgGoal").close(); refreshAll(); };
  // cerrar modales al hacer click en backdrop
  $$("dialog").forEach(d=> d.addEventListener("click", e=>{ if(e.target===d) d.close(); }));
}

function handleGroupMenu(act){
  const g=grupo();
  if(act==="rename"){ promptDialog({titulo:"Renombrar grupo", label:"Nuevo nombre", valor:g.nombre}, n=>{ if(!n)return; snapshot(); g.nombre=n; guardar(); refreshAll(); }); }
  else if(act==="delete"){ if(confirm(`¿Eliminar el grupo "${g.nombre}"?`)){ snapshot(); delete data.grupos[grupoActual]; grupoActual=Object.keys(data.grupos)[0]||null; guardar(); refreshAll(); } }
  else if(act==="goal"){ $("#goalTarget").value=g.meta?.objetivo||50; $("#goalReward").value=g.meta?.recompensa||""; $("#dlgGoal").showModal(); }
  else if(act==="cats"){ renderCatEditor(); $("#dlgCats").showModal(); }
  else if(act==="mascot"){ cambiarMascota(); }
}
function cambiarMascota(){
  // reusar editor simple: ciclar tipo/color mediante el editor de equipo-like inline
  const g=grupo();
  let tipo=g.mascota.tipo, color=g.mascota.color;
  // construir un pequeño diálogo reutilizando dlgTeam-like via prompt sencillo:
  const tipos=MONSTER_TYPES.map(m=>m.id);
  tipo = tipos[(tipos.indexOf(tipo)+1)%tipos.length];
  color = (color+1)%MONSTER_COLORS.length;
  snapshot(); g.mascota={tipo,color}; guardar(); updateGroupMascot();
  toast(`Mascota: ${MONSTER_TYPES.find(m=>m.id===tipo).nombre}`,"👾");
}

/* ============ PUENTE CON LA NUBE (firebase-sync.js) ============ */
window.MusiPuntosApp = {
  /* Devuelve el estado actual para sembrar la nube la primera vez */
  getData(){ return data; },
  /* Aplica datos recibidos de la escuela (tiempo real) */
  applyCloudData(remoto){
    if(!remoto || !remoto.grupos) return;
    // Si no hay cambios reales, evitamos refrescos innecesarios
    try{ if(JSON.stringify(remoto) === JSON.stringify(data)) return; }catch(e){}
    applyingRemote = true;
    data = remoto;
    Object.values(data.grupos).forEach(saneaGrupo);
    if(!grupoActual || !data.grupos[grupoActual]){
      grupoActual = Object.keys(data.grupos)[0] || null;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    refreshAll();
    if(!$("#classMode").hidden) renderModoClase();
    applyingRemote = false;
  }
};

(function init(){
  cargarYMigrar();
  Object.values(data.grupos).forEach(saneaGrupo);
  const keys=Object.keys(data.grupos);
  if(keys.length) grupoActual=keys[0];
  // monstruo del estado vacío
  setMonster($("#emptyMonster"), "antenas", 0);
  bindEventos();
  applySelectMode();
  refreshAll();
})();
