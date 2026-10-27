import { useEffect, useMemo, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { apiFetch } from "./auth";
import { usePersistedList } from "./hooks/persistence";
import { DIAS_RUTA, RUTA_POR_DEFECTO, rutaCoincide } from "./rutaCortes";

// Días de recolección de cortes por sucursal (solo administrador_ricardo y
// jesus_segura; se abre desde el menú de Cuenta). Cada cambio se guarda al momento.
const T = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE" };

export default function RutaCortesModal({ onCerrar }) {
  const [ruta, setRuta] = usePersistedList("ruta_cortes", RUTA_POR_DEFECTO);
  const [catalogo, setCatalogo] = useState([]);
  useEffect(() => {
    apiFetch("/api/lists/sucursalesAI").then((r) => r.json()).then((d) => { if (Array.isArray(d)) setCatalogo(d); }).catch(() => {});
  }, []);

  // Filas: lo que ya está en la ruta + las sucursales del catálogo que todavía no están.
  const filas = useMemo(() => {
    const out = ruta.filter((it) => !it.oculta).map((it) => ({ nombre: it.nombre, dias: it.dias || {}, enRuta: true }));
    catalogo.forEach((n) => { if (!ruta.some((it) => rutaCoincide(it, n))) out.push({ nombre: n, dias: {}, enRuta: false }); });
    return out.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [ruta, catalogo]);

  const cambiar = (nombre, dias) => setRuta((prev) => {
    const i = prev.findIndex((it) => it.nombre === nombre);
    if (i >= 0) return prev.map((it, j) => (j === i ? { ...it, dias } : it));
    return [...prev, { nombre, alias: [], dias }];
  });
  const alternar = (f, wd) => {
    const dias = { ...f.dias };
    if (dias[wd] != null) delete dias[wd]; else dias[wd] = 1;
    cambiar(f.nombre, dias);
  };
  // "Borrar" quita la sucursal de ESTA lista (y de Conciliación); no la borra del catálogo
  // de la plataforma. Se guarda como "oculta" para que no vuelva a salir del catálogo.
  const borrar = (f) => {
    if (!window.confirm(`¿Seguro que quieres borrar "${f.nombre}" de esta lista?\n\nDejará de aparecer aquí y en Conciliación. No se borra de la plataforma (Recepción de Cortes, Nómina, etc.) ni se pierden recepciones ya capturadas. Puedes restaurarla después desde "Sucursales borradas".`)) return;
    setRuta((prev) => {
      const i = prev.findIndex((it) => it.nombre === f.nombre);
      if (i >= 0) return prev.map((it, j) => (j === i ? { ...it, dias: {}, oculta: true } : it));
      return [...prev, { nombre: f.nombre, alias: [], dias: {}, oculta: true }];
    });
  };
  const restaurar = (nombre) => setRuta((prev) => prev.map((it) => (it.nombre === nombre ? { ...it, oculta: false } : it)));
  const borradas = ruta.filter((it) => it.oculta);
  const ponerCortes = (f, wd, v) => cambiar(f.nombre, { ...f.dias, [wd]: Math.max(1, Math.min(99, Number(v) || 1)) });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }} onClick={onCerrar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 760, maxWidth: "94vw", maxHeight: "86vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.25)", display: "grid", gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: T.ink }}>Días de recolección de cortes</div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}><X size={18} color={T.muted} /></button>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: -6, lineHeight: 1.5 }}>
          Marca qué días de la semana el chofer recoge los cortes de cada sucursal y cuántos cortes se esperan ese día. Una sucursal nueva del catálogo aparece aquí sin días: asígnale los suyos y la Conciliación la empieza a evaluar. Se guarda al momento.
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {filas.map((f) => (
            <div key={f.nombre} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: Object.keys(f.dias).length ? T.paper : "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 12px" }}>
              <div style={{ flex: "1 1 190px", fontSize: 13, fontWeight: 600, color: T.ink }}>
                {f.nombre}
                {Object.keys(f.dias).length === 0 && <div style={{ fontSize: 10.5, fontWeight: 600, color: "#B45F06" }}>Sin días asignados</div>}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {DIAS_RUTA.map(([wd, nombre]) => {
                  const activo = f.dias[wd] != null;
                  return (
                    <div key={wd} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <button onClick={() => alternar(f, wd)} style={{ width: 46, padding: "5px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${activo ? T.brand : T.line}`, background: activo ? T.brand : "#fff", color: activo ? "#fff" : T.ink }}>{nombre}</button>
                      {activo ? <input type="number" min={1} max={99} value={f.dias[wd]} onChange={(e) => ponerCortes(f, wd, e.target.value)} title="Cortes que se esperan ese día" style={{ width: 46, textAlign: "center", fontSize: 12, padding: "3px 2px", border: `1px solid ${T.line}`, borderRadius: 6, fontFamily: "inherit" }} /> : <div style={{ height: 24 }} />}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => borrar(f)} title="Borrar esta sucursal de la lista" style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0, padding: 4, alignSelf: "center" }}><Trash2 size={16} color="#D6453F" /></button>
            </div>
          ))}
          {filas.length === 0 && <div style={{ fontSize: 12.5, color: T.muted }}>Cargando…</div>}
        </div>
        {borradas.length > 0 && (
          <details style={{ fontSize: 12, color: T.muted }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sucursales borradas ({borradas.length})</summary>
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {borradas.map((it) => (
                <div key={it.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.paper, borderRadius: 8, padding: "6px 10px" }}>
                  <span style={{ color: T.ink }}>{it.nombre}</span>
                  <button onClick={() => restaurar(it.nombre)} style={{ border: `1px solid ${T.line}`, background: "#fff", borderRadius: 7, fontSize: 11.5, fontWeight: 600, padding: "3px 10px", cursor: "pointer", fontFamily: "inherit" }}>Restaurar</button>
                </div>
              ))}
            </div>
          </details>
        )}
        <div style={{ fontSize: 11.5, color: T.muted }}>El número debajo de cada día son los cortes que se esperan ese día (por ejemplo 4, 3 o 7).</div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onCerrar} style={{ border: "none", background: T.ink, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "8px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>Listo</button>
        </div>
      </div>
    </div>
  );
}
