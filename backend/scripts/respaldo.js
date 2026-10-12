// Respaldo de toda la base de datos a un archivo JSON en tu computadora.
//
//   npm run respaldo            -> hace un respaldo (solo si el último tiene 1+ día)
//   npm run respaldo -- --ya    -> lo hace ahora mismo, sin importar cuándo fue el último
//
// Los archivos se guardan FUERA del proyecto, en  ~/Respaldos Frutal Yogurt/
// (así nunca llegan a GitHub). Se conservan los últimos 30; los más viejos se
// borran solos. Incluye usuarios (con sus contraseñas ya cifradas), todas las
// colecciones y todas las listas.
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { pool } from "../db.js";

const CARPETA = path.join(os.homedir(), "Respaldos Frutal Yogurt");
const CADA_DIAS = 1;
const CONSERVAR = 30;
const forzar = process.argv.includes("--ya");

async function main() {
  fs.mkdirSync(CARPETA, { recursive: true, mode: 0o700 });

  const previos = fs.readdirSync(CARPETA).filter((f) => /^respaldo-.*\.json$/.test(f)).sort();
  if (!forzar && previos.length) {
    const ultimo = fs.statSync(path.join(CARPETA, previos[previos.length - 1]));
    const dias = (Date.now() - ultimo.mtimeMs) / 86400000;
    if (dias < CADA_DIAS) {
      console.log(`Último respaldo hace ${dias.toFixed(1)} días (cada ${CADA_DIAS}). Todavía no toca.`);
      await pool.end();
      return;
    }
  }

  const [users, colecciones, listas] = await Promise.all([
    pool.query("SELECT id, username, password_hash, role, sucursal, preferencias, created_at FROM users ORDER BY id"),
    pool.query("SELECT collection, id, data, updated_at FROM collection_items ORDER BY collection, id"),
    pool.query("SELECT name, data, updated_at FROM config_lists ORDER BY name"),
  ]);

  const respaldo = {
    version: 1,
    fecha: new Date().toISOString(),
    users: users.rows,
    collection_items: colecciones.rows,
    config_lists: listas.rows,
  };

  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const nombre = `respaldo-${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}${pad(ahora.getMinutes())}.json`;
  const destino = path.join(CARPETA, nombre);
  fs.writeFileSync(destino, JSON.stringify(respaldo), { mode: 0o600 });

  // Verifica que el archivo se pueda leer de vuelta antes de dar por bueno el respaldo.
  const leido = JSON.parse(fs.readFileSync(destino, "utf8"));
  if (leido.collection_items.length !== colecciones.rows.length || leido.users.length !== users.rows.length) {
    throw new Error("El archivo de respaldo no coincide con la base — no confíes en él.");
  }

  const todos = fs.readdirSync(CARPETA).filter((f) => /^respaldo-.*\.json$/.test(f)).sort();
  todos.slice(0, Math.max(0, todos.length - CONSERVAR)).forEach((f) => fs.unlinkSync(path.join(CARPETA, f)));

  console.log(`✅ Respaldo guardado: ${destino}`);
  console.log(`   ${users.rows.length} usuarios · ${colecciones.rows.length} registros · ${listas.rows.length} listas`);
  await pool.end();
}

main().catch((err) => {
  console.error("Error haciendo el respaldo:", err.message);
  process.exit(1);
});
