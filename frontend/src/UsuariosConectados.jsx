import { useCallback, useEffect, useState } from "react";
import { X, Users, LogOut } from "lucide-react";
import { apiFetch, getUsername } from "./auth";

// Quién está conectado ahora mismo. Solo lo abre el dueño de la plataforma
// (el servidor lo vuelve a comprobar: cualquier otro usuario recibe 403).
// Se actualiza solo cada 10 segundos.

const ROLES = { admin: "Administrador", sucursal: "Sucursal", inventarios: "Inventarios", auditor: "Auditor" };

function hace(seg) {
  if (seg < 5) return "ahora mismo";
  if (seg < 60) return `hace ${seg} s`;
  return `hace ${Math.floor(seg / 60)} min`;
}
function horaLocal(iso) {
  try { return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export default function UsuariosConectados({ onCerrar }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState("");
  const [cerrando, setCerrando] = useState("");
  const yo = getUsername();

  const cargar = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/sesiones");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cargar");
      setFilas(data);
      setError("");
    } catch (e) {
      setError(e.message || "No se pudo cargar");
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
  }, [cargar]);

  const cerrarDe = async (username) => {
    if (!window.confirm(`¿Cerrar la sesión de "${username}"? Tendrá que volver a iniciar sesión.`)) return;
    setCerrando(username);
    try {
      const res = await apiFetch(`/api/admin/sesiones/${encodeURIComponent(username)}/cerrar`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo cerrar");
      await cargar();
    } catch (e) {
      setError(e.message || "No se pudo cerrar");
    } finally {
      setCerrando("");
    }
  };

  const th = { padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#55555F", textTransform: "uppercase", letterSpacing: "0.04em" };
  const td = { padding: "10px", fontSize: 13, borderTop: "1px solid #F0EEE8" };

  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 640, maxWidth: "94vw", maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid #E6E3DB" }}>
          <Users size={18} color="#0F6E66" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#16161B" }}>Usuarios conectados</div>
            <div style={{ fontSize: 11.5, color: "#8C8C97" }}>En vivo · se actualiza cada 10 segundos</div>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: "6px 10px 16px" }}>
          {error && <div style={{ margin: "10px", fontSize: 12.5, color: "#D6453F", background: "#FBE7E5", borderRadius: 8, padding: "8px 10px" }}>{error}</div>}
          {!filas && !error && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#8C8C97" }}>Cargando…</div>}
          {filas && filas.length === 0 && <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "#8C8C97" }}>No hay nadie conectado en este momento.</div>}
          {filas && filas.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr><th style={th}>Usuario</th><th style={th}>Acceso</th><th style={th}>Desde</th><th style={th}>Última señal</th><th style={th} /></tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.username}>
                    <td style={td}>
                      <span title={f.enLinea ? "En línea" : "Sin señal reciente"} style={{ display: "inline-block", width: 8, height: 8, borderRadius: 99, marginRight: 8, background: f.enLinea ? "#2E9E5B" : "#E0A100" }} />
                      <strong>{f.username}</strong>{f.username === yo ? <span style={{ color: "#8C8C97" }}> (tú)</span> : null}
                    </td>
                    <td style={td}>{f.role === "sucursal" && f.sucursal ? f.sucursal : (ROLES[f.role] || f.role || "—")}</td>
                    <td style={td}>{horaLocal(f.iniciada)}</td>
                    <td style={{ ...td, color: f.enLinea ? "#16161B" : "#9A6700" }}>{hace(f.segundos)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {f.username !== yo && (
                        <button onClick={() => cerrarDe(f.username)} disabled={cerrando === f.username} title="Cerrar su sesión" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid #E6E3DB", background: "#fff", borderRadius: 8, padding: "5px 9px", fontSize: 11.5, fontWeight: 600, color: "#D6453F", cursor: "pointer", fontFamily: "inherit" }}>
                          <LogOut size={12} /> Cerrar sesión
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ margin: "12px 10px 0", fontSize: 11, color: "#8C8C97", lineHeight: 1.45 }}>
            Verde: con señal reciente. Amarillo: sin señal en el último minuto y medio (cerró la ventana o perdió internet); si no vuelve, su cuenta se libera sola a los 3 minutos.
          </div>
        </div>
      </div>
    </div>
  );
}
