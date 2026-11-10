import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, Clock } from "lucide-react";
import { apiFetch, getUsername } from "./auth";

// Procesos: lo que cada persona de oficina hace a diario o cada semana (p. ej. "Los lunes: revisar que no haya
// cortes de más de 4 días"). Cada quien marca como hecho lo suyo del día; se pueden crear para uno mismo o
// asignarlos a otra cuenta de oficina, y quien los asigna ve si se cumplieron hoy.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", ok: "#2E9E5B", warn: "#B07A12" };
const DIAS = [["L", 1, "Lunes"], ["M", 2, "Martes"], ["X", 3, "Miércoles"], ["J", 4, "Jueves"], ["V", 5, "Viernes"], ["S", 6, "Sábado"], ["D", 0, "Domingo"]];
const NOMBRE_DIA = { 0: "domingos", 1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábados" };
const textoDias = (dias) => {
  if (!dias || !dias.length) return "todos los días";
  const n = [1, 2, 3, 4, 5, 6, 0].filter((d) => dias.includes(d)).map((d) => NOMBRE_DIA[d]);
  return n.length === 1 ? `los ${n[0]}` : `los ${n.slice(0, -1).join(", ")} y ${n[n.length - 1]}`;
};
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tocaHoy = (p) => !p.dias?.length || p.dias.includes(new Date().getDay());
const bonito = (u) => String(u || "").replace(/_/g, " ");

const campo = { padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13.5, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
const boton = (fondo, color = "#fff", borde) => ({ border: borde || "none", background: fondo, color, fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" });

function Formulario({ inicial, personas, guardando, onGuardar, onCancelar }) {
  const [titulo, setTitulo] = useState(inicial?.titulo || "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || "");
  const [dias, setDias] = useState(inicial?.dias || []);
  const [hora, setHora] = useState(inicial?.hora || "");
  const [para, setPara] = useState("");
  const editando = !!inicial;
  const alternar = (d) => setDias((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]));
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, display: "grid", gap: 12, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{editando ? "Editar proceso" : "Nuevo proceso"}</div>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} placeholder="Qué hay que hacer (ej. Revisar que no haya cortes de más de 4 días)" style={campo} autoFocus />
      <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} rows={2} placeholder="Detalle (opcional)" style={{ ...campo, resize: "vertical" }} />
      <div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>¿Qué días toca? (sin elegir ninguno = todos los días)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DIAS.map(([l, n, nombre]) => (
            <button key={n} type="button" title={nombre} onClick={() => alternar(n)} style={{ width: 34, height: 34, borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${dias.includes(n) ? C.brand : C.line}`, background: dias.includes(n) ? C.brand : "#fff", color: dias.includes(n) ? "#fff" : C.ink }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11.5, color: C.muted }}>Hora (opcional)</span>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...campo, width: 120, padding: "6px 8px" }} />
        </div>
        {!editando && personas.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: C.muted }}>Para</span>
            <select value={para} onChange={(e) => setPara(e.target.value)} style={{ ...campo, width: 220, padding: "7px 8px" }}>
              <option value="">Yo</option>
              {personas.map((p) => <option key={p.username} value={p.username}>{bonito(p.username)}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: C.muted }}>Toca {textoDias(dias)}{hora ? ` a las ${hora}` : ""}.</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancelar} style={boton("#fff", C.ink, `1px solid ${C.line}`)}>Cancelar</button>
        <button onClick={() => onGuardar({ titulo, descripcion, dias, hora, ...(editando ? {} : { para }) })} disabled={guardando || !titulo.trim()} style={{ ...boton(C.brand), opacity: guardando || !titulo.trim() ? 0.5 : 1 }}>{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}

export default function Procesos() {
  const yo = getUsername();
  const hoy = hoyISO();
  const [lista, setLista] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [error, setError] = useState("");
  const [forma, setForma] = useState(null); // null | "nuevo" | proceso en edición
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch("/api/procesos");
      const d = await r.json().catch(() => null);
      if (r.ok && Array.isArray(d)) setLista(d); else setError("No se pudieron cargar los procesos");
    } catch { setError("No se pudieron cargar los procesos"); }
    apiFetch("/api/procesos/personas").then((r) => r.json()).then((d) => setPersonas(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const llamar = async (url, metodo, cuerpo) => {
    setError(""); setGuardando(true);
    try {
      const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      const d = r.status === 204 ? null : await r.json().catch(() => null);
      if (!r.ok) throw new Error(d?.error || "No se pudo guardar");
      return d ?? true;
    } catch (e) { setError(e.message); return undefined; } finally { setGuardando(false); }
  };
  const reemplazar = (p) => setLista((x) => (x.some((y) => y.id === p.id) ? x.map((y) => (y.id === p.id ? p : y)) : [p, ...x]));

  if (!lista) return <div style={{ fontSize: 13, color: C.muted }}>{error || "Cargando…"}</div>;

  const mios = lista.filter((p) => p.owner === yo);
  const paraHoy = mios.filter(tocaHoy).sort((a, b) => (a.hora || "99:99").localeCompare(b.hora || "99:99"));
  const hechosHoy = paraHoy.filter((p) => (p.hechoFechas || []).includes(hoy)).length;
  const asignados = lista.filter((p) => p.creador === yo && p.owner !== yo);

  const marcar = async (p) => { const hecho = !(p.hechoFechas || []).includes(hoy); const r = await llamar(`/api/procesos/${p.id}/hecho`, "PUT", { fecha: hoy, hecho }); if (r && r !== true) reemplazar(r); };
  const guardar = async (datos) => {
    const r = forma && forma !== "nuevo" ? await llamar(`/api/procesos/${forma.id}`, "PUT", datos) : await llamar("/api/procesos", "POST", datos);
    if (r && r !== true) { reemplazar(r); setForma(null); }
  };
  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar el proceso “${p.titulo}”? No se puede deshacer.`)) return;
    const r = await llamar(`/api/procesos/${p.id}`, "DELETE");
    if (r !== undefined) setLista((x) => x.filter((y) => y.id !== p.id));
  };

  const acciones = (p) => p.creador === yo && (
    <div style={{ display: "flex", gap: 4 }}>
      <button onClick={() => { setForma(p); setError(""); }} title="Editar" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}><Pencil size={14} color={C.muted} /></button>
      <button onClick={() => eliminar(p)} title="Eliminar" style={{ background: "none", border: "none", cursor: "pointer", padding: 4, lineHeight: 0 }}><Trash2 size={14} color={C.bad} /></button>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>Procesos</h1>
        {!forma && <button onClick={() => setForma("nuevo")} style={{ ...boton(C.brand), display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={15} /> Nuevo proceso</button>}
      </div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 18 }}>Lo que haces a diario o cada semana. Márcalo cuando lo termines; también puedes asignarle procesos a otra persona.</div>
      {error && <div style={{ color: C.bad, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
      {forma && <Formulario key={forma === "nuevo" ? "nuevo" : forma.id} inicial={forma === "nuevo" ? null : forma} personas={personas} guardando={guardando} onGuardar={guardar} onCancelar={() => setForma(null)} />}

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Para hoy</div>
          {paraHoy.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: hechosHoy === paraHoy.length ? C.ok : C.warn }}>{hechosHoy} de {paraHoy.length} hechos</span>}
        </div>
        {paraHoy.length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>No tienes procesos para hoy.</div>}
        {paraHoy.map((p) => {
          const hecho = (p.hechoFechas || []).includes(hoy);
          return (
            <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: `1px solid ${C.lineSoft}` }}>
              <button onClick={() => marcar(p)} title={hecho ? "Deshacer" : "Marcar como hecho"} style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, marginTop: 1, cursor: "pointer", border: `1.5px solid ${hecho ? C.ok : C.line}`, background: hecho ? C.ok : "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>{hecho && <Check size={14} color="#fff" strokeWidth={3} />}</button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: hecho ? C.muted : C.ink, textDecoration: hecho ? "line-through" : "none" }}>{p.titulo}</div>
                {p.descripcion && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{p.descripcion}</div>}
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {p.hora && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Clock size={11} /> {p.hora}</span>}
                  {p.creador !== yo && <span>Asignado por {bonito(p.creador)}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Todos mis procesos</div>
        {mios.length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>Todavía no tienes procesos. Usa "Nuevo proceso" para crear el primero.</div>}
        {[...mios].sort((a, b) => a.titulo.localeCompare(b.titulo)).map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${C.lineSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.titulo}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{textoDias(p.dias)}{p.hora ? ` · ${p.hora}` : ""}{p.creador !== yo ? ` · asignado por ${bonito(p.creador)}` : ""}</div>
            </div>
            {acciones(p)}
          </div>
        ))}
      </div>

      {asignados.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Procesos que asigné</div>
          {[...asignados].sort((a, b) => a.owner.localeCompare(b.owner) || a.titulo.localeCompare(b.titulo)).map((p) => {
            const toca = tocaHoy(p);
            const hecho = (p.hechoFechas || []).includes(hoy);
            const ultima = (p.hechoFechas || []).slice(-1)[0];
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", padding: "9px 0", borderTop: `1px solid ${C.lineSoft}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{p.titulo}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{bonito(p.owner)} · {textoDias(p.dias)}{p.hora ? ` · ${p.hora}` : ""}{ultima ? ` · último hecho ${ultima}` : " · aún sin hacerse"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: "3px 9px", whiteSpace: "nowrap", color: !toca ? C.muted : hecho ? C.ok : C.warn, background: !toca ? C.paper : hecho ? "#E3F4EA" : "#FBF1DC" }}>{!toca ? "No toca hoy" : hecho ? "Hecho hoy" : "Pendiente hoy"}</span>
                  {acciones(p)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
