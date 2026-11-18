// Ventas de sucursales: total de venta por sucursal y por día, para sucursales propias y franquicias.
// Se cargan desde un reporte de Odoo (Excel) que el navegador lee; aquí solo se guardan los totales.
// Colección interna "ventas_sucursales": un documento por tipo + sucursal + mes, con los días dentro,
// para que un año completo sea poca información. Volver a cargar un periodo reemplaza esos días.
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS = new Set(["propias", "franquicias"]);
const COL = "ventas_sucursales";

export function montarVentasSucursales(app, { requireAuth, getItem, upsertItem, listCollection, asyncRoute }) {
  const soloAdmin = (req, res, next) => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "No tienes permiso para esto" });
    next();
  };

  // Ventas de un rango de fechas (máximo 400 días): { filas: [{ tipo, sucursal, fecha, total }] }
  app.get("/api/ventas-sucursales", requireAuth, soloAdmin, asyncRoute(async (req, res) => {
    const { desde, hasta } = req.query;
    if (!FECHA_RE.test(String(desde || "")) || !FECHA_RE.test(String(hasta || "")) || desde > hasta) return res.status(400).json({ error: "Fechas inválidas" });
    if ((new Date(hasta) - new Date(desde)) / 86400000 > 400) return res.status(400).json({ error: "El rango es demasiado grande" });
    const mDesde = desde.slice(0, 7), mHasta = hasta.slice(0, 7);
    const docs = (await listCollection(COL)).filter((d) => d && d.mes >= mDesde && d.mes <= mHasta);
    const filas = [];
    for (const d of docs) for (const [fecha, total] of Object.entries(d.dias || {})) if (fecha >= desde && fecha <= hasta) filas.push({ tipo: d.tipo, sucursal: d.sucursal, fecha, total });
    res.json({ filas });
  }));

  // Guarda filas { sucursal, fecha, total } del tipo elegido. Si el día ya existía, se reemplaza.
  app.post("/api/ventas-sucursales/importar", requireAuth, soloAdmin, asyncRoute(async (req, res) => {
    const { tipo, filas } = req.body || {};
    if (!TIPOS.has(tipo)) return res.status(400).json({ error: "Elige propias o franquicias" });
    if (!Array.isArray(filas) || !filas.length) return res.status(400).json({ error: "No hay ventas para guardar" });
    if (filas.length > 30000) return res.status(400).json({ error: "El archivo trae demasiadas filas" });
    const grupos = new Map(); // `${sucursal}|${mes}` -> { sucursal, mes, dias }
    let min = "", max = "";
    for (const f of filas) {
      const sucursal = String((f && f.sucursal) || "").trim().slice(0, 80);
      const fecha = String((f && f.fecha) || "");
      const total = Math.round(Number(f && f.total) * 100) / 100;
      if (!sucursal || !FECHA_RE.test(fecha) || !Number.isFinite(total)) return res.status(400).json({ error: "Hay filas con datos inválidos" });
      const mes = fecha.slice(0, 7), k = `${sucursal}|${mes}`;
      if (!grupos.has(k)) grupos.set(k, { sucursal, mes, dias: {} });
      grupos.get(k).dias[fecha] = total; // si el archivo repite un día de una sucursal, queda la última fila
      if (!min || fecha < min) min = fecha;
      if (!max || fecha > max) max = fecha;
    }
    const sucursales = new Set();
    for (const g of grupos.values()) {
      const id = `${tipo}|${g.sucursal}|${g.mes}`;
      const doc = (await getItem(COL, id)) || { id, tipo, sucursal: g.sucursal, mes: g.mes, dias: {} };
      doc.dias = { ...doc.dias, ...g.dias };
      doc.actualizado = new Date().toISOString();
      doc.actualizadoPor = req.user.username;
      await upsertItem(COL, id, doc);
      sucursales.add(g.sucursal);
    }
    res.json({ ok: true, filas: filas.length, sucursales: sucursales.size, desde: min, hasta: max });
  }));
}
