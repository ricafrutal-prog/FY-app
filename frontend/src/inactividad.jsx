import { useEffect, useRef, useState } from "react";
import { clearSession, getToken } from "./auth";

/* Cierre de sesión por inactividad.
   Si nadie toca el ratón, el teclado o la pantalla durante LIMITE_MIN minutos,
   la sesión se cierra sola. Un minuto antes aparece un aviso con cuenta
   regresiva para poder seguir. La "última actividad" se guarda en
   localStorage, así que cuenta para TODAS las pestañas abiertas y también si
   se cierra el navegador y se vuelve horas después: al regresar, pide login. */

export const LIMITE_MIN = 10;
const LIMITE_MS = LIMITE_MIN * 60 * 1000;
const AVISO_MS = 60 * 1000;
const KEY = "fy_last_activity";

export function marcarActividad() {
  try { localStorage.setItem(KEY, String(Date.now())); } catch { /* sin storage: no pasa nada */ }
}
export function limpiarActividad() {
  try { localStorage.removeItem(KEY); } catch { /* idem */ }
}
function ultimaActividad() {
  const v = Number(localStorage.getItem(KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

// Se usa al abrir la página: si ya hay sesión guardada pero pasó el límite sin
// actividad, se descarta. Regresa true si la sesión se descartó.
export function descartarSesionSiInactiva() {
  if (!getToken()) return false;
  const last = ultimaActividad();
  if (last && Date.now() - last >= LIMITE_MS) {
    clearSession();
    limpiarActividad();
    return true;
  }
  if (!last) marcarActividad(); // sesión anterior a esta función: empezar a contar desde ahora
  return false;
}

export default function GuardiaInactividad({ activo, onExpira }) {
  const [restante, setRestante] = useState(null); // segundos para el cierre, o null si no hay aviso
  const ultimoRegistro = useRef(0);

  useEffect(() => {
    if (!activo) return undefined;
    marcarActividad();

    const registrar = () => {
      const ahora = Date.now();
      if (ahora - ultimoRegistro.current < 2000) return; // no escribir en cada movimiento
      ultimoRegistro.current = ahora;
      marcarActividad();
    };
    const eventos = ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "wheel"];
    eventos.forEach((e) => window.addEventListener(e, registrar, { passive: true, capture: true }));

    const revisar = () => {
      const last = ultimaActividad() ?? Date.now();
      const inactivo = Date.now() - last;
      if (inactivo >= LIMITE_MS) {
        limpiarActividad();
        onExpira();
      } else if (inactivo >= LIMITE_MS - AVISO_MS) {
        setRestante(Math.ceil((LIMITE_MS - inactivo) / 1000));
      } else {
        setRestante(null);
      }
    };
    const t = setInterval(revisar, 1000);
    // Al volver a la pestaña (o despertar la computadora) se revisa de inmediato.
    document.addEventListener("visibilitychange", revisar);

    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", revisar);
      eventos.forEach((e) => window.removeEventListener(e, registrar, { capture: true }));
    };
  }, [activo, onExpira]);

  if (!activo || restante == null) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div role="alertdialog" aria-live="assertive" style={{ background: "#fff", borderRadius: 14, padding: "24px 26px", width: 340, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,.3)", display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#16161B" }}>¿Sigues ahí?</div>
        <div style={{ fontSize: 13, color: "#55555F", lineHeight: 1.45 }}>
          Por seguridad, tu sesión se cerrará en <strong>{restante}</strong> segundo{restante === 1 ? "" : "s"} por falta de actividad.
        </div>
        <button
          autoFocus
          onClick={() => { ultimoRegistro.current = 0; marcarActividad(); setRestante(null); }}
          style={{ marginTop: 6, border: "none", padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: "#5E8A17", color: "#fff" }}
        >
          Seguir conectado
        </button>
      </div>
    </div>
  );
}
