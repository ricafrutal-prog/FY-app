import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Plus, Check, X, Trash2, ChevronLeft } from "lucide-react";
import { apiFetch, getUsername, getRole, nombreDeUsername } from "./auth";

// Timbre de recordatorios — solo para usuarios administrativos (el servidor
// además rechaza a las cuentas de sucursal). Cada recordatorio puede ser solo
// para quien lo crea, solo para otra persona, o para las dos. A la otra persona
// le llega como invitación: ve el recordatorio y decide si lo acepta o lo rechaza.

const T = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", badSoft: "#FBE7E5", warn: "#C98A12", warnSoft: "#FBF1D9", ok: "#2E9E5B", okSoft: "#E7F4EC" };

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fechaCorta = (iso, hora) => {
  const [y, m, d] = (iso || "").split("-").map(Number);
  if (!y) return iso || "";
  return `${d} ${MESES[m - 1]} ${y}${hora ? ` · ${hora}` : ""}`;
};

// ---- Timbre (sonido) ----
// Suena solo con la app abierta: al llegar una invitación nueva y cuando llega la
// hora de un recordatorio propio. Cada uno suena una sola vez (se recuerda en el
// navegador). El sonido se genera aquí mismo, no depende de ningún archivo.
let audioCtx = null;
function tocarTimbre() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [[880, 0], [1175, 0.28], [880, 0.56], [1175, 0.84]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.5);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + d); o.stop(t0 + d + 0.55);
    });
  } catch { /* el navegador no dejó reproducir: se intenta en el siguiente aviso */ }
}
const claveTimbrados = (yo) => `fy_rec_timbrados_${yo}`;
const leerTimbrados = (yo) => { try { return new Set(JSON.parse(localStorage.getItem(claveTimbrados(yo)) || "[]")); } catch { return new Set(); } };
const guardarTimbrados = (yo, set) => { try { localStorage.setItem(claveTimbrados(yo), JSON.stringify([...set].slice(-300))); } catch { /* sin almacenamiento */ } };

export default function Recordatorios() {
  const yo = getUsername();
  const [abierto, setAbierto] = useState(false);
  const [items, setItems] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [agregando, setAgregando] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef(null);

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch("/api/recordatorios");
      const data = await r.json().catch(() => null);
      if (r.ok && Array.isArray(data)) setItems(data);
    } catch { /* sin conexión: se reintenta en el siguiente ciclo */ }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    if (!abierto) return;
    cargar();
    const fuera = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { setAbierto(false); setAgregando(false); } };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto, cargar]);

  // El navegador solo deja sonar después de que la persona hizo clic en la página.
  useEffect(() => {
    const desbloquear = () => {
      try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { audioCtx = audioCtx || new AC(); audioCtx.resume(); } } catch { /* nada */ }
    };
    document.addEventListener("click", desbloquear, { once: true });
    return () => document.removeEventListener("click", desbloquear);
  }, []);

  const hoy = hoyLocal();

  // Qué me toca a mí:
  const invitaciones = items.filter((r) => r.destinatario === yo && r.respuesta === "pendiente");
  const mios = items.filter((r) => (r.creador === yo && r.para !== "otro") || (r.destinatario === yo && r.respuesta === "aceptado"));
  const hechoMio = (r) => (r.creador === yo ? r.hechoCreador : r.hechoDestinatario);
  const activos = mios.filter((r) => !hechoMio(r)).sort((a, b) => (a.fecha + (a.hora || "")).localeCompare(b.fecha + (b.hora || "")));
  const vencidos = activos.filter((r) => r.fecha <= hoy);
  const proximos = activos.filter((r) => r.fecha > hoy);
  const hechos = mios.filter(hechoMio);
  const enviados = items.filter((r) => r.creador === yo && r.para === "otro");
  const insignia = invitaciones.length + vencidos.length;

  // Revisa cada 20 s (y cada vez que cambian los datos) si hay algo que deba sonar.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    const revisar = () => {
      const lista = itemsRef.current;
      if (!lista.length) return;
      const ahora = new Date();
      const hhmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
      const hoyS = hoyLocal();
      const vistos = leerTimbrados(yo);
      const nuevos = [];
      lista.forEach((r) => {
        if (r.destinatario === yo && r.respuesta === "pendiente") nuevos.push(`inv:${r.id}`);
        const esMio = (r.creador === yo && r.para !== "otro") || (r.destinatario === yo && r.respuesta === "aceptado");
        const hecho = r.creador === yo ? r.hechoCreador : r.hechoDestinatario;
        if (esMio && !hecho && (r.fecha < hoyS || (r.fecha === hoyS && (!r.hora || r.hora <= hhmm)))) nuevos.push(`due:${r.id}:${r.fecha}:${r.hora || ""}`);
      });
      const sinSonar = nuevos.filter((k) => !vistos.has(k));
      if (sinSonar.length) {
        tocarTimbre();
        sinSonar.forEach((k) => vistos.add(k));
        guardarTimbrados(yo, vistos);
      }
    };
    revisar();
    const t = setInterval(revisar, 20000);
    return () => clearInterval(t);
  }, [items, yo]);

  const mutar = async (url, opciones) => {
    setError("");
    try {
      const r = await apiFetch(url, opciones);
      if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.error || "No se pudo completar"); }
      await cargar();
    } catch (e) { setError(e.message || "No se pudo completar"); }
  };
  const responder = (id, accion) => {
    if (accion === "rechazar" && !window.confirm("¿Seguro que quieres rechazar este recordatorio? Quien te lo mandó verá que lo rechazaste.")) return;
    return mutar(`/api/recordatorios/${id}/responder`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion }) });
  };
  const marcar = (id, hecho) => mutar(`/api/recordatorios/${id}/hecho`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hecho }) });
  const borrar = (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este recordatorio? Esta acción no se puede deshacer.")) return;
    return mutar(`/api/recordatorios/${id}`, { method: "DELETE" });
  };

  const abrirAgregar = async () => {
    setAgregando(true);
    setError("");
    if (getRole() === "sucursal") return; // las sucursales solo se ponen recordatorios a sí mismas
    try {
      const r = await apiFetch("/api/recordatorios/personas");
      const d = await r.json().catch(() => null);
      if (r.ok && Array.isArray(d)) setPersonas(d);
    } catch { /* se queda la lista vacía */ }
  };

  const guardar = async (datos) => {
    const r = await apiFetch("/api/recordatorios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.error || "No se pudo guardar el recordatorio");
    await cargar();
    setAgregando(false);
  };

  const fila = (r, acciones, etiqueta) => (
    <div key={r.id} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{r.titulo}</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {etiqueta}
          {r.creador === yo && r.destinatario && r.para !== "otro" && !etiqueta && (r.respuesta === "aceptado" ? chip("Aceptado", T.ok, T.okSoft) : r.respuesta === "rechazado" ? chip("Rechazado", T.bad, T.badSoft) : chip("Sin responder", T.muted, T.lineSoft))}
          {r.creador === yo && r.destinatario && r.para !== "otro" && etiqueta && r.respuesta !== "pendiente" && (r.respuesta === "aceptado" ? chip("Aceptado", T.ok, T.okSoft) : chip("Rechazado", T.bad, T.badSoft))}
          {r.destinatario === yo && r.respuesta === "aceptado" && chip("Aceptaste", T.ok, T.okSoft)}
        </div>
      </div>
      {r.descripcion && <div style={{ fontSize: 12, color: T.muted, marginTop: 3, whiteSpace: "pre-wrap" }}>{r.descripcion}</div>}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>
        {fechaCorta(r.fecha, r.hora)}
        {r.creador !== yo && <> · de {nombreDeUsername(r.creador)}</>}
        {r.creador === yo && r.destinatario && <> · {r.para === "ambos" ? "contigo y con" : "para"} {r.destinatarioNombre || nombreDeUsername(r.destinatario)}</>}
      </div>
      {acciones && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{acciones}</div>}
    </div>
  );
  const btn = (texto, onClick, color = T.ink, fondo = "#fff", Icono = null) => (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: `1px solid ${fondo === "#fff" ? T.line : fondo}`, background: fondo, color, fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit" }}>
      {Icono && <Icono size={12} />}{texto}
    </button>
  );
  const seccion = (titulo, lista, render) => lista.length > 0 && (
    <div style={{ display: "grid", gap: 7 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{titulo}</div>
      {lista.map(render)}
    </div>
  );
  const chip = (texto, color, fondo) => <span style={{ fontSize: 10, fontWeight: 700, color, background: fondo, borderRadius: 99, padding: "2px 8px", whiteSpace: "nowrap" }}>{texto}</span>;

  const vacio = invitaciones.length + activos.length + hechos.length + enviados.length === 0;

  return (
    <div ref={wrapRef} className="noprint" style={{ position: "relative", display: "inline-block", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <button
        onClick={() => { setAbierto((v) => !v); setAgregando(false); }}
        title="Recordatorios"
        style={{ position: "relative", width: 40, height: 40, borderRadius: 99, border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
      >
        <Bell size={18} color={T.ink} />
        {insignia > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, minWidth: 17, height: 17, borderRadius: 99, background: T.bad, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxSizing: "border-box" }}>{insignia}</span>
        )}
      </button>

      {abierto && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 370, maxWidth: "92vw", maxHeight: "74vh", overflowY: "auto", background: T.paper, borderRadius: 12, boxShadow: "0 14px 36px rgba(0,0,0,.25)", border: `1px solid ${T.line}`, zIndex: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#fff", borderBottom: `1px solid ${T.lineSoft}`, position: "sticky", top: 0, zIndex: 1 }}>
            {agregando ? (
              <button onClick={() => setAgregando(false)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: T.brand, fontWeight: 700, fontSize: 13, padding: 0, fontFamily: "inherit" }}><ChevronLeft size={15} /> Nuevo recordatorio</button>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>Recordatorios</div>
                <button onClick={abrirAgregar} style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: T.brand, color: "#fff", fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> Agregar</button>
              </>
            )}
          </div>

          <div style={{ padding: 12, display: "grid", gap: 14 }}>
            {error && <div style={{ background: T.badSoft, border: `1px solid ${T.bad}`, color: T.bad, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>{error}</div>}

            {agregando ? (
              <FormularioRecordatorio personas={personas} onGuardar={guardar} onCancelar={() => setAgregando(false)} T={T} hoy={hoy} />
            ) : (
              <>
                {vacio && <div style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: "18px 0" }}>No tienes recordatorios. Usa "Agregar" para crear uno.</div>}

                {seccion("Invitaciones — alguien te lo compartió", invitaciones, (r) => fila(r,
                  <>
                    {btn("Aceptar", () => responder(r.id, "aceptar"), "#fff", T.ok, Check)}
                    {btn("Rechazar", () => responder(r.id, "rechazar"), T.bad, "#fff", X)}
                  </>
                ))}

                {seccion("Para hoy o vencidos", vencidos, (r) => fila(r,
                  <>
                    {btn("Marcar como hecho", () => marcar(r.id, true), "#fff", T.brand, Check)}
                    {r.creador === yo && btn("Eliminar", () => borrar(r.id), T.bad, "#fff", Trash2)}
                  </>,
                  r.fecha < hoy ? chip("Vencido", T.bad, T.badSoft) : chip("Hoy", T.warn, T.warnSoft)
                ))}

                {seccion("Próximos", proximos, (r) => fila(r,
                  <>
                    {btn("Marcar como hecho", () => marcar(r.id, true), T.ink, "#fff", Check)}
                    {r.creador === yo && btn("Eliminar", () => borrar(r.id), T.bad, "#fff", Trash2)}
                  </>
                ))}

                {seccion("Enviados a otra persona", enviados, (r) => fila(r,
                  btn("Eliminar", () => borrar(r.id), T.bad, "#fff", Trash2),
                  r.respuesta === "aceptado" ? chip("Aceptado", T.ok, T.okSoft) : r.respuesta === "rechazado" ? chip("Rechazado", T.bad, T.badSoft) : chip("Sin responder", T.muted, T.lineSoft)
                ))}

                {seccion("Hechos", hechos, (r) => fila(r,
                  <>
                    {btn("Deshacer", () => marcar(r.id, false))}
                    {btn("Quitar", () => borrar(r.id), T.bad, "#fff", Trash2)}
                  </>,
                  chip("Hecho", T.ok, T.okSoft)
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioRecordatorio({ personas, onGuardar, onCancelar, T, hoy }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [hora, setHora] = useState("");
  const [para, setPara] = useState("yo");
  const [destinatario, setDestinatario] = useState("");
  const rol = getRole();
  const soloParaMi = rol === "sucursal";           // las sucursales no pueden mandar a nadie
  const puedeSucursales = rol === "rrhh";          // Recursos Humanos también puede mandar a sucursales
  const [tipoDest, setTipoDest] = useState("admin"); // admin | sucursal (solo rrhh)
  const candidatas = personas.filter((u) => (puedeSucursales && tipoDest === "sucursal" ? u.role === "sucursal" : u.role !== "sucursal"));
  const etiquetaPersona = (u) => (u.role === "sucursal" ? u.sucursal || nombreDeUsername(u.username) : nombreDeUsername(u.username));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const campo = { padding: "9px 10px", borderRadius: 8, border: `1px solid ${T.line}`, fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
  const etiqueta = { fontSize: 11.5, fontWeight: 600, color: T.ink, display: "block", marginBottom: 4 };
  const necesitaOtra = para !== "yo" && !soloParaMi;
  const listo = titulo.trim() && fecha && (!necesitaOtra || destinatario);

  const enviar = async () => {
    if (!listo || guardando) return;
    setGuardando(true);
    setError("");
    try {
      await onGuardar({ titulo, descripcion, fecha, hora, para: soloParaMi ? "yo" : para, destinatario: necesitaOtra && !soloParaMi ? destinatario : null });
    } catch (e) {
      setError(e.message || "No se pudo guardar");
      setGuardando(false);
    }
  };

  const opcion = (valor, texto) => (
    <label key={valor} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.ink, cursor: "pointer", padding: "7px 10px", border: `1px solid ${para === valor ? T.brand : T.line}`, background: para === valor ? T.brandSoft : "#fff", borderRadius: 8 }}>
      <input type="radio" name="para" checked={para === valor} onChange={() => setPara(valor)} style={{ margin: 0 }} />
      {texto}
    </label>
  );

  return (
    <div style={{ display: "grid", gap: 11 }}>
      <div>
        <label style={etiqueta}>Título</label>
        <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} placeholder="Ej. Revisar cortes de la semana" style={campo} />
      </div>
      <div>
        <label style={etiqueta}>Descripción</label>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={1000} rows={3} placeholder="Opcional" style={{ ...campo, resize: "vertical" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 8 }}>
        <div>
          <label style={etiqueta}>Recordarme el día</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} />
        </div>
        <div>
          <label style={etiqueta}>Hora (opcional)</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} />
        </div>
      </div>
      {!soloParaMi && (
        <div>
          <label style={etiqueta}>¿Para quién es?</label>
          <div style={{ display: "grid", gap: 6 }}>
            {opcion("yo", "Solo para mí")}
            {opcion("otro", puedeSucursales ? "Solo para otra persona o sucursal" : "Solo para otra persona")}
            {opcion("ambos", puedeSucursales ? "Para mí y para otra persona o sucursal" : "Para mí y para otra persona")}
          </div>
        </div>
      )}
      {!soloParaMi && necesitaOtra && puedeSucursales && (
        <div>
          <label style={etiqueta}>¿A quién se lo mandas?</label>
          <div style={{ display: "flex", gap: 6 }}>
            {[["admin", "Persona administrativa"], ["sucursal", "Sucursal"]].map(([k, texto]) => (
              <button key={k} type="button" onClick={() => { setTipoDest(k); setDestinatario(""); }} style={{ flex: 1, border: `1px solid ${tipoDest === k ? T.brand : T.line}`, background: tipoDest === k ? T.brandSoft : "#fff", color: tipoDest === k ? T.brand : T.ink, fontSize: 12.5, fontWeight: 600, padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>{texto}</button>
            ))}
          </div>
        </div>
      )}
      {!soloParaMi && necesitaOtra && (
        <div>
          <label style={etiqueta}>{puedeSucursales && tipoDest === "sucursal" ? "Sucursal" : "Otra persona"}</label>
          <select value={destinatario} onChange={(e) => setDestinatario(e.target.value)} style={campo}>
            <option value="">Selecciona…</option>
            {candidatas.map((u) => <option key={u.username} value={u.username}>{etiquetaPersona(u)}</option>)}
          </select>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>Le llegará como invitación: decide si la acepta o la rechaza.</div>
        </div>
      )}
      {error && <div style={{ fontSize: 12, color: T.bad }}>{error}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancelar} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
        <button onClick={enviar} disabled={!listo || guardando} style={{ border: "none", background: T.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 16px", borderRadius: 8, cursor: listo ? "pointer" : "default", opacity: listo && !guardando ? 1 : 0.5, fontFamily: "inherit" }}>{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}
