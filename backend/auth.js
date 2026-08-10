import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
  console.warn(
    "⚠️  Falta JWT_SECRET. Agrégalo a backend/.env (ver .env.example). Sin esto, nadie va a poder iniciar sesión de forma segura."
  );
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, SECRET || "inseguro-solo-para-pruebas", {
    expiresIn: "30d",
  });
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
