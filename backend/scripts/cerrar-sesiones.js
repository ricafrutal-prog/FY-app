// Libera sesiones atoradas. Como cada cuenta solo puede tener UNA sesión abierta,
// si alguien se queda "bloqueado" (ya cerró todo pero la plataforma todavía
// cree que su sesión sigue abierta), esto la libera al instante.
//   npm run cerrar-sesiones -- usuario    -> libera solo a ese usuario
//   npm run cerrar-sesiones -- --todas    -> libera a todos (todos tendrán que volver a iniciar sesión)
import dotenv from "dotenv";
dotenv.config();

import { initDb, cerrarSesion, cerrarTodasLasSesiones, pool } from "../db.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.log("Uso: npm run cerrar-sesiones -- usuario   (o  -- --todas)");
    process.exit(1);
  }
  await initDb();
  if (arg === "--todas") {
    await cerrarTodasLasSesiones();
    console.log("✅ Se cerraron todas las sesiones. Todos tendrán que iniciar sesión otra vez.");
  } else {
    await cerrarSesion(arg);
    console.log(`✅ Sesión de "${arg}" liberada.`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
