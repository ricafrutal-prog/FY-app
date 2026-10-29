import { useCallback, useEffect, useState } from "react";
import { Plus, Bell, Trash2, ChevronLeft, BellOff, Check } from "lucide-react";
import { apiFetch } from "./auth";

// Pendientes: notas personales en hilos. Cada hilo tiene un título y mensajes con fecha; cualquier
// mensaje se puede dejar como recordatorio diario (todos los días o solo algunos). Cada persona de
// oficina ve únicamente lo suyo. La campana de arriba avisa los recordatorios del día.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", warn: "#B07A12" };
const DIAS = [["L", 1, "Lunes"], ["M", 2, "Martes"], ["X", 3, "Miércoles"], ["J", 4, "Jueves"], ["V", 5, "Viernes"], ["S", 6, "Sábado"], ["D", 0, "Domingo"]];
const NOMBRE_DIA = { 0: "domingos", 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábados" };
export const textoDias = (dias) => {
  if (!dias || !dias.length) return "todos los días";
  const orden = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d));
  const n = orden.map((d) => NOMBRE_DIA[d]);
  return n.length === 1 ? `los ${n[0]}` : `los ${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
};
const fechaHora = (iso) => { try { return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return iso; } };
const tituloDe = (h) => h.titulo || (h.mensajes[0]?.texto || "Sin título").slice(0, 70);

const campo = { padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
const boton = (fondo, color = "#fff", borde) => ({ border: borde || "none", background: fondo, color, fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" });

// Casilla "convertir en recordatorio diario" con días y hora.
function OpcionRecordatorio({ valor, onChange }) {
  const activo = !!valor;
  const dias = valor?.dias || [];
  const alternarDia = (d) => onChange({ ...valor, dias: dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d] });
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: C.ink }}>
        <input type="checkbox" checked={activo} onChange={(e) => onChange(e.target.checked ? { dias: [], hora: "" } : null)} style={{ width: 16, height: 16, accentColor: C.brand }} />
        <Bell size={14} color={C.brand} /> Hacer de este comentario un recordatorio diario
      </label>
      {activo && (
        <div style={{ marginTop: 10, padding: "12px 14px", background: C.paper, borderRadius: 10, border: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>¿Qué días? (sin elegir ninguno = todos los días)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {DIAS.map(([l, n, nombre]) => (
              <button key={n} type="button" title={nombre} onClick={() => alternarDia(n)} style={{ width: 34, height: 34, borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${dias.includes(n) ? C.brand : C.line}`, background: dias.includes(n) ? C.brand : "#fff", color: dias.includes(n) ? "#fff" : C.ink }}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 11.5, color: C.muted }}>Hora (opcional)</span>
            <input type="time" value={valor.hora || ""} onChange={(e) => onChange({ ...valor, hora: e.target.value })} style={{ ...campo, width: 120, padding: "6px 8px" }} />
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>Te va a recordar {textoDias(dias)}{valor.hora ? ` a las ${valor.hora}` : ""} en la campana, hasta que lo quites.</div>
        </div>
      )}
    </div>
  );
}

export default function Pendientes() {
  const [hilos, setHilos] = useState(null);
  const [abierto, setAbierto] = useState(null); // id del hilo abierto
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch("/api/notas");
      const d = await r.json().catch(() => null);
      if (r.ok && Array.isArray(d)) setHilos(d); else setError("No se pudieron cargar tus pendientes");
    } catch { setError("No se pudieron cargar tus pendientes"); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const llamar = async (url, metodo, cuerpo) => {
    setError(""); setGuardando(true);
    try {
      const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const d = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo guardar");
      return d;
    } catch (e) { setError(e.message); return undefined; } finally { setGuardando(false); }
  };
  const reemplazar = (h) => setHilos((p) => (p.some((x) => x.id === h.id) ? p.map((x) => (x.id === h.id ? h : x)) : [h, ...p]));

  const hilo = hilos && abierto ? hilos.find((h) => h.id === abierto) : null;
  if (!hilos) return <div style={{ fontSize: 13, color: C.muted }}>{error || "Cargando…"}</div>;

  if (hilo) {
    return (
      <VistaHilo
        hilo={hilo} error={error} guardando={guardando}
        onVolver={() => { setAbierto(null); setError(""); }}
        onAgregar={async (texto, recordatorio) => { const h = await llamar(`/api/notas/${hilo.id}/mensajes`, "POST", { texto, recordatorio }); if (h) { reemplazar(h); return true; } return false; }}
        onTitulo={async (titulo) => { const h = await llamar(`/api/notas/${hilo.id}`, "PUT", { titulo }); if (h) reemplazar(h); }}
        onHecho={async (mid, hecho) => { const h = await llamar(`/api/notas/${hilo.id}/mensajes/${mid}`, "PUT", { hecho }); if (h) reemplazar(h); }}
        onQuitarRec={async () => { const h = await llamar(`/api/notas/${hilo.id}`, "PUT", { quitarRecordatorio: true }); if (h) reemplazar(h); }}
        onEliminar={async () => { if (!window.confirm("¿Eliminar este pendiente con todos sus comentarios? No se puede deshacer.")) return; const r = await llamar(`/api/notas/${hilo.id}`, "DELETE"); if (r !== undefined) { setHilos((p) => p.filter((x) => x.id !== hilo.id)); setAbierto(null); } }}
      />
    );
  }

  const ordenados = [...hilos].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>Pendientes</h1>
        {!nuevo && <button onClick={() => setNuevo(true)} style={{ ...boton(C.brand), display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo pendiente</button>}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>Tus notas personales: solo tú las ves. Cada pendiente es un hilo al que puedes seguir agregándole comentarios.</div>
      {error && <div style={{ color: C.bad, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      {nuevo && (
        <NuevoHilo
          guardando={guardando}
          onCancelar={() => setNuevo(false)}
          onGuardar={async (texto, titulo, recordatorio) => { const h = await llamar("/api/notas", "POST", { texto, titulo, recordatorio }); if (h) { reemplazar(h); setNuevo(false); setAbierto(h.id); } }}
        />
      )}
      {ordenados.length === 0 && !nuevo && <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 12, padding: 22, fontSize: 13, color: C.muted, textAlign: "center" }}>Todavía no tienes pendientes. Usa "Nuevo pendiente" para crear el primero.</div>}
      <div style={{ display: "grid", gap: 10, marginTop: nuevo ? 16 : 0 }}>
        {ordenados.map((h) => {
          const ultimo = h.mensajes[h.mensajes.length - 1];
          return (
            <button key={h.id} onClick={() => { setAbierto(h.id); setError(""); }} style={{ textAlign: "left", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", fontFamily: "inherit", display: "block", width: "100%" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{tituloDe(h)}</div>
                {h.recordatorio && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: C.brand, background: C.brandSoft, borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap" }}><Bell size={11} /> Recordatorio {textoDias(h.recordatorio.dias)}</span>}
              </div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ultimo?.texto}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{h.mensajes.length} comentario{h.mensajes.length === 1 ? "" : "s"}{h.mensajes.some((m) => m.hecho) ? ` (${h.mensajes.filter((m) => m.hecho).length} hecho${h.mensajes.filter((m) => m.hecho).length === 1 ? "" : "s"})` : ""} · última actualización {fechaHora(h.actualizadoEn)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NuevoHilo({ onGuardar, onCancelar, guardando }) {
  const [texto, setTexto] = useState("");
  const [titulo, setTitulo] = useState("");
  const [rec, setRec] = useState(null);
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Nuevo pendiente</div>
      <input spellCheck lang="es" autoCorrect="on" autoCapitalize="sentences" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Título (opcional; después lo puedes poner o cambiar)" style={campo} />
      <textarea spellCheck lang="es" autoCorrect="on" autoCapitalize="sentences" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={2000} placeholder="Escribe tu pendiente" style={{ ...campo, resize: "vertical" }} />
      <OpcionRecordatorio valor={rec} onChange={setRec} />
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancelar} style={boton("#fff", C.ink, `1px solid ${C.line}`)}>Cancelar</button>
        <button onClick={() => texto.trim() && onGuardar(texto, titulo, rec)} disabled={!texto.trim() || guardando} style={{ ...boton(C.brand), opacity: texto.trim() && !guardando ? 1 : 0.5 }}>{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}

function VistaHilo({ hilo, error, guardando, onVolver, onAgregar, onTitulo, onHecho, onQuitarRec, onEliminar }) {
  const [texto, setTexto] = useState("");
  const [rec, setRec] = useState(null);
  const [titulo, setTitulo] = useState(hilo.titulo || "");
  useEffect(() => { setTitulo(hilo.titulo || ""); }, [hilo.id, hilo.titulo]);
  const agregar = async () => { if (!texto.trim()) return; if (await onAgregar(texto, rec)) { setTexto(""); setRec(null); } };
  return (
    <div>
      <button onClick={onVolver} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: 12 }}><ChevronLeft size={14} /> Pendientes</button>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <input spellCheck lang="es" autoCorrect="on" autoCapitalize="sentences" value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={() => titulo.trim() !== (hilo.titulo || "") && onTitulo(titulo)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} maxLength={120} placeholder={tituloDe(hilo)} style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 24, fontWeight: 600, border: "none", borderBottom: `1px dashed ${C.line}`, outline: "none", background: "transparent", color: C.ink, flex: 1, minWidth: 220, padding: "2px 0" }} />
        <button onClick={onEliminar} title="Eliminar pendiente" style={{ ...boton("#fff", C.bad, `1px solid ${C.line}`), display: "inline-flex", alignItems: "center", gap: 5 }}><Trash2 size={14} /> Eliminar</button>
      </div>
      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16 }}>Creado el {fechaHora(hilo.creadoEn)} · toca el título para ponerle o cambiarle el nombre.</div>

      {hilo.recordatorio && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", background: C.brandSoft, border: `1px solid ${C.brand}`, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: C.ink }}><Bell size={13} color={C.brand} style={{ verticalAlign: "-2px", marginRight: 6 }} /><strong>Recordatorio activo:</strong> “{hilo.recordatorio.texto}” — {textoDias(hilo.recordatorio.dias)}{hilo.recordatorio.hora ? ` a las ${hilo.recordatorio.hora}` : ""}.</div>
          <button onClick={onQuitarRec} style={{ ...boton("#fff", C.ink, `1px solid ${C.line}`), display: "inline-flex", alignItems: "center", gap: 5 }}><BellOff size={13} /> Quitar recordatorio</button>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
        {hilo.mensajes.map((m) => (
          <div key={m.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <button onClick={() => onHecho(m.id, !m.hecho)} title={m.hecho ? "Quitar marca de hecho" : "Marcar como hecho"} aria-label={m.hecho ? "Quitar marca de hecho" : "Marcar como hecho"} style={{ width: 22, height: 22, borderRadius: 99, border: `2px solid ${m.hecho ? C.brand : C.muted}`, background: m.hecho ? C.brand : "transparent", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
              {m.hecho && <Check size={13} color="#fff" strokeWidth={3.5} />}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: m.hecho ? C.muted : C.ink, whiteSpace: "pre-wrap", textDecoration: m.hecho ? "line-through" : "none" }}>{m.texto}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6, fontSize: 11, color: C.muted }}>
                <span>{fechaHora(m.fecha)}</span>
                {m.hecho && m.hechoEn && <span style={{ color: C.brand, fontWeight: 700 }}>Hecho el {fechaHora(m.hechoEn)}</span>}
                {m.recordatorio && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: C.brand }}><Bell size={11} /> Recordatorio {textoDias(m.recordatorio.dias)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Agregar comentario</div>
        <textarea spellCheck lang="es" autoCorrect="on" autoCapitalize="sentences" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={2000} placeholder="Escribe cómo va este pendiente…" style={{ ...campo, resize: "vertical" }} />
        <OpcionRecordatorio valor={rec} onChange={setRec} />
        {error && <div style={{ color: C.bad, fontSize: 12.5 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={agregar} disabled={!texto.trim() || guardando} style={{ ...boton(C.brand), opacity: texto.trim() && !guardando ? 1 : 0.5 }}>{guardando ? "Guardando…" : "Agregar"}</button>
        </div>
      </div>
    </div>
  );
}
