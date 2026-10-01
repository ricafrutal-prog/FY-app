// Le pone una contraseña NUEVA a un usuario que ya existe (para cuando se
// les olvida — la contraseña vieja no se puede "recuperar", solo reemplazar).
// Uso:
//   npm run reset-password -- usuario contraseñaNueva
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { initDb, getUserByUsername, setPasswordHash, pool } from "../db.js";

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.log("Uso: npm run reset-password -- usuario contraseñaNueva");
    process.exit(1);
  }
  if (password.length < 6) {
    console.log("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  await initDb();

  const existing = await getUserByUsername(username);
  if (!existing) {
    console.log(`No existe un usuario "${username}". Usa "npm run list-users" para ver los que hay.`);
    await pool.end();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await setPasswordHash(username, hash);
  console.log(`✅ Contraseña actualizada para "${username}".`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error actualizando la contraseña:", err.message);
  process.exit(1);
});
