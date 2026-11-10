import crypto from "crypto";
import net from "net";
import { listUsers } from "./db.js";

// ---------------------------------------------------------------------------------------------
// CHECADOR en el celular del empleado.
//   • Identidad: passkey (WebAuthn) — el celular pide huella o Face ID y firma el reto. Aquí no se
//     guarda ninguna huella ni cara, solo la llave pública que el celular genera al registrarse.
//   • Lugar: la petición debe llegar desde la red (IP pública) que la sucursal tiene registrada y,
//     si la sucursal lo exige, desde unos metros a la redonda de su ubicación (geovalla).
//   • Hora: la pone el servidor (zona de la Ciudad de México), nunca el celular.
// Las checadas se guardan en la colección "checadas" (una por sucursal + día + empleado) y la
// pantalla de Registro asistencia las usa para llenar las horas de entrada y salida.
// Colecciones internas (fuera de COLLECTIONS, solo se llega por estas rutas):
//   checador_config (una por sucursal), checador_dispositivos, checador_codigos, checadas.
// ---------------------------------------------------------------------------------------------

export const b64uToBuf = (s) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
export const bufToB64u = (b) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = (b) => crypto.createHash("sha256").update(b).digest();
const hostDe = (origin) => { try { return new URL(origin).hostname; } catch { return ""; } };

// Clave de red de una IP: las IPv4 van completas; de las IPv6 solo se compara el prefijo /64 (cada
// aparato de la misma red trae una dirección distinta dentro del mismo prefijo).
export function ipClave(ipRaw) {
  let ip = String(ipRaw || "").trim();
  if (ip.startsWith("::ffff:") && net.isIPv4(ip.slice(7))) ip = ip.slice(7);
  if (net.isIPv4(ip)) return ip;
  if (net.isIPv6(ip)) {
    const [izq, der] = ip.split("::");
    const g = (s) => (s ? s.split(":") : []);
    const a = g(izq), b = der === undefined ? [] : g(der);
    const completo = der === undefined ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
    return `${completo.slice(0, 4).map((x) => x.padStart(4, "0")).join(":")}::/64`;
  }
  return "";
}

// Detrás del proxy de Render, req.ip suele ser una dirección interna (10.x). La IP real del cliente viene
// en cabeceras: primero las que pone Cloudflare, y si no, la primera dirección pública de X-Forwarded-For.
const esPrivada = (ip) => {
  const v = String(ip || "").replace(/^::ffff:/, "");
  if (net.isIPv4(v)) return /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(v);
  const l = v.toLowerCase();
  return l === "::1" || l.startsWith("fe80") || l.startsWith("fc") || l.startsWith("fd");
};
export function ipCliente(req) {
  const h = req.headers || {};
  const uno = (x) => String(Array.isArray(x) ? x[0] : x || "").split(",")[0].trim();
  for (const c of [uno(h["cf-connecting-ip"]), uno(h["true-client-ip"])]) if (c && (net.isIP(c) && !esPrivada(c))) return c;
  const cadena = String(h["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  const publica = cadena.find((s) => net.isIP(s) && !esPrivada(s));
  return publica || req.ip || "";
}

export function distanciaM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Fecha y hora de hoy en la Ciudad de México.
export function ahoraMx(d = new Date()) {
  const fecha = d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
  const hora = d.toLocaleTimeString("en-GB", { timeZone: "America/Mexico_City", hour12: false, hour: "2-digit", minute: "2-digit" });
  return { fecha, hora: hora === "24:00" ? "00:00" : hora };
}

function leerClientData(b64, tipo, challenge, hostEsperado) {
  const raw = b64uToBuf(b64);
  let j;
  try { j = JSON.parse(raw.toString("utf8")); } catch { throw new Error("Respuesta inválida"); }
  if (j.type !== tipo) throw new Error("Respuesta inválida");
  if (j.challenge !== challenge) throw new Error("El reto no coincide; vuelve a intentarlo");
  const h = hostDe(j.origin);
  if (!h || h !== hostEsperado) throw new Error("Origen no permitido");
  return raw;
}

// Alta de un celular: se valida el reto y se guarda la llave pública (SPKI) que entrega el navegador.
export function verificarRegistro({ clientDataJSON, publicKey, alg }, challenge, host) {
  leerClientData(clientDataJSON, "webauthn.create", challenge, host);
  if (alg !== -7 && alg !== -257) throw new Error("Este celular usa un tipo de llave no compatible");
  const der = b64uToBuf(publicKey);
  try { crypto.createPublicKey({ key: der, format: "der", type: "spki" }); } catch { throw new Error("Llave pública inválida"); }
  return { publicKey: bufToB64u(der), alg };
}

// Checada: se valida el reto, que el celular verificó a la persona (huella/rostro/PIN) y la firma.
export function verificarAfirmacion({ clientDataJSON, authenticatorData, signature }, dispositivo, challenge, host) {
  const raw = leerClientData(clientDataJSON, "webauthn.get", challenge, host);
  const auth = b64uToBuf(authenticatorData);
  if (auth.length < 37) throw new Error("Respuesta inválida");
  if (!auth.subarray(0, 32).equals(sha256(Buffer.from(host)))) throw new Error("Respuesta inválida");
  const flags = auth[32];
  if (!(flags & 0x01) || !(flags & 0x04)) throw new Error("El celular no verificó tu huella o rostro");
  const datos = Buffer.concat([auth, sha256(raw)]);
  const llave = crypto.createPublicKey({ key: b64uToBuf(dispositivo.publicKey), format: "der", type: "spki" });
  if (!crypto.verify("sha256", datos, llave, b64uToBuf(signature))) throw new Error("No se pudo comprobar la firma");
  return true;
}

// ---- Límite de intentos sencillo para las rutas públicas (por IP) ----
const intentos = new Map();
function limitar(req, res, max = 40, ventanaMs = 10 * 60 * 1000) {
  const k = String(ipCliente(req)), ahora = Date.now();
  const r = intentos.get(k);
  if (!r || ahora - r.t > ventanaMs) { intentos.set(k, { n: 1, t: ahora }); return true; }
  r.n += 1;
  if (r.n > max) { res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." }); return false; }
  return true;
}

const retos = new Map(); // retoId -> { challenge, tipo, codigo?, expira }
function nuevoReto(datos) {
  const ahora = Date.now();
  for (const [k, v] of retos) if (v.expira < ahora) retos.delete(k);
  const id = crypto.randomUUID();
  const challenge = bufToB64u(crypto.randomBytes(32));
  retos.set(id, { challenge, expira: ahora + 3 * 60 * 1000, ...datos });
  return { id, challenge };
}
function usarReto(id, tipo) {
  const r = retos.get(id);
  retos.delete(id);
  if (!r || r.tipo !== tipo || r.expira < Date.now()) return null;
  return r;
}

export function montarChecador(app, { requireAuth, getItem, upsertItem, deleteItem, listCollection, getList, asyncRoute, DUENOS }) {
  const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
  const esGestor = (u) => (u.role === "admin" && DUENOS.has(u.username)) || u.role === "rrhh";
  const hostDe_ = (req) => req.hostname;

  // Quién puede ver/operar la sucursal pedida: la propia sucursal, o los gestores (dueños y RR. HH.).
  function sucursalPermitida(req, res, pedida) {
    const u = req.user;
    if (u.role === "sucursal") return u.sucursal;
    if (esGestor(u)) {
      if (typeof pedida !== "string" || !pedida.trim()) { res.status(400).json({ error: "Elige la sucursal" }); return null; }
      return pedida;
    }
    res.status(403).json({ error: "No tienes permiso para esto" });
    return null;
  }
  const configDe = async (sucursal) => (await getItem("checador_config", sucursal)) || { id: sucursal, ips: [], lat: null, lng: null, radio: 150, exigirUbicacion: true };
  const redesAprobadas = (cfg) => (cfg.ips || []).filter((x) => x.aprobada).map((x) => x.clave);

  // ---------------- Panel (sucursal y gestores) ----------------
  app.get("/api/checador/panel", requireAuth, asyncRoute(async (req, res) => {
    const sucursal = sucursalPermitida(req, res, req.query.sucursal);
    if (!sucursal) return;
    const cfg = await configDe(sucursal);
    // El lugar "Oficina" no tiene lista de empleados: su personal son las cuentas de oficina (todas menos sucursales).
    const emps = sucursal === LUGARES_CUENTA.oficina
      ? (await listUsers()).filter((x) => x.role !== "sucursal").map((x) => ({ nombre: x.username, sucursal }))
      : ((await getList("empleados_asistencia")) || []);
    const disp = (await listCollection("checador_dispositivos")).filter((d) => d.sucursal === sucursal);
    res.json({
      sucursal, config: cfg, miRed: ipClave(ipCliente(req)), esGestor: esGestor(req.user), cabeceras: esGestor(req.user) ? { xff: req.headers["x-forwarded-for"] || null, cf: req.headers["cf-connecting-ip"] || null, tc: req.headers["true-client-ip"] || null, ip: req.ip } : undefined,
      empleados: (Array.isArray(emps) ? emps : []).filter((e) => e && e.sucursal === sucursal && !e.fechaBaja).map((e) => {
        const d = disp.find((x) => x.empleado === e.nombre && x.aprobado);
        const pend = disp.find((x) => x.empleado === e.nombre && !x.aprobado);
        return { nombre: e.nombre, puesto: e.puesto || "", dispositivo: !!d, pendiente: !!pend, solicitadoEn: pend?.creadoEn || null, ultimoUso: d?.ultimoUso || null };
      }),
    });
  }));

  // Registrar la red desde la que se está entrando como la de la sucursal. La sucursal solo la propone
  // (queda pendiente); si la registra un gestor, queda aprobada de una vez.
  app.post("/api/checador/red", requireAuth, asyncRoute(async (req, res) => {
    const sucursal = sucursalPermitida(req, res, (req.body || {}).sucursal);
    if (!sucursal) return;
    const manual = typeof (req.body || {}).ip === "string" && (req.body || {}).ip.trim() ? ipClave(req.body.ip) : "";
    if ((req.body || {}).ip && !manual) return res.status(400).json({ error: "Esa dirección IP no es válida" });
    if (manual && !esGestor(req.user)) return res.status(403).json({ error: "No tienes permiso para esto" });
    const clave = manual || ipClave(ipCliente(req));
    if (!clave) return res.status(400).json({ error: "No se pudo leer la red actual" });
    const cfg = await configDe(sucursal);
    if (!cfg.ips.some((x) => x.clave === clave)) cfg.ips.push({ clave, aprobada: esGestor(req.user), agregadaPor: req.user.username, fecha: new Date().toISOString() });
    await upsertItem("checador_config", sucursal, cfg);
    res.json(cfg);
  }));

  // Aprobar/quitar redes y ajustar ubicación y radio (solo gestores).
  app.put("/api/checador/config", requireAuth, asyncRoute(async (req, res) => {
    if (!esGestor(req.user)) return res.status(403).json({ error: "No tienes permiso para esto" });
    const b = req.body || {};
    if (typeof b.sucursal !== "string" || !b.sucursal) return res.status(400).json({ error: "Elige la sucursal" });
    const cfg = await configDe(b.sucursal);
    if (Array.isArray(b.ips)) cfg.ips = b.ips.filter((x) => x && typeof x.clave === "string").map((x) => ({ clave: x.clave, aprobada: !!x.aprobada, agregadaPor: x.agregadaPor || "", fecha: x.fecha || "" })).slice(0, 12);
    if (b.lat !== undefined) { const lat = Number(b.lat), lng = Number(b.lng); if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) { cfg.lat = lat; cfg.lng = lng; } }
    if (b.radio !== undefined) { const r = Math.round(Number(b.radio)); if (r >= 30 && r <= 1000) cfg.radio = r; }
    if (b.exigirUbicacion !== undefined) cfg.exigirUbicacion = !!b.exigirUbicacion;
    await upsertItem("checador_config", b.sucursal, cfg);
    res.json(cfg);
  }));
  // La sucursal puede fijar su ubicación solo si todavía no tiene una; después la cambia un gestor.
  app.post("/api/checador/ubicacion", requireAuth, asyncRoute(async (req, res) => {
    const sucursal = sucursalPermitida(req, res, (req.body || {}).sucursal);
    if (!sucursal) return;
    const lat = Number(req.body.lat), lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return res.status(400).json({ error: "Ubicación inválida" });
    const cfg = await configDe(sucursal);
    if (cfg.lat != null && !esGestor(req.user)) return res.status(403).json({ error: "La ubicación ya está registrada; pídele a tu administrador que la cambie." });
    cfg.lat = lat; cfg.lng = lng;
    await upsertItem("checador_config", sucursal, cfg);
    res.json(cfg);
  }));

  // Aprobar o rechazar la solicitud de registro de un celular. La sucursal (o un gestor) lo hace con la
  // persona enfrente: es lo único que confirma quién es, porque después solo cuenta su huella o rostro.
  app.post("/api/checador/aprobar", requireAuth, asyncRoute(async (req, res) => {
    const sucursal = sucursalPermitida(req, res, (req.body || {}).sucursal);
    if (!sucursal) return;
    const pend = (await listCollection("checador_dispositivos")).filter((d) => d.sucursal === sucursal && d.empleado === req.body.nombre && !d.aprobado);
    if (!pend.length) return res.status(404).json({ error: "No hay una solicitud pendiente de esa persona" });
    for (const d of pend) {
      if (req.body.aprobar) {
        // Aprobar reemplaza cualquier celular anterior ya aprobado de esa persona.
        for (const v of (await listCollection("checador_dispositivos")).filter((x) => x.sucursal === sucursal && x.empleado === d.empleado && x.aprobado)) await deleteItem("checador_dispositivos", v.id);
        await upsertItem("checador_dispositivos", d.id, { ...d, aprobado: true, aprobadoPor: req.user.username, aprobadoEn: new Date().toISOString() });
      } else await deleteItem("checador_dispositivos", d.id);
    }
    res.json({ ok: true });
  }));

  app.delete("/api/checador/dispositivo", requireAuth, asyncRoute(async (req, res) => {
    const sucursal = sucursalPermitida(req, res, (req.body || {}).sucursal);
    if (!sucursal) return;
    if (!esGestor(req.user)) return res.status(403).json({ error: "Solo un administrador puede quitar un celular." });
    const disp = (await listCollection("checador_dispositivos")).filter((d) => d.sucursal === sucursal && d.empleado === req.body.nombre);
    for (const d of disp) await deleteItem("checador_dispositivos", d.id);
    res.json({ ok: true });
  }));

  // Checadas de un día (la sucursal llena con ellas su captura de asistencia).
  app.get("/api/checador/checadas", requireAuth, asyncRoute(async (req, res) => {
    const fecha = String(req.query.fecha || "");
    if (!FECHA_RE.test(fecha)) return res.status(400).json({ error: "Fecha inválida" });
    const u = req.user;
    let sucursal = null;
    if (u.role === "sucursal") sucursal = u.sucursal;
    else if (esGestor(u)) sucursal = typeof req.query.sucursal === "string" && req.query.sucursal ? req.query.sucursal : null;
    else return res.status(403).json({ error: "No tienes permiso para esto" });
    const todas = await listCollection("checadas");
    res.json(todas.filter((c) => c.fecha === fecha && (!sucursal || c.sucursal === sucursal)));
  }));

  // ---- Validaciones y registro compartidos (celular propio y celular de la sucursal) ----
  async function validarLugar(req, disp, b) {
    const cfg = await configDe(disp.sucursal);
    const clave = ipClave(ipCliente(req));
    if (!redesAprobadas(cfg).length) return { status: 403, error: `${disp.sucursal} todavía no tiene su red registrada.` };
    if (!redesAprobadas(cfg).includes(clave)) return { status: 403, error: `Conéctate al Wi-Fi de ${disp.sucursal} para checar.` };
    let distancia = null;
    const lat = Number(b.lat), lng = Number(b.lng), precision = Number(b.precision);
    if (cfg.exigirUbicacion && cfg.lat != null) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { status: 403, error: "Activa la ubicación del celular para checar." };
      if (Number.isFinite(precision) && precision > 150) return { status: 403, error: "La señal de ubicación es débil; acércate a una ventana e inténtalo de nuevo." };
      distancia = distanciaM(lat, lng, cfg.lat, cfg.lng);
      if (distancia > (cfg.radio || 150)) return { status: 403, error: `Estás a ${distancia} m de ${disp.sucursal}; solo puedes checar en la sucursal.` };
    }
    return { clave, lat, lng, precision, distancia };
  }
  // tipoPedido: "entrada" | "salida" (celular de la sucursal) o null (celular propio: la 1.ª checada es entrada, la siguiente salida).
  async function aplicarChecada(disp, lugar, tipoPedido) {
    const { fecha, hora } = ahoraMx();
    const id = `chk|${disp.sucursal}|${fecha}|${disp.empleado}`;
    const doc = (await getItem("checadas", id)) || { id, sucursal: disp.sucursal, empleado: disp.empleado, fecha, entrada: "", salida: "", eventos: [] };
    const base = { empleado: disp.empleado, sucursal: disp.sucursal, fecha };
    let tipo;
    if (tipoPedido === "entrada") {
      if (doc.entrada) return { status: 409, error: `${disp.empleado} ya registró su entrada hoy a las ${doc.entrada}.` };
      tipo = "entrada"; doc.entrada = hora;
    } else if (tipoPedido === "salida") {
      if (!doc.entrada) return { status: 409, error: `${disp.empleado} todavía no registra su entrada de hoy.` };
      if (doc.salida) return { status: 409, error: `${disp.empleado} ya registró su salida hoy a las ${doc.salida}.` };
      tipo = "salida"; doc.salida = hora;
    } else if (!doc.entrada) { tipo = "entrada"; doc.entrada = hora; }
    else {
      const [h1, m1] = doc.entrada.split(":").map(Number), [h2, m2] = hora.split(":").map(Number);
      if (!doc.salida && (h2 * 60 + m2) - (h1 * 60 + m1) < 2) return { resultado: { ok: true, repetida: true, tipo: "entrada", hora: doc.entrada, ...base } };
      tipo = "salida"; doc.salida = hora; // si vuelve a checar, la salida se actualiza a la última
    }
    const { clave, lat, lng, precision, distancia } = lugar;
    doc.eventos.push({ tipo, hora, ip: clave, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, precision: Number.isFinite(precision) ? Math.round(precision) : null, distancia, via: tipoPedido ? "sucursal" : "celular" });
    if (doc.eventos.length > 40) doc.eventos = doc.eventos.slice(-40);
    await upsertItem("checadas", id, doc);
    disp.ultimoUso = new Date().toISOString();
    await upsertItem("checador_dispositivos", disp.id, disp);
    return { resultado: { ok: true, tipo, hora, ...base } };
  }

  // ---------------- Checador en el celular de la SUCURSAL (con la sesión de la sucursal) ----------------
  // Los accesos de huella o rostro de todo el personal se crean en ese equipo, con el gerente presente
  // (la sesión de la sucursal es quien confirma quién es). Después cada persona checa con su huella o rostro.
  const soloSucursal = (req, res) => { if (req.user.role !== "sucursal") { res.status(403).json({ error: "Solo la sucursal puede usar el checador." }); return false; } return true; };
  app.get("/api/checador/kiosco", requireAuth, asyncRoute(async (req, res) => {
    if (!soloSucursal(req, res)) return;
    const suc = req.user.sucursal;
    const emps = await (async () => ((await getList("empleados_asistencia")) || []).filter((e) => e && e.sucursal === suc && !e.fechaBaja))();
    const disp = (await listCollection("checador_dispositivos")).filter((d) => d.sucursal === suc && d.aprobado);
    const { fecha } = ahoraMx();
    const hoy = (await listCollection("checadas")).filter((c) => c.sucursal === suc && c.fecha === fecha);
    res.json({
      sucursal: suc, fecha,
      personal: emps.map((e) => { const c = hoy.find((x) => x.empleado === e.nombre); return { nombre: e.nombre, puesto: e.puesto || "", registrado: disp.some((d) => d.empleado === e.nombre), entrada: c?.entrada || "", salida: c?.salida || "" }; }),
    });
  }));
  app.post("/api/checador/kiosco/registro/opciones", requireAuth, asyncRoute(async (req, res) => {
    if (!soloSucursal(req, res)) return;
    const suc = req.user.sucursal, nombre = (req.body || {}).nombre;
    const emps = ((await getList("empleados_asistencia")) || []).filter((e) => e && e.sucursal === suc && !e.fechaBaja);
    if (!emps.some((e) => e.nombre === nombre)) return res.status(404).json({ error: "No se encontró a esa persona" });
    if ((await listCollection("checador_dispositivos")).some((d) => d.sucursal === suc && d.empleado === nombre && d.aprobado)) return res.status(409).json({ error: "Esa persona ya tiene su huella o rostro registrado. Si hay que repetirlo, pídele a tu administrador que lo quite." });
    const { id, challenge } = nuevoReto({ tipo: "registro", sucursal: suc, empleado: nombre, kiosco: true });
    res.json({
      retoId: id, challenge, rp: { id: hostDe_(req), name: "Frutal Yogurt" },
      user: { id: bufToB64u(Buffer.from(`${suc}|${nombre}`)), name: nombre, displayName: nombre },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none", timeout: 120000, empleado: nombre,
    });
  }));
  app.post("/api/checador/kiosco/registro/verificar", requireAuth, asyncRoute(async (req, res) => {
    if (!soloSucursal(req, res)) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "registro");
    if (!reto || !reto.kiosco || reto.sucursal !== req.user.sucursal) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    try {
      const { publicKey, alg } = verificarRegistro({ clientDataJSON: b.clientDataJSON, publicKey: b.publicKey, alg: b.alg }, reto.challenge, hostDe_(req));
      if (typeof b.id !== "string" || !b.id || b.id.length > 512) throw new Error("Respuesta inválida");
      for (const d of (await listCollection("checador_dispositivos")).filter((x) => x.sucursal === reto.sucursal && x.empleado === reto.empleado)) await deleteItem("checador_dispositivos", d.id);
      await upsertItem("checador_dispositivos", b.id, { id: b.id, publicKey, alg, sucursal: reto.sucursal, empleado: reto.empleado, aprobado: true, kiosco: true, aprobadoPor: req.user.username, creadoEn: new Date().toISOString(), ultimoUso: null });
      res.json({ ok: true, empleado: reto.empleado });
    } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  app.post("/api/checador/kiosco/checar/opciones", requireAuth, asyncRoute(async (req, res) => {
    if (!soloSucursal(req, res)) return;
    const tipo = (req.body || {}).tipo;
    if (tipo !== "entrada" && tipo !== "salida") return res.status(400).json({ error: "Elige entrada o salida" });
    const disp = (await listCollection("checador_dispositivos")).filter((d) => d.sucursal === req.user.sucursal && d.aprobado);
    if (!disp.length) return res.status(409).json({ error: "Todavía nadie tiene huella o rostro registrado." });
    const { id, challenge } = nuevoReto({ tipo: "checar", sucursal: req.user.sucursal, kiosco: true, tipoChecada: tipo });
    res.json({ retoId: id, challenge, rpId: hostDe_(req), userVerification: "required", timeout: 60000, credenciales: disp.map((d) => d.id) });
  }));
  app.post("/api/checador/kiosco/checar/verificar", requireAuth, asyncRoute(async (req, res) => {
    if (!soloSucursal(req, res)) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "checar");
    if (!reto || !reto.kiosco || reto.sucursal !== req.user.sucursal) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    const disp = typeof b.id === "string" ? await getItem("checador_dispositivos", b.id) : null;
    if (!disp || !disp.aprobado || disp.sucursal !== req.user.sucursal) return res.status(404).json({ error: "Esa huella o rostro no está registrado en esta sucursal." });
    try { verificarAfirmacion({ clientDataJSON: b.clientDataJSON, authenticatorData: b.authenticatorData, signature: b.signature }, disp, reto.challenge, hostDe_(req)); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    const lugar = await validarLugar(req, disp, b);
    if (lugar.error) return res.status(lugar.status).json({ error: lugar.error });
    const r = await aplicarChecada(disp, lugar, reto.tipoChecada);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.resultado);
  }));

  // ---------------- Checador del PERSONAL CON CUENTA (oficina, y después almacén y producción) ----------------
  // Cada persona entra con su propia cuenta, crea su acceso con su huella o rostro (una vez) y después checa
  // entrada/salida confirmando con huella o rostro. El "lugar" usa la misma red y ubicación que una sucursal
  // (config con el nombre del lugar, p. ej. "Oficina"), que un gestor configura en Configuración de cuenta.
  const LUGARES_CUENTA = { oficina: "Oficina" };
  const lugarCuenta = (req, res) => {
    const nombre = LUGARES_CUENTA[req.params.lugar];
    if (!nombre) { res.status(404).json({ error: "Lugar no encontrado" }); return null; }
    if (req.user.role === "sucursal") { res.status(403).json({ error: "Este checador es para el personal con cuenta propia." }); return null; }
    return nombre;
  };
  const miDispositivo = async (lugar, usuario) => (await listCollection("checador_dispositivos")).find((d) => d.sucursal === lugar && d.empleado === usuario && d.aprobado);
  app.get("/api/checador/propio/:lugar", requireAuth, asyncRoute(async (req, res) => {
    const lugar = lugarCuenta(req, res); if (!lugar) return;
    const { fecha } = ahoraMx();
    const d = await miDispositivo(lugar, req.user.username);
    const c = await getItem("checadas", `chk|${lugar}|${fecha}|${req.user.username}`);
    const cfg = await configDe(lugar);
    res.json({ lugar, usuario: req.user.username, fecha, registrado: !!d, entrada: c?.entrada || "", salida: c?.salida || "", configurado: redesAprobadas(cfg).length > 0 });
  }));
  app.post("/api/checador/propio/:lugar/registro/opciones", requireAuth, asyncRoute(async (req, res) => {
    const lugar = lugarCuenta(req, res); if (!lugar) return;
    const u = req.user.username;
    if (await miDispositivo(lugar, u)) return res.status(409).json({ error: "Ya tienes tu huella o rostro registrado. Si cambiaste de celular, pídele a un administrador que lo quite." });
    const { id, challenge } = nuevoReto({ tipo: "registro", sucursal: lugar, empleado: u, propio: true });
    res.json({
      retoId: id, challenge, rp: { id: hostDe_(req), name: "Frutal Yogurt" },
      user: { id: bufToB64u(Buffer.from(`${lugar}|${u}`)), name: u, displayName: u },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none", timeout: 120000,
    });
  }));
  app.post("/api/checador/propio/:lugar/registro/verificar", requireAuth, asyncRoute(async (req, res) => {
    const lugar = lugarCuenta(req, res); if (!lugar) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "registro");
    if (!reto || !reto.propio || reto.sucursal !== lugar || reto.empleado !== req.user.username) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    try {
      const { publicKey, alg } = verificarRegistro({ clientDataJSON: b.clientDataJSON, publicKey: b.publicKey, alg: b.alg }, reto.challenge, hostDe_(req));
      if (typeof b.id !== "string" || !b.id || b.id.length > 512) throw new Error("Respuesta inválida");
      await upsertItem("checador_dispositivos", b.id, { id: b.id, publicKey, alg, sucursal: lugar, empleado: reto.empleado, aprobado: true, propio: true, aprobadoPor: req.user.username, creadoEn: new Date().toISOString(), ultimoUso: null });
      res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
  }));
  app.post("/api/checador/propio/:lugar/checar/opciones", requireAuth, asyncRoute(async (req, res) => {
    const lugar = lugarCuenta(req, res); if (!lugar) return;
    const tipo = (req.body || {}).tipo;
    if (tipo !== "entrada" && tipo !== "salida") return res.status(400).json({ error: "Elige entrada o salida" });
    const d = await miDispositivo(lugar, req.user.username);
    if (!d) return res.status(409).json({ error: "Primero registra tu huella o rostro." });
    const { id, challenge } = nuevoReto({ tipo: "checar", sucursal: lugar, empleado: req.user.username, propio: true, tipoChecada: tipo });
    res.json({ retoId: id, challenge, rpId: hostDe_(req), userVerification: "required", timeout: 60000, credenciales: [d.id] });
  }));
  app.post("/api/checador/propio/:lugar/checar/verificar", requireAuth, asyncRoute(async (req, res) => {
    const lugar = lugarCuenta(req, res); if (!lugar) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "checar");
    if (!reto || !reto.propio || reto.sucursal !== lugar || reto.empleado !== req.user.username) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    const disp = typeof b.id === "string" ? await getItem("checador_dispositivos", b.id) : null;
    if (!disp || !disp.aprobado || disp.sucursal !== lugar || disp.empleado !== req.user.username) return res.status(404).json({ error: "Esa huella o rostro no está registrado en tu cuenta." });
    try { verificarAfirmacion({ clientDataJSON: b.clientDataJSON, authenticatorData: b.authenticatorData, signature: b.signature }, disp, reto.challenge, hostDe_(req)); }
    catch (e) { return res.status(400).json({ error: e.message }); }
    const lg = await validarLugar(req, disp, b);
    if (lg.error) return res.status(lg.status).json({ error: lg.error });
    const r = await aplicarChecada(disp, lg, reto.tipoChecada);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.resultado);
  }));

  // ---------------- Rutas públicas (el empleado no inicia sesión: se identifica con su celular) ----------------
  // 1) Solicitar el registro del celular: sin códigos. Solo se puede desde la red de la sucursal; el empleado
  // elige su nombre, crea su acceso con su huella o rostro y la sucursal lo aprueba estando él presente.
  const sucursalesDeLaRed = async (req) => {
    const clave = ipClave(ipCliente(req));
    return (await listCollection("checador_config")).filter((c) => redesAprobadas(c).includes(clave)).map((c) => c.id);
  };
  const empleadosActivos = async (sucursal) => ((await getList("empleados_asistencia")) || []).filter((e) => e && e.sucursal === sucursal && !e.fechaBaja);
  app.get("/api/checador/personal", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 60)) return;
    const sucs = await sucursalesDeLaRed(req);
    if (!sucs.length) return res.status(403).json({ error: "Conéctate al Wi-Fi de tu sucursal para registrar tu celular." });
    const disp = await listCollection("checador_dispositivos");
    const lista = [];
    for (const suc of sucs) for (const e of await empleadosActivos(suc)) if (!disp.some((d) => d.sucursal === suc && d.empleado === e.nombre && d.aprobado)) lista.push({ sucursal: suc, nombre: e.nombre });
    res.json(lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
  }));
  app.post("/api/checador/registro/opciones", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 20)) return;
    const { sucursal, nombre } = req.body || {};
    if (!(await sucursalesDeLaRed(req)).includes(sucursal)) return res.status(403).json({ error: "Conéctate al Wi-Fi de tu sucursal para registrar tu celular." });
    if (!(await empleadosActivos(sucursal)).some((e) => e.nombre === nombre)) return res.status(404).json({ error: "No se encontró a esa persona" });
    if ((await listCollection("checador_dispositivos")).some((d) => d.sucursal === sucursal && d.empleado === nombre && d.aprobado)) return res.status(409).json({ error: "Esa persona ya tiene un celular registrado. Pídele a tu administrador que lo quite si cambiaste de celular." });
    const { id, challenge } = nuevoReto({ tipo: "registro", sucursal, empleado: nombre });
    res.json({
      retoId: id, challenge, rp: { id: hostDe_(req), name: "Frutal Yogurt" },
      user: { id: bufToB64u(Buffer.from(`${sucursal}|${nombre}`)), name: nombre, displayName: nombre },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
      attestation: "none", timeout: 120000, empleado: nombre,
    });
  }));
  app.post("/api/checador/registro/verificar", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 20)) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "registro");
    if (!reto) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    if (!(await sucursalesDeLaRed(req)).includes(reto.sucursal)) return res.status(403).json({ error: "Conéctate al Wi-Fi de tu sucursal para registrar tu celular." });
    try {
      const { publicKey, alg } = verificarRegistro({ clientDataJSON: b.clientDataJSON, publicKey: b.publicKey, alg: b.alg }, reto.challenge, hostDe_(req));
      if (typeof b.id !== "string" || !b.id || b.id.length > 512) throw new Error("Respuesta inválida");
      // Una sola solicitud pendiente por persona: la nueva reemplaza a la anterior.
      for (const d of (await listCollection("checador_dispositivos")).filter((x) => x.sucursal === reto.sucursal && x.empleado === reto.empleado && !x.aprobado)) await deleteItem("checador_dispositivos", d.id);
      await upsertItem("checador_dispositivos", b.id, { id: b.id, publicKey, alg, sucursal: reto.sucursal, empleado: reto.empleado, aprobado: false, creadoEn: new Date().toISOString(), ultimoUso: null });
      res.json({ ok: true, empleado: reto.empleado });
    } catch (e) { res.status(400).json({ error: e.message }); }
  }));

  // Estado del día de un celular ya registrado (para que la página diga "Checar entrada" o "Checar salida").
  // Solo devuelve el nombre y las horas de hoy; el id de la llave es largo y aleatorio.
  app.get("/api/checador/estado", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 120)) return;
    const id = typeof req.query.id === "string" ? req.query.id : "";
    const disp = id && id.length <= 512 ? await getItem("checador_dispositivos", id) : null;
    if (!disp) return res.status(404).json({ error: "Celular no registrado" });
    const { fecha } = ahoraMx();
    const doc = await getItem("checadas", `chk|${disp.sucursal}|${fecha}|${disp.empleado}`);
    res.json({ empleado: disp.empleado, sucursal: disp.sucursal, aprobado: !!disp.aprobado, entrada: doc?.entrada || "", salida: doc?.salida || "" });
  }));

  // 2) Checar. Antes de pedir la huella se revisa que la red sea de alguna sucursal.
  app.post("/api/checador/checar/opciones", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 60)) return;
    const clave = ipClave(ipCliente(req));
    const configs = await listCollection("checador_config");
    if (!configs.some((c) => redesAprobadas(c).includes(clave))) return res.status(403).json({ error: "Conéctate al Wi-Fi de tu sucursal para checar.", red: clave });
    const { id, challenge } = nuevoReto({ tipo: "checar" });
    res.json({ retoId: id, challenge, rpId: hostDe_(req), userVerification: "required", timeout: 60000 });
  }));
  app.post("/api/checador/checar/verificar", asyncRoute(async (req, res) => {
    if (!limitar(req, res, 60)) return;
    const b = req.body || {};
    const reto = usarReto(b.retoId, "checar");
    if (!reto) return res.status(400).json({ error: "Se acabó el tiempo; vuelve a intentarlo." });
    const disp = typeof b.id === "string" ? await getItem("checador_dispositivos", b.id) : null;
    if (!disp) return res.status(404).json({ error: "Este celular no está registrado. Regístralo desde la opción \"Registrar mi celular\"." });
    if (!disp.aprobado) return res.status(403).json({ error: "Tu registro aún no está aprobado. Pídele a tu gerente que lo apruebe." });
    try { verificarAfirmacion({ clientDataJSON: b.clientDataJSON, authenticatorData: b.authenticatorData, signature: b.signature }, disp, reto.challenge, hostDe_(req)); }
    catch (e) { return res.status(400).json({ error: e.message }); }

    const lugar = await validarLugar(req, disp, b);
    if (lugar.error) return res.status(lugar.status).json({ error: lugar.error });
    const r = await aplicarChecada(disp, lugar, null);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json(r.resultado);
  }));
}
