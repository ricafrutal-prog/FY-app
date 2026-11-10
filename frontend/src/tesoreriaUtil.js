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
  if (!String(m.folio).trim() || !String(m.concepto).trim()) return false;
  if (m.gcTipo === "cierre") return egr === 0; // el cierre de un gasto por comprobar puede ir en $0 (se gastó todo)
  return (ing > 0) !== (egr > 0);
};

// Campos que ligan un renglón con una entrega de Cortes o con un gasto por comprobar (se conservan al guardar).
export const camposLigados = (m) => ({
  ...(m.entregaId != null ? { entregaId: m.entregaId, entregaFolio: m.entregaFolio, montoEntrega: m.montoEntrega } : {}),
  ...(m.gcId != null ? { gcId: m.gcId, gcFolio: m.gcFolio, gcTipo: m.gcTipo, ...(m.gcTipo === "cierre" ? { gcComprobado: Number(m.gcComprobado) || 0 } : {}) } : {}),
});
export const esLigado = (m) => m.entregaId != null || m.gcId != null;

// ---- Gastos por comprobar ----
// Se entrega efectivo (renglón de egreso "GC-n", gcTipo "entrega"). Se cierra con un renglón gcTipo "cierre" que
// trae lo devuelto en efectivo (ingreso, puede ser $0) y lo comprobado con papeles físicos (gcComprobado).
// Así el efectivo solo se mueve una vez y no se inflan ingresos ni egresos con compras que ya salieron de caja.
export const gastosPorComprobar = (capturas) => {
  const mapa = new Map();
  for (const c of [...capturas].sort(ordenCaptura)) {
    for (const m of c.movimientos || []) {
      if (m.gcId == null) continue;
      const g = mapa.get(m.gcId) || { id: m.gcId, folio: m.gcFolio, entregado: 0, devuelto: 0, comprobado: 0, cerrado: false };
      if (m.gcTipo === "cierre") { g.devuelto += tesNum(m.ingreso); g.comprobado += Number(m.gcComprobado) || 0; g.cerrado = true; g.fechaCierre = c.fecha; }
      else { g.entregado += tesNum(m.egreso); g.fecha = c.fecha; g.nombre = m.nombre; g.concepto = m.concepto; g.folio = m.folio; } // el folio es el mismo de la numeración de Tesorería
      mapa.set(m.gcId, g);
    }
  }
  return [...mapa.values()].filter((g) => g.entregado > 0);
};
// Los renglones llevan folio, categoría, subcategoría y detalle como cualquier otro movimiento (se capturan a
// mano); lo único fijo es la marca interna gcId/gcTipo que los liga como "gasto por comprobar".
export const movimientoGastoPorComprobar = () => ({ ...movimientoVacio(), gcId: `gc-${Date.now()}`, gcTipo: "entrega" });
export const movimientoCierreGC = (g, devuelto) => ({
  ...movimientoVacio(), nombre: g.nombre || "",
  concepto: `Cierre de gasto por comprobar (folio ${g.folio})`, ingreso: devuelto > 0 ? String(devuelto) : "", egreso: "",
  gcId: g.id, gcFolio: g.folio, gcTipo: "cierre", gcComprobado: Math.round((g.entregado - devuelto) * 100) / 100,
});

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

const redondear2 = (n) => Math.round(n * 100) / 100;

// ---- Recepción de las entregas de efectivo de Cortes (Elías → tesorería) ----
// Cada entrega finalizada en Cortes › Entrega de Efectivo trae su folio. En Tesorería se recibe como un
// ingreso con folio "E-<folio>"; ese renglón guarda entregaId / entregaFolio / montoEntrega, así que una
// entrega está "por recibir" mientras ningún renglón de Tesorería la tenga ligada.
export const etiquetaEntrega = (folio) => `E-${folio}`;
export const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";
export const movimientoDeEntrega = (s) => ({
  ...movimientoVacio(),
  folio: etiquetaEntrega(s.folio), categoria: "Entrega", subcategoria: "Cortes", nombre: s.entrega || "",
  concepto: `Recepción de entrega de ${primerNombre(s.entrega)}`.trim(),
  ingreso: String(Number(s.monto) || 0), entregaId: s.id, entregaFolio: s.folio, montoEntrega: Number(s.monto) || 0,
});
// Recibido − entregado de un renglón que viene de una entrega (null si no es de una entrega).
export const diferenciaEntrega = (m) => (m.entregaId != null && m.montoEntrega != null ? redondear2(tesNum(m.ingreso) - tesNum(m.montoEntrega)) : null);
export const diasDesde = (iso, hoy) => {
  const t = (s) => { const [y, m, d] = String(s).split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(hoy) - t(iso)) / 86400000);
};
// Orden en que se capturaron (la más antigua primero).
export const ordenCaptura = (a, b) => String(a.creadoEn || "").localeCompare(String(b.creadoEn || "")) || String(a.id).localeCompare(String(b.id));
// "Saldo inicial del día" de una captura = saldo inicial + neto de todas las capturas anteriores a ella.
export const saldoAntesDe = (saldoBase, capturas, id) => {
  let s = tesNum(saldoBase);
  for (const c of [...capturas].sort(ordenCaptura)) {
    if (c.id === id) break;
    s += totalesDe(c.movimientos || []).neto;
  }
  return redondear2(s);
};
// Saldo corrido: el saldo después de cada renglón, partiendo del saldo inicial del día.
export const saldosCorridos = (inicio, movs) => {
  let s = tesNum(inicio);
  return movs.map((m) => { s = redondear2(s + tesNum(m.ingreso) - tesNum(m.egreso)); return s; });
};

// Columnas para Imprimir / PDF / Excel del detalle de una captura (cada renglón puede traer .saldo).
export const columnasMovimientos = (money) => [
  { titulo: "Folio", valor: (m) => m.folio },
  { titulo: "Categoría", valor: (m) => m.categoria || "" },
  { titulo: "Subcategoría", valor: (m) => m.subcategoria || "" },
  { titulo: "Detalle", valor: (m) => m.detalle || "" },
  { titulo: "Nombre", valor: (m) => m.nombre || "" },
  { titulo: "Concepto", valor: (m) => m.concepto },
  { titulo: "Ingreso", valor: (m) => (tesNum(m.ingreso) ? money(tesNum(m.ingreso)) : "") },
  { titulo: "Egreso", valor: (m) => (tesNum(m.egreso) ? money(tesNum(m.egreso)) : "") },
  { titulo: "Saldo", valor: (m) => (m.saldo != null ? money(m.saldo) : "") },
];
