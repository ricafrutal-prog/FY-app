import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";

// Un solo calendario para elegir un rango: primer clic = día inicial, segundo clic = día final.
// Props: desde / hasta (YYYY-MM-DD, pueden ir vacíos), onChange(desde, hasta), max (YYYY-MM-DD, opcional).
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const fmt = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

export default function RangoFechas({ desde, hasta, onChange, max }) {
  const [abierto, setAbierto] = useState(false);
  const base = desde || new Date().toISOString().slice(0, 10);
  const [vista, setVista] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1 });
  const [ancla, setAncla] = useState(null); // primer clic hecho, falta el final
  const [sobre, setSobre] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAbierto(false); setAncla(null); } };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const mover = (n) => setVista((v) => { const t = v.y * 12 + v.m + n; return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 }; });
  const primerDia = (new Date(vista.y, vista.m, 1).getDay() + 6) % 7; // lunes = 0
  const numDias = new Date(vista.y, vista.m + 1, 0).getDate();
  const celdas = [...Array(primerDia).fill(null), ...Array.from({ length: numDias }, (_, i) => i + 1)];

  const clic = (dia) => {
    const f = iso(vista.y, vista.m, dia);
    if (max && f > max) return;
    if (!ancla) { setAncla(f); onChange(f, f); return; }
    const a = ancla <= f ? ancla : f, b = ancla <= f ? f : ancla;
    onChange(a, b);
    setAncla(null);
    setAbierto(false);
  };

  // Rango que se pinta: el ya elegido, o (mientras falta el final) del ancla al día bajo el mouse.
  let r1 = desde, r2 = hasta;
  if (ancla && sobre) { r1 = ancla <= sobre ? ancla : sobre; r2 = ancla <= sobre ? sobre : ancla; }

  const texto = desde ? (hasta && hasta !== desde ? `${fmt(desde)} – ${fmt(hasta)}` : fmt(desde)) : "Elige un rango";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="sel" onClick={() => setAbierto((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", border: "1px solid #E6E3DB", borderRadius: 11, background: "#fff", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", minWidth: 250, textAlign: "left", color: "#16161B", backgroundImage: "none" }}>
        <CalendarRange size={16} color="#8C8C97" /> <span>{texto}</span>
      </button>
      {abierto && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 80, background: "#fff", border: "1px solid #E6E3DB", borderRadius: 14, boxShadow: "0 12px 32px rgba(0,0,0,.14)", padding: 14, width: 290, color: "#16161B" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" onClick={() => mover(-1)} style={navBtn}><ChevronLeft size={16} /></button>
            <strong style={{ fontSize: 13.5 }}>{MESES[vista.m]} {vista.y}</strong>
            <button type="button" onClick={() => mover(1)} style={navBtn}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", rowGap: 2, textAlign: "center" }}>
            {DIAS.map((d) => <div key={d} style={{ fontSize: 10.5, color: "#8C8C97", padding: "4px 0", fontWeight: 600 }}>{d}</div>)}
            {celdas.map((dia, i) => {
              if (!dia) return <div key={`v${i}`} />;
              const f = iso(vista.y, vista.m, dia);
              const deshab = max && f > max;
              const extremo = f === r1 || f === r2;
              const dentro = r1 && r2 && f > r1 && f < r2;
              return (
                <div key={f} style={{ background: dentro || (extremo && r1 !== r2) ? "#DDF0EA" : "transparent", borderRadius: f === r1 && r1 !== r2 ? "99px 0 0 99px" : f === r2 && r1 !== r2 ? "0 99px 99px 0" : 0 }}>
                  <button type="button" disabled={deshab} onClick={() => clic(dia)} onMouseEnter={() => setSobre(f)}
                    style={{ width: "100%", height: 32, border: "none", borderRadius: 99, cursor: deshab ? "default" : "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: extremo ? 700 : 500, background: extremo ? "#0F6E66" : "transparent", color: extremo ? "#fff" : deshab ? "#C9C9CF" : "#16161B" }}>
                    {dia}
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: "#8C8C97", marginTop: 8, textAlign: "center" }}>
            {ancla ? "Ahora elige el día final" : "Elige el día inicial y luego el final"}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn = { border: "1px solid #E6E3DB", background: "#fff", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#41414C" };
