const TOKEN_KEY = "fy_token";
const USERNAME_KEY = "fy_username";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || "";
}
function setSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username || "");
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

export async function login(username, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesión");
  setSession(data.token, data.username);
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
