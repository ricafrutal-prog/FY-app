// Crea un usuario que va a poder iniciar sesión en la plataforma.
// Uso — usuario normal (ve toda la plataforma):
//   npm run create-user -- usuario contraseña
// Uso — usuario de una sola sucursal (solo ve el apartado de Sucursales):
//   npm run create-user -- usuario contraseña "Nombre de la sucursal"
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { initDb, getUserByUsername, createUser, pool } from "../db.js";

async function main() {
  const [, , username, password, sucursal] = process.argv;
  if (!username || !password) {
    console.log('Uso: npm run create-user -- usuario contraseña ["Nombre de la sucursal"]');
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
  const role = sucursal ? "sucursal" : "admin";
  await createUser(username, hash, role, sucursal || null);
  console.log(
    sucursal
      ? `✅ Usuario "${username}" creado para la sucursal "${sucursal}" — solo va a ver ese apartado.`
      : `✅ Usuario "${username}" creado. Ya puede iniciar sesión con esa contraseña.`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("Error creando el usuario:", err.message);
  process.exit(1);
});
