// ---- Personalización de la cuenta (tema, tipografía, fondo, densidad) ----
// Se guarda dos veces: en localStorage (para que se vea al instante, sin
// esperar respuesta del servidor) y en la cuenta del usuario en el backend
// (para que lo mismo aparezca si entra desde otra computadora). El tema
// oscuro y el fondo se aplican con CSS global (ver index.html) en vez de
// tocar uno por uno los miles de estilos de la app — así siempre se ve
// completo, sin partes que se queden a medias.
import { apiFetch } from "./auth";

const PREFS_KEY = "fy_prefs";

export const FUENTES = [
  { id: "jakarta", label: "Plus Jakarta Sans (por default)", stack: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: "inter", label: "Inter", stack: "'Inter', system-ui, sans-serif" },
  { id: "sistema", label: "La del sistema", stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "georgia", label: "Serif (Georgia)", stack: "Georgia, 'Times New Roman', serif" },
  { id: "mono", label: "Monoespaciada", stack: "'JetBrains Mono', ui-monospace, 'Courier New', monospace" },
];

export const DEFAULTS = {
  tema: "claro", // claro | oscuro
  fuente: "jakarta",
  fondoImagen: null, // data URL (ya comprimida) o null
  fondoIntensidad: 55, // 0 = casi tapada por el tinte, 100 = foto a toda vista
  densidad: "comoda", // comoda | compacta
};

export function getPrefsLocal() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

// Se usa al cerrar sesión — la personalización es de la cuenta, no del
// aparato, así que no debe quedarse puesta para quien entre después con otro
// usuario (sobre todo en una terminal de sucursal compartida).
export function limpiarPrefsLocal() {
  try {
    localStorage.removeItem(PREFS_KEY);
  } catch {
    // no pasa nada si no se pudo — de cualquier forma aplicamos los
    // valores por default a continuación
  }
  applyPrefs(DEFAULTS);
}

export function savePrefsLocal(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Si el fondo quedó demasiado pesado para localStorage, seguimos sin
    // tronar — igual se guardó en el servidor.
  }
}

// Pone en pantalla lo que diga "prefs" — clases y variables CSS en <html>,
// leídas por las reglas en index.html. Se puede llamar tantas veces como
// se quiera (por ejemplo, mientras alguien mueve un control en vivo).
export function applyPrefs(prefs) {
  const p = { ...DEFAULTS, ...prefs };
  const root = document.documentElement;

  root.classList.toggle("fy-dark", p.tema === "oscuro");
  root.classList.toggle("fy-compacta", p.densidad === "compacta");

  const fuente = FUENTES.find((f) => f.id === p.fuente) || FUENTES[0];
  root.style.setProperty("--fy-font", fuente.stack);

  if (p.fondoImagen) {
    const tinte = Math.max(0, Math.min(100, 100 - (Number(p.fondoIntensidad) || 0))) / 100;
    root.style.setProperty("--fy-bg-image", `url(${p.fondoImagen})`);
    root.style.setProperty("--fy-bg-tint", String(0.15 + tinte * 0.75));
  } else {
    root.style.setProperty("--fy-bg-image", "none");
    root.style.setProperty("--fy-bg-tint", "1");
  }
}

export async function loadPrefsDesdeServidor() {
  const r = await apiFetch("/api/auth/me");
  if (!r.ok) throw new Error("No se pudo cargar tu cuenta");
  const data = await r.json();
  const prefs = { ...DEFAULTS, ...(data.preferencias || {}) };
  savePrefsLocal(prefs);
  applyPrefs(prefs);
  return prefs;
}

export async function guardarPrefsEnServidor(prefs) {
  const r = await apiFetch("/api/auth/preferencias", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    // Si el backend no tiene esta ruta todavía (no se ha reiniciado desde
    // que se agregó), el servidor contesta un 404 en HTML en vez de JSON —
    // ahí "data" sale null. Lo avisamos distinto para que sea obvio que es
    // eso y no un problema con la foto o la conexión.
    if (!data) throw new Error(`El servidor contestó ${r.status} y no en el formato esperado — probablemente el backend no se ha reiniciado desde la última actualización.`);
    throw new Error(data?.error || "No se pudieron guardar tus preferencias");
  }
  savePrefsLocal(prefs);
  return data.preferencias;
}

// Comprime y reduce una foto antes de guardarla — una foto de celular sin
// tocar pesa varios MB; esto la deja en un tamaño razonable para vivir en
// la cuenta del usuario y cargar rápido.
export function comprimirImagen(file, maxAncho = 1600, calidad = 0.72) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no parece ser una imagen válida"));
      img.onload = () => {
        const escala = Math.min(1, maxAncho / img.width);
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(file);
  });
}
