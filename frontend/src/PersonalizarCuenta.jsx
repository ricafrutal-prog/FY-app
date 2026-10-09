import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sun, Moon, Image as ImageIcon, Trash2, Type, LayoutGrid } from "lucide-react";
import { FUENTES, DEFAULTS, getPrefsLocal, applyPrefs, guardarPrefsEnServidor, comprimirImagen } from "./preferences";

const T = {
  ink: "#16161B",
  inkSoft: "#41414C",
  muted: "#8C8C97",
  line: "#E6E3DB",
  lineSoft: "#F0EEE8",
  paper: "#F1F3F2",
  card: "#FFFFFF",
  brand: "#0F6E66",
  brandSoft: "#E4F0EE",
  bad: "#D6453F",
  badSoft: "#FBE7E5",
};

export default function PersonalizarCuenta({ onCerrar }) {
  const originalRef = useRef(getPrefsLocal());
  const [prefs, setPrefs] = useState(originalRef.current);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const actualizar = (cambios) => {
    const next = { ...prefs, ...cambios };
    setPrefs(next);
    applyPrefs(next);
  };

  const cerrarSinGuardar = () => {
    applyPrefs(originalRef.current);
    onCerrar();
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await guardarPrefsEnServidor(prefs);
      onCerrar();
    } catch (e) {
      setError(e?.message || "No se pudo guardar — revisa tu conexión.");
    }
    setGuardando(false);
  };

  const restablecer = () => actualizar({ ...DEFAULTS });

  const elegirFoto = () => fileRef.current?.click();

  const onFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Elige un archivo de imagen."); return; }
    setSubiendoFoto(true);
    setError("");
    try {
      const dataUrl = await comprimirImagen(file);
      actualizar({ fondoImagen: dataUrl, fondoIntensidad: prefs.fondoIntensidad ?? DEFAULTS.fondoIntensidad });
    } catch (e2) {
      setError(e2?.message || "No se pudo usar esa imagen.");
    }
    setSubiendoFoto(false);
  };

  const quitarFoto = () => actualizar({ fondoImagen: null });

  // Se manda directo a <body> con un portal — así el overlay siempre cubre
  // TODA la pantalla y queda arriba de todo, sin importar en qué parte del
  // árbol de la página viva <PersonalizarCuenta> cuando se abre.
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 }} onClick={cerrarSinGuardar}>
      <div style={{ background: T.card, borderRadius: 16, padding: 0, width: 520, maxWidth: "94vw", maxHeight: "88vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: `1px solid ${T.lineSoft}`, position: "sticky", top: 0, background: T.card, zIndex: 1 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: T.ink }}>Personalizar cuenta</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Los cambios se ven al instante — Guardar los deja para la próxima vez</div>
          </div>
          <button onClick={cerrarSinGuardar} style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}><X size={18} color={T.muted} /></button>
        </div>

        <div style={{ padding: 22, display: "grid", gap: 22 }}>
          {/* Tema */}
          <div>
            <div style={seccionTitulo}><Sun size={14} /> Tema</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "claro", label: "Claro", Ico: Sun }, { id: "oscuro", label: "Oscuro", Ico: Moon }].map(({ id, label, Ico }) => (
                <button key={id} onClick={() => actualizar({ tema: id })} style={opcionBtn(prefs.tema === id)}>
                  <Ico size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipografía */}
          <div>
            <div style={seccionTitulo}><Type size={14} /> Tipografía</div>
            <select value={prefs.fuente} onChange={(e) => actualizar({ fuente: e.target.value })} style={selStyle}>
              {FUENTES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>

          {/* Densidad */}
          <div>
            <div style={seccionTitulo}><LayoutGrid size={14} /> Densidad de la interfaz</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "comoda", label: "Cómoda" }, { id: "compacta", label: "Compacta" }].map(({ id, label }) => (
                <button key={id} onClick={() => actualizar({ densidad: id })} style={opcionBtn(prefs.densidad === id)}>{label}</button>
              ))}
            </div>
          </div>

          {/* Fondo */}
          <div>
            <div style={seccionTitulo}><ImageIcon size={14} /> Imagen de fondo</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFoto} style={{ display: "none" }} />
            {prefs.fondoImagen ? (
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ height: 110, borderRadius: 10, border: `1px solid ${T.line}`, backgroundColor: T.paper, backgroundImage: `url(${prefs.fondoImagen})`, backgroundSize: prefs.fondoAjuste === "completa" ? "contain" : "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => actualizar({ fondoAjuste: "llenar" })} style={{ ...opcionBtn((prefs.fondoAjuste || "llenar") === "llenar"), flex: 1 }} title="La foto cubre toda la pantalla; si no coincide la forma, se recortan los bordes">Llenar pantalla</button>
                  <button onClick={() => actualizar({ fondoAjuste: "completa" })} style={{ ...opcionBtn(prefs.fondoAjuste === "completa"), flex: 1 }} title="Se ve la foto completa, sin recortar; pueden quedar franjas a los lados">Ver completa</button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={elegirFoto} disabled={subiendoFoto} style={{ ...opcionBtn(false), flex: 1 }}>Cambiar foto</button>
                  <button onClick={quitarFoto} style={{ ...opcionBtn(false), color: T.bad, borderColor: T.bad, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}><Trash2 size={14} /> Quitar</button>
                </div>
                <label style={{ fontSize: 11.5, color: T.muted }}>
                  Qué tanto se ve la foto
                  <input type="range" min={0} max={100} value={prefs.fondoIntensidad ?? DEFAULTS.fondoIntensidad} onChange={(e) => actualizar({ fondoIntensidad: Number(e.target.value) })} style={{ display: "block", width: "100%", marginTop: 6 }} />
                </label>
              </div>
            ) : (
              <button onClick={elegirFoto} disabled={subiendoFoto} style={{ width: "100%", border: `1px dashed ${T.line}`, borderRadius: 10, padding: "16px", background: T.paper, color: T.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {subiendoFoto ? "Cargando…" : "Subir una foto"}
              </button>
            )}
          </div>

          {error && <div style={{ background: T.badSoft, border: `1px solid ${T.bad}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: T.bad }}>{error}</div>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 22px", borderTop: `1px solid ${T.lineSoft}`, position: "sticky", bottom: 0, background: T.card }}>
          <button onClick={restablecer} style={{ background: "none", border: "none", color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>Restablecer</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cerrarSinGuardar} style={{ ...opcionBtn(false) }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ border: "none", background: T.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", opacity: guardando ? 0.7 : 1 }}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const seccionTitulo = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" };
const selStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 13.5, background: T.card, color: T.ink, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const opcionBtn = (activo) => ({
  display: "flex", alignItems: "center", gap: 6, justifyContent: "center", flex: "none",
  border: `1px solid ${activo ? T.brand : T.line}`, borderRadius: 9, padding: "9px 14px",
  background: activo ? T.brandSoft : "#fff", color: activo ? T.brand : T.inkSoft,
  fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
});
