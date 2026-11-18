// Elimina una cuenta de usuario (y sus sesiones abiertas). NO se puede deshacer.
// Solo borra la cuenta: las capturas, pendientes, etc. ya hechas se quedan como están.
// Uso:
//   npm run delete-user -- usuario            (solo muestra qué cuenta es, no borra nada)
//   npm run delete-user -- usuario --confirmar (la borra)
import dotenv from "dotenv";
dotenv.config();

import { initDb, getUserByUsername, pool } from "../db.js";

async function main() {
  const [, , username, bandera] = process.argv;
  if (!username) {
    console.log("Uso: npm run delete-user -- usuario [--confirmar]");
    process.exit(1);
  }
  await initDb();
  const u = await getUserByUsername(username);
  if (!u) {
    console.log(`No existe un usuario "${username}". Usa "npm run list-users" para ver los que hay.`);
    await pool.end();
    process.exit(1);
  }
  if (["administrador_ricardo", "administrador_ramiro", "administrador_carlos"].includes(u.username)) {
    console.log("Por seguridad, este script no borra cuentas de administrador.");
    await pool.end();
    process.exit(1);
  }
  console.log(`Cuenta: ${u.username} · rol: ${u.role}${u.sucursal ? ` · sucursal: ${u.sucursal}` : ""}`);
  if (bandera !== "--confirmar") {
    console.log("No se borró nada. Si es la cuenta correcta, repite el comando agregando --confirmar");
    await pool.end();
    return;
  }
  await pool.query("DELETE FROM users WHERE username = $1", [u.username]);
  // Si hay una tabla de sesiones, también se cierran (se ignora si no existe).
  try { await pool.query("DELETE FROM sesiones WHERE username = $1", [u.username]); } catch { /* sin tabla de sesiones por usuario */ }
  // Si tenía huella o rostro registrado en el checador de oficina, también se quita.
  try { await pool.query("DELETE FROM collection_items WHERE collection = 'checador_dispositivos' AND data->>'empleado' = $1 AND data->>'propio' = 'true'", [u.username]); } catch { /* estructura distinta: se puede quitar desde Configuración de cuenta */ }
  console.log(`✅ Cuenta "${u.username}" eliminada.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error eliminando la cuenta:", err.message);
  process.exit(1);
});
