import { useState } from "react";
import { Truck, Clock, ClipboardList } from "lucide-react";
import { getUsername, getRole } from "./auth";
import RutaCortesModal from "./RutaCortesModal.jsx";
import AsistenciaAdmin from "./AsistenciaAdmin.jsx";

// Pantalla "Configuración de cuenta" (se abre desde el menú de Cuenta). Para todos los
// usuarios; dos columnas: en la primera van las opciones que le tocan a cada quien.
//   • Días de recolección de cortes: administrador_ricardo y jesus_segura.
//   • Horarios del personal: Recursos Humanos (Cesar y Yessica) y administrador_ricardo.
// La segunda columna queda libre para lo que se vaya agregando.
const RUTA_CORTES_USUARIOS = new Set(["administrador_ricardo", "jesus_segura"]);
const DUENO = "administrador_ricardo";
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66" };

export function opcionesConfig() {
  const u = getUsername();
  const out = [];
  if (RUTA_CORTES_USUARIOS.has(u)) out.push({ key: "ruta", titulo: "Días de recolección de cortes", desc: "Qué días se recogen los cortes de cada sucursal", Icono: Truck });
  if (getRole() === "rrhh" || u === DUENO) {
    out.push({ key: "horarios", titulo: "Horarios del personal", desc: "Alta de personal y hora de entrada y salida de cada empleado", Icono: Clock });
    out.push({ key: "asistencia", titulo: "Registro de asistencia", desc: "Editar o eliminar lo que capturaron las sucursales", Icono: ClipboardList });
  }
  return out;
}

export default function ConfigCuentaContenido({ onAbrirHorarios }) {
  const opciones = opcionesConfig();
  const [verRuta, setVerRuta] = useState(false);
  const [verAsistencia, setVerAsistencia] = useState(false);
  const abrir = (k) => { if (k === "ruta") setVerRuta(true); else if (k === "horarios") onAbrirHorarios && onAbrirHorarios(); else if (k === "asistencia") setVerAsistencia(true); };
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
          {opciones.length === 0 && <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 16, fontSize: 12.5, color: C.muted }}>Por ahora no hay opciones de configuración disponibles para tu cuenta.</div>}
        </div>
        <div />
      </div>
      {verRuta && <RutaCortesModal onCerrar={() => setVerRuta(false)} />}
    </div>
  );
}
