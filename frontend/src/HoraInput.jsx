import { useEffect, useState } from "react";

// Enter pasa al siguiente cuadro de la captura de asistencia (estatus → entrada → salida → siguiente persona…).
export function enterAvanza(ev) {
  if (ev.key !== "Enter") return;
  ev.preventDefault();
  const campos = [...document.querySelectorAll("[data-asist-campo]")].filter((el) => !el.disabled);
  const i = campos.indexOf(ev.currentTarget);
  const sig = campos[i + 1];
  if (sig) { sig.focus(); if (sig.select) sig.select(); }
}

/* Hora en formato de 24 horas (HH:MM) en un solo cuadro. El <input type="time">
   del navegador usa am/pm según el idioma del sistema y no se puede forzar. */
export default function HoraInput({ value, onChange, disabled, style }) {
  const [txt, setTxt] = useState(value || "");
  useEffect(() => { setTxt(value || ""); }, [value]);
  const escribir = (raw) => {
    const d = raw.replace(/\D/g, "").slice(0, 4);
    const t = d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
    setTxt(t);
    if (d.length === 4 && Number(d.slice(0, 2)) <= 23 && Number(d.slice(2)) <= 59) onChange(t);
    else if (d.length === 0) onChange("");
  };
  const salir = () => {
    // Si quedó incompleta o inválida, vuelve a la última hora válida.
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(txt)) setTxt(value || "");
  };
  return <input type="text" inputMode="numeric" placeholder="HH:MM" maxLength={5} value={txt} disabled={disabled} onChange={(e) => escribir(e.target.value)} onBlur={salir} onKeyDown={enterAvanza} data-asist-campo="1" style={style} />;
}
