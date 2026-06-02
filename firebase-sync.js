/* ===========================================================
   firebase-sync.js — Sincronización en la nube (Firestore)
   MusiPuntos · Musicala
   -----------------------------------------------------------
   Guarda TODA la información de la escuela en un único documento
   compartido (escuelas/musipuntos) y la mantiene en tiempo real
   entre todos los dispositivos. localStorage se usa como caché.
   =========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getFirestore, doc, onSnapshot, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQEf6uuVcaLubxuzmD_p76oQsmU7Y6Aj0",
  authDomain: "musipuntos.firebaseapp.com",
  projectId: "musipuntos",
  storageBucket: "musipuntos.firebasestorage.app",
  messagingSenderId: "539172840874",
  appId: "1:539172840874:web:20005a2d844584235ab7d3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ESCUELA_REF = doc(db, "escuelas", "musipuntos"); // documento compartido

let saveTimer = null;
let primerSnapshot = true;

/* Indicador visual de estado de sincronización */
function setBadge(texto, titulo, color){
  const b = document.getElementById("syncBadge");
  if(!b) return;
  b.textContent = texto;
  if(titulo) b.title = titulo;
  if(color) b.style.borderColor = color;
}

/* API expuesta a app.js */
window.MusiCloud = {
  enabled: true,
  /* Guarda con "debounce" para no escribir en cada clic */
  save(obj){
    clearTimeout(saveTimer);
    setBadge("☁️ Guardando…", "Sincronizando con la escuela…");
    saveTimer = setTimeout(async ()=>{
      try{
        await setDoc(ESCUELA_REF, { data: obj, updated: Date.now() });
        setBadge("☁️ Nube", "Sincronizado con la escuela", "#16b673");
      }catch(e){
        console.warn("[MusiCloud] error al guardar:", e?.code || e);
        setBadge("⚠️ Sin nube", "No se pudo sincronizar (revisa conexión/reglas)", "#e23b5a");
      }
    }, 800);
  }
};

/* Escucha en tiempo real los cambios de la escuela */
onSnapshot(ESCUELA_REF, (snap)=>{
  // Ignora los ecos de nuestras propias escrituras pendientes
  if(snap.metadata.hasPendingWrites) return;

  if(!snap.exists()){
    // Primera vez: aún no hay documento → subimos lo que tengamos localmente
    if(primerSnapshot && window.MusiPuntosApp){
      const local = window.MusiPuntosApp.getData();
      if(local) window.MusiCloud.save(local);
    }
    primerSnapshot = false;
    setBadge("☁️ Nube", "Conectado a la escuela (vacío)", "#16b673");
    return;
  }

  primerSnapshot = false;
  const remoto = snap.data().data;
  if(remoto && window.MusiPuntosApp){
    window.MusiPuntosApp.applyCloudData(remoto);
  }
  setBadge("☁️ Nube", "Sincronizado con la escuela", "#16b673");
}, (err)=>{
  console.warn("[MusiCloud] error de conexión:", err?.code || err);
  setBadge("⚠️ Local", "Trabajando solo en este dispositivo", "#e8943a");
});
