import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { initDb, listCollection, upsertItem, deleteItem, getList, setList } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Solo estas colecciones/listas existen — evita crear tablas/uso arbitrario por error.
const COLLECTIONS = new Set(["recepciones", "conteos", "borradores_conteo", "salidas"]);
const LISTS = new Set(["sucursalesAI", "nombresEntregaAI", "nombresRecibeAI"]);

function checkCollection(req, res, next) {
  if (!COLLECTIONS.has(req.params.name)) return res.status(404).json({ error: "Colección no reconocida" });
  next();
}
function checkList(req, res, next) {
  if (!LISTS.has(req.params.name)) return res.status(404).json({ error: "Lista no reconocida" });
  next();
}

// Envuelve cada ruta async para que un error no tumbe el servidor —
// responde 500 con el mensaje en vez de dejar la petición colgada.
const asyncRoute = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: "Error del servidor", detalle: err.message });
});

// ---- Colecciones (arreglos de objetos con id): recepciones, conteos, borradores_conteo, salidas ----
app.get("/api/collections/:name", checkCollection, asyncRoute(async (req, res) => {
  res.json(await listCollection(req.params.name));
}));

app.post("/api/collections/:name", checkCollection, asyncRoute(async (req, res) => {
  const item = req.body;
  if (item == null || item.id == null) return res.status(400).json({ error: "El item necesita un id" });
  await upsertItem(req.params.name, item.id, item);
  res.status(201).json(item);
}));

app.put("/api/collections/:name/:id", checkCollection, asyncRoute(async (req, res) => {
  const item = req.body;
  await upsertItem(req.params.name, req.params.id, item);
  res.json(item);
}));

app.delete("/api/collections/:name/:id", checkCollection, asyncRoute(async (req, res) => {
  await deleteItem(req.params.name, req.params.id);
  res.status(204).end();
}));

// ---- Listas simples (arreglos de strings): sucursales y catálogos de nombres ----
app.get("/api/lists/:name", checkList, asyncRoute(async (req, res) => {
  const data = await getList(req.params.name);
  res.json(data ?? []);
}));

app.put("/api/lists/:name", checkList, asyncRoute(async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Se esperaba un arreglo" });
  await setList(req.params.name, req.body);
  res.json(req.body);
}));

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---- Sirve el frontend ya compilado (producción) si existe ----
const distPath = path.join(__dirname, "..", "frontend", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).end();
    res.sendFile(path.join(distPath, "index.html"));
  });
}

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Frutal Yogurt backend escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("No se pudo conectar a la base de datos:", err.message);
    process.exit(1);
  });
