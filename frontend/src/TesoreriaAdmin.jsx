import { useEffect, useMemo, useState } from "react";
import { apiFetch, getUsername } from "./auth";
import { SALDO_ID, movimientoVacio, tesNum, limpiarMonto, soloDigitos, movimientoValido, totalesDe } from "./tesoreriaUtil";

// Configuración de cuenta › Tesorería: editar o eliminar lo que se capturó en Tesorería
// (y corregir el saldo inicial). Solo el nivel alto (administradores).
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66", bad: "#D6453F", ok: "#2E9E5B" };
const campo = { padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", width: "100%", minWidth: 0 };
const dinero = (n) => `${n < 0 ? "-" : ""}$${Math.abs(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLS = "70px 1fr 1fr 1fr 1.2fr 2.2fr 110px 110px 26px";
const ORDEN = ["folio", "categoria", "subcategoria", "detalle", "nombre", "concepto", "ingreso", "egreso"];
const ROTULOS = { folio: "Folio", categoria: "Categoría", subcategoria: "Subcategoría", detalle: "Detalle", nombre: "Nombre", concepto: "Concepto", ingreso: "Ingreso", egreso: "Egreso" };
const dosPalabras = (t) => { const p = t.split(/\s+/); return p.length > 2 ? p.slice(0, 2).join(" ") : t; };
const btn = (peligro, lleno) => ({ border: lleno ? "none" : `1px solid ${peligro ? C.bad : C.line}`, background: lleno ? C.brand : "#fff", color: lleno ? "#fff" : peligro ? C.bad : C.ink, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" });

async function llamar(metodo, url, cuerpo) {
  const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "No se pudo completar la acción");
  return d;
}

export default function TesoreriaAdmin() {
  const [capturas, setCapturas] = useState(null);
  const [saldo, setSaldo] = useState(undefined); // undefined = cargando, null = sin saldo inicial
  const [error, setError] = useState("");
  const [mes, setMes] = useState("");
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [saldoTxt, setSaldoTxt] = useState("");

  useEffect(() => {
    apiFetch("/api/collections/tesoreria_capturas").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCapturas(d); else setError("No se pudo cargar Tesorería"); }).catch(() => setError("No se pudo cargar Tesorería"));
    apiFetch("/api/collections/tesoreria_saldo").then((r) => r.json()).then((d) => {
      const doc = Array.isArray(d) ? d.find((x) => x.id === SALDO_ID) : null;
      setSaldo(doc || null);
      setSaldoTxt(doc ? String(doc.monto) : "");
    }).catch(() => setSaldo(null));
  }, []);

  const filtradas = useMemo(() => (capturas || []).filter((c) => !mes || c.fecha.startsWith(mes)).sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.id).localeCompare(String(a.id))), [capturas, mes]);

  const guardarSaldo = async () => {
    if (!String(saldoTxt).trim()) { window.alert("Escribe el saldo inicial."); return; }
    try {
      const doc = { ...(saldo || { id: SALDO_ID, creadoEn: new Date().toISOString(), creadoPor: getUsername() }), monto: tesNum(saldoTxt), editadoPor: getUsername() };
      await llamar(saldo ? "PUT" : "POST", saldo ? `/api/collections/tesoreria_saldo/${SALDO_ID}` : "/api/collections/tesoreria_saldo", doc);
      setSaldo(doc);
      window.alert("Saldo inicial guardado.");
    } catch (e) { window.alert(e.message); }
  };
  const eliminarCaptura = async (c) => {
    if (!window.confirm(`¿Eliminar la captura del ${c.fecha} completa (${(c.movimientos || []).length} movimiento${(c.movimientos || []).length === 1 ? "" : "s"})?\n\nEl saldo se recalcula sin ella. No se puede deshacer.`)) return;
    try { await llamar("DELETE", `/api/collections/tesoreria_capturas/${c.id}`); setCapturas((p) => p.filter((x) => x.id !== c.id)); if (editando?.id === c.id) setEditando(null); }
    catch (e) { window.alert(e.message); }
  };
  const abrir = (c) => setEditando({
    ...c,
    movimientos: (c.movimientos || []).map((m) => ({ ...movimientoVacio(), ...m, ingreso: m.ingreso ? String(m.ingreso) : "", egreso: m.egreso ? String(m.egreso) : "" })),
  });
  const poner = (i, k, valor) => setEditando((p) => ({
    ...p,
    movimientos: p.movimientos.map((m, idx) => {
      if (idx !== i) return m;
      if (k === "folio") return { ...m, folio: soloDigitos(valor) };
      if (k === "categoria" || k === "subcategoria" || k === "detalle") return { ...m, [k]: dosPalabras(valor).slice(0, 40) };
      if (k === "ingreso") { const v = limpiarMonto(valor); return { ...m, ingreso: v, egreso: v ? "" : m.egreso }; }
      if (k === "egreso") { const v = limpiarMonto(valor); return { ...m, egreso: v, ingreso: v ? "" : m.ingreso }; }
      return { ...m, [k]: valor };
    }),
  }));
  const quitarFila = (i) => setEditando((p) => ({ ...p, movimientos: p.movimientos.filter((_, idx) => idx !== i) }));
  const agregarFila = () => setEditando((p) => ({ ...p, movimientos: [...p.movimientos, movimientoVacio()] }));

  const guardar = async () => {
    if (!editando.fecha || !String(editando.encargado || "").trim()) { window.alert("Pon la fecha y el encargado."); return; }
    if (!editando.movimientos.length) { window.alert("La captura no tiene movimientos. Si ya no la quieres, usa Eliminar captura."); return; }
    if (!editando.movimientos.every(movimientoValido)) { window.alert("Cada movimiento necesita folio, concepto y un monto (ingreso o egreso, no los dos)."); return; }
    setGuardando(true);
    try {
      const doc = {
        ...editando,
        encargado: editando.encargado.trim(),
        movimientos: editando.movimientos.map((m) => ({ folio: String(m.folio).trim(), categoria: m.categoria.trim(), subcategoria: m.subcategoria.trim(), detalle: m.detalle.trim(), nombre: m.nombre.trim(), concepto: m.concepto.trim(), ingreso: tesNum(m.ingreso), egreso: tesNum(m.egreso) })),
        editadoPor: getUsername(), editadoEn: new Date().toISOString(),
      };
      await llamar("PUT", `/api/collections/tesoreria_capturas/${doc.id}`, doc);
      setCapturas((p) => p.map((x) => (x.id === doc.id ? doc : x)));
      setEditando(null);
    } catch (e) { window.alert(e.message); }
    setGuardando(false);
  };

  if (editando) {
    const tot = totalesDe(editando.movimientos);
    return (
      <div>
        <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Tesorería</button>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 14px", color: C.ink }}>Editar captura</h1>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Fecha</div><input type="date" value={editando.fecha} onChange={(e) => setEditando((p) => ({ ...p, fecha: e.target.value }))} style={{ ...campo, width: 170 }} /></div>
          <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Encargado</div><input value={editando.encargado || ""} onChange={(e) => setEditando((p) => ({ ...p, encargado: e.target.value }))} style={{ ...campo, width: 240 }} /></div>
        </div>
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 14, overflowX: "auto" }}>
          <div style={{ minWidth: 1040, display: "grid", gap: 6 }}>
            <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, fontSize: 11, fontWeight: 700, color: C.muted }}>
              {ORDEN.map((k) => <div key={k}>{ROTULOS[k]}</div>)}<div />
            </div>
            {editando.movimientos.map((m, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, gap: 6, alignItems: "center" }}>
                {ORDEN.map((k) => (
                  <input key={k} value={m[k]} onChange={(e) => poner(i, k, e.target.value)} inputMode={k === "folio" ? "numeric" : k === "ingreso" || k === "egreso" ? "decimal" : "text"} placeholder={k === "ingreso" || k === "egreso" ? "0.00" : ""} spellCheck={k === "concepto"} lang="es" style={{ ...campo, textAlign: k === "ingreso" || k === "egreso" ? "right" : "left" }} />
                ))}
                <button onClick={() => quitarFila(i)} title="Eliminar este movimiento" style={{ background: "none", border: "none", color: C.bad, fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
            <button onClick={agregarFila} style={{ ...btn(false), color: C.brand, borderColor: C.brand }}>+ Agregar movimiento</button>
            <div style={{ fontSize: 12.5, color: C.ink, display: "flex", gap: 16 }}>
              <span>Ingresos <strong style={{ color: C.ok }}>{dinero(tot.ingresos)}</strong></span>
              <span>Egresos <strong style={{ color: C.bad }}>{dinero(tot.egresos)}</strong></span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={() => setEditando(null)} style={btn(false)}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ ...btn(false, true), opacity: guardando ? 0.6 : 1 }}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px", color: C.ink }}>Tesorería</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Edita o elimina lo que se capturó en Tesorería. El saldo se recalcula solo.</div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Saldo inicial</div>
          <input value={saldoTxt} onChange={(e) => setSaldoTxt(limpiarMonto(e.target.value))} inputMode="decimal" placeholder={saldo === undefined ? "Cargando…" : "$0.00"} style={{ ...campo, width: 180 }} />
        </div>
        <button onClick={guardarSaldo} disabled={saldo === undefined} style={btn(false, true)}>{saldo ? "Guardar saldo inicial" : "Poner saldo inicial"}</button>
        {saldo === null && <div style={{ fontSize: 11.5, color: C.muted }}>Aún no se captura; Tesorería lo pedirá en la primera captura.</div>}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Mes</div>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ ...campo, width: 170 }} />
      </div>
      {error && <div style={{ color: C.bad, fontSize: 13 }}>{error}</div>}
      {!capturas && !error && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}
      {capturas && filtradas.length === 0 && <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 18, fontSize: 13, color: C.muted, textAlign: "center" }}>No hay capturas de tesorería con este filtro.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {filtradas.map((c) => {
          const t = totalesDe(c.movimientos || []);
          const n = (c.movimientos || []).length;
          return (
            <div key={c.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{c.fecha} · {c.encargado}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{n} movimiento{n === 1 ? "" : "s"} · ingresos {dinero(t.ingresos)} · egresos {dinero(t.egresos)}{c.editadoPor ? ` · editado por ${c.editadoPor}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => abrir(c)} style={btn(false)}>Editar</button>
                <button onClick={() => eliminarCaptura(c)} style={btn(true)}>Eliminar captura</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
