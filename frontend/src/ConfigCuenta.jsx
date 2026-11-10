import { useState } from "react";
import { Truck, UserPlus, ClipboardList, Landmark, ListTree, Smartphone } from "lucide-react";
import Checador from "./Checador.jsx";
import { getUsername, getRole } from "./auth";
import RutaCortesModal from "./RutaCortesModal.jsx";
import AsistenciaAdmin from "./AsistenciaAdmin.jsx";
import TesoreriaAdmin from "./TesoreriaAdmin.jsx";
import CategoriasTesoreria from "./CategoriasTesoreria.jsx";

// Pantalla "Configuración de cuenta" (se abre desde el menú de Cuenta). Para todos los
// usuarios; dos columnas: en la primera van las opciones que le tocan a cada quien.
//   • Días de recolección de cortes: administrador_ricardo y jesus_segura.
//   • Horarios del personal: Recursos Humanos (Cesar y Yessica) y administrador_ricardo.
// La segunda columna queda libre para lo que se vaya agregando.
const RUTA_CORTES_USUARIOS = new Set(["administrador_ricardo", "administrador_ramiro", "administrador_carlos", "jesus_segura"]);
const DUENOS = new Set(["administrador_ricardo", "administrador_ramiro", "administrador_carlos"]);
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66" };

export function opcionesConfig() {
  const u = getUsername();
  const out = [];
  if (RUTA_CORTES_USUARIOS.has(u)) out.push({ key: "ruta", titulo: "Días de recolección de cortes", desc: "Qué días se recogen los cortes de cada sucursal", Icono: Truck });
  if (getRole() === "rrhh" || DUENOS.has(u)) {
    out.push({ key: "horarios", titulo: "Alta de personal", desc: "Dar de alta personal (de sucursal o fuera de ella), con su puesto, horario y sueldo", Icono: UserPlus });
    out.push({ key: "asistencia", titulo: "Registro de asistencia", desc: "Editar o eliminar lo que capturaron las sucursales", Icono: ClipboardList });
    out.push({ key: "checador", titulo: "Checador en el celular", desc: "Red y ubicación de cada sucursal, y el celular de cada empleado", Icono: Smartphone });
  }
  if (DUENOS.has(u)) out.push({ key: "tesoreria", titulo: "Tesorería", desc: "Responsables de la captura, saldo inicial, y editar o eliminar capturas", Icono: Landmark });
  if (RUTA_CORTES_USUARIOS.has(u)) out.push({ key: "categorias", titulo: "Categorías de Tesorería", desc: "Opciones de Categoría, Subcategoría, Detalle y Nombre para capturar", Icono: ListTree });
  return out;
}

// `extra`: más opciones (ya armadas) que se agregan al final de la primera columna.
export default function ConfigCuentaContenido({ onAbrirHorarios, extra = null }) {
  const opciones = opcionesConfig();
  const [verRuta, setVerRuta] = useState(false);
  const [verAsistencia, setVerAsistencia] = useState(false);
  const [verTesoreria, setVerTesoreria] = useState(false);
  const [verCategorias, setVerCategorias] = useState(false);
  const [verChecador, setVerChecador] = useState(false);
  const abrir = (k) => { if (k === "checador") setVerChecador(true); else if (k === "ruta") setVerRuta(true); else if (k === "horarios") onAbrirHorarios && onAbrirHorarios(); else if (k === "asistencia") setVerAsistencia(true); else if (k === "tesoreria") setVerTesoreria(true); else if (k === "categorias") setVerCategorias(true); };
  if (verChecador) {
    return (
      <div>
        <button onClick={() => setVerChecador(false)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Configuración de cuenta</button>
        <Checador />
      </div>
    );
  }
  if (verCategorias) {
    return (
      <div>
        <button onClick={() => setVerCategorias(false)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Configuración de cuenta</button>
        <CategoriasTesoreria />
      </div>
    );
  }
  if (verTesoreria) {
    return (
      <div>
        <button onClick={() => setVerTesoreria(false)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Configuración de cuenta</button>
        <TesoreriaAdmin />
      </div>
    );
  }
  if (verAsistencia) {
    return (
      <div>
        <button onClick={() => setVerAsistencia(false)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Configuración de cuenta</button>
        <AsistenciaAdmin />
      </div>
    );
  }
  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 20px", color: C.ink }}>Configuración de cuenta</h1>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 380px) 1fr", gap: 24, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 10 }}>
          {opciones.map(({ key, titulo, desc, Icono }) => (
            <button key={key} onClick={() => abrir(key)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", fontFamily: "inherit" }}>
              <Icono size={20} color={C.brand} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{titulo}</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{desc}</div>
              </div>
            </button>
          ))}
          {extra}
          {opciones.length === 0 && !extra && <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: C.muted }}>Por ahora no hay opciones de configuración disponibles para tu cuenta.</div>}
        </div>
        <div />
      </div>
      {verRuta && <RutaCortesModal onCerrar={() => setVerRuta(false)} />}
    </div>
  );
}
