// Script de PRUEBA, de solo lectura — no modifica nada en Odoo ni en nuestra
// base de datos. Sirve para confirmar que la conexión funciona y para ver,
// con datos reales, cómo se llaman las sucursales del lado de Odoo (para
// poder relacionarlas después con los nombres que usamos en la plataforma).
//
// Uso (desde app/backend, con el .env ya lleno):  npm run odoo-explore
import dotenv from "dotenv";
dotenv.config();

import { odooListDatabases, odooLogin, odooExecuteKw } from "../odoo.js";

async function main() {
  console.log("— Paso 1: ¿se puede llegar al servidor de Odoo? —");
  try {
    const dbs = await odooListDatabases();
    console.log("Bases de datos visibles:", dbs);
    if (dbs?.length && !process.env.ODOO_DB) {
      console.log(`\n⚠️  No tienes ODOO_DB en tu .env. Prueba con: ODOO_DB=${dbs[0]}\n`);
    }
  } catch (e) {
    console.log("No se pudo listar bases de datos (normal, muchas instancias lo bloquean):", e.message);
  }

  if (!process.env.ODOO_DB) {
    console.log("\n❌ Necesito que pongas ODOO_DB en el .env antes de seguir. Avísame y vemos cómo encontrarlo.");
    process.exit(1);
  }

  console.log("\n— Paso 2: iniciar sesión —");
  const uid = await odooLogin();
  console.log("✅ Sesión iniciada. uid:", uid);

  console.log("\n— Paso 3: sucursales (puntos de venta) registradas en Odoo —");
  const sucursales = await odooExecuteKw(uid, "pos.config", "search_read", [[]], { fields: ["id", "name"] });
  console.table(sucursales);

  console.log("\n— Paso 4: campos disponibles en report.pos.order —");
  const campos = await odooExecuteKw(uid, "report.pos.order", "fields_get", [], { attributes: ["string", "type"] });
  const nombres = Object.keys(campos).sort();
  console.log(`(${nombres.length} campos en total)`);
  const relevantes = nombres.filter((n) => /date|total|price|config|amount/i.test(n));
  console.log("Campos que parecen relevantes:", relevantes);

  console.log("\n— Paso 5: probando traer ventas de los últimos 7 días —");
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const candidatosFecha = ["date_order", "date", "order_date"].filter((c) => nombres.includes(c));
  const candidatosTotal = ["price_total", "amount_total", "total"].filter((c) => nombres.includes(c));

  let ok = false;
  for (const campoFecha of candidatosFecha.length ? candidatosFecha : ["date_order"]) {
    for (const campoTotal of candidatosTotal.length ? candidatosTotal : ["price_total"]) {
      try {
        const muestra = await odooExecuteKw(
          uid,
          "report.pos.order",
          "read_group",
          [[[campoFecha, ">=", fmt(desde)], [campoFecha, "<=", fmt(hasta)]], [`${campoTotal}:sum`], [`${campoFecha}:day`, "config_id"]],
          {}
        );
        console.log(`✅ Funcionó con fecha="${campoFecha}" y total="${campoTotal}":`);
        console.log(JSON.stringify(muestra, null, 2));
        ok = true;
        break;
      } catch (e) {
        console.log(`❌ fecha="${campoFecha}" / total="${campoTotal}": ${e.message}`);
      }
    }
    if (ok) break;
  }
  if (!ok) console.log('\nNinguna combinación funcionó — revisa la lista de "campos que parecen relevantes" de arriba y mándamela completa.');

  console.log("\n✅ Listo. Copia y pégame todo lo que salió arriba en el chat.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
