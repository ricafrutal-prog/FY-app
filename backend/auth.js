import jwt from "jsonwebtoken";
import { getSesion, tocarSesion } from "./db.js";

const SECRET = process.env.JWT_SECRET;

// En producción (Render) jamás se arranca sin una llave real: con la llave de
// pruebas cualquiera podría fabricarse una sesión de administrador.
if (!SECRET && process.env.RENDER) {
  console.error("JWT_SECRET no está configurado en producción — el servidor no arranca sin él.");
  process.exit(1);
}

if (!SECRET) {
  console.warn(
    "⚠️  Falta JWT_SECRET. Agrégalo a backend/.env (ver .env.example). Sin esto, nadie va a poder iniciar sesión de forma segura."
  );
}

// `sid` identifica la sesión abierta de este usuario (ver tabla "sesiones"):
// un token solo vale mientras su sid sea el de la sesión vigente.
export function signToken(user, sid) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role || "admin", sucursal: user.sucursal || null, sid },
    SECRET || "inseguro-solo-para-pruebas",
    { expiresIn: "24h" }
  );
}

// Protege una ruta: exige "Authorization: Bearer <token>" válido Y que la
// sesión siga vigente (no cerrada, ni reemplazada). De paso renueva la
// "última actividad" de la sesión, como mucho cada 20 segundos.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });
  let payload;
  try {
    payload = jwt.verify(token, SECRET || "inseguro-solo-para-pruebas");
  } catch {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
  try {
    const ses = payload.sid ? await getSesion(payload.username) : null;
    // Sin sid (tokens anteriores a este control) o con otro sid: sesión no vigente.
    if (!ses || ses.sid !== payload.sid) return res.status(401).json({ error: "La sesión ya no está vigente. Inicia sesión de nuevo." });
    if (ses.segundos > 20) await tocarSesion(payload.username, payload.sid);
    req.user = payload;
    next();
  } catch (err) {
    console.error("Error verificando la sesión:", err.message);
    res.status(500).json({ error: "Error del servidor" });
  }
}

// Para las consultas de Odoo: las puede usar un "admin" y también un usuario con
// rol "inventarios" (Auditoría e Inventarios las necesitan). Las sucursales, no.
export function requireAdminOInventarios(req, res, next) {
  if (req.user?.role !== "admin" && req.user?.role !== "inventarios") return res.status(403).json({ error: "No tienes permiso para esto" });
  next();
}

// Protege una ruta para que solo un usuario "admin" pueda entrar — se usa
// después de requireAuth. Los usuarios "sucursal" reciben 403.
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "No tienes permiso para esto" });
  next();
}
