import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./auth";
import HoraInput from "./HoraInput.jsx";
import { ESTATUS, ESTATUS_CON_HORAS, ESTATUS_COLOR, horasDeRegistro, fmtHoras } from "./asistenciaUtil";

// Configuración de cuenta › Registro de asistencia: corregir o eliminar lo que las
// sucursales capturaron. Solo Recursos Humanos y administrador_ricardo.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66", bad: "#D6453F" };
const campo = { padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };
const nombreEstatus = (e) => (e === "Asistió" ? "Asistencia" : e);
const OPCIONES = ["Asistió", "Retardo", "Falta", "Descanso", "Permiso", "Vacaciones", "Pendiente"];

async function llamar(metodo, cuerpo) {
  const r = await apiFetch("/api/nomina/asistencia", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "No se pudo completar la acción");
  return d;
}

export default function AsistenciaAdmin() {
  const [docs, setDocs] = useState(null);
  const [error, setError] = useState("");
  const [sucursal, setSucursal] = useState("");
  const [mes, setMes] = useState("");
  const [editando, setEditando] = useState(null); // { id, sucursal, fecha, registros: [...] }
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    apiFetch("/api/collections/asistencia_sucursal").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setDocs(d); else setError("No se pudo cargar la asistencia"); }).catch(() => setError("No se pudo cargar la asistencia"));
  }, []);

  const sucursales = useMemo(() => [...new Set((docs || []).map((d) => d.sucursal))].sort((a, b) => a.localeCompare(b, "es")), [docs]);
  const filtrados = useMemo(() => (docs || []).filter((d) => (!sucursal || d.sucursal === sucursal) && (!mes || d.fecha.startsWith(mes))).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.sucursal.localeCompare(b.sucursal, "es")), [docs, sucursal, mes]);

  const eliminar = async (d) => {
    if (!window.confirm(`¿Eliminar la asistencia de ${d.sucursal} del ${d.fecha}? No se puede deshacer; la sucursal podrá volver a capturar ese día.`)) return;
    try { await llamar("DELETE", { sucursal: d.sucursal, fecha: d.fecha }); setDocs((p) => p.filter((x) => x.id !== d.id)); if (editando?.id === d.id) setEditando(null); }
    catch (e) { window.alert(e.message); }
  };
  const ponerReg = (empleado, cambios) => setEditando((p) => ({ ...p, registros: p.registros.map((r) => (r.empleado === empleado ? { ...r, ...cambios } : r)) }));
  const cambiarEstatus = (r, estatus) => ponerReg(r.empleado, ESTATUS_CON_HORAS.has(estatus) ? { estatus } : { estatus, entrada: "", salida: "" });
  const guardar = async () => {
    setGuardando(true);
    try {
      const nuevo = await llamar("PUT", { sucursal: editando.sucursal, fecha: editando.fecha, registros: editando.registros.map(({ empleado, estatus, entrada, salida }) => ({ empleado, estatus, entrada, salida })) });
      setDocs((p) => p.map((x) => (x.id === nuevo.id ? nuevo : x)));
      setEditando(null);
    } catch (e) { window.alert(e.message); }
    setGuardando(false);
  };

  if (editando) {
    const total = editando.registros.reduce((s, r) => s + horasDeRegistro(r), 0);
    return (
      <div>
        <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Registro de asistencia</button>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px", color: C.ink }}>Editar asistencia</h1>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>{editando.sucursal} · {editando.fecha}</div>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "grid", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.8fr 0.8fr 0.5fr", gap: 8, fontSize: 11, fontWeight: 700, color: C.muted, padding: "0 10px" }}>
            <div>Empleado</div><div>Estatus</div><div>Entrada</div><div>Salida</div><div style={{ textAlign: "right" }}>Horas</div>
          </div>
          {editando.registros.map((r) => {
            const conHoras = ESTATUS_CON_HORAS.has(r.estatus);
            const col = ESTATUS_COLOR[r.estatus];
            return (
              <div key={r.empleado} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.8fr 0.8fr 0.5fr", gap: 8, alignItems: "center", background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.ink }}>{r.empleado}{r.puesto && <div style={{ fontSize: 11, fontWeight: 400, color: C.muted }}>{r.puesto}</div>}</div>
                <select value={r.estatus} onChange={(e) => cambiarEstatus(r, e.target.value)} style={{ ...campo, color: col?.color }}>
                  {OPCIONES.map((o) => <option key={o} value={o}>{nombreEstatus(o)}</option>)}
                </select>
                <HoraInput value={r.entrada || ""} disabled={!conHoras} onChange={(h) => ponerReg(r.empleado, { entrada: h })} style={{ ...campo, opacity: conHoras ? 1 : 0.5, width: "100%" }} />
                <HoraInput value={r.salida || ""} disabled={!conHoras} onChange={(h) => ponerReg(r.empleado, { salida: h })} style={{ ...campo, opacity: conHoras ? 1 : 0.5, width: "100%" }} />
                <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: C.ink }}>{conHoras ? fmtHoras(horasDeRegistro(r)) : "—"}</div>
              </div>
            );
          })}
          <div style={{ textAlign: "right", fontSize: 12.5, fontWeight: 700, color: C.ink, padding: "4px 10px" }}>Total de horas: {fmtHoras(total)}</div>
        </div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Asistencia y Retardo llevan hora de entrada y salida; los demás estatus no. Aquí tú decides el estatus, aunque la sucursal haya capturado otro.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setEditando(null)} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ border: "none", background: C.brand, color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 22px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", opacity: guardando ? 0.6 : 1 }}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px", color: C.ink }}>Registro de asistencia</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Corrige o elimina lo que capturaron las sucursales.</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Sucursal</div>
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} style={{ ...campo, minWidth: 220 }}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Mes</div>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={campo} />
        </div>
      </div>
      {error && <div style={{ color: C.bad, fontSize: 13 }}>{error}</div>}
      {!docs && !error && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}
      {docs && filtrados.length === 0 && <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 18, fontSize: 13, color: C.muted, textAlign: "center" }}>No hay capturas con este filtro.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {filtrados.map((d) => (
          <div key={d.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{d.fecha} · {d.sucursal}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{d.registros.length} persona{d.registros.length === 1 ? "" : "s"} · {fmtHoras(d.registros.reduce((s, r) => s + horasDeRegistro(r), 0))} horas{d.capturadoPor ? ` · capturó ${d.capturadoPor}` : ""}{d.editadoPor ? ` · editado por ${d.editadoPor}` : ""}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditando({ id: d.id, sucursal: d.sucursal, fecha: d.fecha, registros: d.registros.map((r) => ({ ...r })) })} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Editar</button>
              <button onClick={() => eliminar(d)} style={{ border: `1px solid ${C.bad}`, background: "#fff", color: C.bad, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Eliminar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
