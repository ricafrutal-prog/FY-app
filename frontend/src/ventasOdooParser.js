// Lee un reporte de ventas de Odoo (Excel) y lo convierte en filas { sucursal, fecha, total }.
// Entiende estos formatos, que salen de Punto de venta → Informes en Odoo:
//   1) Tabla dinámica con días en las filas y, al expandir un día, las sucursales debajo de él (lo más común).
//   2) Tabla dinámica con sucursales en las filas y días en las columnas (o al revés).
//   3) Lista plana con columnas "Punto de venta", "Fecha" y "Total".
//   4) Solo totales por día, sin sucursales: se pide el nombre de la sucursal (si es de una sola).
// En las tablas dinámicas toma la medida "Precio total"; las demás (pedidos, cantidad) se ignoran.
const MESES = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null);

// Texto o número de Excel → "YYYY-MM-DD", o null si no parece una fecha de un día.
export function parseFecha(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    if (v < 30000 || v > 80000) return null;
    const d = new Date(Math.round((v - 25569) * 86400000));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (v instanceof Date) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
  const t = String(v).trim().toLowerCase().replace(/\./g, "");
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)\s+(?:de\s+)?(\d{4})/);
  if (m && MESES[m[2].slice(0, 3)]) return iso(+m[3], MESES[m[2].slice(0, 3)], +m[1]);
  m = t.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m && MESES[m[1].slice(0, 3)]) return iso(+m[3], MESES[m[1].slice(0, 3)], +m[2]);
  return null;
}
// "noviembre 2026" (un mes completo, no un día)
const esMesAnio = (v) => typeof v === "string" && /^[a-záéíóú]+\s+(de\s+)?\d{4}$/i.test(v.trim()) && !parseFecha(v);

// "Frutal Metro Sendero 1" → "Metro Sendero 1"
export function limpiarSucursal(s) {
  return String(s || "").replace(/\s+/g, " ").trim().replace(/^frutal\s+/i, "").trim();
}

const numero = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const sangria = (v) => (typeof v === "string" ? (v.match(/^\s*/) || [""])[0].length : 0);
const redondear = (n) => Math.round(n * 100) / 100;

function sumar(filas) {
  const m = new Map();
  for (const f of filas) {
    const k = `${f.sucursal}|${f.fecha}`;
    m.set(k, redondear((m.get(k) || 0) + f.total));
  }
  return [...m.entries()].map(([k, total]) => { const i = k.lastIndexOf("|"); return { sucursal: k.slice(0, i), fecha: k.slice(i + 1), total }; });
}

// Lista plana con encabezados: Punto de venta / Fecha / Total.
function leerLista(rows) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const enc = (rows[i] || []).map((c) => String(c ?? "").toLowerCase());
    const cSuc = enc.findIndex((c) => /punto de venta|sucursal|tienda|config/.test(c));
    const cFecha = enc.findIndex((c) => /^fecha|date|fecha de|d[ií]a/.test(c));
    let cTotal = enc.findIndex((c, j) => j !== cSuc && j !== cFecha && /total|monto|importe/.test(c));
    if (cTotal < 0) cTotal = enc.findIndex((c, j) => j !== cSuc && j !== cFecha && /venta/.test(c));
    if (cSuc >= 0 && cFecha >= 0 && cTotal >= 0 && new Set([cSuc, cFecha, cTotal]).size === 3) {
      const filas = [];
      for (const r of rows.slice(i + 1)) {
        const fecha = parseFecha(r?.[cFecha]), total = numero(r?.[cTotal]), suc = limpiarSucursal(r?.[cSuc]);
        if (fecha && total != null && suc) filas.push({ sucursal: suc, fecha, total });
      }
      if (filas.length) return { formato: "lista", filas: sumar(filas), diarios: [], avisos: [] };
    }
  }
  return null;
}

// Tabla dinámica de Odoo (con encabezado de medidas) o una sola columna de totales (sin encabezado).
function leerPivot(rows) {
  const avisos = [];
  // Fila con los nombres de las medidas ("Precio total"); la fila de arriba trae los grupos de columnas (meses, días…).
  let filaMedidas = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) if ((rows[i] || []).some((c, j) => j > 0 && /^precio total$/i.test(String(c ?? "").trim()))) { filaMedidas = i; break; }
  const conEncabezado = filaMedidas >= 0;
  const columnas = []; // { j, tipo: "mes"|"total"|"fecha"|"otro", etiqueta }
  if (conEncabezado) {
    const medidas = rows[filaMedidas], grupos = filaMedidas > 0 ? rows[filaMedidas - 1] || [] : [];
    medidas.forEach((c, j) => {
      if (j === 0 || !/^precio total$/i.test(String(c ?? "").trim())) return;
      let g = null;
      for (let k = j; k >= Math.max(1, j - 3); k--) if (grupos[k] != null && String(grupos[k]).trim() !== "") { g = grupos[k]; break; }
      const f = parseFecha(g);
      const tipo = g == null || /^total$/i.test(String(g).trim()) ? "total" : f ? "fecha" : esMesAnio(g) ? "mes" : "otro";
      columnas.push({ j, tipo, etiqueta: tipo === "fecha" ? f : tipo === "otro" ? limpiarSucursal(g) : String(g ?? "") });
    });
  }
  const primerNumero = (r, tipos) => {
    if (!conEncabezado) { const n = (r || []).slice(1).map(numero).filter((x) => x != null); return n.length ? n[0] : null; }
    for (const c of columnas) if (tipos.includes(c.tipo)) { const v = numero(r[c.j]); if (v != null) return v; }
    return null;
  };

  const items = [];
  let varias = false;
  for (const r of rows.slice(conEncabezado ? filaMedidas + 1 : 0)) {
    if (!r || r[0] == null || String(r[0]).trim() === "") continue;
    const nombre = String(r[0]).trim();
    if (/^total$/i.test(nombre)) continue;
    if (!conEncabezado && (r.slice(1).map(numero).filter((x) => x != null).length > 1)) varias = true;
    items.push({ fila: r, sangria: sangria(r[0]), nombre, fecha: parseFecha(r[0]), mes: esMesAnio(r[0]) });
  }
  if (!items.length) return { formato: "ninguno", filas: [], diarios: [], avisos };
  if (varias) avisos.push("El reporte trae varias columnas de números; se usó la primera. Lo ideal es exportar solo el precio total.");

  const hayNiveles = new Set(items.map((x) => x.sangria)).size > 1;
  const filas = [], diarios = [];
  const columnasSucursal = columnas.filter((c) => c.tipo === "otro");
  const columnasFecha = columnas.filter((c) => c.tipo === "fecha");
  const pila = [];
  items.forEach((it, i) => {
    if (hayNiveles) while (pila.length && pila[pila.length - 1].sangria >= it.sangria) pila.pop();
    const esHoja = hayNiveles ? !(items[i + 1] && items[i + 1].sangria > it.sangria) : true;
    if (esHoja && !it.mes) {
      const padreSuc = [...pila].reverse().find((p) => !p.fecha && !p.mes);
      const padreFecha = [...pila].reverse().find((p) => p.fecha);
      if (it.fecha) {
        if (padreSuc) { const v = primerNumero(it.fila, ["mes", "total", "fecha"]); if (v != null) filas.push({ sucursal: limpiarSucursal(padreSuc.nombre), fecha: it.fecha, total: v }); }
        else if (columnasSucursal.length) { for (const c of columnasSucursal) { const v = numero(it.fila[c.j]); if (v != null) filas.push({ sucursal: c.etiqueta, fecha: it.fecha, total: v }); } }
        else { const v = primerNumero(it.fila, ["mes", "total"]); if (v != null) diarios.push({ sucursal: "", fecha: it.fecha, total: v }); }
      } else if (padreFecha) {
        const v = primerNumero(it.fila, ["mes", "total"]);
        if (v != null) filas.push({ sucursal: limpiarSucursal(it.nombre), fecha: padreFecha.fecha, total: v });
      } else if (columnasFecha.length) {
        for (const c of columnasFecha) { const v = numero(it.fila[c.j]); if (v != null) filas.push({ sucursal: limpiarSucursal(it.nombre), fecha: c.etiqueta, total: v }); }
      } else if (!hayNiveles || !pila.length) {
        // Sin sangría ni fechas en columnas: el último nombre sin fecha es la sucursal de las fechas que siguen.
      }
    }
    pila.push(it);
  });
  if (!hayNiveles && !conEncabezado) {
    // Sin niveles ni encabezado: el último nombre que no es fecha es la sucursal de las fechas que siguen.
    filas.length = 0; diarios.length = 0;
    let actual = "";
    for (const it of items) {
      const v = primerNumero(it.fila, ["mes", "total", "fecha"]);
      if (it.fecha) { if (v != null) filas.push({ sucursal: actual, fecha: it.fecha, total: v }); }
      else if (!it.mes) actual = limpiarSucursal(it.nombre);
    }
  }
  const conNombre = sumar(filas.filter((f) => f.sucursal));
  const sinNombre = sumar(filas.filter((f) => !f.sucursal));
  if (conNombre.length) {
    const resultado = { formato: "tabla", filas: [...conNombre, ...sinNombre], diarios: sumar(diarios), avisos };
    return resultado;
  }
  const solo = sumar([...sinNombre, ...diarios]);
  if (solo.length) {
    avisos.push("Este archivo no trae las ventas desglosadas por sucursal, solo totales por día. Si es de una sola sucursal, escribe su nombre; si es de todas, en Odoo expande un día para ver cada sucursal, o pon las sucursales en las filas y los días en las columnas.");
    return { formato: "una sucursal", filas: solo, diarios: [], avisos };
  }
  return { formato: "ninguno", filas: [], diarios: [], avisos };
}

// rows: matriz de filas (como entrega XLSX.utils.sheet_to_json con header:1 y raw:true)
export function leerFilas(rows) {
  return leerLista(rows) || leerPivot(rows);
}

// Archivo (ArrayBuffer) → resultado. "XLSX" es la librería xlsx, que se pasa desde quien la importa.
export function leerArchivoVentas(buf, XLSX) {
  const wb = XLSX.read(buf, { type: "array" });
  let mejor = { formato: "ninguno", filas: [], diarios: [], avisos: [] };
  for (const nombre of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, defval: null, raw: true });
    const r = leerFilas(rows);
    if (r.filas.length > mejor.filas.length) mejor = r;
  }
  return mejor;
}
