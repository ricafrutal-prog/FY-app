const TOKEN_KEY = "fy_token";
const USERNAME_KEY = "fy_username";
const ROLE_KEY = "fy_role";
const SUCURSAL_KEY = "fy_sucursal";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || "";
}
export function getRole() {
  return localStorage.getItem(ROLE_KEY) || "admin";
}
export function getSucursal() {
  return localStorage.getItem(SUCURSAL_KEY) || "";
}

// No hay todavía un campo de "nombre real" en las cuentas (eso vive en
// Configuración de cuenta, que sigue apagada) — mientras tanto, para el
// saludo tipo "Hola Ricardo" se arma un nombre a partir del usuario: a una
// sucursal se le saluda con el nombre de su sucursal (más útil que su
// usuario de acceso), y a un admin quitándole la palabra de rol al usuario.
const PALABRAS_ROL = new Set(["admin", "administrador", "sucursal", "gerente", "usuario", "user"]);
export function nombreParaSaludo() {
  if (getRole() === "sucursal") {
    const suc = getSucursal();
    if (suc) return suc;
  }
  const username = getUsername();
  if (!username) return "";
  const partes = username.split(/[._-]+/).filter(Boolean);
  const limpio = partes.filter((p) => !PALABRAS_ROL.has(p.toLowerCase()));
  const base = (limpio.length ? limpio : partes).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  return base.join(" ") || username;
}
function setSession(token, username, role, sucursal) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username || "");
  localStorage.setItem(ROLE_KEY, role || "admin");
  localStorage.setItem(SUCURSAL_KEY, sucursal || "");
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(SUCURSAL_KEY);
}

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión");
  setSession(data.token, data.username, data.role, data.sucursal);
  return data;
}

// Reemplazo de "fetch" que agrega el token de sesión y cierra la sesión sola
// si el servidor dice que ya no es válida (401).
export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearSession();
    window.location.reload();
  }
  return res;
}
