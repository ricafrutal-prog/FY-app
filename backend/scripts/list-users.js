// Lista los usuarios que existen (usuario, rol y sucursal) — NO muestra
// contraseñas: esas se guardan con hash (bcrypt) y no hay forma de "verlas",
// ni siquiera para quien tiene acceso a la base de datos.
// Uso:
//   npm run list-users
import dotenv from "dotenv";
dotenv.config();

import { initDb, listUsers, pool } from "../db.js";

async function main() {
  await initDb();
  const users = await listUsers();
  if (users.length === 0) {
    console.log("No hay usuarios todavía.");
  } else {
    console.log("");
    users.forEach((u) => {
      console.log(`- ${u.username}  (${u.role}${u.sucursal ? " · " + u.sucursal : ""})`);
    });
    console.log("");
  }
  await pool.end();
}

main().catch((err) => {
  console.error("Error listando usuarios:", err.message);
  process.exit(1);
});
