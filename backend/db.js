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
  `);
}

export async function getUserByUsername(username) {
  const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
  return rows[0] || null;
}

export async function createUser(username, passwordHash) {
  await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [username, passwordHash]);
}

export async function listCollection(collection) {
  const { rows } = await pool.query(
    "SELECT data FROM collection_items WHERE collection = $1 ORDER BY updated_at ASC",
    [collection]
  );
  return rows.map((r) => r.data);
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
