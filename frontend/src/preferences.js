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
  fondoAjuste: "llenar", // llenar = cubre toda la pantalla (puede recortar bordes) | completa = se ve entera
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
    root.style.setProperty("--fy-bg-size", p.fondoAjuste === "completa" ? "contain" : "cover");
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

// Prepara la foto de fondo para guardarla en la cuenta, cuidando la calidad:
//  • Si la foto ya es de un tamaño razonable (hasta 2560 px de lado mayor y
//    ~1.8 MB), se usa TAL CUAL — cero pérdida.
//  • Si es más grande, se reduce con suavizado de alta calidad y se guarda como
//    JPEG empezando en calidad 92; solo baja la calidad (y al final el tamaño)
//    si hace falta para no pasar del límite.
// 2560 px cubre pantallas Retina sin que se vea pixelada.
export function comprimirImagen(file, maxLado = 2560, maxBytes = 1.8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer la imagen"));
    lector.onload = () => {
      const original = lector.result;
      const img = new Image();
      img.onerror = () => reject(new Error("El archivo no parece ser una imagen válida"));
      img.onload = () => {
        const ladoMayor = Math.max(img.width, img.height);
        if (ladoMayor <= maxLado && String(original).length <= maxBytes) return resolve(original);

        const dibujar = (escala, calidad) => {
          const w = Math.max(1, Math.round(img.width * escala));
          const h = Math.max(1, Math.round(img.height * escala));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#fff"; // PNG con transparencia: fondo blanco en vez de negro
          ctx.fillRect(0, 0, w, h);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, w, h);
          return canvas.toDataURL("image/jpeg", calidad);
        };

        let escala = Math.min(1, maxLado / ladoMayor);
        let calidad = 0.92;
        let out = dibujar(escala, calidad);
        while (out.length > maxBytes && calidad > 0.7) { calidad -= 0.05; out = dibujar(escala, calidad); }
        while (out.length > maxBytes && escala > 0.4) { escala *= 0.88; out = dibujar(escala, calidad); }
        resolve(out);
      };
      img.src = original;
    };
    lector.readAsDataURL(file);
  });
}
