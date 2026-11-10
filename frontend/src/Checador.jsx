import { useCallback, useEffect, useState } from "react";
import { apiFetch, getRole } from "./auth";

// Panel del checador en el celular: red y ubicación de la sucursal, y el celular de cada empleado.
// Lo usa la propia sucursal (Registro asistencia › Checador) y los gestores (Configuración de cuenta › Checador).
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", ok: "#2E9E5B", warn: "#B07A12" };
const campo = { padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box" };
const btn = (lleno, peligro) => ({ border: lleno ? "none" : `1px solid ${peligro ? C.bad : C.line}`, background: lleno ? C.brand : "#fff", color: lleno ? "#fff" : peligro ? C.bad : C.ink, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" });
const tarjeta = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 };
const hora = (iso) => { try { return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

async function llamar(metodo, url, cuerpo) {
  const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "No se pudo completar la acción");
  return d;
}
const miUbicacion = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) return reject(new Error("Este navegador no puede leer la ubicación."));
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }), () => reject(new Error("No se pudo leer la ubicación. Acepta el permiso de ubicación del navegador.")), { enableHighAccuracy: true, timeout: 20000 });
});

export default function Checador() {
  const gestor = getRole() !== "sucursal";
  const [sucursales, setSucursales] = useState([]);
  const [sucursal, setSucursal] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [codigos, setCodigos] = useState({}); // nombre -> { codigo, expira }
  const [ipManual, setIpManual] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!gestor) return;
    apiFetch("/api/lists/sucursalesAI").then((r) => r.json()).then((d) => { const l = Array.isArray(d) ? d : []; setSucursales(l); if (l.length) setSucursal((s) => s || l[0]); }).catch(() => {});
  }, [gestor]);

  const cargar = useCallback(async () => {
    if (gestor && !sucursal) return;
    try { setError(""); setDatos(await llamar("GET", `/api/checador/panel${gestor ? `?sucursal=${encodeURIComponent(sucursal)}` : ""}`)); }
    catch (e) { setError(e.message); }
  }, [gestor, sucursal]);
  useEffect(() => { setDatos(null); cargar(); }, [cargar]);

  const accion = async (fn) => { setOcupado(true); setError(""); try { await fn(); await cargar(); } catch (e) { setError(e.message); } setOcupado(false); };
  const cfg = datos?.config;
  const sucNombre = datos?.sucursal;
  const guardarCfg = (cambios) => accion(() => llamar("PUT", "/api/checador/config", { sucursal: sucNombre, ...cambios }));
  const enlace = `${window.location.origin}/checar`;

  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px", color: C.ink }}>Checador en el celular</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 14 }}>El personal checa desde su celular con huella o rostro, conectado al Wi-Fi de la sucursal y estando en ella.</div>

      {gestor && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Sucursal</div>
          <select value={sucursal} onChange={(e) => setSucursal(e.target.value)} style={{ ...campo, width: 260 }}>{sucursales.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </div>
      )}
      {error && <div style={{ color: C.bad, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      {!datos && !error && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}

      {datos && (
        <>
          <div style={tarjeta}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Liga para checar</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <code style={{ background: C.paper, padding: "6px 10px", borderRadius: 8, fontSize: 12.5 }}>{enlace}</code>
              <button onClick={() => navigator.clipboard?.writeText(enlace)} style={btn(false)}>Copiar</button>
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Cada empleado la abre en su celular (puede guardarla en la pantalla de inicio).</div>
          </div>

          <div style={tarjeta}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Red (Wi-Fi) de {sucNombre}</div>
            {cfg.ips.length === 0 && <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Todavía no hay red registrada: nadie podrá checar en esta sucursal hasta que se registre.</div>}
            {cfg.ips.map((x) => (
              <div key={x.clave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.paper}`, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5 }}><code>{x.clave}</code> <span style={{ fontSize: 10.5, fontWeight: 700, color: x.aprobada ? C.ok : C.warn, background: x.aprobada ? "#E3F4EA" : "#FBF1DC", borderRadius: 99, padding: "2px 8px", marginLeft: 6 }}>{x.aprobada ? "Aprobada" : "Pendiente de aprobar"}</span>{x.agregadaPor ? <span style={{ color: C.muted, fontSize: 11 }}> · {x.agregadaPor}</span> : null}</div>
                {datos.esGestor && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {!x.aprobada && <button disabled={ocupado} onClick={() => guardarCfg({ ips: cfg.ips.map((y) => (y.clave === x.clave ? { ...y, aprobada: true } : y)) })} style={btn(true)}>Aprobar</button>}
                    <button disabled={ocupado} onClick={() => window.confirm("¿Quitar esta red?") && guardarCfg({ ips: cfg.ips.filter((y) => y.clave !== x.clave) })} style={btn(false, true)}>Quitar</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
              <button disabled={ocupado} onClick={() => accion(() => llamar("POST", "/api/checador/red", { sucursal: sucNombre }))} style={btn(true)}>Registrar la red desde la que estoy entrando</button>
              <span style={{ fontSize: 11.5, color: C.muted }}>Tu red actual: <code>{datos.miRed || "—"}</code></span>
            </div>
            {datos.esGestor && datos.cabeceras && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 6 }}>Diagnóstico: X-Forwarded-For = {datos.cabeceras.xff || "—"} · CF = {datos.cabeceras.cf || "—"} · conexión = {datos.cabeceras.ip || "—"}</div>}
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Hazlo estando en el Wi-Fi de la sucursal.{datos.esGestor ? "" : " Un administrador debe aprobarla."} Si el internet de la sucursal cambia de dirección, hay que registrarla otra vez.</div>
            {datos.esGestor && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <input value={ipManual} onChange={(e) => setIpManual(e.target.value)} placeholder="Agregar una IP a mano" style={{ ...campo, width: 220 }} />
                <button disabled={ocupado || !ipManual.trim()} onClick={() => accion(async () => { await llamar("POST", "/api/checador/red", { sucursal: sucNombre, ip: ipManual.trim() }); setIpManual(""); })} style={btn(false)}>Agregar</button>
              </div>
            )}
          </div>

          <div style={tarjeta}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Ubicación de {sucNombre}</div>
            <div style={{ fontSize: 12.5, marginBottom: 8, color: cfg.lat == null ? C.warn : C.ink }}>{cfg.lat == null ? "Sin ubicación registrada" : `Registrada (${cfg.lat.toFixed(5)}, ${cfg.lng.toFixed(5)})`}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              {(cfg.lat == null || datos.esGestor) && (
                <button disabled={ocupado} onClick={() => accion(async () => { const p = await miUbicacion(); await llamar("POST", "/api/checador/ubicacion", { sucursal: sucNombre, lat: p.lat, lng: p.lng }); })} style={btn(true)}>{cfg.lat == null ? "Usar mi ubicación actual" : "Actualizar con mi ubicación actual"}</button>
              )}
              {datos.esGestor && (
                <>
                  <label style={{ fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 6 }}>Radio (m)
                    <input type="number" min={30} max={1000} defaultValue={cfg.radio} key={cfg.radio} onBlur={(e) => Number(e.target.value) !== cfg.radio && guardarCfg({ radio: Number(e.target.value) })} style={{ ...campo, width: 80 }} />
                  </label>
                  <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!cfg.exigirUbicacion} onChange={(e) => guardarCfg({ exigirUbicacion: e.target.checked })} /> Exigir ubicación al checar
                  </label>
                </>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>Hazlo parado dentro de la sucursal. Solo se puede checar a menos de {cfg.radio} metros.</div>
          </div>

          <div style={tarjeta}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Personal y su celular</div>
            {datos.empleados.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No hay personal dado de alta en esta sucursal.</div>}
            {datos.empleados.map((e) => {
              const c = codigos[e.nombre];
              const vigente = c && c.expira > Date.now();
              return (
                <div key={e.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.paper}`, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.nombre}</div>
                    <div style={{ fontSize: 11.5, color: e.dispositivo ? C.ok : C.warn }}>{e.dispositivo ? `Celular registrado${e.ultimoUso ? ` · último uso ${hora(e.ultimoUso)}` : ""}` : "Sin celular registrado"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {vigente && <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "0.12em", background: C.brandSoft, color: C.brand, borderRadius: 8, padding: "4px 12px" }}>{c.codigo}</span>}
                    <button disabled={ocupado} onClick={() => accion(async () => { const r = await llamar("POST", "/api/checador/codigo", { sucursal: sucNombre, nombre: e.nombre }); setCodigos((p) => ({ ...p, [e.nombre]: r })); })} style={btn(false)}>{e.dispositivo ? "Código para cambiar de celular" : "Generar código"}</button>
                    {datos.esGestor && e.dispositivo && <button disabled={ocupado} onClick={() => window.confirm(`¿Quitar el celular de ${e.nombre}?`) && accion(() => llamar("DELETE", "/api/checador/dispositivo", { sucursal: sucNombre, nombre: e.nombre }))} style={btn(false, true)}>Quitar celular</button>}
                  </div>
                </div>
              );
            })}
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>El código dura 15 minutos y sirve una sola vez. El empleado abre la liga, elige "Registrar mi celular" y escribe el código.</div>
          </div>
        </>
      )}
    </div>
  );
}
