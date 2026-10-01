// Script de PRUEBA, de solo lectura — no modifica nada en Odoo ni en nuestra
// base de datos. Sirve para confirmar cómo se llaman los campos de producto y
// cantidad dentro de "report.pos.order" (o si hace falta usar otro modelo,
// como "pos.order.line"), para poder construir el consumo por ventas
// (inventario) por producto/día/sucursal.
//
// Uso (desde app/backend, con el .env ya lleno):  npm run odoo-explore-productos
import dotenv from "dotenv";
dotenv.config();

import { odooLogin, odooExecuteKw, fechaLocalMx } from "../odoo.js";
import { ODOO_SUCURSAL_A_CONFIG } from "../odoo-sucursales.js";

async function main() {
  console.log("— Paso 1: iniciar sesión —");
  const uid = await odooLogin();
  console.log("✅ Sesión iniciada. uid:", uid);

  // Usamos una sucursal conocida (Las Puentes) y los últimos 7 días como
  // muestra — igual que hace odoo-explore.js con las ventas totales.
  const sucursalPrueba = "Las Puentes";
  const configId = ODOO_SUCURSAL_A_CONFIG[sucursalPrueba];
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);

  console.log(`\n— Paso 2: campos disponibles en report.pos.order relacionados a producto/cantidad —`);
  const campos = await odooExecuteKw(uid, "report.pos.order", "fields_get", [], { attributes: ["string", "type", "relation"] });
  const nombres = Object.keys(campos).sort();
  const relevantes = nombres.filter((n) => /product|qty|quantity|uom|categ/i.test(n));
  relevantes.forEach((n) => console.log(`  ${n} (${campos[n].type}${campos[n].relation ? " → " + campos[n].relation : ""}): ${campos[n].string}`));
  if (!relevantes.length) console.log("  (ninguno — reporte.pos.order no parece tener campos de producto)");

  console.log(`\n— Paso 3: traer 5 registros crudos de report.pos.order de los últimos 7 días (sucursal: ${sucursalPrueba}, config_id: ${configId}) —`);
  if (configId == null) {
    console.log(`  ⚠️ "${sucursalPrueba}" no está en ODOO_SUCURSAL_A_CONFIG, se omite este paso.`);
  } else {
    const camposATraer = ["date", "price_total", ...relevantes].filter((v, i, arr) => arr.indexOf(v) === i);
    try {
      const muestraCruda = await odooExecuteKw(
        uid,
        "report.pos.order",
        "search_read",
        [[["config_id", "=", configId], ["date", ">=", `${fmt(desde)} 00:00:00`], ["date", "<=", `${fmt(hasta)} 23:59:59`]]],
        { fields: camposATraer, limit: 5 }
      );
      console.log(JSON.stringify(muestraCruda, null, 2));
    } catch (e) {
      console.log(`  ❌ Error al leer report.pos.order con esos campos: ${e.message}`);
    }
  }

  console.log(`\n— Paso 4: intentar agrupar por producto y día (read_group) —`);
  const campoProducto = relevantes.find((n) => /^product_id$/.test(n)) || relevantes.find((n) => /product/i.test(n));
  const campoCantidad = relevantes.find((n) => /^(product_)?qty/i.test(n)) || relevantes.find((n) => /qty|quantity/i.test(n));
  if (!campoProducto) {
    console.log("  ⚠️ No se encontró un campo tipo product_id en report.pos.order — probablemente haya que usar otro modelo, como pos.order.line.");
  } else if (configId != null) {
    try {
      const agrupado = await odooExecuteKw(
        uid,
        "report.pos.order",
        "read_group",
        [
          [["config_id", "=", configId], ["date", ">=", `${fmt(desde)} 00:00:00`], ["date", "<=", `${fmt(hasta)} 23:59:59`]],
          [campoCantidad ? `${campoCantidad}:sum` : "price_total:sum"],
          [campoProducto, "date:day"],
        ],
        {}
      );
      console.log(`✅ Agrupado por "${campoProducto}" y "date:day"${campoCantidad ? ` sumando "${campoCantidad}"` : " (sin campo de cantidad — solo total en pesos)"}:`);
      console.log(JSON.stringify(agrupado, null, 2));
    } catch (e) {
      console.log(`  ❌ Error al agrupar: ${e.message}`);
    }
  }

  console.log(`\n— Paso 5 (respaldo): revisar si "pos.order.line" existe y tiene product_id/qty, por si report.pos.order no sirve para esto —`);
  try {
    const camposLinea = await odooExecuteKw(uid, "pos.order.line", "fields_get", [], { attributes: ["string", "type", "relation"] });
    const nombresLinea = Object.keys(camposLinea).sort();
    const relevantesLinea = nombresLinea.filter((n) => /product|qty|quantity|order_id|date/i.test(n));
    console.log(`  ✅ "pos.order.line" existe. Campos relevantes:`);
    relevantesLinea.forEach((n) => console.log(`    ${n} (${camposLinea[n].type}${camposLinea[n].relation ? " → " + camposLinea[n].relation : ""}): ${camposLinea[n].string}`));
  } catch (e) {
    console.log(`  ❌ "pos.order.line" no se pudo consultar: ${e.message}`);
  }

  console.log("\n✅ Listo. Copia y pégame todo lo que salió arriba en el chat.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
