import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { initDb, listCollection, upsertItem, deleteItem, getItem, getList, setList, getUserByUsername, updatePreferencias, abrirSesion, cerrarSesion, listarSesiones, listUsers } from "./db.js";
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
  // Registro de asistencia: un documento por sucursal y día (se crea una vez,
  // no se edita; si hay error lo corrige el administrador).
  asistencia_sucursal: "co",
};
const COLLECTIONS = new Set([
  "recepciones", "conteos", "borradores_conteo", "salidas", "cuadres_auditoria",
  ...Object.keys(SUCURSAL_PERMISOS),
  "entradas_inventario", "ajustes_inventario",
]);
const LISTS = new Set(["sucursalesAI", "nombresEntregaAI", "nombresRecibeAI", "terminacionesAI", "responsables_sucursal", "empleados_asistencia"]);
// Listas que un usuario "sucursal" puede LEER (nunca reemplazar/borrar toda
// la lista — eso lo hace el admin desde Gestión). Por ejemplo el catálogo de
// responsables que aparece como selector al capturar un corte.
const SUCURSAL_LISTS_RO = new Set(["responsables_sucursal", "empleados_asistencia"]);
// Datos de nómina: solo admin (y la propia sucursal para lo suyo). Los roles
// "inventarios" y "auditor" NO los ven, aunque sí lean el resto.
const SOLO_ADMIN_Y_SUCURSAL = new Set(["asistencia_sucursal", "empleados_asistencia"]);
// Estatus válidos de asistencia — mismos que el menú de la hoja de Excel.
const ESTATUS_ASISTENCIA = new Set(["Asistió", "Retardo", "Falta", "Descanso", "Vacaciones", "Pendiente"]);
const ESTATUS_CON_HORAS = new Set(["Asistió", "Retardo"]);
const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
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
  // Recursos Humanos: NO escribe en ninguna colección de las de arriba (en
  // Inventarios solo mira). Lo único que puede hacer además de leer es borrar un
  // día de asistencia por error desde Nómina sucursales (ver checkCollectionRole).
  rrhh: new Set(),
};
// Lo único que el rol "rrhh" puede LEER: Nómina sucursales (asistencia y su
// personal) e Inventarios. No ve Cortes, auditorías ni nada más.
const LECTURA_RRHH_COLECCIONES = new Set(["asistencia_sucursal", "conteos_diarios_inventario", "productos_inventario", "entradas_inventario", "ajustes_inventario"]);
const LECTURA_RRHH_LISTAS = new Set(["empleados_asistencia", "sucursalesAI"]);

function checkListRole(req, res, next) {
  if (req.user.role === "admin") return next();
  if (req.user.role === "rrhh") {
    if (req.method === "GET" && LECTURA_RRHH_LISTAS.has(req.params.name)) return next();
    return res.status(403).json({ error: "No tienes permiso para esto" });
  }
  if (SOLO_ADMIN_Y_SUCURSAL.has(req.params.name) && req.user.role !== "sucursal") return res.status(403).json({ error: "No tienes permiso para esto" });
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
  if (req.user.role === "rrhh") {
    const lee = req.method === "GET" && LECTURA_RRHH_COLECCIONES.has(req.params.name);
    const borraAsistencia = req.method === "DELETE" && req.params.name === "asistencia_sucursal";
    if (lee || borraAsistencia) return next();
    return res.status(403).json({ error: "No tienes permiso para esto" });
  }
  if (SOLO_ADMIN_Y_SUCURSAL.has(req.params.name) && req.user.role !== "sucursal") return res.status(403).json({ error: "No tienes permiso para esto" });
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
const SUPERADMIN = process.env.SUPERADMIN_USERNAME || "administrador_ricardo";
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

// Valida un día de asistencia: un solo documento por sucursal + fecha, con un
// renglón por empleado (estatus válido; Asistió/Retardo traen entrada y salida).
function validarAsistencia(item, sucursal) {
  if (typeof item.fecha !== "string" || !FECHA_RE.test(item.fecha)) return "Fecha inválida";
  if (item.id !== `asist|${sucursal}|${item.fecha}`) return "Identificador inválido";
  if (!Array.isArray(item.registros) || item.registros.length === 0 || item.registros.length > 200) return "No hay registros que guardar";
  const vistos = new Set();
  for (const r of item.registros) {
    if (!r || typeof r.empleado !== "string" || !r.empleado.trim() || r.empleado.length > 120) return "Empleado inválido";
    if (vistos.has(r.empleado)) return "Empleado repetido";
    vistos.add(r.empleado);
    if (!ESTATUS_ASISTENCIA.has(r.estatus)) return `Estatus inválido para ${r.empleado}`;
    // La sucursal solo registra horas: con horas es "Asistió" (el sistema compara con el horario) y sin horas "Pendiente" (lo clasifica administración).
    if (r.estatus !== "Asistió" && r.estatus !== "Pendiente") return `Estatus no permitido para ${r.empleado}`;
    if (ESTATUS_CON_HORAS.has(r.estatus)) {
      if (!HORA_RE.test(r.entrada || "") || !HORA_RE.test(r.salida || "")) return `Falta hora de entrada o salida de ${r.empleado}`;
    } else {
      r.entrada = ""; r.salida = "";
    }
  }
  return null;
}

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
    // "co" = solo crear: nunca se puede sobrescribir algo que ya existe.
    if (await getItem(req.params.name, item.id)) return res.status(409).json({ error: "Eso ya fue capturado — pídele a tu administrador que lo corrija." });
    if (req.params.name === "asistencia_sucursal") {
      const err = validarAsistencia(item, req.user.sucursal);
      if (err) return res.status(400).json({ error: err });
    }
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
  // Empleados de asistencia: cada sucursal solo ve a los suyos.
  if (req.user.role === "sucursal" && req.params.name === "empleados_asistencia") {
    return res.json((Array.isArray(data) ? data : []).filter((e) => e && e.sucursal === req.user.sucursal && !e.fechaBaja).map(({ horaEntrada, horaSalida, ...resto }) => resto)); // el horario que le toca a cada quien no se muestra a la sucursal
  }
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

// ---- Bajas de personal (Nómina sucursales) ----
// Dar de baja NO borra a la persona: le pone fecha y motivo de baja, así su historial
// y los números de rotación se conservan. Una persona dada de baja ya no aparece
// en la captura de asistencia de la sucursal. Lo pueden hacer admin y rrhh.
function requireAdminORrhh(req, res, next) {
  if (req.user?.role !== "admin" && req.user?.role !== "rrhh") return res.status(403).json({ error: "No tienes permiso para esto" });
  next();
}
async function cambiarEmpleado(sucursal, nombre, cambio) {
  const lista = Array.isArray(await getList("empleados_asistencia")) ? await getList("empleados_asistencia") : [];
  const i = lista.findIndex((e) => e && e.sucursal === sucursal && e.nombre === nombre);
  if (i < 0) return null;
  lista[i] = cambio(lista[i]);
  await setList("empleados_asistencia", lista);
  return lista;
}
app.put("/api/nomina/baja", requireAuth, requireAdminORrhh, asyncRoute(async (req, res) => {
  const { sucursal, nombre, motivo, fecha } = req.body || {};
  if (typeof sucursal !== "string" || typeof nombre !== "string") return res.status(400).json({ error: "Faltan datos" });
  if (!["faltas", "renuncia", "otro"].includes(motivo)) return res.status(400).json({ error: "Motivo inválido" });
  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) return res.status(400).json({ error: "Fecha inválida" });
  const lista = await cambiarEmpleado(sucursal, nombre, (e) => ({ ...e, fechaBaja: fecha, motivoBaja: motivo }));
  if (!lista) return res.status(404).json({ error: "No se encontró a la persona" });
  res.json(lista);
}));
// Horario que le toca a cada persona (fijo, todos los días). Lo ponen admin y rrhh en
// Nómina sucursales; la sucursal no lo ve, solo captura la hora real y el sistema compara.
app.put("/api/nomina/horario", requireAuth, requireAdminORrhh, asyncRoute(async (req, res) => {
  const { sucursal, nombre, entrada, salida } = req.body || {};
  if (typeof sucursal !== "string" || typeof nombre !== "string") return res.status(400).json({ error: "Faltan datos" });
  const vacio = !entrada && !salida;
  if (!vacio && (typeof entrada !== "string" || typeof salida !== "string" || !HORA_RE.test(entrada) || !HORA_RE.test(salida))) return res.status(400).json({ error: "Horario inválido (usa HH:MM)" });
  const lista = await cambiarEmpleado(sucursal, nombre, (e) => {
    const { horaEntrada, horaSalida, ...resto } = e;
    return vacio ? resto : { ...resto, horaEntrada: entrada, horaSalida: salida };
  });
  if (!lista) return res.status(404).json({ error: "No se encontró a la persona" });
  res.json(lista);
}));
// Administración (admin/rrhh) clasifica a quien la sucursal dejó sin horas:
// Falta, Descanso o Vacaciones (o lo regresa a Pendiente).
app.put("/api/nomina/estatus-dia", requireAuth, requireAdminORrhh, asyncRoute(async (req, res) => {
  const { sucursal, fecha, empleado, estatus } = req.body || {};
  if (typeof sucursal !== "string" || typeof empleado !== "string" || typeof fecha !== "string" || !FECHA_RE.test(fecha)) return res.status(400).json({ error: "Faltan datos" });
  if (!["Falta", "Descanso", "Vacaciones", "Pendiente"].includes(estatus)) return res.status(400).json({ error: "Estatus inválido" });
  const id = `asist|${sucursal}|${fecha}`;
  const doc = await getItem("asistencia_sucursal", id);
  if (!doc || !Array.isArray(doc.registros)) return res.status(404).json({ error: "No se encontró ese día" });
  const r = doc.registros.find((x) => x.empleado === empleado);
  if (!r) return res.status(404).json({ error: "No se encontró a la persona en ese día" });
  if (r.entrada || r.salida) return res.status(400).json({ error: "Esa persona tiene horas capturadas; no se puede marcar como falta, descanso o vacaciones" });
  r.estatus = estatus;
  await upsertItem("asistencia_sucursal", id, doc);
  res.json(doc);
}));
app.put("/api/nomina/reactivar", requireAuth, requireAdminORrhh, asyncRoute(async (req, res) => {
  const { sucursal, nombre } = req.body || {};
  if (typeof sucursal !== "string" || typeof nombre !== "string") return res.status(400).json({ error: "Faltan datos" });
  const lista = await cambiarEmpleado(sucursal, nombre, (e) => { const { fechaBaja, motivoBaja, ...resto } = e; return resto; });
  if (!lista) return res.status(404).json({ error: "No se encontró a la persona" });
  res.json(lista);
}));

// ---- Recordatorios (timbre de notificaciones) — solo usuarios administrativos ----
// Cada recordatorio lo crea una persona (creador) y puede ser: solo para ella
// ("yo"), solo para otra ("otro") o para ambas ("ambos"). A la otra persona
// (destinatario) NO se le impone: le llega como invitación y decide si la
// acepta o la rechaza. Se guardan en la colección "recordatorios", que no está
// en COLLECTIONS a propósito: solo se llega a ella por estas rutas, que
// siempre filtran por la persona que hace la petición.
const COLECCION_RECORDATORIOS = "recordatorios";
const esMio = (r, u) => r.creador === u || r.destinatario === u;
// Reglas de quién puede mandarle un recordatorio a quién:
//   • cualquier cuenta puede crearse recordatorios a sí misma;
//   • las cuentas administrativas también pueden mandarlos a otra cuenta administrativa;
//   • solo "rrhh" (Recursos Humanos) puede además mandarlos a una sucursal;
//   • las sucursales SOLO se pueden poner recordatorios a sí mismas.
const puedeEnviarASucursal = (rol) => rol === "rrhh";

app.get("/api/recordatorios", requireAuth, asyncRoute(async (req, res) => {
  const todos = await listCollection(COLECCION_RECORDATORIOS);
  res.json(todos.filter((r) => esMio(r, req.user.username)));
}));

// Personas a las que se les puede mandar un recordatorio. Las sucursales no
// mandan a nadie; "rrhh" ve además a las sucursales.
app.get("/api/recordatorios/personas", requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role === "sucursal") return res.json([]);
  const usuarios = await listUsers();
  res.json(
    usuarios
      .filter((u) => u.username !== req.user.username && (u.role !== "sucursal" || puedeEnviarASucursal(req.user.role)))
      .map((u) => ({ username: u.username, role: u.role, sucursal: u.sucursal || null }))
  );
}));

app.post("/api/recordatorios", requireAuth, asyncRoute(async (req, res) => {
  const b = req.body || {};
  const titulo = typeof b.titulo === "string" ? b.titulo.trim() : "";
  const descripcion = typeof b.descripcion === "string" ? b.descripcion.trim() : "";
  if (!titulo || titulo.length > 120) return res.status(400).json({ error: "Escribe un título (máximo 120 caracteres)" });
  if (descripcion.length > 1000) return res.status(400).json({ error: "La descripción es demasiado larga" });
  if (typeof b.fecha !== "string" || !FECHA_RE.test(b.fecha)) return res.status(400).json({ error: "Elige la fecha del recordatorio" });
  const hora = typeof b.hora === "string" && HORA_RE.test(b.hora) ? b.hora : "";
  if (!["yo", "otro", "ambos"].includes(b.para)) return res.status(400).json({ error: "Elige para quién es" });
  if (req.user.role === "sucursal" && b.para !== "yo") return res.status(403).json({ error: "Solo puedes crear recordatorios para ti" });
  let destinatario = null;
  let destinatarioNombre = null;
  if (b.para !== "yo") {
    const u = typeof b.destinatario === "string" ? await getUserByUsername(b.destinatario) : null;
    const sucursalNoPermitida = u && u.role === "sucursal" && !puedeEnviarASucursal(req.user.role);
    if (!u || sucursalNoPermitida || u.username === req.user.username) return res.status(400).json({ error: "Elige a la otra persona" });
    destinatario = u.username;
    destinatarioNombre = u.role === "sucursal" ? u.sucursal : null;
  }
  const item = {
    id: randomUUID(), titulo, descripcion, fecha: b.fecha, hora,
    creador: req.user.username, para: b.para, destinatario, destinatarioNombre,
    // Respuesta de la otra persona; "pendiente" hasta que acepte o rechace.
    respuesta: destinatario ? "pendiente" : null,
    hechoCreador: false, hechoDestinatario: false,
    creadoEn: new Date().toISOString(),
  };
  await upsertItem(COLECCION_RECORDATORIOS, item.id, item);
  res.status(201).json(item);
}));

// La otra persona acepta o rechaza.
app.put("/api/recordatorios/:id/responder", requireAuth, asyncRoute(async (req, res) => {
  const r = await getItem(COLECCION_RECORDATORIOS, req.params.id);
  if (!r || r.destinatario !== req.user.username) return res.status(404).json({ error: "No se encontró el recordatorio" });
  const accion = (req.body || {}).accion;
  if (accion !== "aceptar" && accion !== "rechazar") return res.status(400).json({ error: "Acción inválida" });
  r.respuesta = accion === "aceptar" ? "aceptado" : "rechazado";
  await upsertItem(COLECCION_RECORDATORIOS, r.id, r);
  res.json(r);
}));

// Marcar como hecho (o deshacer) — cada quien marca el suyo.
app.put("/api/recordatorios/:id/hecho", requireAuth, asyncRoute(async (req, res) => {
  const r = await getItem(COLECCION_RECORDATORIOS, req.params.id);
  if (!r || !esMio(r, req.user.username)) return res.status(404).json({ error: "No se encontró el recordatorio" });
  const hecho = !!(req.body || {}).hecho;
  if (r.creador === req.user.username) r.hechoCreador = hecho;
  else r.hechoDestinatario = hecho;
  await upsertItem(COLECCION_RECORDATORIOS, r.id, r);
  res.json(r);
}));

// Borra: quien lo creó lo borra para todos; la otra persona solo lo quita de su lista.
app.delete("/api/recordatorios/:id", requireAuth, asyncRoute(async (req, res) => {
  const r = await getItem(COLECCION_RECORDATORIOS, req.params.id);
  if (!r || !esMio(r, req.user.username)) return res.status(404).json({ error: "No se encontró el recordatorio" });
  if (r.creador === req.user.username) await deleteItem(COLECCION_RECORDATORIOS, r.id);
  else { r.respuesta = "rechazado"; await upsertItem(COLECCION_RECORDATORIOS, r.id, r); }
  res.status(204).end();
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

// Deja UNA sola vez un recordatorio para el dueño sobre los respaldos
// automáticos (queda anotada una marca para que, si lo borra, no reaparezca).
async function sembrarRecordatorioRespaldos() {
  const marca = "recordatorio_respaldos_sembrado";
  const marcas = (await getList("marcas_sistema")) ?? [];
  if (marcas.includes(marca)) return;
  const f = new Date(); f.setDate(f.getDate() + 3);
  const fecha = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`;
  await upsertItem(COLECCION_RECORDATORIOS, "sistema-respaldos", {
    id: "sistema-respaldos",
    titulo: "Programar respaldos automáticos de la base de datos",
    descripcion: "Antes de que las sucursales capturen en serio: dejar respaldos automáticos (Neon de pago con historial más largo, o el respaldo programado en tu Mac con `npm run respaldo`) y probar una restauración con `npm run restaurar` en modo simulacro.",
    fecha, hora: "", creador: SUPERADMIN, para: "yo", destinatario: null, respuesta: null,
    hechoCreador: false, hechoDestinatario: false, creadoEn: new Date().toISOString(),
  });
  await setList("marcas_sistema", [...marcas, marca]);
}

initDb()
  .then(() => separarResponsablesPorSucursal())
  .then(() => sembrarRecordatorioRespaldos())
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
