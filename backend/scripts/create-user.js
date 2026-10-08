// Crea un usuario que va a poder iniciar sesión en la plataforma.
// Uso — usuario normal (ve toda la plataforma):
//   npm run create-user -- usuario contraseña
// Uso — usuario de una sola sucursal (solo ve el apartado de Sucursales):
//   npm run create-user -- usuario contraseña "Nombre de la sucursal"
// Uso — usuario de inventarios (en Gestión solo entra a Inventarios y a
// Cortes › Auditoría; solo puede escribir en lo de Inventarios y en Auditoría):
//   npm run create-user -- usuario contraseña --rol=inventarios
// Uso — usuario auditor (en Gestión solo entra a Cortes, todos los paneles
// menos Auditoría; sin Configuración):
//   npm run create-user -- usuario contraseña --rol=auditor
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import { initDb, getUserByUsername, createUser, pool } from "../db.js";

async function main() {
  const argv = process.argv.slice(2);
  const rolFlag = argv.find((a) => a.startsWith("--rol="));
  const rolElegido = rolFlag ? rolFlag.slice("--rol=".length) : null;
  const [username, password, sucursal] = argv.filter((a) => !a.startsWith("--"));
  if (rolElegido && !["inventarios", "auditor"].includes(rolElegido)) {
    console.log('Rol no reconocido. Los roles son --rol=inventarios y --rol=auditor (o déjalo vacío para admin / usa una sucursal).');
    process.exit(1);
  }
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
  const role = rolElegido || (sucursal ? "sucursal" : "admin");
  await createUser(username, hash, role, role === "sucursal" ? sucursal : null);
  console.log(
    role === "inventarios"
      ? `✅ Usuario "${username}" creado con rol inventarios — en Gestión solo entra a Inventarios y a Cortes › Auditoría.`
      : role === "auditor"
      ? `✅ Usuario "${username}" creado con rol auditor — en Gestión solo entra a Cortes (sin Auditoría ni Configuración).`
      : sucursal
      ? `✅ Usuario "${username}" creado para la sucursal "${sucursal}" — solo va a ver ese apartado.`
      : `✅ Usuario "${username}" creado. Ya puede iniciar sesión con esa contraseña.`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("Error creando el usuario:", err.message);
  process.exit(1);
});
