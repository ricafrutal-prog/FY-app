// Script de PRUEBA, de solo lectura — no modifica nada en Odoo ni en nuestra base de datos.
// Sirve para ver las EMPRESAS que tiene este Odoo (propias y franquicias), qué puntos de venta
// tiene cada una y si la clave API actual puede ver las ventas de todas.
//
// Uso (desde app/backend, con el .env ya lleno):  npm run odoo-explore-empresas
import dotenv from "dotenv";
dotenv.config();

import { odooLogin, odooExecuteKw } from "../odoo.js";

async function main() {
  const uid = await odooLogin();
  console.log("✅ Sesión iniciada. uid:", uid);

  console.log("\n— Paso 1: empresas a las que tiene acceso este usuario —");
  const usuario = await odooExecuteKw(uid, "res.users", "read", [[uid]], { fields: ["name", "company_id", "company_ids"] });
  console.log("Usuario:", usuario[0].name, "· empresa actual:", JSON.stringify(usuario[0].company_id));
  const idsEmpresas = usuario[0].company_ids || [];
  const empresas = await odooExecuteKw(uid, "res.company", "read", [idsEmpresas], { fields: ["id", "name"] });
  console.table(empresas);

  console.log("\n— Paso 2: puntos de venta, con su empresa (viendo TODAS las empresas permitidas) —");
  const contexto = { allowed_company_ids: idsEmpresas };
  const puntos = await odooExecuteKw(uid, "pos.config", "search_read", [[]], { fields: ["id", "name", "company_id", "active"], context: contexto });
  console.table(puntos.map((p) => ({ id: p.id, nombre: p.name, empresa: Array.isArray(p.company_id) ? p.company_id[1] : p.company_id, activo: p.active })));

  console.log("\n— Paso 3: ventas de los últimos 7 días por punto de venta (todas las empresas) —");
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 7 * 86400000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  try {
    const grupos = await odooExecuteKw(
      uid,
      "report.pos.order",
      "read_group",
      [[["date", ">=", `${fmt(desde)} 00:00:00`], ["date", "<=", `${fmt(hasta)} 23:59:59`]], ["price_total:sum"], ["config_id"]],
      { context: contexto, lazy: false }
    );
    console.table(grupos.map((g) => ({ punto_de_venta: Array.isArray(g.config_id) ? g.config_id[1] : g.config_id, ventas_7_dias: Math.round((g.price_total || 0) * 100) / 100 })));
  } catch (e) {
    console.log("❌ No se pudieron leer las ventas:", e.message);
  }

  console.log("\n✅ Listo. Copia y pégame todo lo que salió arriba en el chat.");
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
