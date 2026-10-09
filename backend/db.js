import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "⚠️  Falta DATABASE_URL. Copia backend/.env.example a backend/.env y pon ahí el connection string de tu base de datos (Neon)."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Neon cierra las conexiones que llevan un rato sin usarse. Sin este
// "listener", ese cierre tumbaba TODO el servidor (Node lo trata como un
// error no atendido) — con esto solo se registra y el servidor sigue vivo;
// la siguiente consulta simplemente abre una conexión nueva sola.
pool.on("error", (err) => {
  console.error("Aviso: se perdió una conexión inactiva con la base de datos (normal si llevaba rato sin uso) —", err.message);
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection TEXT NOT NULL,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (collection, id)
    );
    CREATE TABLE IF NOT EXISTS config_lists (
      name TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- "role": 'admin' ve toda la plataforma (como hoy). 'sucursal' solo ve el
    -- apartado de captura de su sucursal — se agregan con ALTER porque la
    -- tabla "users" ya existe en producción con datos reales.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS sucursal TEXT;
    -- Preferencias de personalización (tema, tipografía, fondo, densidad) —
    -- se guardan por cuenta para que viajen entre dispositivos.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;

    -- Una sola sesión abierta por usuario. "sid" identifica la sesión vigente
    -- (va dentro del token); "ultima_actividad" se renueva con cada petición y
    -- con el latido que manda la pantalla. Todo el cálculo de tiempos se hace
    -- con el reloj de la base de datos, no con el del servidor.
    CREATE TABLE IF NOT EXISTS sesiones (
      username TEXT PRIMARY KEY,
      sid TEXT NOT NULL,
      role TEXT,
      sucursal TEXT,
      ip TEXT,
      iniciada TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultima_actividad TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/* ---- Sesiones (una abierta por usuario) ---- */

// Intenta abrir la sesión de un usuario. Solo lo logra si NO hay una sesión
// viva (con actividad en los últimos `ventanaSeg` segundos) — en un solo paso,
// para que dos inicios de sesión a la vez no se cuelen los dos. Regresa true/false.
export async function abrirSesion({ username, sid, role, sucursal, ip, ventanaSeg }) {
  const { rows } = await pool.query(
    `INSERT INTO sesiones (username, sid, role, sucursal, ip, iniciada, ultima_actividad)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     ON CONFLICT (username) DO UPDATE
       SET sid = excluded.sid, role = excluded.role, sucursal = excluded.sucursal, ip = excluded.ip,
           iniciada = now(), ultima_actividad = now()
       WHERE sesiones.ultima_actividad < now() - ($6 || ' seconds')::interval
     RETURNING sid`,
    [username, sid, role, sucursal, ip, String(ventanaSeg)]
  );
  return rows.length > 0;
}

export async function getSesion(username) {
  const { rows } = await pool.query(
    "SELECT sid, EXTRACT(EPOCH FROM (now() - ultima_actividad)) AS segundos FROM sesiones WHERE username = $1",
    [username]
  );
  return rows[0] ? { sid: rows[0].sid, segundos: Number(rows[0].segundos) } : null;
}

export async function tocarSesion(username, sid) {
  await pool.query("UPDATE sesiones SET ultima_actividad = now() WHERE username = $1 AND sid = $2", [username, sid]);
}

// Cierra la sesión de un usuario. Con `sid` solo borra si es esa misma sesión
// (así un cierre tardío no tumba una sesión nueva).
export async function cerrarSesion(username, sid = null) {
  if (sid) await pool.query("DELETE FROM sesiones WHERE username = $1 AND sid = $2", [username, sid]);
  else await pool.query("DELETE FROM sesiones WHERE username = $1", [username]);
}

export async function cerrarTodasLasSesiones() {
  await pool.query("DELETE FROM sesiones");
}

export async function listarSesiones(maxSegundos) {
  const { rows } = await pool.query(
    `SELECT username, role, sucursal, iniciada,
            EXTRACT(EPOCH FROM (now() - ultima_actividad)) AS segundos
       FROM sesiones
      WHERE ultima_actividad >= now() - ($1 || ' seconds')::interval
      ORDER BY iniciada ASC`,
    [String(maxSegundos)]
  );
  return rows.map((r) => ({ username: r.username, role: r.role, sucursal: r.sucursal, iniciada: r.iniciada, segundos: Math.round(Number(r.segundos)) }));
}

export async function getUserByUsername(username) {
  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  return rows[0] || null;
}

export async function updatePreferencias(userId, prefs) {
  const { rows } = await pool.query(
    "UPDATE users SET preferencias = $2 WHERE id = $1 RETURNING preferencias",
    [userId, JSON.stringify(prefs)]
  );
  return rows[0]?.preferencias || {};
}

export async function createUser(username, passwordHash, role = "admin", sucursal = null) {
  await pool.query(
    "INSERT INTO users (username, password_hash, role, sucursal) VALUES ($1, $2, $3, $4)",
    [username, passwordHash, role, sucursal]
  );
}

// Las contraseñas se guardan con hash (bcrypt) — no hay forma de "ver" la
// contraseña de alguien, ni yo ni nadie con acceso a la base de datos puede
// recuperarla. Lo único que se puede hacer si se les olvida es ponerle una
// nueva (scripts/reset-password.js usa esto).
export async function setPasswordHash(username, passwordHash) {
  const { rows } = await pool.query(
    "UPDATE users SET password_hash = $2 WHERE username = $1 RETURNING username, role, sucursal",
    [username, passwordHash]
  );
  return rows[0] || null;
}

export async function listUsers() {
  const { rows } = await pool.query("SELECT username, role, sucursal, created_at FROM users ORDER BY sucursal NULLS FIRST, username");
  return rows;
}

export async function listCollection(collection) {
  const { rows } = await pool.query(
    "SELECT data FROM collection_items WHERE collection = $1 ORDER BY updated_at ASC",
    [collection]
  );
  return rows.map((r) => r.data);
}

export async function getItem(collection, id) {
  const { rows } = await pool.query(
    "SELECT data FROM collection_items WHERE collection = $1 AND id = $2",
    [collection, String(id)]
  );
  return rows[0]?.data || null;
}

export async function upsertItem(collection, id, item) {
  await pool.query(
    `INSERT INTO collection_items (collection, id, data, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (collection, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [collection, String(id), JSON.stringify(item)]
  );
}

export async function deleteItem(collection, id) {
  await pool.query("DELETE FROM collection_items WHERE collection = $1 AND id = $2", [collection, String(id)]);
}

export async function getList(name) {
  const { rows } = await pool.query("SELECT data FROM config_lists WHERE name = $1", [name]);
  return rows.length ? rows[0].data : null;
}

export async function setList(name, data) {
  await pool.query(
    `INSERT INTO config_lists (name, data, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [name, JSON.stringify(data)]
  );
}
