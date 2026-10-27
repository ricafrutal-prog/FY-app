import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

// Ocultar / mostrar la barra lateral. Se recuerda en este navegador y se comparte
// entre todas las barras (Gestión, Tareas, Finanzas, Sucursales) con un evento.
const CLAVE = "fy_sidebar_oculta";
const EVENTO = "fy-sidebar";
const leer = () => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } };

export function useSidebarOculta() {
  const [oculta, setOcultaEstado] = useState(leer);
  useEffect(() => {
    const sync = () => setOcultaEstado(leer());
    window.addEventListener(EVENTO, sync);
    return () => window.removeEventListener(EVENTO, sync);
  }, []);
  const setOculta = (v) => {
    try { localStorage.setItem(CLAVE, v ? "1" : "0"); } catch { /* sin almacenamiento */ }
    setOcultaEstado(v);
    window.dispatchEvent(new Event(EVENTO));
  };
  return [oculta, setOculta];
}

const botonBase = { width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 9, border: "1px solid #E1E5EA", background: "#fff", cursor: "pointer", padding: 0, flexShrink: 0 };

// Encabezado del panel lateral: título (y subtítulo) a la izquierda y el botón « para ocultarlo.
export function PanelCabecera({ titulo, subtitulo, onOcultar }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, padding: "2px 6px 18px" }}>
      <div>
        <div data-fy-titulo="1" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 11, marginTop: 3, letterSpacing: "0.06em", textTransform: "uppercase" }}>{subtitulo}</div>}
      </div>
      <button onClick={onOcultar} title="Ocultar barra lateral" aria-label="Ocultar barra lateral" style={botonBase}><ChevronsLeft size={15} color="#5B6370" /></button>
    </div>
  );
}

// Botón » para volver a mostrarla. `flotante` lo deja fijo arriba a la izquierda (para pantallas sin riel).
export function BotonMostrarBarra({ onMostrar, flotante }) {
  // Con el botón flotante, el encabezado se recorre un poco para que no lo tape (ver index.html).
  useEffect(() => {
    if (!flotante) return undefined;
    document.documentElement.classList.add("fy-boton-flotante");
    return () => document.documentElement.classList.remove("fy-boton-flotante");
  }, [flotante]);
  const estilo = flotante ? { ...botonBase, position: "fixed", top: 14, left: 14, zIndex: 40, boxShadow: "0 2px 8px rgba(16,24,40,.12)" } : { ...botonBase, marginBottom: 8 };
  return <button onClick={onMostrar} className="noprint" title="Mostrar barra lateral" aria-label="Mostrar barra lateral" style={estilo}><ChevronsRight size={15} color="#5B6370" /></button>;
}
