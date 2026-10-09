import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { initDb, listCollection, upsertItem, deleteItem, getItem, getList, setList, getUserByUsername, updatePreferencias, abrirSesion, cerrarSesion, listarSesiones } from "./db.js";
import { signToken, requireAuth, requireAdmin, requireAdminOInventarios } from "./auth.js";
import { odooLogin, odooExecuteKw, fechaLocalMx, sumarDiasISO } from "./odoo.js";
import { ODOO_SUCURSAL_A_CONFIG } from "./odoo-sucursales.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;

// Render pone un proxy delante: sin esto, todas las visitas parecerían venir de
// la misma IP y el límite de intentos de login no distinguiría a nadie.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// La plataforma y su API viven en el mismo dominio, así que no hace falta
// permitir que OTROS sitios llamen a la API desde un navegador.
app.use(cors({ origin: false }));

// Cabeceras de seguridad básicas (sin dependencias extra).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY"); // nadie puede incrustar la plataforma en otra página
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "5mb" }));

// Contraseña para confirmar borrados sensibles (cuadres de Auditoría,
// capturas de Cortes por día). Vive SOLO en la variable de entorno — no hay
// respaldo fijo en el código. Si no está configurada, esas rutas de borrado
// simplemente se bloquean (más abajo) en vez de aceptar una palabra que
// cualquiera con el código pudiera ver.
const AI_CLAVE_BORRAR = process.env.AI_CLAVE_BORRAR;
if (!AI_CLAVE_BORRAR) {
  console.warn(
    "⚠️  Falta AI_CLAVE_BORRAR. Agrégalo a backend/.env (ver .env.example). Sin esto, nadie va a poder borrar cuadres de Auditoría ni capturas de Cortes — es intencional, para no dejar una contraseña fija en el código."
  );
}

// Solo estas colecciones/listas existen — evita crear tablas/uso arbitrario por error.
// SUCURSAL_PERMISOS dice a cuáles puede entrar un usuario tipo "sucursal" y
// hasta dónde:
//   "rw" = puede crear, leer, actualizar Y borrar (solo lo suyo).
//   "co" = puede Crear y leer lo suyo, pero NO editar ni borrar — eso lo
//          corrige el admin (gastos/descuentos/venta app, conteos diarios de
//          inventario).
//   "ro" = solo puede LEER — ni crear, ni editar, ni borrar. Es el caso de
//          los productos a inventariar: la lista la maneja el admin desde
//          Gestión › Inventarios; sucursal solo la ve para capturar su
//          conteo diario. Todas las demás colecciones son solo para "admin".
const SUCURSAL_PERMISOS = {
  gastos_descuentos_sucursal: "co",
  productos_inventario: "ro",
  conteos_diarios_inventario: "co",
};
const COLLECTIONS = new Set([
  "recepciones", "conteos", "borradores_conteo", "salidas", "cuadres_auditoria",
  ...Object.keys(SUCURSAL_PERMISOS),
  "entradas_inventario", "ajustes_inventario",
]);
const LISTS = new Set(["sucursalesAI", "nombresEntregaAI", "nombresRecibeAI", "terminacionesAI", "responsables_sucursal"]);
// Listas que un usuario "sucursal" puede LEER (nunca reemplazar/borrar toda
// la lista — eso lo hace el admin desde Gestión). Por ejemplo el catálogo de
// responsables que aparece como selector al capturar un corte.
const SUCURSAL_LISTS_RO = new Set(["responsables_sucursal"]);
// Listas donde, además de leer, un usuario "sucursal" puede AGREGAR un valor
// nuevo (nunca quitar ni reemplazar la lista completa) — usan la ruta
// dedicada POST /api/lists/:name/agregar, no el PUT normal (que sigue
// siendo solo-admin).
const SUCURSAL_LISTS_AGREGAR = new Set(["responsables_sucursal"]);

function checkCollection(req, res, next) {
  if (!COLLECTIONS.has(req.params.name)) return res.status(404).json({ error: "Colección no reconocida" });
  next();
}
function checkList(req, res, next) {
  if (!LISTS.has(req.params.name)) return res.status(404).json({ error: "Lista no reconocida" });
  next();
}
// Rol "inventarios" (p. ej. el encargado de inventarios): ve todo lo que ve un
// admin en la plataforma pero SOLO puede escribir en lo de Inventarios y en los
// cuadres de Auditoría. Las listas de configuración las puede leer, no cambiar.
//   • "inventarios": Inventarios + cuadres de Auditoría.
//   • "auditor": lo de Cortes (recepción, conteo, entrega de efectivo) — NO los
//     cuadres de Auditoría ni nada de Inventarios.
const ESCRITURA_POR_ROL = {
  inventarios: new Set(["cuadres_auditoria", "conteos_diarios_inventario", "productos_inventario", "entradas_inventario", "ajustes_inventario"]),
  auditor: new Set(["recepciones", "conteos", "borradores_conteo", "salidas"]),
};

function checkListRole(req, res, next) {
  if (req.user.role === "admin") return next();
  if (ESCRITURA_POR_ROL[req.user.role] && req.method === "GET") return next();
  if (req.user.role === "sucursal" && SUCURSAL_LISTS_RO.has(req.params.name)) return next();
  return res.status(403).json({ error: "No tienes permiso para esto" });
}

// Un usuario "sucursal" SOLO puede tocar lo que esté en SUCURSAL_PERMISOS —
// cualquier otra colección le regresa 403, sin importar lo que pida el
// frontend. Esto es lo que hace la restricción real (no solo ocultar
// botones en la pantalla).
function checkCollectionRole(req, res, next) {
  if (req.user.role === "admin") return next();
  if (ESCRITURA_POR_ROL[req.user.role]) {
    if (req.method === "GET" || ESCRITURA_POR_ROL[req.user.role].has(req.params.name)) return next();
    return res.status(403).json({ error: "No tienes permiso para esto" });
  }
  if (req.user.role === "sucursal" && SUCURSAL_PERMISOS[req.params.name]) return next();
  return res.status(403).json({ error: "No tienes permiso para esto" });
}

// Envuelve cada ruta async para que un error no tumbe el servidor —
// responde 500 con el mensaje en vez de dejar la petición colgada.
const asyncRoute = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  // El detalle del error se queda en el log del servidor; al navegador no se
  // le manda (podría revelar cómo está armado por dentro).
  res.status(500).json({ error: "Error del servidor" });
});

// ---- Límite de intentos de login (frena adivinar contraseñas) ----
// Máximo 8 fallos por IP+usuario cada 15 min, y 40 fallos por IP en el mismo
// lapso. Se guarda en memoria: suficiente para un solo servidor.
const VENTANA_LOGIN_MS = 15 * 60 * 1000;
const fallosLogin = new Map(); // clave -> [timestamps]
function fallosRecientes(clave) {
  const ahora = Date.now();
  const lista = (fallosLogin.get(clave) || []).filter((t) => ahora - t < VENTANA_LOGIN_MS);
  if (lista.length) fallosLogin.set(clave, lista); else fallosLogin.delete(clave);
  return lista;
}
function registrarFallo(clave) { const l = fallosRecientes(clave); l.push(Date.now()); fallosLogin.set(clave, l); }
setInterval(() => { for (const k of [...fallosLogin.keys()]) fallosRecientes(k); }, VENTANA_LOGIN_MS).unref();
// Hash de mentira para que "usuario que no existe" tarde lo mismo que uno real.
const HASH_FALSO = bcrypt.hashSync("no-es-una-contraseña-real", 10);

// Segundos sin actividad tras los cuales una sesión ya no cuenta como abierta.
const VENTANA_SESION_SEG = 180;

// ---- Login: recibe usuario/contraseña, regresa un token si son correctos ----
app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Falta usuario o contraseña" });
  if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 200) {
    return res.status(400).json({ error: "Usuario o contraseña incorrectos" });
  }
  const claveIpUsuario = `${req.ip}|${username.toLowerCase()}`;
  const claveIp = `ip|${req.ip}`;
  if (fallosRecientes(claveIpUsuario).length >= 8 || fallosRecientes(claveIp).length >= 40) {
    return res.status(429).json({ error: "Demasiados intentos. Espera unos 15 minutos e inténtalo de nuevo." });
  }
  const user = await getUserByUsername(username);
  const ok = await bcrypt.compare(password, user ? user.password_hash : HASH_FALSO);
  if (!user || !ok) {
    registrarFallo(claveIpUsuario);
    registrarFallo(claveIp);
    return res.status(401).json({ error: "Usuario o contraseña incorrectos" });
  }
  // Una sola sesión abierta por cuenta: si ya hay una viva (con actividad en los
  // últimos VENTANA_SESION_SEG segundos), no se deja abrir otra hasta que se
  // cierre esa — o pasen unos minutos sin señal de ella (ventana cerrada, equipo
  // apagado, sin internet).
  const sid = randomUUID();
  const abierta = await abrirSesion({ username: user.username, sid, role: user.role, sucursal: user.sucursal, ip: req.ip, ventanaSeg: VENTANA_SESION_SEG });
  if (!abierta) {
    return res.status(409).json({ error: "Esta cuenta ya tiene una sesión abierta en otro dispositivo o ventana. Ciérrala primero; si ya la cerraste sin usar \"Cerrar sesión\", espera unos 3 minutos e inténtalo de nuevo." });
  }
  res.json({ token: signToken(user, sid), username: user.username, role: user.role, sucursal: user.sucursal, preferencias: user.preferencias || {} });
}));

// Latido: la pantalla lo manda cada 30 s mientras está abierta. Así la sesión
// cuenta como "en línea"; cuando dejan de llegar (se cerró la ventana o se
// apagó el equipo) la cuenta se libera sola a los pocos minutos.
app.post("/api/auth/heartbeat", requireAuth, (req, res) => res.json({ ok: true }));

// Cierre de sesión voluntario: libera la cuenta al instante.
app.post("/api/auth/logout", requireAuth, asyncRoute(async (req, res) => {
  await cerrarSesion(req.user.username, req.user.sid);
  res.json({ ok: true });
}));

// ---- Usuarios conectados (solo para el dueño de la plataforma) ----
// El permiso se comprueba aquí, en el servidor, por nombre de usuario — el
// botón en pantalla es solo comodidad.
const SUPERADMIN = process.env.SUPERADMIN_USERNAME || "ricardo_administrador";
function requireSuperAdmin(req, res, next) {
  if (req.user?.username !== SUPERADMIN) return res.status(403).json({ error: "No tienes permiso para esto" });
  next();
}
app.get("/api/admin/sesiones", requireAuth, requireSuperAdmin, asyncRoute(async (req, res) => {
  const sesiones = await listarSesiones(VENTANA_SESION_SEG);
  res.json(sesiones.map((s) => ({ ...s, enLinea: s.segundos < 90 })));
}));
app.post("/api/admin/sesiones/:username/cerrar", requireAuth, requireSuperAdmin, asyncRoute(async (req, res) => {
  if (req.params.username === req.user.username) return res.status(400).json({ error: "Para cerrar tu propia sesión usa \"Cerrar sesión\"." });
  await cerrarSesion(req.params.username);
  res.json({ ok: true });
}));

// Sesión actual — sirve para refrescar (por ejemplo) las preferencias de
// personalización guardadas en otro dispositivo, sin tener que volver a
// iniciar sesión.
app.get("/api/auth/me", requireAuth, asyncRoute(async (req, res) => {
  const user = await getUserByUsername(req.user.username);
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json({ username: user.username, role: user.role, sucursal: user.sucursal, preferencias: user.preferencias || {} });
}));

// Preferencias de personalización (tema, tipografía, fondo, densidad) —
// cada quien guarda las suyas, ligadas a su propia cuenta.
app.put("/api/auth/preferencias", requireAuth, asyncRoute(async (req, res) => {
  if (typeof req.body !== "object" || req.body == null || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Se esperaba un objeto de preferencias" });
  }
  const preferencias = await updatePreferencias(req.user.sub, req.body);
  res.json({ preferencias });
}));

// ---- Colecciones (arreglos de objetos con id) ----
// requireAuth primero (¿hay sesión?), luego checkCollection (¿existe?), luego
// checkCollectionRole (¿le toca a este usuario?).
// Colecciones donde TODAS las sucursales ven exactamente lo mismo (no se
// filtra por la sucursal del usuario) — por ahora solo el catálogo de
// productos de Inventarios, que es un solo catálogo compartido, no uno por
// sucursal.
const COLECCIONES_GLOBALES = new Set(["productos_inventario"]);

app.get("/api/collections/:name", requireAuth, checkCollection, checkCollectionRole, asyncRoute(async (req, res) => {
  let items = await listCollection(req.params.name);
  // Un usuario de sucursal solo ve lo de SU sucursal, aunque en la base de
  // datos haya de todas — el filtro se hace aquí, no confiamos en el frontend.
  if (req.user.role === "sucursal" && !COLECCIONES_GLOBALES.has(req.params.name)) {
    items = items.filter((it) => it.sucursal === req.user.sucursal);
  }
  res.json(items);
}));

app.post("/api/collections/:name", requireAuth, checkCollection, checkCollectionRole, asyncRoute(async (req, res) => {
  const item = req.body;
  if (item == null || item.id == null) return res.status(400).json({ error: "El item necesita un id" });
  if (req.user.role === "sucursal") {
    if (SUCURSAL_PERMISOS[req.params.name] === "ro") return res.status(403).json({ error: "No puedes agregar esto — pídele a tu administrador." });
    item.sucursal = req.user.sucursal; // no puede capturar a nombre de otra sucursal
    item.capturadoPor = req.user.username;
  }
  await upsertItem(req.params.name, item.id, item);
  res.status(201).json(item);
}));

app.put("/api/collections/:name/:id", requireAuth, checkCollection, checkCollectionRole, asyncRoute(async (req, res) => {
  const item = req.body;
  if (req.user.role === "sucursal") {
    if (SUCURSAL_PERMISOS[req.params.name] !== "rw") return res.status(403).json({ error: "No puedes editar esto — pídele a tu administrador que lo corrija." });
    const existente = await getItem(req.params.name, req.params.id);
    if (existente && existente.sucursal !== req.user.sucursal) return res.status(403).json({ error: "No tienes permiso para esto" });
    item.sucursal = req.user.sucursal;
    item.capturadoPor = req.user.username;
  }
  await upsertItem(req.params.name, req.params.id, item);
  res.json(item);
}));

app.delete("/api/collections/:name/:id", requireAuth, checkCollection, checkCollectionRole, asyncRoute(async (req, res) => {
  if (req.user.role === "sucursal") {
    if (SUCURSAL_PERMISOS[req.params.name] !== "rw") return res.status(403).json({ error: "No puedes borrar esto — pídele a tu administrador." });
    const existente = await getItem(req.params.name, req.params.id);
    if (existente && existente.sucursal !== req.user.sucursal) return res.status(403).json({ error: "No tienes permiso para esto" });
  }
  // Borrar un cuadre de auditoría requiere una contraseña adicional, validada
  // aquí en el servidor (nunca en el navegador) contra AI_CLAVE_BORRAR en
  // .env — así no queda visible en el código que se manda al navegador.
  if (req.params.name === "cuadres_auditoria") {
    if (!AI_CLAVE_BORRAR) return res.status(500).json({ error: "El servidor no tiene configurada la contraseña de borrado (AI_CLAVE_BORRAR) — avísale a tu desarrollador." });
    if ((req.body || {}).clave !== AI_CLAVE_BORRAR) return res.status(403).json({ error: "Contraseña incorrecta" });
  }
  await deleteItem(req.params.name, req.params.id);
  res.status(204).end();
}));

// Borra de un jalón TODO lo que una sucursal capturó (gastos/descuentos/
// ventas por app en Cortes, o conteos en Inventarios) para una fecha
// específica. Igual que borrar un cuadre de auditoría, pide la misma
// contraseña (AI_CLAVE_BORRAR) — nunca se compara en el navegador, solo aquí
// en el servidor. Va antes de la ruta "/:name/:id" a propósito (aunque no
// debería chocar, al tener más segmentos) para dejar clara la prioridad.
const COLECCIONES_BORRABLES_POR_DIA = new Set(["gastos_descuentos_sucursal", "conteos_diarios_inventario"]);
app.delete("/api/collections/:name/dia/:sucursal/:fecha", requireAuth, requireAdmin, checkCollection, asyncRoute(async (req, res) => {
  if (!COLECCIONES_BORRABLES_POR_DIA.has(req.params.name)) {
    return res.status(400).json({ error: "Esta colección no soporta borrado por día" });
  }
  if (!AI_CLAVE_BORRAR) return res.status(500).json({ error: "El servidor no tiene configurada la contraseña de borrado (AI_CLAVE_BORRAR) — avísale a tu desarrollador." });
  if ((req.body || {}).clave !== AI_CLAVE_BORRAR) return res.status(403).json({ error: "Contraseña incorrecta" });
  const items = await listCollection(req.params.name);
  const aBorrar = items.filter((it) => it.sucursal === req.params.sucursal && it.fecha === req.params.fecha);
  await Promise.all(aBorrar.map((it) => deleteItem(req.params.name, it.id)));
  res.json({ borrados: aBorrar.length });
}));

// ---- Listas simples (arreglos de strings/objetos): sucursales y catálogos ----
// La mayoría son solo-admin; unas pocas (ver SUCURSAL_LISTS_RO) también se
// pueden LEER desde sucursal para poblar selects — nunca editar desde ahí.
// Los responsables funcionan en dos capas:
//   • la lista GENERAL ("responsables_sucursal"), que maneja el admin desde
//     Gestión y ven todas las sucursales por igual;
//   • la lista PROPIA de cada sucursal ("responsables_sucursal::<sucursal>"),
//     donde caen los nombres que esa sucursal agrega desde su captura — solo
//     esa sucursal los ve.
// Una sucursal siempre recibe general + propia; el admin sigue viendo y
// editando solo la general.
const nombreListaPropia = (nombre, sucursal) => `${nombre}::${sucursal}`;
async function listaVistaPorSucursal(nombre, sucursal) {
  const general = (await getList(nombre)) ?? [];
  const propia = (await getList(nombreListaPropia(nombre, sucursal))) ?? [];
  return [...new Set([...general, ...propia])];
}

app.get("/api/lists/:name", requireAuth, checkList, checkListRole, asyncRoute(async (req, res) => {
  if (req.user.role === "sucursal" && SUCURSAL_LISTS_AGREGAR.has(req.params.name)) {
    return res.json(await listaVistaPorSucursal(req.params.name, req.user.sucursal));
  }
  const data = await getList(req.params.name);
  res.json(data ?? []);
}));

app.put("/api/lists/:name", requireAuth, requireAdmin, checkList, asyncRoute(async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: "Se esperaba un arreglo" });
  await setList(req.params.name, req.body);
  res.json(req.body);
}));

// Agregar UN valor a una lista, sin poder tocar el resto — a diferencia del
// PUT de arriba (que reemplaza toda la lista y es solo-admin), esta ruta la
// puede usar un usuario "sucursal" para las listas en SUCURSAL_LISTS_AGREGAR
// (por ejemplo, agregar su nombre al catálogo de responsables desde la
// captura, sin necesitar entrar a Gestión).
app.post("/api/lists/:name/agregar", requireAuth, checkList, asyncRoute(async (req, res) => {
  const esAdmin = req.user.role === "admin";
  const puedeAgregar = esAdmin || (req.user.role === "sucursal" && SUCURSAL_LISTS_AGREGAR.has(req.params.name));
  if (!puedeAgregar) return res.status(403).json({ error: "No tienes permiso para esto" });
  const valor = typeof (req.body || {}).valor === "string" ? req.body.valor.trim() : "";
  if (!valor) return res.status(400).json({ error: "Falta el nombre a agregar" });
  if (valor.length > 80) return res.status(400).json({ error: "El nombre es demasiado largo" });
  if (!esAdmin) {
    // Una sucursal agrega a SU lista propia, nunca a la general.
    const visibles = await listaVistaPorSucursal(req.params.name, req.user.sucursal);
    if (!visibles.includes(valor)) {
      const propiaNombre = nombreListaPropia(req.params.name, req.user.sucursal);
      const propia = (await getList(propiaNombre)) ?? [];
      propia.push(valor);
      await setList(propiaNombre, propia);
    }
    return res.json(await listaVistaPorSucursal(req.params.name, req.user.sucursal));
  }
  const actual = (await getList(req.params.name)) ?? [];
  if (!actual.includes(valor)) {
    actual.push(valor);
    await setList(req.params.name, actual);
  }
  res.json(actual);
}));

// ---- Ventas sucursal automáticas desde Odoo (opcional, solo admin) ----
// Si la sucursal todavía no está conectada, o el servidor no tiene la
// configuración de Odoo puesta, regresa un error claro — el frontend, en ese
// caso, deja seguir usando la subida de archivo a mano sin problema.
app.get("/api/odoo/ventas-sucursal", requireAuth, requireAdminOInventarios, asyncRoute(async (req, res) => {
  const { sucursal, desde, hasta } = req.query;
  if (!sucursal || !desde || !hasta) return res.status(400).json({ error: "Falta sucursal, desde o hasta" });
  if (!process.env.ODOO_URL) return res.status(503).json({ error: "La conexión con Odoo no está configurada en este servidor." });
  const configId = ODOO_SUCURSAL_A_CONFIG[sucursal];
  if (configId == null) return res.status(404).json({ error: `"${sucursal}" todavía no está conectada con Odoo — sube el archivo a mano.` });

  const uid = await odooLogin();
  // Odoo guarda "date" en UTC, pero las sucursales operan en hora de Nuevo
  // León (UTC-6) — agrupar por día directamente en Odoo (date:day) mezclaría
  // mal los días cerca de la medianoche. En vez de eso, pedimos un día de
  // margen de cada lado y calculamos aquí, orden por orden, a qué día local
  // pertenece cada una antes de sumarla (ver fechaLocalMx en odoo.js).
  const margenDesde = sumarDiasISO(desde, -1);
  const margenHasta = sumarDiasISO(hasta, 1);
  const ordenes = await odooExecuteKw(
    uid,
    "report.pos.order",
    "search_read",
    [[["config_id", "=", configId], ["date", ">=", `${margenDesde} 00:00:00`], ["date", "<=", `${margenHasta} 23:59:59`]]],
    { fields: ["date", "price_total"] }
  );
  const out = {};
  ordenes.forEach((o) => {
    const iso = fechaLocalMx(o.date);
    if (iso >= desde && iso <= hasta) out[iso] = Math.round(((out[iso] || 0) + (o.price_total || 0)) * 100) / 100;
  });
  res.json(out);
}));

// ---- Consumo por ventas (inventario), automático desde Odoo, por producto/día ----
// Regresa, para el rango pedido, cuánto se vendió de cada producto cada día en
// esa sucursal — { "2026-09-03": { "Nieve Yogurt Chica": 12, ... }, ... }. El
// nombre del producto viene tal cual está en Odoo (sin el código "[001]" al
// frente); el lado de Inventarios hace el emparejamiento contra los productos
// que cada sucursal decidió llevar (no hay catálogo fijo).
app.get("/api/odoo/consumo-ventas", requireAuth, requireAdminOInventarios, asyncRoute(async (req, res) => {
  const { sucursal, desde, hasta } = req.query;
  if (!sucursal || !desde || !hasta) return res.status(400).json({ error: "Falta sucursal, desde o hasta" });
  if (!process.env.ODOO_URL) return res.status(503).json({ error: "La conexión con Odoo no está configurada en este servidor." });
  const configId = ODOO_SUCURSAL_A_CONFIG[sucursal];
  if (configId == null) return res.status(404).json({ error: `"${sucursal}" todavía no está conectada con Odoo.` });

  const uid = await odooLogin();
  // Mismo truco que en /ventas-sucursal: pedimos un día de margen de cada lado
  // y calculamos el día local orden por orden, en vez de confiar en el
  // agrupado "date:day" de Odoo (que usa UTC y desfasaría ventas cerca de la
  // medianoche).
  const margenDesde = sumarDiasISO(desde, -1);
  const margenHasta = sumarDiasISO(hasta, 1);
  const lineas = await odooExecuteKw(
    uid,
    "report.pos.order",
    "search_read",
    [[["config_id", "=", configId], ["date", ">=", `${margenDesde} 00:00:00`], ["date", "<=", `${margenHasta} 23:59:59`]]],
    { fields: ["date", "product_id", "product_qty"] }
  );
  const out = {};
  lineas.forEach((l) => {
    const iso = fechaLocalMx(l.date);
    if (iso < desde || iso > hasta) return;
    if (!l.product_id) return;
    // El nombre en Odoo trae un código al frente, ej. "[001]Nieve Yogurt
    // Chica" — se lo quitamos para que sea más fácil de emparejar a simple
    // vista con lo que captura cada sucursal.
    const nombre = String(l.product_id[1] || "").replace(/^\[[^\]]*\]\s*/, "").trim();
    if (!nombre) return;
    if (!out[iso]) out[iso] = {};
    out[iso][nombre] = Math.round(((out[iso][nombre] || 0) + (l.product_qty || 0)) * 100) / 100;
  });
  res.json(out);
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

// Migración única: "Productos de Inventario" pasó de ser un catálogo por
// sucursal a uno solo, compartido por todas (ver COLECCIONES_GLOBALES
// arriba) — se decidió que el catálogo de Las Puentes es el que queda para
// todas. Esto borra lo que hubiera quedado de cualquier otra sucursal; es
// idempotente (si ya no hay nada que no sea de Las Puentes, no hace nada),
// así que es seguro dejarla aquí para cuando el servidor arranque.
async function migrarProductosInventarioAGlobal() {
  const items = await listCollection("productos_inventario");
  const sobrantes = items.filter((it) => it.sucursal && it.sucursal !== "Las Puentes");
  if (sobrantes.length === 0) return;
  await Promise.all(sobrantes.map((it) => deleteItem("productos_inventario", it.id)));
  console.log(`Productos de Inventario: catálogo unificado — se quitaron ${sobrantes.length} producto(s) que eran de otras sucursales (se quedó el de Las Puentes).`);
}

// La pantalla de "Conciliación semanal" pasó por dos rediseños antes de
// llegar a su versión final (una vista de solo lectura, sin nada que
// capturar ahí — todo sale automático de conteos_diarios_inventario y
// Odoo). Esto borra cualquier registro que haya quedado de las dos
// versiones descartadas: la primera (estatus/aclaración por semana) y la
// segunda (captura diaria manual). Ambas colecciones ya ni siquiera están
// en COLLECTIONS, pero listCollection/deleteItem trabajan directo contra
// Postgres por nombre, así que igual pueden limpiarse aquí.
async function borrarConciliacionSemanalVieja() {
  for (const nombre of ["conciliaciones_semanales_inventario", "conciliaciones_diarias_inventario"]) {
    const items = await listCollection(nombre);
    if (items.length === 0) continue;
    await Promise.all(items.map((it) => deleteItem(nombre, it.id)));
    console.log(`Conciliación semanal: se borraron ${items.length} registro(s) de "${nombre}" (diseño ya descartado).`);
  }
}

// Migración única: hasta ahora los responsables eran UNA lista que compartían
// todas las sucursales. Lo que había ahí lo fueron agregando desde captura
// (solo se usaba Las Puentes), así que se pasa a la lista propia de Las
// Puentes y la general queda vacía para que el admin la use solo con lo que
// quiera que vean todas. Se anota que ya se hizo para no repetirla.
async function separarResponsablesPorSucursal() {
  const marca = (await getList("migraciones_hechas")) ?? [];
  if (marca.includes("responsables_por_sucursal")) return;
  const general = (await getList("responsables_sucursal")) ?? [];
  if (general.length) {
    const propiaNombre = nombreListaPropia("responsables_sucursal", "Las Puentes");
    const propia = (await getList(propiaNombre)) ?? [];
    await setList(propiaNombre, [...new Set([...propia, ...general])]);
    await setList("responsables_sucursal", []);
    console.log(`Responsables: ${general.length} nombre(s) pasaron de la lista compartida a la propia de Las Puentes.`);
  }
  await setList("migraciones_hechas", [...marca, "responsables_por_sucursal"]);
}

initDb()
  .then(() => separarResponsablesPorSucursal())
  .then(() => migrarProductosInventarioAGlobal())
  .then(() => borrarConciliacionSemanalVieja())
  .then(() => {
    // Host explícito 0.0.0.0: Render escanea el puerto por IPv4 y no lo
    // detectaba con el bind por defecto (":::"), así que el deploy expiraba.
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Frutal Yogurt backend escuchando en http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("No se pudo conectar a la base de datos:", err.message);
    process.exit(1);
  });
