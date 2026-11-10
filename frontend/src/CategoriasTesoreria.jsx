import { useEffect, useState } from "react";
import { apiFetch } from "./auth";

// Configuración de cuenta › Categorías de Tesorería: las opciones que salen en los selectores
// Categoría, Subcategoría y Detalle de la captura. Niveles alto y medio.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", paper: "#F1F3F2", brand: "#0F6E66", bad: "#D6453F" };
const campo = { padding: "7px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, fontFamily: "inherit", background: "#fff", boxSizing: "border-box", width: 220, minWidth: 0 };
const btn = { border: "none", background: C.brand, color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" };

const LISTAS = [
  { lista: "categorias_tesoreria", titulo: "Categorías", ejemplo: "Ej. Entrega, Gastos, Nómina" },
  { lista: "subcategorias_tesoreria", titulo: "Subcategorías", ejemplo: "Ej. Cortes, Papelería" },
  { lista: "detalles_tesoreria", titulo: "Detalles", ejemplo: "Ej. Sucursal Centro" },
  { lista: "nombres_tesoreria", titulo: "Nombres", ejemplo: "Ej. Elías, Proveedor X" },
];

function Lista({ lista, titulo, ejemplo }) {
  const [items, setItems] = useState(null);
  const [nuevo, setNuevo] = useState("");
  useEffect(() => {
    apiFetch(`/api/lists/${lista}`).then((r) => r.json()).then((d) => setItems(Array.isArray(d) ? d : [])).catch(() => setItems([]));
  }, [lista]);
  const guardar = async (arr) => {
    try {
      const r = await apiFetch(`/api/lists/${lista}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(arr) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "No se pudo guardar");
      setItems(arr);
      return true;
    } catch (e) { window.alert(e.message); return false; }
  };
  const agregar = async () => {
    const n = nuevo.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!n) return;
    if ((items || []).some((x) => x.toLowerCase() === n.toLowerCase())) { window.alert("Ya está en la lista."); return; }
    if (await guardar([...(items || []), n])) setNuevo("");
  };
  const quitar = async (n) => {
    if (!window.confirm(`¿Quitar "${n}"? Lo ya capturado con ese valor se conserva.`)) return;
    await guardar((items || []).filter((x) => x !== n));
  };
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>{titulo}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} placeholder={ejemplo} maxLength={40} style={campo} />
        <button onClick={agregar} disabled={!nuevo.trim() || items === null} style={{ ...btn, opacity: nuevo.trim() ? 1 : 0.5 }}>Agregar</button>
      </div>
      {items === null ? <div style={{ fontSize: 12, color: C.muted }}>Cargando…</div> : items.length === 0 ? <div style={{ fontSize: 12, color: C.muted }}>Todavía no hay opciones.</div> : (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {items.map((n) => (
            <span key={n} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.paper, border: `1px solid ${C.line}`, borderRadius: 99, padding: "4px 6px 4px 12px", fontSize: 12.5, color: C.ink }}>
              {n}
              <button onClick={() => quitar(n)} title={`Quitar ${n}`} aria-label={`Quitar ${n}`} style={{ background: "none", border: "none", color: C.bad, fontSize: 16, lineHeight: 1, cursor: "pointer", padding: "0 4px" }}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriasTesoreria() {
  return (
    <div>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, margin: "0 0 4px", color: C.ink }}>Categorías de Tesorería</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Las opciones que aparecen al capturar en Tesorería: Categoría, Subcategoría, Detalle y Nombre.</div>
      {LISTAS.map((l) => <Lista key={l.lista} {...l} />)}
    </div>
  );
}
