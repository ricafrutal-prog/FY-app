import jwt from "jsonwebtoken";

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

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role || "admin", sucursal: user.sucursal || null },
    SECRET || "inseguro-solo-para-pruebas",
    { expiresIn: "24h" }
  );
}

// Protege una ruta: exige "Authorization: Bearer <token>" válido.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No autorizado" });
  try {
    req.user = jwt.verify(token, SECRET || "inseguro-solo-para-pruebas");
    next();
  } catch {
    res.status(401).json({ error: "Sesión inválida o expirada" });
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
