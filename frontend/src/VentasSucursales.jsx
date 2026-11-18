import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "./auth";
import { leerArchivoVentas } from "./ventasOdooParser.js";

// Ventas de sucursales: total de venta por sucursal y por día.
// Pestañas: Propias y Franquicias. La franquicia San Miguel se muestra del lado de las Propias.
// Los datos se cargan subiendo el reporte de ventas de Odoo (Punto de venta → Reportes), que trae
// todas las sucursales juntas. Volver a subir un periodo reemplaza esos días.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", ok: "#2E9E5B" };
const EsSanMiguel = (s) => /san\s*miguel/i.test(s);
const pad = (n) => String(n).padStart(2, "0");
const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sumarDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDe(d); };
const dinero = (n) => (n == null ? "" : Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }));
const corto = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const rangoMes = (offset = 0) => { const h = new Date(); const ini = new Date(h.getFullYear(), h.getMonth() + offset, 1); const fin = offset === 0 ? h : new Date(h.getFullYear(), h.getMonth() + offset + 1, 0); return [isoDe(ini), isoDe(fin)]; };

async function llamar(metodo, url, cuerpo) {
  const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "No se pudo completar la acción");
  return d;
}

export default function VentasSucursales() {
  const [pestana, setPestana] = useState("propias");
  const [[desde, hasta], setRango] = useState(() => rangoMes(0));
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [vista, setVista] = useState(null); // { archivo, resultado } antes de guardar
  const [sucManual, setSucManual] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) return;
    setCargando(true); setError("");
    try { setFilas((await llamar("GET", `/api/ventas-sucursales?desde=${desde}&hasta=${hasta}`)).filas); }
    catch (e) { setError(e.message); setFilas([]); }
    setCargando(false);
  }, [desde, hasta]);
  useEffect(() => { cargar(); }, [cargar]);

  // Qué ventas van en cada pestaña: San Miguel (que viene del Odoo de franquicias) se cuenta como propia.
  const visibles = useMemo(() => filas.filter((f) => (pestana === "propias" ? f.tipo === "propias" || EsSanMiguel(f.sucursal) : f.tipo === "franquicias" && !EsSanMiguel(f.sucursal))), [filas, pestana]);
  const dias = useMemo(() => { const out = []; for (let d = desde; d <= hasta && out.length < 400; d = sumarDias(d, 1)) out.push(d); return out; }, [desde, hasta]);
  const verDias = dias.length <= 45;
  const tabla = useMemo(() => {
    const m = new Map();
    for (const f of visibles) {
      if (!m.has(f.sucursal)) m.set(f.sucursal, { sucursal: f.sucursal, dias: {}, total: 0 });
      const r = m.get(f.sucursal);
      r.dias[f.fecha] = (r.dias[f.fecha] || 0) + f.total;
      r.total += f.total;
    }
    return [...m.values()].sort((a, b) => a.sucursal.localeCompare(b.sucursal, "es"));
  }, [visibles]);
  const totalesDia = useMemo(() => { const t = {}; for (const r of tabla) for (const [d, v] of Object.entries(r.dias)) t[d] = (t[d] || 0) + v; return t; }, [tabla]);
  const granTotal = tabla.reduce((s, r) => s + r.total, 0);

  const elegirArchivo = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setMsg(""); setError(""); setSucManual("");
    try {
      const resultado = leerArchivoVentas(await archivo.arrayBuffer(), XLSX);
      if (!resultado.filas.length) { setError("No pude encontrar ventas por día en ese archivo. Verifica que sea el reporte de ventas de Odoo agrupado por punto de venta y día."); return; }
      setVista({ archivo: archivo.name, resultado });
    } catch { setError("No se pudo leer el archivo."); }
  };

  const sinSucursal = vista?.resultado.filas.some((f) => !f.sucursal);
  const guardar = async () => {
    if (sinSucursal && !sucManual.trim()) return;
    setGuardando(true); setError("");
    try {
      const filasOk = vista.resultado.filas.map((f) => ({ sucursal: f.sucursal || sucManual.trim(), fecha: f.fecha, total: f.total }));
      const r = await llamar("POST", "/api/ventas-sucursales/importar", { tipo: pestana, filas: filasOk });
      setMsg(`Guardado: ${r.sucursales} sucursal${r.sucursales === 1 ? "" : "es"}, del ${r.desde} al ${r.hasta}.`);
      setVista(null);
      if (r.desde < desde || r.hasta > hasta) setRango([r.desde < desde ? r.desde : desde, r.hasta > hasta ? r.hasta : hasta]);
      else await cargar();
    } catch (e) { setError(e.message); }
    setGuardando(false);
  };

  const btn = (activo) => ({ border: activo ? "none" : `1px solid ${C.line}`, background: activo ? C.brand : "#fff", color: activo ? "#fff" : C.ink, fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" });
  const campo = { padding: "6px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: "inherit", background: "#fff" };
  const celda = { padding: "7px 10px", borderBottom: `1px solid ${C.lineSoft}`, textAlign: "right", whiteSpace: "nowrap", fontSize: 12.5 };
  const hoy = isoDe(new Date());

  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px", color: C.ink }}>Ventas de sucursales</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Venta total por sucursal y por día, tomada de los reportes de Odoo.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setPestana("propias")} style={btn(pestana === "propias")}>Ventas propias</button>
        <button onClick={() => setPestana("franquicias")} style={btn(pestana === "franquicias")}>Ventas franquicias</button>
        <div style={{ flex: 1 }} />
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={elegirArchivo} style={{ display: "none" }} />
        <button onClick={() => inputRef.current?.click()} style={{ ...btn(false), borderColor: C.brand, color: C.brand }}>Subir reporte de Odoo ({pestana === "propias" ? "propias" : "franquicias"})</button>
      </div>

      {pestana === "propias" && <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>San Miguel se muestra aquí aunque su venta venga del Odoo de franquicias.</div>}
      {error && <div style={{ background: "#FBE7E5", color: C.bad, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 12 }}>{error}</div>}
      {msg && <div style={{ background: "#E3F4EA", color: C.ok, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>{msg}</div>}

      {vista && (
        <div style={{ background: "#fff", border: `1px solid ${C.brand}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Revisa antes de guardar</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>{vista.archivo} · se guardará como <b>{pestana === "propias" ? "ventas propias" : "ventas de franquicias"}</b>.</div>
          {(() => {
            const f = vista.resultado.filas;
            const sucs = [...new Set(f.map((x) => x.sucursal).filter(Boolean))];
            const fechas = f.map((x) => x.fecha).sort();
            const total = f.reduce((s, x) => s + x.total, 0);
            return (
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <div>{sucs.length ? `${sucs.length} sucursales` : "Una sola sucursal"} · {f.length} registros · del {fechas[0]} al {fechas[fechas.length - 1]}</div>
                <div>Venta total del archivo: <b>{dinero(total)}</b></div>
                {sucs.length > 0 && <div style={{ color: C.muted, fontSize: 12 }}>{sucs.slice(0, 12).join(", ")}{sucs.length > 12 ? "…" : ""}</div>}
                {sucs.length > 0 && fechas[0] === fechas[fechas.length - 1] && <div style={{ color: C.muted, fontSize: 12 }}>Este reporte trae el detalle por sucursal de un solo día.</div>}
                {(vista.resultado.diarios?.length || 0) > 0 && <div style={{ color: C.muted, fontSize: 12 }}>También trae el total de otros {vista.resultado.diarios.length} días, pero sin desglose por sucursal; esos días no se guardan.</div>}
              </div>
            );
          })()}
          {vista.resultado.avisos.map((a) => <div key={a} style={{ fontSize: 12, color: "#B07A12", marginTop: 6 }}>{a}</div>)}
          {sinSucursal && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Este archivo no dice de qué sucursal es. Escribe el nombre:</div>
              <input value={sucManual} onChange={(e) => setSucManual(e.target.value)} placeholder="Ej. Mitras" style={{ ...campo, width: 240 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={guardar} disabled={guardando || (sinSucursal && !sucManual.trim())} style={{ ...btn(true), opacity: guardando || (sinSucursal && !sucManual.trim()) ? 0.5 : 1 }}>{guardando ? "Guardando…" : "Guardar ventas"}</button>
            <button onClick={() => setVista(null)} style={btn(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: C.muted }}>Del</span>
        <input type="date" value={desde} max={hasta} onChange={(e) => e.target.value && setRango([e.target.value, hasta])} style={campo} />
        <span style={{ fontSize: 12, color: C.muted }}>al</span>
        <input type="date" value={hasta} min={desde} onChange={(e) => e.target.value && setRango([desde, e.target.value])} style={campo} />
        <button onClick={() => setRango(rangoMes(0))} style={btn(false)}>Este mes</button>
        <button onClick={() => setRango(rangoMes(-1))} style={btn(false)}>Mes pasado</button>
        <button onClick={() => setRango([sumarDias(hoy, -6), hoy])} style={btn(false)}>Últimos 7 días</button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, overflowX: "auto" }}>
        {cargando && <div style={{ padding: 20, fontSize: 13, color: C.muted }}>Cargando…</div>}
        {!cargando && tabla.length === 0 && <div style={{ padding: "28px 20px", textAlign: "center", color: C.muted, fontSize: 13 }}>No hay ventas cargadas de {pestana === "propias" ? "las sucursales propias" : "las franquicias"} en este periodo. Sube el reporte de Odoo con el botón de arriba.</div>}
        {!cargando && tabla.length > 0 && (
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...celda, textAlign: "left", position: "sticky", left: 0, background: "#fff", fontWeight: 700 }}>Sucursal</th>
                {verDias && dias.map((d) => <th key={d} style={{ ...celda, color: C.muted, fontWeight: 600 }}>{corto(d)}</th>)}
                <th style={{ ...celda, fontWeight: 700 }}>Total</th>
                <th style={{ ...celda, color: C.muted, fontWeight: 600 }}>Promedio por día</th>
              </tr>
            </thead>
            <tbody>
              {tabla.map((r) => {
                const n = Object.keys(r.dias).length;
                return (
                  <tr key={r.sucursal}>
                    <td style={{ ...celda, textAlign: "left", position: "sticky", left: 0, background: "#fff", fontWeight: 600 }}>{r.sucursal}</td>
                    {verDias && dias.map((d) => <td key={d} style={{ ...celda, color: r.dias[d] == null ? "#C8C8CF" : C.ink }}>{r.dias[d] == null ? "—" : dinero(r.dias[d])}</td>)}
                    <td style={{ ...celda, fontWeight: 700 }}>{dinero(r.total)}</td>
                    <td style={{ ...celda, color: C.muted }}>{dinero(n ? r.total / n : 0)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...celda, textAlign: "left", position: "sticky", left: 0, background: C.paper, fontWeight: 700 }}>Total</td>
                {verDias && dias.map((d) => <td key={d} style={{ ...celda, background: C.paper, fontWeight: 600 }}>{totalesDia[d] == null ? "—" : dinero(totalesDia[d])}</td>)}
                <td style={{ ...celda, background: C.paper, fontWeight: 700 }}>{dinero(granTotal)}</td>
                <td style={{ ...celda, background: C.paper }} />
              </tr>
            </tbody>
          </table>
        )}
      </div>
      {!verDias && tabla.length > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Con más de 45 días solo se muestran los totales. Acorta el periodo para ver cada día.</div>}
    </div>
  );
}
