// Restaura la base de datos desde un archivo de respaldo (los que crea respaldo.js).
//
//   npm run restaurar                       -> muestra qué cambiaría con el respaldo MÁS RECIENTE (no toca nada)
//   npm run restaurar -- archivo.json       -> igual, con un archivo en concreto
//   npm run restaurar -- archivo.json --aplicar
//                                           -> restaura de verdad (pide escribir RESTAURAR para confirmar)
//
// Opciones al aplicar:
//   --borrar-extra   también borra lo que NO existía en el respaldo (regresa la base EXACTAMENTE a como estaba).
//                    Sin esto, solo se recuperan/corrigen registros: lo creado después del respaldo se queda.
//   --con-usuarios   también restaura usuarios y contraseñas (por defecto NO se tocan).
//
// Antes de aplicar, SIEMPRE guarda una copia del estado actual (prerestauracion-….json)
// en ~/Respaldos Frutal Yogurt/, por si te arrepientes.
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

import { pool } from "../db.js";

const CARPETA = path.join(os.homedir(), "Respaldos Frutal Yogurt");
const args = process.argv.slice(2);
const aplicar = args.includes("--aplicar");
const borrarExtra = args.includes("--borrar-extra");
const conUsuarios = args.includes("--con-usuarios");
let archivo = args.find((a) => !a.startsWith("--"));

const clave = (c, i) => `${c}\u0000${i}`;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(texto, (r) => { rl.close(); res(r); }));
}

async function leerEstadoActual() {
  const [users, colecciones, listas] = await Promise.all([
    pool.query("SELECT id, username, password_hash, role, sucursal, preferencias, created_at FROM users ORDER BY id"),
    pool.query("SELECT collection, id, data, updated_at FROM collection_items ORDER BY collection, id"),
    pool.query("SELECT name, data, updated_at FROM config_lists ORDER BY name"),
  ]);
  return { version: 1, fecha: new Date().toISOString(), users: users.rows, collection_items: colecciones.rows, config_lists: listas.rows };
}

async function main() {
  if (!archivo) {
    const todos = fs.existsSync(CARPETA) ? fs.readdirSync(CARPETA).filter((f) => /^respaldo-.*\.json$/.test(f)).sort() : [];
    if (!todos.length) throw new Error(`No encontré respaldos en ${CARPETA}. Corre primero: npm run respaldo -- --ya`);
    archivo = path.join(CARPETA, todos[todos.length - 1]);
  } else if (!path.isAbsolute(archivo)) {
    archivo = fs.existsSync(archivo) ? path.resolve(archivo) : path.join(CARPETA, archivo);
  }
  const resp = JSON.parse(fs.readFileSync(archivo, "utf8"));
  if (!resp || resp.version !== 1 || !Array.isArray(resp.collection_items) || !Array.isArray(resp.config_lists) || !Array.isArray(resp.users)) {
    throw new Error("Ese archivo no parece un respaldo válido de Frutal Yogurt.");
  }
  console.log(`Respaldo: ${archivo}`);
  console.log(`Hecho el: ${resp.fecha}`);
  console.log(`Contiene: ${resp.users.length} usuarios · ${resp.collection_items.length} registros · ${resp.config_lists.length} listas\n`);

  const actual = await leerEstadoActual();

  // ---- Qué cambiaría ----
  const ahoraCol = new Map(actual.collection_items.map((r) => [clave(r.collection, r.id), r]));
  const respCol = new Map(resp.collection_items.map((r) => [clave(r.collection, r.id), r]));
  const recuperar = [], cambiados = [], iguales = [];
  respCol.forEach((r, k) => {
    const a = ahoraCol.get(k);
    if (!a) recuperar.push(r);
    else if (!igual(a.data, r.data)) cambiados.push(r);
    else iguales.push(r);
  });
  const extra = actual.collection_items.filter((r) => !respCol.has(clave(r.collection, r.id)));

  const ahoraLis = new Map(actual.config_lists.map((r) => [r.name, r]));
  const listasCambian = resp.config_lists.filter((r) => !ahoraLis.has(r.name) || !igual(ahoraLis.get(r.name).data, r.data));

  console.log("Qué pasaría al restaurar:");
  console.log(`  • ${recuperar.length} registro(s) que hoy NO están y se volverían a crear`);
  console.log(`  • ${cambiados.length} registro(s) que hoy son distintos y volverían a como estaban`);
  console.log(`  • ${iguales.length} registro(s) que ya están igual (sin cambio)`);
  console.log(`  • ${extra.length} registro(s) creados DESPUÉS del respaldo ${borrarExtra ? "(se BORRARÍAN por --borrar-extra)" : "(se quedarían tal cual)"}`);
  console.log(`  • ${listasCambian.length} lista(s) volverían a su versión del respaldo`);
  console.log(`  • Usuarios: ${conUsuarios ? "se restaurarían (contraseñas incluidas)" : "NO se tocan"}`);
  const porColeccion = {};
  [...recuperar, ...cambiados].forEach((r) => { porColeccion[r.collection] = (porColeccion[r.collection] || 0) + 1; });
  if (Object.keys(porColeccion).length) {
    console.log("\n  Registros a recuperar/corregir, por colección:");
    Object.entries(porColeccion).forEach(([c, n]) => console.log(`    - ${c}: ${n}`));
  }

  if (!aplicar) {
    console.log("\n(Esto fue solo una vista previa — no se cambió nada.)");
    console.log("Para restaurar de verdad, agrega --aplicar al comando.");
    await pool.end();
    return;
  }

  console.log("\n⚠️  Vas a modificar la base de datos REAL (la que usan las sucursales).");
  const r = await preguntar('Escribe RESTAURAR (en mayúsculas) para continuar, o cualquier otra cosa para cancelar: ');
  if (r.trim() !== "RESTAURAR") {
    console.log("Cancelado. No se cambió nada.");
    await pool.end();
    return;
  }

  // Copia de seguridad del estado actual, por si te arrepientes.
  fs.mkdirSync(CARPETA, { recursive: true, mode: 0o700 });
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const seguro = path.join(CARPETA, `prerestauracion-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`);
  fs.writeFileSync(seguro, JSON.stringify(actual), { mode: 0o600 });
  console.log(`Copia del estado actual guardada en: ${seguro}`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of resp.collection_items) {
      await client.query(
        `INSERT INTO collection_items (collection, id, data, updated_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [r.collection, r.id, JSON.stringify(r.data), r.updated_at]
      );
    }
    for (const r of resp.config_lists) {
      await client.query(
        `INSERT INTO config_lists (name, data, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at`,
        [r.name, JSON.stringify(r.data), r.updated_at]
      );
    }
    if (borrarExtra) {
      for (const r of extra) await client.query("DELETE FROM collection_items WHERE collection = $1 AND id = $2", [r.collection, r.id]);
    }
    if (conUsuarios) {
      for (const u of resp.users) {
        await client.query(
          `INSERT INTO users (username, password_hash, role, sucursal, preferencias, created_at) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, sucursal = EXCLUDED.sucursal, preferencias = EXCLUDED.preferencias`,
          [u.username, u.password_hash, u.role, u.sucursal, JSON.stringify(u.preferencias || {}), u.created_at]
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw new Error(`Falló y NO se cambió nada (todo se revirtió): ${err.message}`);
  } finally {
    client.release();
  }

  console.log("\n✅ Restauración terminada.");
  console.log(`   ${recuperar.length} recuperados · ${cambiados.length} corregidos${borrarExtra ? ` · ${extra.length} borrados` : ""}${conUsuarios ? " · usuarios restaurados" : ""}`);
  console.log("   Pídele a quien esté capturando que recargue la página.");
  await pool.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
