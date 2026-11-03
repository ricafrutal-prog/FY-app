// Tesorería — funciones compartidas por la pantalla de captura (App.jsx) y por
// Configuración de cuenta › Tesorería (TesoreriaAdmin.jsx).
//
// Una captura (colección "tesoreria_capturas"):
//   { id, fecha: "AAAA-MM-DD", encargado, movimientos: [{ folio, categoria, subcategoria,
//     detalle, nombre, concepto, ingreso, egreso }], creadoEn, creadoPor }
// El saldo inicial (colección "tesoreria_saldo") es un solo documento: { id: "saldo-inicial", monto }.

export const SALDO_ID = "saldo-inicial";

export const movimientoVacio = () => ({ folio: "", categoria: "", subcategoria: "", detalle: "", nombre: "", concepto: "", ingreso: "", egreso: "" });

// Texto de un campo de monto -> número (acepta "1,500.50" o "$1500").
export const tesNum = (v) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

// Deja escribir solo dígitos y un punto decimal (con máximo 2 decimales).
export const limpiarMonto = (txt) => {
  const s = String(txt).replace(/[^0-9.]/g, "");
  const [ent, ...resto] = s.split(".");
  return resto.length ? `${ent}.${resto.join("").slice(0, 2)}` : ent;
};

export const soloDigitos = (txt) => String(txt).replace(/\D/g, "").slice(0, 12);

// Una fila está completa si tiene folio, concepto y un monto (ingreso o egreso, no ambos).
export const movimientoValido = (m) => {
  const ing = tesNum(m.ingreso), egr = tesNum(m.egreso);
  return !!String(m.folio).trim() && !!String(m.concepto).trim() && (ing > 0) !== (egr > 0);
};

export const totalesDe = (movs) => {
  const ingresos = Math.round(movs.reduce((s, m) => s + tesNum(m.ingreso) * 100, 0)) / 100;
  const egresos = Math.round(movs.reduce((s, m) => s + tesNum(m.egreso) * 100, 0)) / 100;
  return { ingresos, egresos, neto: Math.round((ingresos - egresos) * 100) / 100 };
};

// Saldo = saldo inicial + todos los ingresos − todos los egresos de todas las capturas.
export const saldoActual = (saldoInicial, capturas) => {
  const base = tesNum(saldoInicial);
  const neto = capturas.reduce((s, c) => s + totalesDe(c.movimientos || []).neto, 0);
  return Math.round((base + neto) * 100) / 100;
};

// Columnas para Imprimir / PDF / Excel del detalle de una captura.
export const columnasMovimientos = (money) => [
  { titulo: "Folio", valor: (m) => m.folio },
  { titulo: "Categoría", valor: (m) => m.categoria || "" },
  { titulo: "Subcategoría", valor: (m) => m.subcategoria || "" },
  { titulo: "Detalle", valor: (m) => m.detalle || "" },
  { titulo: "Nombre", valor: (m) => m.nombre || "" },
  { titulo: "Concepto", valor: (m) => m.concepto },
  { titulo: "Ingreso", valor: (m) => (tesNum(m.ingreso) ? money(tesNum(m.ingreso)) : "") },
  { titulo: "Egreso", valor: (m) => (tesNum(m.egreso) ? money(tesNum(m.egreso)) : "") },
];
