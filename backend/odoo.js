// Cliente muy sencillo para hablar con Odoo (el sistema de punto de venta)
// usando su API externa (JSON-RPC). No depende de ninguna librería nueva —
// solo usa "fetch", que ya viene incluido en Node.
//
// Para usarlo hacen falta 4 variables en el .env: ODOO_URL, ODOO_DB,
// ODOO_USERNAME y ODOO_API_KEY. Si falta alguna, las funciones de aquí
// avisan con un error claro en vez de fallar de forma rara.

function odooConfig() {
  const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env;
  return { url: ODOO_URL, db: ODOO_DB, username: ODOO_USERNAME, apiKey: ODOO_API_KEY };
}

// Llamada JSON-RPC genérica a un "servicio" de Odoo (common, object, db...).
async function odooRpc(service, method, args) {
  const { url } = odooConfig();
  if (!url) throw new Error("Falta ODOO_URL en el .env");
  const res = await fetch(`${url.replace(/\/$/, "")}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Date.now(),
    }),
  });
  if (!res.ok) throw new Error(`Odoo respondió ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.error) {
    const msg = data.error?.data?.message || data.error?.message || JSON.stringify(data.error);
    throw new Error(msg);
  }
  return data.result;
}

// Intenta listar las bases de datos disponibles. Muchas instancias lo tienen
// deshabilitado por seguridad — si falla, no es un error grave, solo significa
// que hay que escribir ODOO_DB a mano en el .env.
export async function odooListDatabases() {
  return odooRpc("db", "list", []);
}

// Inicia sesión y regresa el "uid" (identificador del usuario) que se usa en
// todas las demás llamadas.
export async function odooLogin() {
  const { db, username, apiKey } = odooConfig();
  if (!db) throw new Error("Falta ODOO_DB en el .env");
  if (!username) throw new Error("Falta ODOO_USERNAME en el .env");
  if (!apiKey) throw new Error("Falta ODOO_API_KEY en el .env");
  const uid = await odooRpc("common", "authenticate", [db, username, apiKey, {}]);
  if (!uid) throw new Error("Usuario, base de datos o llave incorrectos (Odoo no regresó un uid).");
  return uid;
}

// Llamada genérica a cualquier modelo/método de Odoo (equivalente a
// execute_kw). Ejemplo: odooExecuteKw(uid, "pos.config", "search_read", [[]], { fields: ["id", "name"] })
export async function odooExecuteKw(uid, model, method, args = [], kwargs = {}) {
  const { db, apiKey } = odooConfig();
  return odooRpc("object", "execute_kw", [db, uid, apiKey, model, method, args, kwargs]);
}

// Odoo guarda "report.pos.order.date" en UTC, sin zona horaria en el texto
// (ej. "2026-08-30 23:15:00" ya es UTC). Todas las sucursales operan en
// Nuevo León, que desde la reforma de 2022 ya no tiene horario de verano y
// está fija en UTC-6 todo el año — por eso el offset se puede dejar fijo
// aquí en vez de tener que calcular horario de verano.
const OFFSET_HORAS_MX = 6;

// Convierte un datetime UTC (como lo entrega Odoo) al día calendario que le
// corresponde en hora de Nuevo León — así el día coincide con el que ve
// cualquiera dentro de la propia Odoo (que sí usa la hora local).
export function fechaLocalMx(fechaUtcTexto) {
  const utc = new Date(`${fechaUtcTexto.replace(" ", "T")}Z`);
  const local = new Date(utc.getTime() - OFFSET_HORAS_MX * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

// Suma (o resta, con un número negativo) días a una fecha "YYYY-MM-DD".
export function sumarDiasISO(fechaISO, dias) {
  const d = new Date(`${fechaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
