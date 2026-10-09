import { useEffect, useRef, useState } from "react";
import { ChevronDown, Sparkles, Settings, LogOut, Users } from "lucide-react";
import { nombreParaSaludo, getUsername } from "./auth";
import PersonalizarCuenta from "./PersonalizarCuenta.jsx";
import UsuariosConectados from "./UsuariosConectados.jsx";

// Solo esta cuenta ve la opción "Usuarios conectados" (el servidor además
// rechaza a cualquier otra con 403, aunque alguien intentara llamarla).
const DUENO = "administrador_ricardo";

// Botón de cuenta ("Hola, {nombre} · Cuenta", como en Amazon) con su menú
// desplegable. NO se posiciona solo — va adentro de <CuentaBarra>, que es la
// franja blanca fija arriba de cada app (ver CuentaBarra.jsx). Así el botón
// vive dentro del flujo normal de la página y nunca tapa nada de lo que hay
// debajo. Lo usan tanto Gestión (App.jsx) como Sucursales (SucursalApp.jsx),
// cada una pasándole su propio "onCerrarSesion" porque cada app cierra
// sesión un poco distinto.
export default function AccountMenu({ onCerrarSesion }) {
  const [abierto, setAbierto] = useState(false);
  const [personalizando, setPersonalizando] = useState(false);
  const [verConectados, setVerConectados] = useState(false);
  const esDueno = getUsername() === DUENO;
  const wrapRef = useRef(null);
  const nombre = nombreParaSaludo();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  return (
    <>
      <div
        ref={wrapRef}
        className="noprint"
        style={{ position: "relative", display: "inline-block", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
      >
        <button
          onClick={() => setAbierto((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 9, background: "#16161B", color: "#fff", border: "none",
            borderRadius: 99, padding: "7px 14px 7px 16px", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <div style={{ textAlign: "left", lineHeight: 1.25 }}>
            <div style={{ fontSize: 10, opacity: 0.68, fontWeight: 500 }}>Hola, {nombre || "—"}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>Cuenta</div>
          </div>
          <ChevronDown size={14} style={{ opacity: 0.75, transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
        </button>

        {abierto && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 236, background: "#fff", borderRadius: 12, boxShadow: "0 14px 36px rgba(0,0,0,.25)", border: "1px solid #E6E3DB", overflow: "hidden" }}>
            <div style={{ padding: "13px 15px", borderBottom: "1px solid #F0EEE8" }}>
              <div style={{ fontSize: 10.5, color: "#8C8C97" }}>Hola,</div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#16161B" }}>{nombre || "—"}</div>
            </div>

            <button
              onClick={() => { setPersonalizando(true); setAbierto(false); }}
              style={itemStyle}
            >
              <Sparkles size={15} color="#0F6E66" /> Personalizar cuenta
            </button>

            {esDueno && (
              <button
                onClick={() => { setVerConectados(true); setAbierto(false); }}
                style={itemStyle}
              >
                <Users size={15} color="#0F6E66" /> Usuarios conectados
              </button>
            )}

            <button disabled style={{ ...itemStyle, color: "#B7B7BF", cursor: "default" }}>
              <Settings size={15} color="#B7B7BF" />
              <span style={{ flex: 1 }}>Configuración de cuenta</span>
              <span style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#B7B7BF", border: "1px solid #E6E3DB", borderRadius: 99, padding: "2px 6px" }}>Próx.</span>
            </button>

            <button
              onClick={onCerrarSesion}
              style={{ ...itemStyle, borderTop: "1px solid #F0EEE8", color: "#D6453F" }}
            >
              <LogOut size={15} color="#D6453F" /> Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {personalizando && <PersonalizarCuenta onCerrar={() => setPersonalizando(false)} />}
      {esDueno && verConectados && <UsuariosConectados onCerrar={() => setVerConectados(false)} />}
    </>
  );
}

const itemStyle = {
  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
  background: "none", border: "none", padding: "11px 15px", fontSize: 13, fontWeight: 600,
  color: "#16161B", cursor: "pointer", fontFamily: "inherit",
};
