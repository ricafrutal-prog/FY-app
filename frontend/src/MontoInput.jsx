import { limpiarMonto } from "./tesoreriaUtil";

// Campo de dinero que se ve como "$3,223,324.50" mientras se escribe.
// El valor que maneja por dentro (value / onChange) es texto simple: "3223324.50".
export const formatoMonto = (raw) => {
  const s = limpiarMonto(raw ?? "");
  if (!s) return "";
  const [ent, dec] = s.split(".");
  const miles = (ent || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${miles}${dec !== undefined ? `.${dec}` : ""}`;
};

export default function MontoInput({ value, onChange, placeholder = "$0.00", ...resto }) {
  return (
    <input
      {...resto}
      value={formatoMonto(value)}
      onChange={(e) => onChange(limpiarMonto(e.target.value))}
      inputMode="decimal"
      placeholder={placeholder}
    />
  );
}
