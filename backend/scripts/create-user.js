// Crea un usuario que va a poder iniciar sesión en la plataforma.
// Uso (desde app/backend):  npm run create-user -- usuario contraseña
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { initDb, getUserByUsername, createUser, pool } from "../db.js";

async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.log("Uso: npm run create-user -- usuario contraseña");
    process.exit(1);
  }
  if (password.length < 6) {
    console.log("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  await initDb();

  const existing = await getUserByUsername(username);
  if (existing) {
    console.log(`Ya existe un usuario "${username}". Si quieres cambiarle la contraseña, avísame.`);
    await pool.end();
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  await createUser(username, hash);
  console.log(`✅ Usuario "${username}" creado. Ya puede iniciar sesión con esa contraseña.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error creando el usuario:", err.message);
  process.exit(1);
});
