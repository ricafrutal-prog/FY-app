import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import * as Icons from "lucide-react";
import * as XLSX from "xlsx";
import { usePersistedCollection, usePersistedList } from "./hooks/persistence";

const LOGO = "./assets/logo.png";

/* ============================================================
   Mantenimiento · Sucursales — prototipo interactivo
   Tablero general → detalle de sucursal → reportar falla
   El reporte lo cierra (confirma) quien lo levantó.
   ============================================================ */

const T = {
  ink: "#16161B",
  inkSoft: "#41414C",
  muted: "#8C8C97",
  line: "#E6E3DB",
  lineSoft: "#F0EEE8",
  paper: "#F1F3F2",
  card: "#FFFFFF",
  brand: "#0F6E66",
  brandDark: "#0A4F49",
  brandSoft: "#E4F0EE",
  ok: "#2E9E5B",
  okSoft: "#E7F4EC",
  warn: "#C98A1E",
  warnSoft: "#FAF1DC",
  bad: "#D6453F",
  badSoft: "#FBE7E5",
  crit: "#A81D27",
};

/* ---- catálogo de fallas por tipo de equipo ----
   cada falla define la criticidad (impacto al negocio)
   y el impacto funcional sobre el equipo (estado resultante) */
const FALLAS = {
  "Máquina de helado": [
    { f: "No congela / no produce", crit: "Crítico", estado: "fuera" },
    { f: "No enciende", crit: "Crítico", estado: "fuera" },
    { f: "Se tapa constantemente", crit: "Crítico", estado: "fuera" },
    { f: "Cambio de cuchillas", crit: "Crítico", estado: "fuera" },
    { f: "Produce con textura o temperatura incorrecta", crit: "Crítico", estado: "degradado" },
    { f: "Ruido o vibración anormal", crit: "Crítico", estado: "degradado" },
    { f: "Fuga de agua o mezcla", crit: "Alto", estado: "degradado" },
    { f: "Falta de empaques", crit: "Alto", estado: "degradado" },
    { f: "Falta de pieza", crit: "Alto", estado: "degradado" },
    { f: "Falla en panel / control", crit: "Medio", estado: "degradado" },
  ],
  "Congelador": [
    { f: "No enfría / temperatura alta", crit: "Crítico", estado: "fuera" },
    { f: "Enfría de forma intermitente", crit: "Alto", estado: "degradado" },
    { f: "Exceso de escarcha", crit: "Medio", estado: "degradado" },
    { f: "Empaque o puerta dañada", crit: "Bajo", estado: "degradado" },
  ],
  "Enfriador": [
    { f: "No enfría / temperatura alta", crit: "Crítico", estado: "fuera" },
    { f: "Enfría parcialmente", crit: "Alto", estado: "degradado" },
    { f: "Ruido anormal del compresor", crit: "Medio", estado: "degradado" },
    { f: "Iluminación o puerta dañada", crit: "Bajo", estado: "degradado" },
  ],
  "Clima": [
    { f: "No enfría", crit: "Crítico", estado: "fuera" },
    { f: "Enfría poco", crit: "Alto", estado: "degradado" },
    { f: "Gotea / fuga de agua", crit: "Medio", estado: "degradado" },
    { f: "Ruido anormal", crit: "Medio", estado: "degradado" },
  ],
  "Anuncio luminoso": [
    { f: "Apagado total", crit: "Crítico", estado: "fuera" },
    { f: "Secciones fundidas o parpadeo", crit: "Medio", estado: "degradado" },
  ],
  "Punto de venta": [
    { f: "No enciende / no cobra", crit: "Crítico", estado: "fuera" },
    { f: "No imprime tickets", crit: "Alto", estado: "degradado" },
    { f: "Lento o se traba", crit: "Alto", estado: "degradado" },
    { f: "Lector de código falla", crit: "Bajo", estado: "degradado" },
  ],
  "Cámaras": [
    { f: "Sistema completo caído", crit: "Crítico", estado: "fuera" },
    { f: "No graba / sin almacenamiento", crit: "Medio", estado: "degradado" },
    { f: "Una cámara sin señal", crit: "Bajo", estado: "degradado" },
  ],
  "Congelador helado duro": [
    { f: "No enfría / temperatura alta", crit: "Crítico", estado: "fuera" },
    { f: "Enfría de forma intermitente", crit: "Alto", estado: "degradado" },
    { f: "Exceso de escarcha", crit: "Medio", estado: "degradado" },
    { f: "Vidrio o puerta dañada", crit: "Bajo", estado: "degradado" },
  ],
  "Filtro de agua": [
    { f: "No pasa agua / tapado", crit: "Alto", estado: "fuera" },
    { f: "Agua turbia o con mal sabor", crit: "Alto", estado: "degradado" },
    { f: "Fuga", crit: "Medio", estado: "degradado" },
    { f: "Toca cambio de cartucho", crit: "Bajo", estado: "degradado" },
  ],
  "Terminal bancaria": [
    { f: "No conecta / no procesa pagos", crit: "Crítico", estado: "fuera" },
    { f: "Procesa lento o se cae intermitente", crit: "Alto", estado: "degradado" },
    { f: "No imprime comprobante", crit: "Bajo", estado: "degradado" },
  ],
  "Microondas": [
    { f: "No enciende / no calienta", crit: "Alto", estado: "fuera" },
    { f: "Calienta poco o intermitente", crit: "Bajo", estado: "degradado" },
    { f: "Plato o puerta dañada", crit: "Bajo", estado: "degradado" },
  ],
  "Crepera": [
    { f: "No enciende / no calienta", crit: "Alto", estado: "fuera" },
    { f: "No alcanza temperatura", crit: "Medio", estado: "degradado" },
    { f: "Termostato falla", crit: "Medio", estado: "degradado" },
  ],
  "Equipos snack": [
    { f: "No enciende / no calienta", crit: "Crítico", estado: "fuera" },
    { f: "Calienta de forma despareja", crit: "Bajo", estado: "degradado" },
  ],
  "Pantallas menú": [
    { f: "Apagada / no enciende", crit: "Alto", estado: "fuera" },
    { f: "Imagen congelada / no actualiza", crit: "Bajo", estado: "degradado" },
    { f: "Secciones o píxeles dañados", crit: "Bajo", estado: "degradado" },
  ],
  "Pantalla": [
    { f: "No enciende", crit: "Bajo", estado: "fuera" },
    { f: "Sin señal o imagen", crit: "Bajo", estado: "degradado" },
  ],
  "Ventiladores espantamoscas": [
    { f: "No enciende", crit: "Crítico", estado: "fuera" },
    { f: "Funciona débil o intermitente", crit: "Bajo", estado: "degradado" },
    { f: "Ruido anormal", crit: "Bajo", estado: "degradado" },
  ],
  "Iluminación": [
    { f: "Zona sin luz / apagada", crit: "Medio", estado: "fuera" },
    { f: "Parpadeo o lámparas fundidas", crit: "Bajo", estado: "degradado" },
  ],
  "Módem de internet": [
    { f: "Sin servicio / no hay internet", crit: "Crítico", estado: "fuera" },
    { f: "No enciende / sin luces", crit: "Crítico", estado: "fuera" },
    { f: "Conexión intermitente / se cae a ratos", crit: "Alto", estado: "degradado" },
    { f: "Internet lento", crit: "Medio", estado: "degradado" },
    { f: "WiFi de clientes no funciona", crit: "Bajo", estado: "degradado" },
  ],
};

const PROVEEDOR = {
  "Máquina de helado": "FríoTec Servicios",
  "Congelador": "FríoTec Servicios",
  "Enfriador": "FríoTec Servicios",
  "Congelador helado duro": "FríoTec Servicios",
  "Clima": "ClimaPro MTY",
  "Punto de venta": "SistemasPOS",
  "Terminal bancaria": "Banco (adquirente)",
  "Cámaras": "SeguriRed",
  "Anuncio luminoso": "Rótulos del Norte",
  "Filtro de agua": "AquaService",
  "Microondas": "Servicio Técnico Cocina",
  "Crepera": "Servicio Técnico Cocina",
  "Equipos snack": "Servicio Técnico Cocina",
  "Pantallas menú": "DigitalSign",
  "Pantalla": "DigitalSign",
  "Ventiladores espantamoscas": "Electro Servicios",
  "Iluminación": "Electro Servicios",
  "Módem de internet": "Proveedor de internet (ISP)",
};

const TIPO_CODE = {
  "Máquina de helado": "HEL",
  "Enfriador": "ENF",
  "Congelador": "CON",
  "Clima": "CLI",
  "Anuncio luminoso": "ANU",
  "Punto de venta": "POS",
  "Cámaras": "CAM",
  "Congelador helado duro": "CHD",
  "Filtro de agua": "FIL",
  "Terminal bancaria": "TER",
  "Microondas": "MIC",
  "Crepera": "CRE",
  "Equipos snack": "SNK",
  "Pantallas menú": "PMN",
  "Pantalla": "PAN",
  "Ventiladores espantamoscas": "VEN",
  "Iluminación": "ILU",
  "Módem de internet": "NET",
};

const CICLO = ["Abierto", "Asignado", "En proceso", "Resuelto — por confirmar", "Cerrado"];

/* ---- datos semilla ---- */
const SUCURSALES = [
  "Las Puentes",
  "República Mexicana",
  "Walmart San Sebastián",
  "Soriana Cadereyta",
  "Mitras",
  "Berneses",
  "Juárez Centro",
  "Escobedo Lineal",
  "Colón Centro",
  "Estación Sendero 1",
  "Estación Sendero 2",
  "Estación San Nicolás",
];

/* ===== Datos compartidos que alimentan el apartado de Finanzas =====
   Las ventas provienen de la plataforma analítica (aquí van de ejemplo).
   Inventarios y cuadro de personal se capturan en Gestión y alimentan los % de Finanzas. */
const VENTAS_MES = {
  "Las Puentes": 336130, "República Mexicana": 298400, "Walmart San Sebastián": 274900, "Soriana Cadereyta": 251200,
  "Mitras": 312750, "Berneses": 289600, "Juárez Centro": 305100, "Escobedo Lineal": 243800,
  "Colón Centro": 268400, "Estación Sendero 1": 226500, "Estación Sendero 2": 214300, "Estación San Nicolás": 259700,
};
const INV_SEED = Object.fromEntries(SUCURSALES.map((s, i) => [s, { inicial: 18000 + i * 200, compras: Math.round(VENTAS_MES[s] * 0.30) + i * 300, final: 16500 + i * 150 }]));
const CUADRO_SEED = Object.fromEntries(SUCURSALES.map((s) => [s, [
  { puesto: "Gerente", sueldo: 4500 },
  { puesto: "Subgerente", sueldo: 3200 },
  { puesto: "Colaborador", sueldo: 2200 },
  { puesto: "Colaborador", sueldo: 2200 },
  { puesto: "Colaborador T/V", sueldo: 1800 },
]]));

const PLANTILLA = [
  ["Máquina de helado", 2],
  ["Congelador helado duro", 1],
  ["Enfriador", 2],
  ["Congelador", 2],
  ["Clima", 2],
  ["Crepera", 1],
  ["Microondas", 1],
  ["Equipos snack", 1],
  ["Filtro de agua", 1],
  ["Punto de venta", 2],
  ["Terminal bancaria", 2],
  ["Pantallas menú", 1],
  ["Pantalla", 1],
  ["Anuncio luminoso", 1],
  ["Iluminación", 2],
  ["Ventiladores espantamoscas", 1],
  ["Módem de internet", 1],
  ["Cámaras", 1],
];

function siglas(s) {
  const w = s.split(" ").filter(Boolean);
  if (w.length === 1) return w[0].slice(0, 3).toUpperCase();
  return w.map((x) => x[0]).join("").slice(0, 3).toUpperCase();
}

function buildEquipos() {
  const out = [];
  Object.entries(AREA_DATA).forEach(([area, cfg]) => {
    cfg.sites.forEach((site) => {
      cfg.plantilla.forEach(([tipo, n]) => {
        for (let i = 1; i <= n; i++) {
          out.push({
            id: `${siglas(site)}-${cfg.tipoCode[tipo] || tipo.slice(0, 3).toUpperCase()}-${i}`,
            area,
            sucursal: site,
            tipo,
            nombre: n > 1 ? `${tipo} ${i}` : tipo,
            estado: "operativo",
          });
        }
      });
    });
  });
  return out;
}

const hAgo = (h) => new Date(Date.now() - h * 3600 * 1000);

/* reportes y estados de equipo pre-cargados para que el tablero tenga vida */
const SEED = [
  // abiertos / en curso (recientes)
  { suc: "Las Puentes", tipo: "Máquina de helado", idx: 0, falla: "No congela / no produce", por: "Laura M. (Encargada)", ciclo: 1, hrs: 6 },
  { suc: "Mitras", tipo: "Clima", idx: 0, falla: "No enfría", por: "Diego R. (Gerente)", ciclo: 2, hrs: 28 },
  { suc: "Soriana Cadereyta", tipo: "Congelador", idx: 1, falla: "Exceso de escarcha", por: "Sofía P. (Encargada)", ciclo: 0, hrs: 3 },
  { suc: "Colón Centro", tipo: "Anuncio luminoso", idx: 0, falla: "Secciones fundidas o parpadeo", por: "Iván T. (Encargado)", ciclo: 0, hrs: 50 },
  { suc: "Estación Sendero 1", tipo: "Punto de venta", idx: 0, falla: "No enciende / no cobra", por: "Mariana L. (Gerente)", ciclo: 3, hrs: 9 },
  { suc: "República Mexicana", tipo: "Enfriador", idx: 1, falla: "Enfría parcialmente", por: "Laura M. (Encargada)", ciclo: 2, hrs: 18 },
  // historial cerrado dentro de la última semana
  { suc: "Berneses", tipo: "Máquina de helado", idx: 0, falla: "Ruido o vibración anormal", por: "Ana G. (Gerente)", ciclo: 4, hrs: 100, res: 30 },
  { suc: "Juárez Centro", tipo: "Terminal bancaria", idx: 0, falla: "No conecta / no procesa pagos", por: "Luis F. (Auditor)", ciclo: 4, hrs: 130, res: 5 },
  { suc: "Escobedo Lineal", tipo: "Clima", idx: 1, falla: "Enfría poco", por: "Rosa M. (Gerente)", ciclo: 4, hrs: 80, res: 48 },
  { suc: "Estación Sendero 2", tipo: "Punto de venta", idx: 0, falla: "Lento o se traba", por: "Pedro S. (Auditor)", ciclo: 4, hrs: 60, res: 20 },
  { suc: "Las Puentes", tipo: "Filtro de agua", idx: 0, falla: "Toca cambio de cartucho", por: "Laura M. (Encargada)", ciclo: 4, hrs: 150, res: 72 },
  // historial cerrado del último mes
  { suc: "Mitras", tipo: "Congelador helado duro", idx: 0, falla: "Exceso de escarcha", por: "Diego R. (Gerente)", ciclo: 4, hrs: 240, res: 24 },
  { suc: "Colón Centro", tipo: "Iluminación", idx: 0, falla: "Parpadeo o lámparas fundidas", por: "Iván T. (Encargado)", ciclo: 4, hrs: 300, res: 96 },
  { suc: "Estación San Nicolás", tipo: "Cámaras", idx: 0, falla: "Una cámara sin señal", por: "Marisol P. (Gerente)", ciclo: 4, hrs: 360, res: 50 },
  { suc: "Walmart San Sebastián", tipo: "Microondas", idx: 0, falla: "No enciende / no calienta", por: "Jorge L. (Auditor)", ciclo: 4, hrs: 420, res: 30 },
  { suc: "República Mexicana", tipo: "Anuncio luminoso", idx: 0, falla: "Apagado total", por: "Laura M. (Encargada)", ciclo: 4, hrs: 480, res: 60 },
  { suc: "Soriana Cadereyta", tipo: "Enfriador", idx: 0, falla: "No enfría / temperatura alta", por: "Sofía P. (Encargada)", ciclo: 4, hrs: 540, res: 12 },
  { suc: "Berneses", tipo: "Crepera", idx: 0, falla: "No alcanza temperatura", por: "Ana G. (Gerente)", ciclo: 4, hrs: 600, res: 40 },
  { suc: "Juárez Centro", tipo: "Máquina de helado", idx: 1, falla: "Falta de empaques", por: "Luis F. (Auditor)", ciclo: 4, hrs: 660, res: 80 },
  { suc: "Estación Sendero 1", tipo: "Clima", idx: 0, falla: "Gotea / fuga de agua", por: "Mariana L. (Gerente)", ciclo: 4, hrs: 700, res: 36 },
];

let FOLIO = 1040;
function nextFolio() {
  FOLIO += 1;
  return `MT-${FOLIO}`;
}

function buildSeed(equipos) {
  const reportes = [];
  Object.entries(AREA_DATA).forEach(([area, cfg]) => {
    cfg.seed.forEach((s) => {
      const site = s.suc || s.site || cfg.sites[0];
      const eq = equipos.filter((e) => e.area === area && e.sucursal === site && e.tipo === s.tipo)[s.idx];
      if (!eq) return;
      const meta = cfg.fallas[s.tipo].find((x) => x.f === s.falla);
      if (s.ciclo < 4) eq.estado = meta.estado; // los cerrados ya volvieron a operativo
      const prov = cfg.proveedor[s.tipo];
      const base = { "Crítico": 2800, "Alto": 1600, "Medio": 850, "Bajo": 350 }[meta.crit] || 500;
      const externo = /ISP|Banco/i.test(prov);
      const costo = s.ciclo >= 3 ? (externo ? 0 : base + (s.hrs % 7) * 60) : null;
      const C = hAgo(s.hrs).getTime();
      const at = (h) => new Date(C + h * 3600000);
      const log = [{ estado: "Abierto", actor: s.por, ts: at(0) }];
      let evidencia = null;
      if (s.ciclo === 4) {
        const res = s.res || 24;
        log.push({ estado: "Asignado", actor: "Mantenimiento", ts: at(res * 0.15), detalle: `Proveedor: ${prov}` });
        log.push({ estado: "En proceso", actor: "Mantenimiento", ts: at(res * 0.4) });
        evidencia = "Se revisó el equipo, se corrigió la falla y se probó funcionamiento.";
        log.push({ estado: "Resuelto — por confirmar", actor: "Mantenimiento", ts: at(res * 0.85), detalle: evidencia });
        log.push({ estado: "Cerrado", actor: s.por, ts: at(res) });
      } else {
        if (s.ciclo >= 1) log.push({ estado: "Asignado", actor: "Mantenimiento", ts: at(1), detalle: `Proveedor: ${prov}` });
        if (s.ciclo >= 2) log.push({ estado: "En proceso", actor: "Mantenimiento", ts: at(2) });
        if (s.ciclo >= 3) {
          evidencia = "Se revisó el equipo, se reemplazó la pieza dañada y se probó funcionamiento.";
          log.push({ estado: "Resuelto — por confirmar", actor: "Mantenimiento", ts: at(4), detalle: evidencia });
        }
      }
      reportes.push({
        folio: nextFolio(),
        area,
        equipoId: eq.id,
        sucursal: site,
        tipo: s.tipo,
        equipoNombre: eq.nombre,
        falla: s.falla,
        crit: meta.crit,
        estadoFunc: meta.estado,
        por: s.por,
        proveedor: s.ciclo >= 1 ? prov : null,
        provDefault: prov,
        ciclo: s.ciclo,
        creado: hAgo(s.hrs),
        nota: "",
        evidencia,
        costo,
        log,
      });
    });
  });
  return reportes.sort((a, b) => a.creado - b.creado);
}

/* ============================================================
   OFICINAS — catálogo propio (una sola oficina, un bloque)
   ============================================================ */
const OFICINAS_FALLAS = {
  "Módem / internet": [
    { f: "Sin servicio / no hay internet", crit: "Crítico", estado: "fuera" },
    { f: "Conexión intermitente", crit: "Alto", estado: "degradado" },
    { f: "Internet lento", crit: "Medio", estado: "degradado" },
  ],
  "Red local": [
    { f: "Red caída (nadie conecta)", crit: "Crítico", estado: "fuera" },
    { f: "Un área sin red", crit: "Alto", estado: "degradado" },
    { f: "Lentitud en la red", crit: "Medio", estado: "degradado" },
  ],
  "WiFi": [
    { f: "WiFi caído total", crit: "Alto", estado: "fuera" },
    { f: "WiFi débil o intermitente", crit: "Medio", estado: "degradado" },
    { f: "Un punto de acceso sin señal", crit: "Bajo", estado: "degradado" },
  ],
  "Servidor / NAS": [
    { f: "No responde / sistema caído", crit: "Crítico", estado: "fuera" },
    { f: "Lento o intermitente", crit: "Alto", estado: "degradado" },
    { f: "Sin espacio / respaldo fallando", crit: "Medio", estado: "degradado" },
  ],
  "No-break / UPS": [
    { f: "No respalda / no enciende", crit: "Alto", estado: "fuera" },
    { f: "Batería no retiene carga", crit: "Medio", estado: "degradado" },
    { f: "Alarma o falla intermitente", crit: "Bajo", estado: "degradado" },
  ],
  "Impresora": [
    { f: "No imprime / no enciende", crit: "Alto", estado: "fuera" },
    { f: "Atasca o imprime con fallas", crit: "Medio", estado: "degradado" },
    { f: "Escáner no funciona", crit: "Bajo", estado: "degradado" },
    { f: "Sin tóner / consumible", crit: "Bajo", estado: "degradado" },
  ],
  "Clima": [
    { f: "No enfría", crit: "Alto", estado: "fuera" },
    { f: "Enfría poco", crit: "Medio", estado: "degradado" },
    { f: "Gotea / ruido", crit: "Bajo", estado: "degradado" },
  ],
  "Iluminación": [
    { f: "Zona sin luz", crit: "Medio", estado: "fuera" },
    { f: "Parpadeo / lámparas fundidas", crit: "Bajo", estado: "degradado" },
  ],
  "Cámaras": [
    { f: "Sistema completo caído", crit: "Alto", estado: "fuera" },
    { f: "No graba / sin almacenamiento", crit: "Medio", estado: "degradado" },
    { f: "Una cámara sin señal", crit: "Bajo", estado: "degradado" },
  ],
  "Control de acceso": [
    { f: "No abre / bloquea el acceso", crit: "Alto", estado: "fuera" },
    { f: "No registra asistencia", crit: "Medio", estado: "degradado" },
    { f: "Lector intermitente", crit: "Bajo", estado: "degradado" },
  ],
};
const OFICINAS_PROVEEDOR = {
  "Módem / internet": "Proveedor de internet (ISP)",
  "Red local": "Soporte IT",
  "WiFi": "Soporte IT",
  "Servidor / NAS": "Soporte IT",
  "No-break / UPS": "Electro Servicios",
  "Impresora": "Servicio de impresión",
  "Clima": "ClimaPro MTY",
  "Iluminación": "Electro Servicios",
  "Cámaras": "SeguriRed",
  "Control de acceso": "SeguriRed",
};
const OFICINAS_TIPO_CODE = {
  "Módem / internet": "NET", "Red local": "RED", "WiFi": "WIFI", "Servidor / NAS": "SRV",
  "No-break / UPS": "UPS", "Impresora": "IMP", "Clima": "CLI", "Iluminación": "ILU",
  "Cámaras": "CAM", "Control de acceso": "ACC",
};
const OFICINAS_PLANTILLA = [
  ["Módem / internet", 1],
  ["Red local", 1],
  ["WiFi", 2],
  ["Servidor / NAS", 1],
  ["No-break / UPS", 1],
  ["Impresora", 2],
  ["Clima", 2],
  ["Iluminación", 2],
  ["Cámaras", 1],
  ["Control de acceso", 1],
];
const OFICINAS_SEED = [
  { tipo: "Módem / internet", idx: 0, falla: "Conexión intermitente", por: "Claudia R. (Administración)", ciclo: 1, hrs: 5 },
  { tipo: "Impresora", idx: 0, falla: "Atasca o imprime con fallas", por: "Beto S. (Recepción)", ciclo: 0, hrs: 20 },
  { tipo: "Clima", idx: 1, falla: "No enfría", por: "Claudia R. (Administración)", ciclo: 2, hrs: 30 },
  { tipo: "WiFi", idx: 0, falla: "WiFi caído total", por: "Beto S. (Recepción)", ciclo: 4, hrs: 120, res: 6 },
  { tipo: "No-break / UPS", idx: 0, falla: "Batería no retiene carga", por: "Claudia R. (Administración)", ciclo: 4, hrs: 300, res: 48 },
  { tipo: "Cámaras", idx: 0, falla: "Una cámara sin señal", por: "Vigilancia", ciclo: 4, hrs: 480, res: 72 },
];

/* registro de áreas configuradas — cada una con su propio catálogo */
const AREA_DATA = {
  sucursales: { multi: true, sites: SUCURSALES, plantilla: PLANTILLA, fallas: FALLAS, proveedor: PROVEEDOR, tipoCode: TIPO_CODE, seed: SEED },
  oficinas: { multi: false, sites: ["Oficina"], plantilla: OFICINAS_PLANTILLA, fallas: OFICINAS_FALLAS, proveedor: OFICINAS_PROVEEDOR, tipoCode: OFICINAS_TIPO_CODE, seed: OFICINAS_SEED },
};

/* ---- helpers visuales ---- */
const estadoMeta = {
  operativo: { label: "Operativo", color: T.ok, soft: T.okSoft },
  degradado: { label: "Degradado", color: T.warn, soft: T.warnSoft },
  fuera: { label: "Fuera de servicio", color: T.bad, soft: T.badSoft },
};
const critMeta = {
  "Crítico": { color: T.crit },
  "Alto": { color: T.bad },
  "Medio": { color: T.warn },
  "Bajo": { color: T.muted },
};

function antiguedad(d) {
  const h = (Date.now() - new Date(d).getTime()) / 3600000;
  if (h < 1) return "hace menos de 1 h";
  if (h < 24) return `hace ${Math.round(h)} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function fmtTs(d) {
  return new Date(d).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* navegación permitida por rol — auditores/gerentes NO ven el tablero */
const NAV = {
  sucursal: [["reportar", "Reportar falla"], ["reportes", "Mis reportes"]],
  mantenimiento: [["tablero", "Tablero"], ["reportes", "Reportes"], ["informes", "Informes"]],
};

/* áreas del negocio — por ahora solo Sucursales está configurada */
const AREAS = [
  { key: "sucursales", nombre: "Sucursales", iconName: "Store", desc: "Puntos de venta y atención a clientes", activa: true },
  { key: "oficinas", nombre: "Oficinas", iconName: "Building2", desc: "Áreas administrativas", activa: true },
  { key: "almacen", nombre: "Almacén", iconName: "Warehouse", desc: "Resguardo y distribución de mercancía", activa: false, hint: "Cámaras de refrigeración, montacargas, racks, andenes, CCTV" },
  { key: "vehiculos", nombre: "Parque vehicular", iconName: "Truck", desc: "Unidades administrativas y de carga", activa: false, hint: "Se controla por kilometraje y servicios programados, más verificaciones" },
  { key: "produccion", nombre: "Producción", iconName: "Factory", desc: "Elaboración de producto", activa: false, hint: "Líneas y máquinas de producción, tanques, compresores, control de temperatura" },
];

/* departamentos de la plataforma (barra lateral) — solo Mantenimiento está desarrollado */
const DEPTOS = [
  { key: "inicio", nombre: "Inicio", iconName: "LayoutDashboard", activo: true, home: true },
  { key: "franquicias", nombre: "Franquicias", iconName: "Handshake", activo: true, metricas: [["Franquicias activas", "34"], ["Solicitudes en proceso", "5"]] },
  { key: "sucursales_propias", nombre: "Sucursales Propias", iconName: "Store", activo: true, metricas: [["Sucursales", "12"], ["Auditorías críticas", "2"]] },
  { key: "aperturas", nombre: "Aperturas", iconName: "KeyRound", metricas: [["Sucursales en proceso", "3"], ["Próxima apertura", "12 jul"]] },
  { key: "remodelaciones", nombre: "Remodelaciones", iconName: "Hammer", metricas: [["Proyectos activos", "2"], ["Avance promedio", "68%"]] },
  { key: "capital_humano", nombre: "Capital Humano", iconName: "Users", activo: true, metricas: [["Empleados", "248"], ["Vacantes abiertas", "7"]] },
  { key: "video_vigilancia", nombre: "Auditorías Remotas", iconName: "Video", metricas: [["Cámaras en línea", "182/190"], ["Alertas hoy", "3"]] },
  { key: "mantenimiento", nombre: "Mantenimiento", iconName: "Wrench", activo: true },
  { key: "inventarios", nombre: "Inventarios", iconName: "Package", activo: true, metricas: [["Valor de inventario", "$4.2M"], ["Por reabastecer", "23"]] },
  { key: "marketing", nombre: "Marketing", iconName: "Megaphone", metricas: [["Campañas activas", "4"], ["Alcance del mes", "68 mil"]] },
  { key: "atencion_cliente", nombre: "Atención al Cliente", iconName: "Headphones", metricas: [["Casos abiertos", "18"], ["Satisfacción", "4.5 / 5"]] },
  { key: "auditoria", nombre: "Auditoría Presencial", iconName: "ClipboardCheck", metricas: [["Auditorías del mes", "42"], ["Cumplimiento promedio", "87%"]] },
  { key: "auditoria_interna", nombre: "Auditoría Interna", iconName: "ShieldCheck" },
];

/* ===== Datos del departamento de Franquicias ===== */
const FRANQ_SECCIONES = [
  { key: "red", nombre: "Red de franquicias", iconName: "Network", activa: true, desc: "Directorio y semáforo de todas las franquicias" },
  { key: "renovaciones", nombre: "Contratos y renovaciones", iconName: "FileText", activa: true, desc: "Pipeline de renovación por etapas" },
  { key: "auditorias", nombre: "Auditorías y planes de acción", iconName: "ClipboardCheck", activa: false, desc: "Resultados, planes, evidencias y sanciones" },
  { key: "cobranza", nombre: "Cobranza y finanzas", iconName: "Wallet", activa: true, desc: "Regalías, cartera vencida, bloqueo de suministro" },
  { key: "relacion", nombre: "Relación y Reportes", iconName: "MessageSquare", activa: true, desc: "Reportes del portal · folios y seguimiento" },
  { key: "marketing", nombre: "Marketing y publicidad", iconName: "Megaphone", activa: false, desc: "Plan corporativo y local por franquicia" },
  { key: "capacitacion", nombre: "Capacitación", iconName: "GraduationCap", activa: false, desc: "Necesidades detectadas y aperturas" },
  { key: "encuestas", nombre: "Encuestas de Satisfacción", iconName: "Star", activa: true, desc: "Satisfacción de franquiciatarios por aspecto" },
  { key: "reportes", nombre: "Reportes y KPIs", iconName: "BarChart3", activa: true, desc: "Automáticos + entregas con carga" },
];
const FRANQ_ETAPAS = [
  "Detección y clasificación", "Construcción del expediente", "Primer contacto formal",
  "Negociación", "Elaboración del contrato", "Firma y formalización", "Seguimiento post-renovación",
];
const FRANQ_ETAPA_INFO = [
  "Detectado en el archivo maestro; se verifican datos del contrato y se asigna categoría (Verde / Amarillo / Rojo).",
  "Se arma el expediente: desempeño en auditorías, historial financiero y de relación, con resumen ejecutivo y postura inicial.",
  "Reunión formal con el franquiciatario: se comunica el vencimiento y su desempeño, y se acuerda la reunión de negociación.",
  "Se negocian condiciones dentro de los parámetros de Dirección General; cada sesión queda documentada en minuta.",
  "El área Legal elabora el contrato y el Gerente lo revisa punto por punto contra las condiciones acordadas.",
  "Firma de ambas partes, entrega de ejemplares y archivo; se actualiza el archivo maestro de contratos.",
  "Seguimiento de los compromisos pactados durante el primer mes, validando cada uno con evidencia concreta.",
];
const catMeta = { "Verde": { color: T.ok }, "Amarillo": { color: T.warn }, "Rojo": { color: T.bad } };
const CONCEPTOS = [
  ["regalias", "Regalías"], ["renta", "Renta"], ["financiamiento", "Financiamiento"],
  ["nacionSalud", "Nación Salud"], ["publicidad", "Publicidad"], ["compras", "Compras"],
];
/* roster real tomado del Excel de conciliación de pagos (Junio 2026).
   Unidad = franquicia (sucursal). El franquiciatario (dueño) queda como atributo.
   Calif. de auditoría y datos de contrato son ilustrativos (no venían en el Excel). */
const RENTA_SUC = new Set(["Patio 1", "Patio 2", "Apodaca 1", "Sto. Domingo", "S. Diego Díaz", "S. Aztlán", "Azteca", "Huinalá", "S. Contry", "Interplaza Morelos", "San Pedro", "S. Escobedo", "Rep. Mexicana", "Sendero la Fe 2", "Merco Sta. Elena", "San Miguel", "La Puerta"]);
const FIN_SUC = new Set(["Apodaca 1", "Patio 2", "S. Escobedo", "Multi Apodaca", "Rep. Mexicana", "Send. La Fe", "La Puerta"]);
const NS_SUC = new Set(["Universidad", "S. Contry", "Quintas", "Azteca", "Huinalá", "Multiplaza Gpe.", "HEB Tec", "San Pedro", "Interplaza Morelos", "S. Escobedo", "Multi Apodaca", "Rep. Mexicana", "Merco Sta. Elena", "San Miguel", "La Puerta", "Pinos", "HEB Acapulco"]);
const VENCIDOS = {
  "S. Escobedo": { financiamiento: 29980, compras: 24854 },
  "Multi Apodaca": { financiamiento: 5600 },
  "La Puerta": { financiamiento: 13625 },
  "Send. La Fe": { financiamiento: 5400, nacionSalud: 1200 },
  "Merco Sta. Elena": { publicidad: 3000 },
  "Pinos": { compras: 12128 },
  "HEB Acapulco": { compras: 11430 },
};
const _SUC = [
  ["Patio 1", "Mauricio Garza", 93, 15, 0], ["Patio 2", "Mauricio Garza", 90, 18, 0], ["Apodaca 1", "Mauricio Garza", 91, 14, 0],
  ["Sto. Domingo", "Mauricio Garza", 88, 22, 0], ["S. Diego Díaz", "Mauricio Garza", 92, 16, 0], ["S. Aztlán", "Mauricio Garza", 89, 20, 0],
  ["Merco El Carmen", "Mauricio Garza", 94, 17, 0], ["Morelos 2", "Mauricio Garza", 87, 19, 0], ["Walmart La Fe / San Antonio", "Mauricio Garza", 85, 24, 0],
  ["Universidad", "Jorge Jaramillo", 96, 7, 5], ["S. Contry", "Jorge Jaramillo", 93, 13, 0], ["Quintas", "Jorge Jaramillo", 95, 15, 0],
  ["Azteca", "Jesús Medina", 86, 10, 3], ["Huinalá", "Jesús Medina", 88, 14, 0], ["Multiplaza Gpe.", "Jesús Medina", 90, 16, 0],
  ["HEB Tec", "Hassel Mendoza", 91, 13, 0], ["San Pedro", "Hassel Mendoza", 89, 4, 6],
  ["Interplaza Morelos", "Humberto Quintanilla", 86, 11, 2], ["S. Escobedo", "Cesar Cantú", 64, 5, 4],
  ["Multi Apodaca", "Marcela Alcocer", 82, 8, 4], ["Sendero la Fe 2", "Marcela Alcocer", 84, 17, 0],
  ["Rep. Mexicana", "Fernando Cortez", 96, 9, 3], ["Merco Sta. Elena", "Jesús Fermín", 83, 13, 0], ["San Miguel", "David Maya", 91, 18, 0],
  ["La Puerta", "Jair Marañón", 79, 12, 1], ["Pinos", "Irma Lara", 80, 3, 2], ["HEB Acapulco", "Andrés Garza", 85, 16, 0],
  ["Cuauhtémoc", "David Treviño", 89, 21, 0], ["Central", "David Treviño", 90, 19, 0], ["San Bernabé", "David Treviño", 88, 23, 0],
  ["Matamoros", "Enrique Polanco", 87, 9, 3], ["Send. La Fe", "Carlos Alanís", 60, 5, 4],
];
/* porcentaje de regalías y montos fijos por sucursal (del Excel) */
const PCT = {
  "Patio 1": 0.03, "Patio 2": 0.03, "Apodaca 1": 0.03, "Sto. Domingo": 0.03, "S. Diego Díaz": 0.03, "S. Aztlán": 0.03, "Merco El Carmen": 0.03, "Morelos 2": 0.03, "Walmart La Fe / San Antonio": 0.03,
  "Universidad": 0.035, "S. Contry": 0.035, "Quintas": 0.035, "Azteca": 0.025, "Huinalá": 0.025, "Multiplaza Gpe.": 0.035, "HEB Tec": 0.025, "San Pedro": 0.025, "Interplaza Morelos": 0.03,
  "S. Escobedo": 0.035, "Multi Apodaca": 0.035, "Sendero la Fe 2": 0.035, "Rep. Mexicana": 0.035, "Merco Sta. Elena": 0.035, "San Miguel": 0.035, "La Puerta": 0.04, "Pinos": 0.035, "HEB Acapulco": 0.04,
  "Cuauhtémoc": 0.035, "Central": 0.035, "San Bernabé": 0.035, "Matamoros": 0.04, "Send. La Fe": 0.035,
};
const RENTA = { "Patio 1": 30628, "Patio 2": 34060, "Apodaca 1": 22638, "Sto. Domingo": 10775, "S. Diego Díaz": 14941, "S. Aztlán": 15534, "Azteca": 16000, "Huinalá": 14731, "S. Contry": 15274, "Interplaza Morelos": 45000, "San Pedro": 24200, "S. Escobedo": 46200, "Rep. Mexicana": 14000, "Sendero la Fe 2": 24560, "Merco Sta. Elena": 11968, "San Miguel": 10034, "La Puerta": 19001 };
const FIN = { "Apodaca 1": 52973, "Patio 2": 33709, "S. Escobedo": 29980, "Multi Apodaca": 5600, "Rep. Mexicana": 34635, "Send. La Fe": 5400, "La Puerta": 13625 };
const NS_MONTO = 700;
const PUB_MONTO = 1200;
const MESES_COB = [["2026-01", "Enero"], ["2026-02", "Febrero"], ["2026-03", "Marzo"], ["2026-04", "Abril"], ["2026-05", "Mayo"], ["2026-06", "Junio"]];
const COB_ACTUAL = 5; // junio = mes en curso
const FRANQUICIAS = _SUC.map(([suc, franq, calif, venceMeses, etapa], i) => {
  const cob = { regalias: { e: "ok" }, publicidad: { e: "ok" }, compras: { e: "ok" } };
  if (RENTA_SUC.has(suc)) cob.renta = { e: "ok" };
  if (FIN_SUC.has(suc)) cob.financiamiento = { e: "ok" };
  if (NS_SUC.has(suc)) cob.nacionSalud = { e: "ok" };
  const v = VENCIDOS[suc];
  if (v) for (const k in v) cob[k] = { e: "vencido", monto: v[k] };
  return { id: "FR-" + String(i + 1).padStart(2, "0"), suc, franq, calif, venceMeses, etapa, cobranza: cob, pct: PCT[suc] || 0.03, renta: RENTA[suc] || 0, fin: FIN[suc] || 0, ns: NS_SUC.has(suc) };
});
/* semilla de movimientos mensuales: Ene–Abr pagados; Mayo con los adeudos reales; Junio en blanco (mes en curso para capturar) */
function seedMovimientos(franqs) {
  const mov = {};
  franqs.forEach((f, idx) => {
    const ventaBase = 140000 + ((idx * 7919) % 130000);
    for (let mi = 0; mi <= 4; mi++) {
      const venta = Math.round((ventaBase * (1 + mi * 0.03)) / 500) * 500;
      mov[`${f.id}|${mi}|regalias`] = { venta, pagado: true, fecha: `${String(mi + 1).padStart(2, "0")}/2026` };
      mov[`${f.id}|${mi}|publicidad`] = { pagado: true, fecha: `${String(mi + 1).padStart(2, "0")}/2026` };
      if (f.renta) mov[`${f.id}|${mi}|renta`] = { pagado: true, fecha: `${String(mi + 1).padStart(2, "0")}/2026` };
      if (f.fin) mov[`${f.id}|${mi}|financiamiento`] = { pagado: true, fecha: `${String(mi + 1).padStart(2, "0")}/2026` };
      if (f.ns) mov[`${f.id}|${mi}|nacionSalud`] = { pagado: true, fecha: `${String(mi + 1).padStart(2, "0")}/2026` };
    }
    const v = VENCIDOS[f.suc];
    if (v) for (const k in v) {
      if (k === "compras") mov[`${f.id}|4|compras`] = { monto: v[k], pagado: false, fecha: null };
      else mov[`${f.id}|4|${k}`] = { ...(mov[`${f.id}|4|${k}`] || {}), pagado: false, fecha: null, monto: v[k] };
    }
  });
  return mov;
}
function fqVencidos(f) { return CONCEPTOS.filter(([k]) => f.cobranza[k] && f.cobranza[k].e === "vencido"); }
function fqMontoVencido(f) { return fqVencidos(f).reduce((a, [k]) => a + (f.cobranza[k].monto || 0), 0); }
function fqCategoria(f) { const n = fqVencidos(f).length; return n >= 2 ? "Rojo" : n === 1 ? "Amarillo" : "Verde"; }
function fqBloqueo(f) { return f.cobranza.compras && f.cobranza.compras.e === "vencido"; }

/* ============================================================ */

export default function App() {
  const [equipos, setEquipos] = useState(buildEquipos);
  const [reportes, setReportes] = useState(() => buildSeed(equipos));
  const [rol, setRol] = useState("mantenimiento"); // sucursal | mantenimiento
  const [area, setArea] = useState(null); // null = menú de áreas | "sucursales" | ...
  const [vista, setVista] = useState("tablero"); // tablero | reportes | reportar | informes
  const [sucSel, setSucSel] = useState(null);
  const [depto, setDepto] = useState("inicio");
  const [modo, setModo] = useState("gestion");
  const [cuadro, setCuadro] = useState(CUADRO_SEED);
  const [inv, setInv] = useState(INV_SEED);
  const [invMes, setInvMes] = useState(INVMES_SEED);
  const [toast, setToast] = useState(null);

  const cambiarRol = (k) => { setRol(k); setVista(NAV[k][0][0]); setSucSel(null); setArea(null); };
  const entrarArea = (k) => { setArea(k); setVista("tablero"); setSucSel(null); };
  const salirArea = () => { setArea(null); setSucSel(null); };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  /* área activa en pantalla (para mantenimiento es la que abrió; para el rol que reporta, sucursales) */
  const currentArea = rol === "sucursal" ? "sucursales" : area;
  const areaEquipos = useMemo(() => equipos.filter((e) => e.area === currentArea), [equipos, currentArea]);
  const areaReportes = useMemo(() => reportes.filter((r) => r.area === currentArea), [reportes, currentArea]);
  const sitesActuales = currentArea && AREA_DATA[currentArea] ? AREA_DATA[currentArea].sites : [];

  /* --- métricas del área actual --- */
  const m = useMemo(() => {
    const total = areaEquipos.length;
    const oper = areaEquipos.filter((e) => e.estado === "operativo").length;
    const degr = areaEquipos.filter((e) => e.estado === "degradado").length;
    const fuera = areaEquipos.filter((e) => e.estado === "fuera").length;
    const abiertos = areaReportes.filter((r) => r.ciclo < 4);
    const criticosCaidos = areaEquipos.filter((e) => {
      if (e.estado === "operativo") return false;
      const r = abiertos.find((x) => x.equipoId === e.id);
      return r && r.crit === "Crítico";
    }).length;
    return {
      total, oper, degr, fuera,
      disp: total ? Math.round((oper / total) * 100) : 100,
      abiertos, criticosCaidos,
      critCount: abiertos.filter((r) => r.crit === "Crítico").length,
      altoCount: abiertos.filter((r) => r.crit === "Alto").length,
    };
  }, [areaEquipos, areaReportes]);

  const porSucursal = useMemo(() => {
    return sitesActuales.map((s) => {
      const eq = areaEquipos.filter((e) => e.sucursal === s);
      const oper = eq.filter((e) => e.estado === "operativo").length;
      const fuera = eq.filter((e) => e.estado === "fuera").length;
      const degr = eq.filter((e) => e.estado === "degradado").length;
      const ab = areaReportes.filter((r) => r.sucursal === s && r.ciclo < 4);
      return { s, eq, oper, fuera, degr, disp: eq.length ? Math.round((oper / eq.length) * 100) : 100, ab };
    });
  }, [areaEquipos, areaReportes, sitesActuales]);

  /* resumen de cada área activa para el panel principal */
  const resumenAreas = useMemo(() => {
    const out = {};
    AREAS.forEach((a) => {
      if (!a.activa) return;
      const eq = equipos.filter((e) => e.area === a.key);
      const oper = eq.filter((e) => e.estado === "operativo").length;
      const ab = reportes.filter((r) => r.area === a.key && r.ciclo < 4).length;
      out[a.key] = { total: eq.length, disp: eq.length ? Math.round((oper / eq.length) * 100) : 100, abiertos: ab };
    });
    return out;
  }, [equipos, reportes]);

  /* resumen global real de Mantenimiento (para la tarjeta de Inicio) */
  const mttoResumen = useMemo(() => {
    const oper = equipos.filter((e) => e.estado === "operativo").length;
    const ab = reportes.filter((r) => r.ciclo < 4).length;
    return { disp: equipos.length ? Math.round((oper / equipos.length) * 100) : 100, abiertos: ab };
  }, [equipos, reportes]);

  /* --- acciones del ciclo (cada paso lo mueve un rol y queda en bitácora) --- */
  function asignar(folio) {
    setReportes((prev) => prev.map((r) => {
      if (r.folio !== folio) return r;
      const prov = r.proveedor || r.provDefault || "Proveedor";
      return { ...r, ciclo: 1, proveedor: prov, log: [...(r.log || []), { estado: "Asignado", actor: "Mantenimiento", ts: new Date(), detalle: `Proveedor: ${prov}` }] };
    }));
  }
  function iniciar(folio) {
    setReportes((prev) => prev.map((r) => (r.folio !== folio ? r : { ...r, ciclo: 2, log: [...(r.log || []), { estado: "En proceso", actor: "Mantenimiento", ts: new Date() }] })));
  }
  function resolver(folio, evidencia, costo) {
    setReportes((prev) => prev.map((r) => (r.folio !== folio ? r : { ...r, ciclo: 3, evidencia, costo: Number(costo) || 0, log: [...(r.log || []), { estado: "Resuelto — por confirmar", actor: "Mantenimiento", ts: new Date(), detalle: evidencia }] })));
    flash("Marcado como resuelto · ahora la sucursal debe confirmar");
  }
  function confirmar(folio) {
    const rep = reportes.find((r) => r.folio === folio);
    setReportes((prev) => prev.map((r) => (r.folio !== folio ? r : { ...r, ciclo: 4, log: [...(r.log || []), { estado: "Cerrado", actor: r.por, ts: new Date() }] })));
    if (rep) {
      setEquipos((prev) => prev.map((e) => (e.id === rep.equipoId ? { ...e, estado: "operativo" } : e)));
      flash(`${rep.folio} cerrado · ${rep.equipoNombre} regresó a operativo`);
    }
  }
  function rechazar(folio) {
    setReportes((prev) => prev.map((r) => (r.folio !== folio ? r : { ...r, ciclo: 2, evidencia: null, log: [...(r.log || []), { estado: "Rechazado — no quedó", actor: r.por, ts: new Date() }] })));
    flash("Cierre rechazado · el reporte volvió a En proceso");
  }
  const acciones = { asignar, iniciar, resolver, confirmar, rechazar };

  function crearReporte(data) {
    const cfg = AREA_DATA[data.area];
    const meta = cfg && cfg.fallas[data.tipo] && cfg.fallas[data.tipo].find((x) => x.f === data.falla);
    const eq = equipos.find((e) => e.id === data.equipoId);
    if (!meta || !eq) {
      flash("No se pudo crear el reporte: revisa equipo y falla.");
      return;
    }
    const nuevo = {
      folio: nextFolio(),
      area: data.area,
      equipoId: data.equipoId,
      sucursal: data.site,
      tipo: data.tipo,
      equipoNombre: eq.nombre,
      falla: data.falla,
      crit: meta.crit,
      estadoFunc: meta.estado,
      por: data.por,
      proveedor: null,
      provDefault: cfg.proveedor[data.tipo],
      ciclo: 0,
      creado: new Date(),
      nota: data.nota,
      evidencia: null,
      costo: null,
      log: [{ estado: "Abierto", actor: data.por, ts: new Date() }],
    };
    setReportes((prev) => [...prev, nuevo]);
    setEquipos((prev) => prev.map((e) => (e.id === data.equipoId ? { ...e, estado: meta.estado } : e)));
    flash(`${nuevo.folio} enviado · ${data.site} · criticidad ${meta.crit}`);
    setVista("reportes");
  }

  const areaMeta = AREAS.find((a) => a.key === area);
  const enHome = rol === "mantenimiento" && area === null;
  const enModulo = rol === "sucursal" || (rol === "mantenimiento" && areaMeta && areaMeta.activa);
  const enPlaceholder = rol === "mantenimiento" && areaMeta && !areaMeta.activa;
  const subtitulo = rol === "sucursal" ? "Reportar" : enHome ? "Todas las áreas" : (areaMeta ? areaMeta.nombre : "");

  return (
    <div style={{ minHeight: "100%", display: "flex", background: T.paper, color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <NavRail modo={modo} setModo={setModo} />
      {modo === "tareas" ? <Tareas /> : modo === "finanzas" ? <Finanzas cuadro={cuadro} inv={inv} invMes={invMes} /> : (<>
      <Sidebar depto={depto} onPick={setDepto} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {depto === "inicio" && <Inicio onEnter={(k) => setDepto(k)} mtto={mttoResumen} />}
      {depto === "franquicias" && <Franquicias />}
      {depto === "capital_humano" && <CapitalHumano cuadro={cuadro} setCuadro={setCuadro} />}
      {depto === "sucursales_propias" && <SucursalesPropias />}
      {depto === "inventarios" && <Inventarios inv={inv} setInv={setInv} invMes={invMes} setInvMes={setInvMes} />}
      {depto === "video_vigilancia" && <AuditoriasRemotas />}
      {depto === "remodelaciones" && <Remodelaciones />}
      {depto === "auditoria_interna" && <AuditoriaInterna />}
      {depto !== "inicio" && depto !== "mantenimiento" && depto !== "franquicias" && depto !== "capital_humano" && depto !== "sucursales_propias" && depto !== "inventarios" && depto !== "video_vigilancia" && depto !== "remodelaciones" && depto !== "auditoria_interna" && <DeptoPlaceholder depto={DEPTOS.find((d) => d.key === depto)} />}
      {depto === "mantenimiento" && (<>

      {/* barra superior */}
      <header style={sx.header} className="noprint">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15, letterSpacing: "-0.01em" }}>
              Mantenimiento
            </div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              {subtitulo}
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {rol === "mantenimiento" && area !== null && (
            <button onClick={salirArea} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>
              ‹ Áreas
            </button>
          )}
          {enModulo && NAV[rol].map(([k, label]) => {
            const badge = k === "reportes"
              ? (rol === "sucursal" ? reportes.filter((r) => r.ciclo === 3).length : m.abiertos.length)
              : 0;
            return (
              <button
                key={k}
                onClick={() => { setVista(k); setSucSel(null); }}
                className="navbtn"
                style={{
                  ...sx.navbtn,
                  background: vista === k ? T.ink : "transparent",
                  color: vista === k ? "#fff" : T.inkSoft,
                }}
              >
                {label}
                {badge > 0 && (
                  <span style={{ ...sx.badge, background: vista === k ? "#fff" : T.bad, color: vista === k ? T.ink : "#fff" }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* barra de rol — simula quién está usando la plataforma */}
      <div style={sx.rolebar} className="noprint">
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>Viendo como</span>
        {[["sucursal", "Auditor / Gerente"], ["mantenimiento", "Mantenimiento"]].map(([k, label]) => (
          <button
            key={k}
            className="roletab"
            onClick={() => cambiarRol(k)}
            style={{ ...sx.roletab, background: rol === k ? T.brand : "#fff", color: rol === k ? "#fff" : T.inkSoft, borderColor: rol === k ? T.brand : T.line }}
          >
            {label}
          </button>
        ))}
        <span style={{ fontSize: 11.5, color: T.muted, marginLeft: "auto" }}>
          {rol === "sucursal" ? "Solo reporta fallas y confirma correcciones — sin acceso al tablero" : "Panel con todas las áreas, tablero, reportes e informes"}
        </span>
      </div>

      <main style={sx.main}>
        {enHome && (
          <AreasHome resumen={resumenAreas} onEnter={entrarArea} />
        )}
        {enPlaceholder && (
          <AreaPlaceholder area={areaMeta} onBack={salirArea} />
        )}
        {enModulo && (
          <>
            {vista === "tablero" && !sucSel && (
              <Tablero m={m} porSucursal={porSucursal} onOpen={(s) => setSucSel(s)} areaNombre={areaMeta ? areaMeta.nombre : "Sucursales"} />
            )}
            {vista === "tablero" && sucSel && (
              <Detalle
                data={porSucursal.find((p) => p.s === sucSel)}
                reportes={areaReportes.filter((r) => r.sucursal === sucSel)}
                onBack={() => setSucSel(null)}
                acciones={acciones}
                rol={rol}
              />
            )}
            {vista === "reportes" && (
              <Reportes reportes={rol === "sucursal" ? reportes : areaReportes} acciones={acciones} rol={rol} />
            )}
            {vista === "informes" && (
              <Informes reportes={areaReportes} areaNombre={areaMeta ? areaMeta.nombre : "Sucursales"} />
            )}
            {vista === "reportar" && (
              <Formulario equipos={equipos} onSubmit={crearReporte} />
            )}
          </>
        )}
      </main>
      </>)}
      </div>
      </>)}

      {toast && <div style={sx.toast} className="toast">{toast}</div>}
    </div>
  );
}

/* ---------------- BARRA DE MODOS (Gestión / Tareas) ---------------- */
function NavRail({ modo, setModo }) {
  const items = [["gestion", "Gestión", "LayoutGrid"], ["tareas", "Tareas y Reportes", "ListChecks"], ["finanzas", "Finanzas", "TrendingUp"]];
  return (
    <div className="noprint" style={{ width: 66, flexShrink: 0, background: "#0d0d12", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 6, position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" }}>
      {items.map(([k, label, icon]) => (
        <button key={k} onClick={() => setModo(k)} className="deptobtn" style={{ width: 54, padding: "10px 0", borderRadius: 11, border: "none", cursor: "pointer", background: modo === k ? T.brand : "transparent", color: modo === k ? "#fff" : "rgba(255,255,255,.6)", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontFamily: "inherit" }}>
          <Ico name={icon} size={20} />
          <span style={{ fontSize: 9.5, fontWeight: 600 }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------------- MÓDULO DE TAREAS ---------------- */
const dOff = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const MESES_TXT = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaTexto = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); if (!y || !m || !d) return iso; return `${d} de ${MESES_TXT[m - 1]} de ${y}`; };
const COLABS = ["Alfredo Cavazos", "Cesar Cantu", "Pamela Segovia", "Osvaldo", "Jesus", "Abi", "Kathia", "Viridiana", "Ruben Reyes", "Elias"];
const TAREA_DEPTOS = ["Franquicias", "Capital Humano", "Mantenimiento", "Inventarios", "Marketing", "Atención al Cliente", "Auditoría", "Compras", "General"];
const PRIOS = [["Baja", T.ok], ["Media", T.warn], ["Alta", T.bad]];
const prioCol = (p) => (PRIOS.find(([n]) => n === p) || PRIOS[1])[1];
const TAREAS = [
  { id: 1, titulo: "Mejorar diseño de presentación a Franquicias", asignado: "Yo", depto: "Franquicias", fecha: dOff(3), prioridad: "Media", estado: "Pendiente", mia: true },
  { id: 2, titulo: "Compra consolidada: usar el peso de las sucursales para negociar insumos", asignado: "Yo", depto: "Inventarios", fecha: dOff(5), prioridad: "Alta", estado: "Pendiente", mia: true },
  { id: 3, titulo: "Concluir POE de incorporación de nuevo gerente", asignado: "Yo", depto: "Capital Humano", fecha: dOff(-1), prioridad: "Alta", estado: "En proceso", mia: true },
  { id: 4, titulo: "Preparar POE y comunicado para el nuevo portal de reportes a franquicias", asignado: "Yo", depto: "Franquicias", fecha: dOff(7), prioridad: "Media", estado: "Pendiente", mia: true },
  { id: 5, titulo: "Enviar información a proveedor de vasos para cotización", asignado: "Yo", depto: "Compras", fecha: dOff(1), prioridad: "Baja", estado: "Pendiente", mia: true },
  { id: 6, titulo: "Auditar los procesos de flujo de trabajo", asignado: "Supervisor Operaciones", depto: "Auditoría", fecha: dOff(-1), prioridad: "Media", estado: "Pendiente", mia: false },
  { id: 7, titulo: "Revisar la cadena de suministro", asignado: "Encargado Almacén", depto: "Inventarios", fecha: dOff(0), prioridad: "Media", estado: "En proceso", mia: false },
  { id: 8, titulo: "Revisar el desempeño del proveedor", asignado: "Gerente Franquicias", depto: "Mantenimiento", fecha: dOff(4), prioridad: "Baja", estado: "Pendiente", mia: false },
];

const MASCOTA_IMG = "./assets/mascota.png";
function MascotaCelebra() {
  const colores = ["#0F6E66", "#2E9E5B", "#C98A1E", "#A81D27", "#0A4F49", "#E4F0EE", "#F5C542", "#6BbF59"];
  const confetti = Array.from({ length: 130 }, (_, i) => ({
    left: Math.random() * 100,
    delay: 0.8 + Math.random() * 2.6,
    dur: 1.6 + Math.random() * 1.4,
    col: colores[i % colores.length],
    w: 6 + Math.random() * 6,
    h: 9 + Math.random() * 9,
    round: Math.random() > 0.6,
  }));
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, pointerEvents: "none", overflow: "hidden" }}>
      {/* fondo tenue */}
      <div className="celebra-bg" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%, rgba(255,255,255,.55), rgba(22,22,27,.28))" }} />
      {/* confeti */}
      {confetti.map((c, i) => (
        <div key={i} style={{ position: "absolute", top: 0, left: `${c.left}%`, width: c.w, height: c.h, background: c.col, borderRadius: c.round ? "50%" : 2, animation: `confettiFall ${c.dur}s linear ${c.delay}s forwards` }} />
      ))}
      {/* mascota grande al centro */}
      <div className="celebra-big" style={{ position: "absolute", top: "45%", left: "50%", textAlign: "center" }}>
        <div style={{ position: "relative", width: 260, height: 264 }}>
          <img className="masc-blow" src={MASCOTA_IMG} alt="Fy" style={{ width: 260, height: "auto", filter: "drop-shadow(0 16px 30px rgba(0,0,0,.28))" }} />
          {/* cornetita de fiesta que se desenrolla desde la boca */}
          <div style={{ position: "absolute", left: "56%", top: "43%", display: "flex", alignItems: "center", transform: "rotate(-8deg)", transformOrigin: "left center" }}>
            <div style={{ width: 0, height: 0, borderTop: "8px solid transparent", borderBottom: "8px solid transparent", borderLeft: "16px solid #C98A1E" }} />
            <div className="horn-paper" style={{ height: 9, background: "repeating-linear-gradient(90deg, #A81D27 0 7px, #F5C542 7px 14px)", borderRadius: "0 4px 4px 0" }} />
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "#0F6E66", boxShadow: "0 0 0 2px #fff" }} />
          </div>
          <div className="spark" style={{ position: "absolute", top: 10, left: 8, fontSize: 34 }}>✦</div>
          <div className="spark" style={{ position: "absolute", top: 40, right: 0, fontSize: 26, animationDelay: ".3s" }}>✦</div>
          <div className="spark" style={{ position: "absolute", bottom: 60, left: -10, fontSize: 24, animationDelay: ".6s" }}>✦</div>
        </div>
        <div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: T.brand, fontFamily: "'Bricolage Grotesque', sans-serif", textShadow: "0 2px 10px rgba(255,255,255,.8)" }}>¡Bien hecho!</div>
        <div style={{ fontSize: 14, color: T.inkSoft, fontWeight: 600 }}>Una tarea menos 🎉</div>
      </div>
    </div>
  );
}

function TareasSidebar({ vista, onPick, conRetraso, totalRepPend }) {
  const items = [["mias", "Mis tareas", "ListChecks", conRetraso], ["asignadas", "Tareas que asigné", "Send", 0], ["reportes", "Reportes por departamento", "FileText", totalRepPend]];
  return (
    <aside className="noprint" style={sx.sidebar}>
      <div style={{ padding: "2px 8px 18px" }}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 40, width: "auto" }} />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>Tareas y Reportes</div>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {items.map(([k, label, ic, n]) => {
          const active = vista === k;
          return (
            <button key={k} onClick={() => onPick(k)} className="deptobtn" style={{ ...sx.deptoItem, background: active ? T.brand : "transparent", color: active ? "#fff" : "rgba(255,255,255,.62)", fontWeight: active ? 700 : 500 }}>
              <span style={{ width: 22, display: "flex", justifyContent: "center" }}><Ico name={ic} size={17} /></span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>{label}</span>
              {n > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: active ? "#fff" : T.warn, background: active ? "rgba(255,255,255,.2)" : T.warnSoft, padding: "1px 7px", borderRadius: 99 }}>{n}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 10, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>Prototipo<br />Frutal Yogurt</div>
    </aside>
  );
}

function Tareas() {
  const [tareas, setTareas] = useState(TAREAS);
  const [vista, setVista] = useState("mias");
  const [repDepto, setRepDepto] = useState(null);
  const [filtro, setFiltro] = useState("Próximas");
  const [nueva, setNueva] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const blank = { titulo: "", descripcion: "", entregable: "", asignado: "Alfredo Cavazos", depto: "General", fecha: dOff(3), prioridad: "Media", adjunto: null };
  const [nt, setNt] = useState(blank);
  const [celebra, setCelebra] = useState(false);
  const hoy = new Date().toISOString().slice(0, 10);
  const ntOk = nt.titulo.trim() && nt.descripcion.trim() && nt.fecha;

  const crear = () => {
    if (!ntOk) return;
    setTareas((p) => [{ id: Date.now(), titulo: nt.titulo.trim(), descripcion: nt.descripcion.trim(), entregable: nt.entregable.trim(), asignado: nt.asignado, depto: nt.depto, fecha: nt.fecha, prioridad: nt.prioridad, adjunto: nt.adjunto, estado: "Pendiente", mia: nt.asignado === "Yo" }, ...p]);
    setNt(blank); setNueva(false);
  };
  const ciclar = (id) => setTareas((p) => p.map((t) => {
    if (t.id !== id) return t;
    const next = t.estado === "Hecha" ? "Pendiente" : "Hecha";
    if (next === "Hecha") { setFiltro("Finalizadas"); setCelebra(true); setTimeout(() => setCelebra(false), 4200); }
    return { ...t, estado: next };
  }));

  const esMias = vista === "mias";
  const base = tareas.filter((t) => (esMias ? t.mia : !t.mia));
  const lista = esMias
    ? base.filter((t) => filtro === "Finalizadas" ? t.estado === "Hecha" : filtro === "Con retraso" ? (t.estado !== "Hecha" && t.fecha < hoy) : (t.estado !== "Hecha" && t.fecha >= hoy))
    : base;
  const conRetraso = tareas.filter((t) => t.mia && t.estado !== "Hecha" && t.fecha < hoy).length;

  const REP_GRUPOS = [
    { key: "franquicias", nombre: "Franquicias", config: FRANQ_REPORTES },
    { key: "operaciones", nombre: "Sucursales Propias", config: OP_REPORTES },
    { key: "auditorias", nombre: "Auditorías Remotas", config: AUDR_REPORTES },
    { key: "capital", nombre: "Capital Humano", config: CH_REPORTES },
    { key: "mantenimiento", nombre: "Mantenimiento", config: MTTO_REPORTES },
  ];
  const repPend = (cfg) => cfg.entregas.filter((e) => e.estado !== "Entregado").length;
  const totalRepPend = REP_GRUPOS.reduce((a, g) => a + repPend(g.config), 0);
  const grupoSel = REP_GRUPOS.find((g) => g.key === repDepto);

  return (
    <>
      <TareasSidebar vista={vista} onPick={(k) => { setVista(k); setRepDepto(null); }} conRetraso={conRetraso} totalRepPend={totalRepPend} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={sx.header} className="noprint">
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Tareas y Reportes</div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{vista === "reportes" ? "Reportes por departamento" : vista === "asignadas" ? "Tareas que asigné" : "Mis tareas"}</div>
          </div>
          {vista !== "reportes" && (
            <button className="actbtn" onClick={() => setNueva(!nueva)} style={{ ...sx.actbtn, fontSize: 13, padding: "9px 18px", background: nueva ? T.ink : T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: nueva ? "none" : "0 2px 8px rgba(15,110,102,.35)" }}>
              <Ico name={nueva ? "X" : "Plus"} size={16} color="#fff" />{nueva ? "Cancelar" : "Nueva tarea"}
            </button>
          )}
        </header>
        <main style={sx.main}>
          {vista !== "reportes" && (
            <>
              {nueva && (
                <div style={{ ...sx.repCard, marginBottom: 14, display: "grid", gap: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva tarea</div>
                  <TField label="¿Qué hay que hacer?" hint="Un título corto y accionable">
                    <input placeholder="Ej. Cotizar vasos de 16 oz con el proveedor" value={nt.titulo} onChange={(e) => setNt({ ...nt, titulo: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12.5 }} />
                  </TField>
                  <TField label="Instrucciones / detalle" hint="El contexto y el cómo, para que el colaborador no tenga dudas">
                    <textarea placeholder="Explica qué necesitas, con quién, y cualquier dato necesario…" value={nt.descripcion} onChange={(e) => setNt({ ...nt, descripcion: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12.5, minHeight: 60, resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
                  </TField>
                  <TField label="¿Cuándo se considera terminada?" hint="El entregable o resultado esperado (opcional)">
                    <input placeholder="Ej. 3 cotizaciones enviadas por correo a Dirección" value={nt.entregable} onChange={(e) => setNt({ ...nt, entregable: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12.5 }} />
                  </TField>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                    <TField label="Asignar a"><select className="sel" value={nt.asignado} onChange={(e) => setNt({ ...nt, asignado: e.target.value })} style={{ ...sx.sel, fontSize: 12 }}>{COLABS.map((x) => <option key={x}>{x}</option>)}</select></TField>
                    <TField label="Departamento / área"><select className="sel" value={nt.depto} onChange={(e) => setNt({ ...nt, depto: e.target.value })} style={{ ...sx.sel, fontSize: 12 }}>{TAREA_DEPTOS.map((x) => <option key={x}>{x}</option>)}</select></TField>
                    <TField label="Fecha límite"><input type="date" value={nt.fecha} onChange={(e) => setNt({ ...nt, fecha: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12 }} /></TField>
                    <TField label="Prioridad"><select className="sel" value={nt.prioridad} onChange={(e) => setNt({ ...nt, prioridad: e.target.value })} style={{ ...sx.sel, fontSize: 12 }}>{PRIOS.map(([n]) => <option key={n}>{n}</option>)}</select></TField>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <UploadBtn archivo={nt.adjunto} onPick={(n) => setNt({ ...nt, adjunto: n })} label="Adjuntar referencia (opcional)" />
                    <button className="actbtn" disabled={!ntOk} onClick={crear} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: ntOk ? T.ink : T.line, color: ntOk ? "#fff" : T.muted, cursor: ntOk ? "pointer" : "not-allowed" }}>Asignar tarea</button>
                  </div>
                  {!ntOk && <div style={{ fontSize: 10.5, color: T.muted }}>El título, las instrucciones y la fecha límite son obligatorios.</div>}
                </div>
              )}

              {esMias && (
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {["Próximas", "Con retraso", "Finalizadas"].map((f) => (
                    <button key={f} className="roletab" onClick={() => setFiltro(f)} style={{ ...sx.roletab, fontSize: 12, background: filtro === f ? T.brandSoft : "#fff", color: filtro === f ? T.brand : T.muted, borderColor: filtro === f ? T.brand : T.line }}>{f}</button>
                  ))}
                </div>
              )}

              <div style={{ display: "grid", gap: 8 }}>
                {lista.length === 0 && <div style={sx.empty}>Sin tareas en esta vista.</div>}
                {lista.map((t) => {
                  const retraso = t.estado !== "Hecha" && t.fecha < hoy;
                  const estCol = t.estado === "Hecha" ? T.ok : t.estado === "En proceso" ? T.warn : T.muted;
                  const open = abierta === t.id;
                  return (
                    <div key={t.id} style={{ ...sx.repCard }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button onClick={() => ciclar(t.id)} title={t.estado === "Hecha" ? "Hecha · clic para reabrir" : "Marcar como hecha"} style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, border: `2px solid ${t.estado === "Hecha" ? T.ok : T.line}`, background: t.estado === "Hecha" ? T.ok : "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                          <Ico name="Check" size={12} color={t.estado === "Hecha" ? "#fff" : T.muted} />
                        </button>
                        <button onClick={() => setAbierta(open ? null : t.id)} className="rowbtn" style={{ flex: 1, minWidth: 180, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: t.estado === "Hecha" ? T.muted : T.ink, textDecoration: t.estado === "Hecha" ? "line-through" : "none" }}>{t.titulo}</div>
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{esMias ? t.depto : `${t.asignado} · ${t.depto}`}{t.descripcion ? " · ver detalle" : ""}</div>
                        </button>
                        <span style={{ fontSize: 11, color: retraso ? T.bad : T.muted, fontWeight: retraso ? 700 : 500 }}>{t.fecha === hoy ? "Hoy" : t.fecha}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: prioCol(t.prioridad), border: `1px solid ${prioCol(t.prioridad)}`, padding: "2px 8px", borderRadius: 99 }}>{t.prioridad}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 600, color: estCol }}>{t.estado}</span>
                      </div>
                      {open && (t.descripcion || t.entregable || t.adjunto) && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: "grid", gap: 6 }}>
                          {t.descripcion && <div style={{ fontSize: 12, color: T.inkSoft }}><strong style={{ color: T.ink }}>Instrucciones:</strong> {t.descripcion}</div>}
                          {t.entregable && <div style={{ fontSize: 12, color: T.inkSoft }}><strong style={{ color: T.ink }}>Se considera terminada cuando:</strong> {t.entregable}</div>}
                          {t.adjunto && <div style={{ fontSize: 11.5, color: T.ok, fontWeight: 600 }}>Referencia adjunta: {t.adjunto}</div>}
                          <div style={{ fontSize: 11, color: T.muted }}>Asignada a {t.asignado}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 16, fontStyle: "italic" }}>Toca el círculo para avanzar el estado de la tarea (Pendiente → En proceso → Hecha).</div>
            </>
          )}

          {vista === "reportes" && (
            grupoSel ? (
              <div>
                <button onClick={() => setRepDepto(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Todos los departamentos</button>
                <ReportesSeccion config={grupoSel.config} titulo={`Reportes · ${grupoSel.nombre}`} />
              </div>
            ) : (
              <div>
                <div style={sx.sectionTitle}>Entrega de reportes por departamento</div>
                <p style={{ fontSize: 12.5, color: T.muted, marginTop: -8, marginBottom: 16 }}>Cada departamento entrega sus reportes con periodicidad y fecha límite. Entra a uno para ver su calendario, cargar el archivo y ver el semáforo Entregado / Pendiente / Vencido.</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {REP_GRUPOS.map((g) => {
                    const pend = repPend(g.config);
                    return (
                      <button key={g.key} className="rowbtn" onClick={() => setRepDepto(g.key)} style={{ ...sx.areaCard, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{g.nombre}</div>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: pend ? T.warn : T.ok, background: pend ? T.warnSoft : T.okSoft, padding: "3px 9px", borderRadius: 99 }}>{pend ? `${pend} por entregar` : "Al día"}</span>
                        </div>
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 12, color: T.muted }}>{g.config.entregas.length} reportes · {g.config.automaticos.length} automáticos</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </main>
      </div>
      {celebra && <MascotaCelebra />}
    </>
  );
}

function TField({ label, hint, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft }}>{label}</div>
      {hint && <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 4 }}>{hint}</div>}
      {children}
    </label>
  );
}

/* ---------------- APARTADO DE FINANZAS (indicadores) ---------------- */
const nominaSemanal = (lista) => (lista || []).reduce((s, e) => s + Number(e.sueldo || 0), 0);
const FIN_SECCIONES = [
  { key: "tablero", nombre: "Tablero", iconName: "LayoutDashboard", home: true },
  { key: "ventas", nombre: "Ventas", iconName: "TrendingUp" },
  { key: "transacciones", nombre: "Transacciones y Ticket", iconName: "Receipt" },
  { key: "mix", nombre: "Mix de productos", iconName: "PieChart" },
  { key: "costo", nombre: "Costo de producto", iconName: "Package" },
  { key: "nomina", nombre: "Nómina", iconName: "Wallet" },
  { key: "rentabilidad", nombre: "Rentabilidad", iconName: "PiggyBank" },
  { key: "er", nombre: "Estado de Resultados", iconName: "FileText" },
  { key: "cartera", nombre: "Cartera vencida", iconName: "AlertCircle" },
];
const finColC = (p) => (p <= 39 ? T.ok : p <= 43 ? T.warn : T.bad);
const finColN = (p) => (p <= 22 ? T.ok : p <= 28 ? T.warn : T.bad);
function finFilas(cuadro, inv) {
  return SUCURSALES.map((suc) => {
    const venta = VENTAS_MES[suc] || 0;
    const iv = inv[suc] || { inicial: 0, compras: 0, final: 0 };
    const consumo = iv.inicial + iv.compras - iv.final;
    const pctC = venta ? (consumo / venta) * 100 : 0;
    const nomMes = nominaSemanal(cuadro[suc]) * 4.33;
    const pctN = venta ? (nomMes / venta) * 100 : 0;
    const margen = venta - consumo - nomMes;
    const pctM = venta ? (margen / venta) * 100 : 0;
    return { suc, venta, consumo, pctC, nomMes, pctN, margen, pctM };
  });
}

function FinSidebar({ fsec, onPick, seg, setSeg }) {
  const segs = [["Todas", "Globe"], ["Propias", "Store"], ["Franquicias", "Building2"]];
  return (
    <aside className="noprint" style={sx.sidebar}>
      <div style={{ padding: "2px 8px 18px" }}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 40, width: "auto" }} />
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>Finanzas · Indicadores</div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "0 6px 8px" }}>Segmento activo</div>
        <div style={{ display: "grid", gap: 3 }}>
          {segs.map(([k, ic]) => {
            const active = seg === k;
            return (
              <button key={k} onClick={() => setSeg(k)} className="deptobtn" style={{ ...sx.deptoItem, background: active ? "rgba(255,255,255,.12)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,.62)", fontWeight: active ? 700 : 500 }}>
                <span style={{ width: 22, display: "flex", justifyContent: "center", color: active ? T.brand : "inherit" }}><Ico name={ic} size={16} /></span>
                <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>{k}</span>
                {active && <span style={{ width: 7, height: 7, borderRadius: 99, background: T.brand }} />}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,.4)", padding: "0 6px 8px" }}>Reportes</div>
      <div style={{ display: "grid", gap: 3 }}>
        {FIN_SECCIONES.map((d) => {
          const active = fsec === d.key;
          const bg = active ? T.brand : d.home ? "rgba(255,255,255,.07)" : "transparent";
          const col = active ? "#fff" : d.home ? "#fff" : "rgba(255,255,255,.62)";
          return (
            <button key={d.key} onClick={() => onPick(d.key)} className="deptobtn" style={{ ...sx.deptoItem, background: bg, color: col, fontWeight: active || d.home ? 700 : 500 }}>
              <span style={{ width: 22, display: "flex", justifyContent: "center" }}><Ico name={d.iconName} size={17} /></span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>{d.nombre}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 10, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>Prototipo<br />Frutal Yogurt</div>
    </aside>
  );
}

function FinTabla({ cols, filas }) {
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 60 + cols.length * 110 }}>
        <thead>
          <tr style={{ background: T.paper }}>
            {cols.map((c, i) => <th key={c.h} style={{ padding: "10px 14px", fontWeight: 700, color: T.inkSoft, textAlign: i === 0 ? "left" : "right", borderBottom: `1px solid ${T.line}` }}>{c.h}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre || f.suc}>
              {cols.map((c, i) => <td key={c.h} style={{ padding: "9px 14px", textAlign: i === 0 ? "left" : "right", fontWeight: c.strong ? 700 : i === 0 ? 600 : 400, color: c.color ? c.color(f) : i === 0 ? T.ink : T.inkSoft, borderBottom: `1px solid ${T.lineSoft}` }}>{c.render(f)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function finUnidades(cuadro, inv) {
  const propias = SUCURSALES.map((suc, i) => {
    const venta = VENTAS_MES[suc] || 0;
    const iv = inv[suc] || { inicial: 0, compras: 0, final: 0 };
    const consumo = iv.inicial + iv.compras - iv.final;
    const nomMes = nominaSemanal(cuadro[suc]) * 4.33;
    return { nombre: suc, tipo: "Propia", venta, consumo, nomMes, cartera: 0, renta: 15000 + i * 900 };
  });
  const franq = FRANQUICIAS.map((f, i) => ({ nombre: f.suc, tipo: "Franquicia", venta: 175000 + ((i * 8300) % 190000), consumo: 0, nomMes: 0, cartera: fqMontoVencido(f), renta: 12000 + ((i * 700) % 9000) }));
  return { propias, franq };
}
/* Cascada del Estado de Resultados (formato del Excel de Frutal Yogurt) */
function erCalc(units) {
  const t = { ingreso: 0, costo: 0, mo: 0, servicios: 0, renta: 0, mtto: 0, comision: 0, regalias: 0 };
  units.forEach((u) => {
    const costo = u.tipo === "Propia" ? u.consumo : Math.round(u.venta * 0.40);
    const mo = u.tipo === "Propia" ? u.nomMes : Math.round(u.venta * 0.16);
    t.ingreso += u.venta;
    t.costo += costo;
    t.mo += mo;
    t.servicios += Math.round(u.venta * 0.05);
    t.renta += u.renta;
    t.mtto += Math.round(u.venta * 0.02);
    t.comision += Math.round(u.venta * 0.012);
    t.regalias += u.tipo === "Franquicia" ? Math.round(u.venta * 0.075) : 0;
  });
  t.utilBruta = t.ingreso - t.costo;
  t.util = t.ingreso - t.costo - t.mo - t.servicios - t.renta - t.mtto - t.comision - t.regalias;
  return t;
}
/* ===== Ventas: series por frecuencia usando datos reales del ER (2025) ===== */
const MESES_LBL = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const VENTAS_2025_SHEETS = {
  "Las Puentes": [108353, 187907, 288050, 280889, 241966, 256310, 265187, 236980, 211057, 210305, 158945, 139556],
  "Escobedo": [72355, 146527, 200899, 198166, 182783, 183862, 177982, 175016, 145533, 146593, 107366, 87479],
  "Walmart": [138572, 216014, 317137, 324293, 347847, 343338, 334180, 339278, 296741, 296925, 268853, 285396],
  "Cadereyta": [164939, 209644, 272598, 306662, 282288, 281346, 243231, 272985, 207559, 185881, 172424, 233004],
  "Apodaca 3": [135246, 172542, 230759, 224070, 252454, 250676, 258811, 281796, 218893, 212798, 217693, 280046],
  "Apodaca 2": [125341, 157739, 233552, 235399, 275868, 269717, 243393, 281273, 209895, 186489, 214694, 280485],
  "Mitras": [20581, 49229, 70157, 56528, 55075, 58029, 56940, 56613, 48635, 52906, 34765, 26564],
  "Berneses": [20366, 48761, 64768, 63155, 54586, 68931, 65843, 61929, 50322, 53179, 41658, 22658],
  "Terreno": [73374, 136222, 204575, 181649, 162312, 172411, 165337, 162297, 143197, 133385, 109599, 82196],
  "Vellania": [21037, 35687, 48674, 48364, 38662, 30912, 38210, 30038, 24047, 10570, 0, 0],
};
const MESES_2025 = MESES_LBL.map((_, mi) => Object.values(VENTAS_2025_SHEETS).reduce((s, arr) => s + arr[mi], 0));
const ANUAL_2025 = MESES_2025.reduce((a, b) => a + b, 0);
const HORA_CURVA = [0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 6, 8, 9, 8, 7, 7, 8, 10, 11, 9, 6, 4, 2, 1];
const kfmt = (v) => (v >= 1000 ? Math.round(v / 1000) + "k" : String(Math.round(v)));

function ventasSerie(freq, anio, mes, dia, scale) {
  const sc = scale || 1;
  const yf = (anio === 2025 ? 1 : anio === 2024 ? 0.88 : 0.76) * sc;
  if (freq === "Año") return { labels: ["2023", "2024", "2025"], vals: [ANUAL_2025 * 0.76, ANUAL_2025 * 0.88, ANUAL_2025].map((v) => Math.round(v * sc)), topLabels: true };
  if (freq === "Mes") return { labels: MESES_LBL, vals: MESES_2025.map((v) => Math.round(v * yf)), topLabels: true };
  if (freq === "Semana") {
    const base = MESES_2025[mes] * yf; const w = [0.22, 0.26, 0.28, 0.24];
    return { labels: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"], vals: w.map((x) => Math.round(base * x)), topLabels: true };
  }
  if (freq === "Día") {
    const dim = DIAS_MES[mes]; const base = (MESES_2025[mes] * yf) / dim;
    const vals = Array.from({ length: dim }, (_, d) => Math.round(base * (0.78 + 0.35 * (((d * 5) % dim) / dim) + (d % 7 >= 5 ? 0.3 : 0))));
    return { labels: Array.from({ length: dim }, (_, d) => String(d + 1)), vals, topLabels: false };
  }
  const dim = DIAS_MES[mes]; const dayBase = (MESES_2025[mes] * yf) / dim; const ws = HORA_CURVA.reduce((a, b) => a + b, 0);
  const jitter = 0.85 + ((dia * 7) % 10) / 30;
  const vals = HORA_CURVA.map((wt) => Math.round((dayBase * jitter * wt) / ws));
  return { labels: HORA_CURVA.map((_, h) => h + "h"), vals, topLabels: false };
}
const vhash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
const metaBase = (u) => Math.round(u.venta * (0.90 + (vhash(u.nombre) % 9) * 0.03));
const prevBase = (u) => Math.round(u.venta / (1 + (((vhash(u.nombre) % 31) - 13) / 100)));
const metaCol = (p) => (p >= 100 ? T.ok : p >= 92 ? T.warn : T.bad);

function VentasChart({ freq, anio, mes, dia, scale }) {
  const s = ventasSerie(freq, anio, mes, dia, scale);
  const max = Math.max(...s.vals, 1);
  return (
    <div style={{ marginTop: 16, border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "20px 16px 12px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: s.vals.length > 20 ? 2 : 6, height: 210 }}>
        {s.vals.map((v, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
            {s.topLabels && <div style={{ fontSize: 9, color: T.muted, fontWeight: 600 }}>{kfmt(v)}</div>}
            <div title={money(v)} style={{ width: "100%", maxWidth: 40, height: `${(v / max) * 100}%`, minHeight: 2, background: T.brand, borderRadius: "4px 4px 0 0" }} />
            <div style={{ fontSize: s.vals.length > 20 ? 7.5 : 9.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden" }}>{s.labels[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PeriodoSel({ freq, setFreq, anio, setAnio, mes, setMes, dia, setDia }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
      <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: 3, gap: 2 }}>
        {["Hora", "Día", "Semana", "Mes", "Año"].map((f) => (
          <button key={f} onClick={() => setFreq(f)} style={{ padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: freq === f ? T.brand : "transparent", color: freq === f ? "#fff" : T.muted }}>{f}</button>
        ))}
      </div>
      {freq !== "Año" && <select className="sel" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{[2025, 2024, 2023].map((y) => <option key={y} value={y}>{y}</option>)}</select>}
      {(freq === "Semana" || freq === "Día" || freq === "Hora") && <select className="sel" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{MESES_LBL.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>}
      {freq === "Hora" && <select className="sel" value={dia} onChange={(e) => setDia(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{Array.from({ length: DIAS_MES[mes] }, (_, d) => d + 1).map((d) => <option key={d} value={d}>Día {d}</option>)}</select>}
    </div>
  );
}

function Flecha({ g }) {
  const up = g >= 0;
  return <span style={{ fontSize: 11.5, fontWeight: 700, color: up ? T.ok : T.bad, whiteSpace: "nowrap" }}>{up ? "▲" : "▼"} {Math.abs(g).toFixed(1)}%</span>;
}

const ticketDe = (u) => 88 + (vhash(u.nombre) % 30);
const transDe = (u) => { const t = ticketDe(u); return t ? Math.round(u.venta / t) : 0; };
const SEAS = [0.85, 0.9, 1.0, 1.06, 1.12, 1.18, 1.2, 1.14, 1.0, 0.94, 0.9, 1.08];
const txMonth = (base, y, m) => Math.round(base * SEAS[m] * Math.pow(0.9, 2026 - y) * (0.9 + (vhash("x" + y + m) % 20) / 100));
const tkMonth = (base, y, m) => Math.round(base * Math.pow(0.97, 2026 - y) * (0.96 + (vhash("k" + y + m) % 9) / 100));
const barCol = (i, sel) => (i === sel ? T.brand : T.brandSoft);
const mixMesArr = (baseKey, y, m) => { const raw = MIX_CATS.map(([c], i) => 8 + (vhash(baseKey + c + ((y * 12 + m) % 60)) % 22) + (i === 0 ? 16 : 0) + Math.round((SEAS[m] - 1) * (i === 5 || i === 1 ? 30 : 0))); const s = raw.reduce((a, b) => a + b, 0); return raw.map((r) => (r / s) * 100); };
const vsProm5 = (fn, base, m) => { const cur = fn(base, 2026, m); const avg = [2022, 2023, 2024, 2025, 2026].reduce((a, y) => a + fn(base, y, m), 0) / 5; return avg ? ((cur - avg) / avg) * 100 : 0; };

function HistoricoTT({ baseTrans, baseTicket }) {
  const [metric, setMetric] = useState("trans");
  const [vista, setVista] = useState("12m");
  const [anioSel, setAnioSel] = useState(2026);
  const esMoneda = metric === "ticket";
  const mFn = (y, m) => (metric === "trans" ? txMonth(baseTrans, y, m) : tkMonth(baseTicket, y, m));
  const anualFn = (y) => (metric === "trans" ? MESES_LBL.reduce((a, _, m) => a + mFn(y, m), 0) : Math.round(MESES_LBL.reduce((a, _, m) => a + mFn(y, m), 0) / 12));
  const anios5 = [anioSel - 4, anioSel - 3, anioSel - 2, anioSel - 1, anioSel];
  const promMes = (m) => Math.round(anios5.reduce((a, y) => a + mFn(y, m), 0) / anios5.length);
  const fmt = (v) => (esMoneda ? money(v) : v.toLocaleString("es-MX"));
  const fmtK = (v) => (esMoneda ? money(v) : v >= 1000 ? Math.round(v / 1000) + "k" : String(v));

  let bars = [];
  if (vista === "12m") bars = MESES_LBL.map((l, m) => ({ label: l, v: mFn(anioSel, m) }));
  else if (vista === "anual") bars = [2022, 2023, 2024, 2025, 2026].map((y) => ({ label: String(y), v: anualFn(y) }));
  const max = Math.max(...(vista === "comp" ? MESES_LBL.map((_, m) => Math.max(mFn(anioSel, m), promMes(m))) : bars.map((b) => b.v)), 1);

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={sx.sectionTitle}>Histórico</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2 }}>
            {[["trans", "Transacciones"], ["ticket", "Ticket"]].map(([k, l]) => <button key={k} onClick={() => setMetric(k)} style={{ padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, background: metric === k ? T.ink : "transparent", color: metric === k ? "#fff" : T.muted }}>{l}</button>)}
          </div>
          <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2 }}>
            {[["12m", "12 meses"], ["anual", "Por año"], ["comp", "vs 5 años"]].map(([k, l]) => <button key={k} onClick={() => setVista(k)} style={{ padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, background: vista === k ? T.brand : "transparent", color: vista === k ? "#fff" : T.muted }}>{l}</button>)}
          </div>
          {vista !== "anual" && <select className="sel" value={anioSel} onChange={(e) => setAnioSel(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{[2026, 2025, 2024].map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        </div>
      </div>

      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "20px 16px 12px" }}>
        {vista === "comp" ? (
          <>
            <div style={{ display: "flex", gap: 14, marginBottom: 12, fontSize: 11, color: T.muted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.brand }} />{anioSel}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: T.muted }} />Prom. 5 años</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 200 }}>
              {MESES_LBL.map((l, m) => { const cur = mFn(anioSel, m), pr = promMes(m); return (
                <div key={l} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", gap: 1, alignItems: "flex-end", width: "100%", height: "100%", justifyContent: "center" }}>
                    <div title={fmt(cur)} style={{ width: "42%", height: `${(cur / max) * 100}%`, background: T.brand, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                    <div title={fmt(pr)} style={{ width: "42%", height: `${(pr / max) * 100}%`, background: T.muted, borderRadius: "3px 3px 0 0", minHeight: 2 }} />
                  </div>
                  <div style={{ fontSize: 8.5, color: T.muted }}>{l}</div>
                </div>
              ); })}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: bars.length > 6 ? 4 : 12, height: 200 }}>
            {bars.map((b, i) => (
              <div key={b.label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 9.5, color: T.muted, fontWeight: 600 }}>{fmtK(b.v)}</div>
                <div title={fmt(b.v)} style={{ width: "100%", maxWidth: 46, height: `${(b.v / max) * 100}%`, background: vista === "anual" && b.label === "2026" ? T.brand : vista === "anual" ? T.brandDark : T.brand, borderRadius: "4px 4px 0 0", minHeight: 2 }} />
                <div style={{ fontSize: 9.5, color: T.muted }}>{b.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 8, fontStyle: "italic" }}>Histórico simulado (viene de la analítica al conectar). "vs 5 años" compara cada mes contra el promedio de ese mes en los últimos 5 años.</div>
    </div>
  );
}
function mixDe(nombreKey) {
  const raw = MIX_CATS.map(([c], i) => 8 + (vhash(nombreKey + c) % 22) + (i === 0 ? 16 : 0));
  const s = raw.reduce((a, b) => a + b, 0);
  return MIX_CATS.map(([c, col], i) => ({ cat: c, col, pct: (raw[i] / s) * 100 }));
}

function FinTransacciones({ units, seg }) {
  const rows = units.map((u) => ({ nombre: u.nombre, tipo: u.tipo, venta: u.venta, ticket: ticketDe(u), trans: transDe(u) }));
  const totTrans = rows.reduce((a, r) => a + r.trans, 0);
  const totVenta = rows.reduce((a, r) => a + r.venta, 0);
  const ticketProm = totTrans ? Math.round(totVenta / totTrans) : 0;
  const [orden, setOrden] = useState("ticket");
  const lista = [...rows].sort((a, b) => (orden === "ticket" ? b.ticket - a.ticket : orden === "trans" ? b.trans - a.trans : b.venta - a.venta));
  const maxTicket = Math.max(...rows.map((r) => r.ticket), 1);
  const maxTrans = Math.max(...rows.map((r) => r.trans), 1);
  const cm = 6;
  const trD = vsProm5(txMonth, totTrans, cm);
  const tkD = vsProm5(tkMonth, ticketProm, cm);
  const vtD = vsProm5(txMonth, totVenta, cm);
  const dTxt = (d) => `${d >= 0 ? "+" : ""}${d.toFixed(1)}% vs prom. 5 años`;
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Transacciones y Ticket</h1><span style={{ fontSize: 12, color: T.muted }}>{seg} · mes en curso</span></div>
      <div style={sx.cards4}>
        <Metric big={totTrans.toLocaleString("es-MX")} label="Transacciones" sub={dTxt(trD)} accent={trD >= 0 ? T.ok : T.bad} />
        <Metric big={money(ticketProm)} label="Ticket promedio" sub={dTxt(tkD)} accent={tkD >= 0 ? T.ok : T.bad} />
        <Metric big={money(totVenta)} label="Ventas totales" sub={dTxt(vtD)} accent={vtD >= 0 ? T.ok : T.bad} />
        <Metric big={String(rows.length)} label="Sucursales" sub={seg} accent={T.inkSoft} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 18, marginBottom: 10, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>Ordenar
          <select className="sel" value={orden} onChange={(e) => setOrden(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
            <option value="ticket">Mayor ticket</option>
            <option value="trans">Más transacciones</option>
            <option value="venta">Mayor venta</option>
          </select>
        </label>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {lista.map((r, i) => (
          <div key={r.nombre} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", flexWrap: "wrap" }}>
            <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: T.muted }}>{i + 1}</span>
            <div style={{ width: 150, minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{r.nombre}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{r.tipo}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>Ticket {money(r.ticket)}</div>
              <div style={{ background: T.lineSoft, borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: `${(r.ticket / maxTicket) * 100}%`, height: "100%", background: T.brand, borderRadius: 99 }} /></div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>{r.trans.toLocaleString("es-MX")} transacciones</div>
              <div style={{ background: T.lineSoft, borderRadius: 99, height: 8, overflow: "hidden" }}><div style={{ width: `${(r.trans / maxTrans) * 100}%`, height: "100%", background: T.brandDark, borderRadius: 99 }} /></div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>Ticket y transacciones vienen de la analítica / punto de venta (de ejemplo en la maqueta).</div>
      <HistoricoTT baseTrans={totTrans} baseTicket={ticketProm} />
    </div>
  );
}

function FinMix({ units, seg }) {
  const [sel, setSel] = useState("__cons__");
  const totVenta = units.reduce((a, u) => a + u.venta, 0);
  let mix, ventaBase, titulo;
  if (sel === "__cons__") {
    const acc = MIX_CATS.map(() => 0);
    units.forEach((u) => { mixDe(u.nombre).forEach((m, i) => { acc[i] += (u.venta * m.pct) / 100; }); });
    const tot = acc.reduce((a, b) => a + b, 0) || 1;
    mix = MIX_CATS.map(([c, col], i) => ({ cat: c, col, pct: (acc[i] / tot) * 100, monto: acc[i] }));
    ventaBase = totVenta; titulo = `Consolidado (${seg})`;
  } else {
    const u = units.find((x) => x.nombre === sel);
    ventaBase = u ? u.venta : 0;
    mix = mixDe(sel).map((m) => ({ ...m, monto: (ventaBase * m.pct) / 100 }));
    titulo = sel;
  }
  const top = [...mix].sort((a, b) => b.pct - a.pct)[0];
  const topIdx = MIX_CATS.findIndex(([c]) => c === top.cat);
  const baseKey = sel === "__cons__" ? "red" : sel;
  const vtD = vsProm5(txMonth, ventaBase, 6);
  const topAvg = MESES_LBL.reduce((a, _, m) => a + mixMesArr(baseKey, 2026, m)[topIdx], 0) / 12;
  const topD = top.pct - topAvg;
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Mix de productos</h1><span style={{ fontSize: 12, color: T.muted }}>{seg} · qué se vende</span></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Ver
          <select className="sel" value={sel} onChange={(e) => setSel(e.target.value)} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
            <option value="__cons__">Consolidado ({seg})</option>
            {units.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}
          </select>
        </label>
      </div>
      <div style={sx.cards4}>
        <Metric big={money(Math.round(ventaBase))} label="Ventas del periodo" sub={`${vtD >= 0 ? "+" : ""}${vtD.toFixed(1)}% vs prom. 5 años`} accent={vtD >= 0 ? T.ok : T.bad} />
        <Metric big={top.cat} label="Categoría líder" sub={`${top.pct.toFixed(1)}% · ${topD >= 0 ? "+" : ""}${topD.toFixed(1)} pts vs histórico`} accent={T.ink} />
        <Metric big={String(MIX_CATS.length)} label="Categorías" sub="del catálogo" accent={T.inkSoft} />
      </div>
      <div style={{ marginTop: 24 }}>
        <div style={sx.sectionTitle}>Distribución por categoría · {titulo}</div>
        <div style={{ display: "grid", gap: 8 }}>
          {mix.slice().sort((a, b) => b.pct - a.pct).map((m) => (
            <div key={m.cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 180, minWidth: 180, fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: m.col, flexShrink: 0 }} />{m.cat}
              </div>
              <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 12, overflow: "hidden", minWidth: 60 }}>
                <div style={{ width: `${m.pct}%`, height: "100%", background: m.col, borderRadius: 99 }} />
              </div>
              <div style={{ width: 100, textAlign: "right", fontSize: 11.5, color: T.muted }}>{money(Math.round(m.monto))}</div>
              <div style={{ width: 48, textAlign: "right", fontWeight: 700, fontSize: 12.5 }}>{m.pct.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>El mix viene de la analítica / punto de venta (de ejemplo en la maqueta).</div>
      <HistoricoMix baseKey={sel === "__cons__" ? "red" : sel} />
    </div>
  );
}

function HistoricoMix({ baseKey }) {
  const [vista, setVista] = useState("12m");
  const mixMes = (y, m) => mixMesArr(baseKey, y, m);
  const mixAnio = (y) => { const acc = MIX_CATS.map(() => 0); MESES_LBL.forEach((_, m) => mixMes(y, m).forEach((p, i) => { acc[i] += p; })); const s = acc.reduce((a, b) => a + b, 0); return acc.map((v) => (v / s) * 100); };
  const cols = vista === "12m" ? MESES_LBL.map((l, m) => ({ label: l, pcts: mixMes(2026, m) })) : [2022, 2023, 2024, 2025, 2026].map((y) => ({ label: String(y), pcts: mixAnio(y) }));

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={sx.sectionTitle}>Histórico del mix</div>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2 }}>
          {[["12m", "12 meses"], ["anual", "Por año"]].map(([k, l]) => <button key={k} onClick={() => setVista(k)} style={{ padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: 600, background: vista === k ? T.brand : "transparent", color: vista === k ? "#fff" : T.muted }}>{l}</button>)}
        </div>
      </div>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: vista === "12m" ? 4 : 14, height: 220 }}>
          {cols.map((c) => (
            <div key={c.label} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%" }}>
              <div style={{ flex: 1, width: "100%", maxWidth: 46, display: "flex", flexDirection: "column-reverse", borderRadius: "4px 4px 0 0", overflow: "hidden", margin: "0 auto" }}>
                {MIX_CATS.map(([cat, col], i) => <div key={cat} title={`${cat} ${c.pcts[i].toFixed(1)}%`} style={{ height: `${c.pcts[i]}%`, background: col }} />)}
              </div>
              <div style={{ fontSize: 9.5, color: T.muted }}>{c.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}` }}>
          {MIX_CATS.map(([cat, col]) => <span key={cat} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: T.muted }}><span style={{ width: 10, height: 10, borderRadius: 2, background: col }} />{cat}</span>)}
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 8, fontStyle: "italic" }}>Composición del mix por periodo (simulada). Deja ver cómo cambia qué se vende a lo largo del tiempo.</div>
    </div>
  );
}

const MIX_CATS = [["Helado / Yogurt base", "#0F6E66"], ["Frutas", "#2E9E5B"], ["Toppings", "#C98A1E"], ["Chocolates y dulces", "#0A4F49"], ["Coberturas", "#8C8C97"], ["Nieves", "#A81D27"], ["Bebidas / botana", "#41414C"]];
function FinVentas({ units, totVenta, seg }) {
  const [vista, setVista] = useState("__panorama__");
  const [metas, setMetas] = useState({});
  const [editMetas, setEditMetas] = useState(false);
  const [orden, setOrden] = useState("meta");
  const [freq, setFreq] = useState("Mes");
  const [anio, setAnio] = useState(2025);
  const [mes, setMes] = useState(2);
  const [dia, setDia] = useState(15);

  const enr = units.map((u) => {
    const meta = metas[u.nombre] != null ? metas[u.nombre] : metaBase(u);
    const prev = prevBase(u);
    const pctMeta = meta ? (u.venta / meta) * 100 : 0;
    const growth = prev ? ((u.venta - prev) / prev) * 100 : 0;
    return { ...u, meta, prev, pctMeta, growth };
  });
  const totV = enr.reduce((s, u) => s + u.venta, 0);
  const avg = enr.length ? totV / enr.length : 0;
  const ranked = [...enr].sort((a, b) => b.venta - a.venta);
  const rankOf = (n) => ranked.findIndex((u) => u.nombre === n) + 1;
  const enMeta = enr.filter((u) => u.pctMeta >= 100).length;
  const cerca = enr.filter((u) => u.pctMeta >= 92 && u.pctMeta < 100).length;
  const abajo = enr.filter((u) => u.pctMeta < 92).length;
  const cayeron = enr.filter((u) => u.growth < 0).length;

  const lista = [...enr].sort((a, b) => orden === "meta" ? a.pctMeta - b.pctMeta : orden === "caida" ? a.growth - b.growth : b.venta - a.venta);

  /* ---------- DETALLE DE SUCURSAL / RED ---------- */
  if (vista !== "__panorama__") {
    const esRed = vista === "__red__";
    const u = esRed ? null : enr.find((x) => x.nombre === vista);
    const venta = esRed ? totV : (u ? u.venta : 0);
    const meta = esRed ? enr.reduce((s, x) => s + x.meta, 0) : (u ? u.meta : 0);
    const prev = esRed ? enr.reduce((s, x) => s + x.prev, 0) : (u ? u.prev : 0);
    const pctMeta = meta ? (venta / meta) * 100 : 0;
    const growth = prev ? ((venta - prev) / prev) * 100 : 0;
    const scale = esRed ? (seg === "Propias" ? 1 : venta / (ANUAL_2025 / 12)) : venta / (MESES_2025[2] || 1);
    const vsAvg = u ? ((u.venta - avg) / avg) * 100 : 0;
    const nombreKey = esRed ? "__red__" : u.nombre;
    const ticket = esRed ? 98 : 88 + (vhash(nombreKey) % 30);
    const transacc = ticket ? Math.round(venta / ticket) : 0;
    const rawMix = MIX_CATS.map(([c], i) => 8 + (vhash(nombreKey + c) % 22) + (i === 0 ? 16 : 0));
    const sumMix = rawMix.reduce((a, b) => a + b, 0);
    const mix = MIX_CATS.map(([c, col], i) => ({ cat: c, col, pct: (rawMix[i] / sumMix) * 100 }));
    return (
      <div>
        <button onClick={() => setVista("__panorama__")} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver al panorama</button>
        <div style={sx.h1row}><h1 style={sx.h1}>{esRed ? `Ventas · ${seg}` : u.nombre}</h1><span style={{ fontSize: 12, color: T.muted }}>{esRed ? "consolidado" : u.tipo}</span></div>
        <div style={sx.cards4}>
          <Metric big={`${pctMeta.toFixed(0)}%`} label="Cumplimiento de meta" sub={`meta ${money(meta)}`} accent={metaCol(pctMeta)} alert={pctMeta < 92} />
          <Metric big={money(venta)} label="Ventas del mes" sub={seg} accent={T.brand} />
          <Metric big={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`} label="Vs mes anterior" sub={money(prev)} accent={growth >= 0 ? T.ok : T.bad} />
          {esRed ? <Metric big={String(enr.length)} label="Sucursales" sub={seg} accent={T.ink} /> : <Metric big={`${vsAvg >= 0 ? "+" : ""}${vsAvg.toFixed(1)}%`} label="Vs promedio de la red" sub={money(Math.round(avg))} accent={vsAvg >= 0 ? T.ok : T.warn} />}
        </div>
        <div style={{ marginTop: 12, ...sx.cards4 }}>
          <Metric big={money(ticket)} label="Ticket promedio" sub="por transacción" accent={T.ink} />
          <Metric big={transacc.toLocaleString("es-MX")} label="Transacciones" sub="del mes" accent={T.inkSoft} />
          <Metric big={money(Math.round(venta / 30))} label="Venta diaria promedio" sub="del mes" accent={T.inkSoft} />
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={sx.sectionTitle}>Mix de productos por categoría</div>
          <div style={{ display: "grid", gap: 8 }}>
            {mix.slice().sort((a, b) => b.pct - a.pct).map((m) => (
              <div key={m.cat} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 180, minWidth: 180, fontSize: 12.5, color: T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: m.col, flexShrink: 0 }} />{m.cat}
                </div>
                <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 12, overflow: "hidden", minWidth: 60 }}>
                  <div style={{ width: `${m.pct}%`, height: "100%", background: m.col, borderRadius: 99 }} />
                </div>
                <div style={{ width: 100, textAlign: "right", fontSize: 11.5, color: T.muted }}>{money(Math.round((venta * m.pct) / 100))}</div>
                <div style={{ width: 48, textAlign: "right", fontWeight: 700, fontSize: 12.5 }}>{m.pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={sx.sectionTitle}>Tendencia de ventas</div>
          <PeriodoSel freq={freq} setFreq={setFreq} anio={anio} setAnio={setAnio} mes={mes} setMes={setMes} dia={dia} setDia={setDia} />
          <VentasChart freq={freq} anio={anio} mes={mes} dia={dia} scale={scale} />
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8, fontStyle: "italic" }}>Meses de 2025 con datos reales del ER; hora, día y semana de ejemplo. Ticket, transacciones y mix de productos vienen de la analítica (de ejemplo).</div>
        </div>
      </div>
    );
  }

  /* ---------- PANORAMA ---------- */
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Ventas · Panorama</h1><span style={{ fontSize: 12, color: T.muted }}>{seg} · mes en curso</span></div>

      <div style={sx.cards4}>
        <Metric big={String(enMeta)} label="En meta" sub="≥ 100%" accent={T.ok} />
        <Metric big={String(cerca)} label="Cerca de meta" sub="92–99%" accent={T.warn} alert={cerca > 0} />
        <Metric big={String(abajo)} label="Debajo de meta" sub="< 92%" accent={T.bad} alert={abajo > 0} />
        <Metric big={String(cayeron)} label="Cayeron" sub="vs mes anterior" accent={cayeron ? T.warn : T.ok} alert={cayeron > 0} />
      </div>

      {(abajo > 0 || cayeron > 0) && (
        <div style={{ marginTop: 16, background: T.badSoft, borderRadius: 12, padding: "12px 16px", fontSize: 12.5, color: T.bad, fontWeight: 600 }}>
          Requiere atención: {abajo > 0 ? `${abajo} sucursal${abajo === 1 ? "" : "es"} por debajo de meta` : ""}{abajo > 0 && cayeron > 0 ? " · " : ""}{cayeron > 0 ? `${cayeron} con caída vs mes anterior` : ""}.
        </div>
      )}

      <div style={{ marginTop: 22, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>Ver
            <select className="sel" value={"__panorama__"} onChange={(e) => setVista(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
              <option value="__panorama__">Panorama</option>
              <option value="__red__">Toda la red ({seg})</option>
              {ranked.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}
            </select>
          </label>
          <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>Ordenar
            <select className="sel" value={orden} onChange={(e) => setOrden(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
              <option value="meta">Menor cumplimiento</option>
              <option value="caida">Mayor caída</option>
              <option value="venta">Mayor venta</option>
            </select>
          </label>
        </div>
        <button className="actbtn" onClick={() => setEditMetas(!editMetas)} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>{editMetas ? "Cerrar metas" : "Editar metas"}</button>
      </div>

      {editMetas && (
        <div style={{ marginTop: 12, ...sx.repCard, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
          {ranked.map((u) => (
            <label key={u.nombre} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.nombre}</span>
              <input type="number" value={u.meta} onChange={(e) => setMetas((p) => ({ ...p, [u.nombre]: e.target.value === "" ? 0 : Number(e.target.value) }))} className="sel" style={{ ...sx.sel, fontSize: 12, width: 110, textAlign: "right", padding: "5px 8px" }} />
            </label>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14, display: "grid", gap: 6 }}>
        {lista.map((u) => (
          <button key={u.nombre} onClick={() => setVista(u.nombre)} className="rowbtn" style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: "pointer", textAlign: "left", width: "100%", border: `1px solid ${T.line}`, borderLeft: `3px solid ${metaCol(u.pctMeta)}` }}>
            <div style={{ width: 150, minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nombre}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{u.tipo} · #{rankOf(u.nombre)} en venta</div>
            </div>
            <div style={{ width: 90, textAlign: "center" }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 17, color: metaCol(u.pctMeta) }}>{u.pctMeta.toFixed(0)}%</div>
              <div style={{ fontSize: 9.5, color: T.muted }}>de meta</div>
            </div>
            <div style={{ flex: 1, minWidth: 80 }}>
              <div style={{ background: T.lineSoft, borderRadius: 99, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(u.pctMeta, 100)}%`, height: "100%", background: metaCol(u.pctMeta), borderRadius: 99 }} />
              </div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{money(u.venta)} / {money(u.meta)}</div>
            </div>
            <div style={{ width: 84, textAlign: "right" }}><Flecha g={u.growth} /><div style={{ fontSize: 9.5, color: T.muted }}>vs mes ant.</div></div>
            <div style={{ width: 74, textAlign: "right" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: u.venta >= avg ? T.ok : T.warn }}>{u.venta >= avg ? "▲ arriba" : "▼ abajo"}</div>
              <div style={{ fontSize: 9.5, color: T.muted }}>vs red</div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>Toca una sucursal para ver su detalle y tendencia. Ventas de ejemplo; metas editables.</div>
    </div>
  );
}

function SegControl({ seg, setSeg }) {
  const opts = [["Todas", "Globe"], ["Propias", "Store"], ["Franquicias", "Building2"]];
  return (
    <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: 4, gap: 2, marginBottom: 22, boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
      {opts.map(([k, ic]) => (
        <button key={k} onClick={() => setSeg(k)} className="segbtn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, background: seg === k ? T.brand : "transparent", color: seg === k ? "#fff" : T.muted }}>
          <Ico name={ic} size={15} color={seg === k ? "#fff" : T.muted} />{k}
        </button>
      ))}
    </div>
  );
}

function Finanzas({ cuadro, inv, invMes }) {
  const [fsec, setFsec] = useState("tablero");
  const [seg, setSeg] = useState("Propias");
  const [erSel, setErSel] = useState("__cons__");
  const { propias, franq } = finUnidades(cuadro, inv);
  const units = (seg === "Propias" ? propias : seg === "Franquicias" ? franq : [...propias, ...franq]).map((u) => {
    const pctC = u.venta && u.consumo ? (u.consumo / u.venta) * 100 : null;
    const pctN = u.venta && u.nomMes ? (u.nomMes / u.venta) * 100 : null;
    const margen = u.venta - u.consumo - u.nomMes;
    const pctM = u.venta ? (margen / u.venta) * 100 : 0;
    return { ...u, pctC, pctN, margen, pctM };
  });
  const propiasSel = units.filter((u) => u.tipo === "Propia");
  const totVenta = units.reduce((s, u) => s + u.venta, 0);
  const totConsumo = propiasSel.reduce((s, u) => s + u.consumo, 0);
  const totNomina = propiasSel.reduce((s, u) => s + u.nomMes, 0);
  const ventaP = propiasSel.reduce((s, u) => s + u.venta, 0);
  const totMargen = ventaP - totConsumo - totNomina;
  const promC = ventaP ? (totConsumo / ventaP) * 100 : null;
  const promN = ventaP ? (totNomina / ventaP) * 100 : null;
  const promM = ventaP ? (totMargen / ventaP) * 100 : null;
  const cartera = units.reduce((s, u) => s + u.cartera, 0);
  const conAdeudo = units.filter((u) => u.cartera > 0).length;
  const secMeta = FIN_SECCIONES.find((s) => s.key === fsec);
  const pct = (v) => (v === null ? "—" : `${v.toFixed(1)}%`);
  const soloFranq = seg === "Franquicias";

  return (
    <>
      <FinSidebar fsec={fsec} onPick={setFsec} seg={seg} setSeg={setSeg} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={sx.header} className="noprint">
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Finanzas</div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{secMeta ? secMeta.nombre : ""} · {seg.toLowerCase()}</div>
          </div>
        </header>
        <main style={sx.main}>
          {fsec === "tablero" && (
            <div>
              <div style={sx.h1row}><h1 style={sx.h1}>Tablero financiero</h1><span style={{ fontSize: 12, color: T.muted }}>{units.length} unidades · {seg.toLowerCase()}</span></div>
              <div style={sx.cards4}>
                <Metric big={money(totVenta)} label="Ventas del mes" sub={seg} accent={T.brand} />
                <Metric big={pct(promC)} label="Costo de producto" sub={soloFranq ? "no aplica" : "promedio propias"} accent={promC === null ? T.muted : finColC(promC)} />
                <Metric big={pct(promN)} label="Nómina sobre ventas" sub={soloFranq ? "no aplica" : "promedio propias"} accent={promN === null ? T.muted : finColN(promN)} />
                <Metric big={pct(promM)} label="Margen bruto" sub={soloFranq ? "no aplica" : money(totMargen)} accent={T.ink} />
              </div>
              <div style={{ marginTop: 12, ...sx.cards4 }}>
                <Metric big={money(cartera)} label="Cartera vencida" sub={`${conAdeudo} con adeudo`} accent={cartera ? T.bad : T.ok} alert={cartera > 0} />
              </div>
              <div style={{ marginTop: 26 }}>
                <div style={sx.sectionTitle}>Indicadores</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
                  {FIN_SECCIONES.filter((s) => !s.home).map((s) => (
                    <button key={s.key} className="rowbtn" onClick={() => setFsec(s.key)} style={{ ...sx.areaCard, cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ color: T.brand, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                      </div>
                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}`, fontSize: 12, fontWeight: 600, color: T.brand }}>
                        {s.key === "ventas" ? money(totVenta) : s.key === "costo" ? `${pct(promC)} promedio` : s.key === "nomina" ? `${pct(promN)} promedio` : s.key === "rentabilidad" ? `${pct(promM)} margen` : s.key === "er" ? "Cascada completa" : money(cartera)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 18, background: T.brandSoft, borderRadius: 12, padding: "14px 16px", fontSize: 12, color: T.brandDark }}>
                <strong>Cómo se alimenta:</strong> el <strong>costo</strong> y la <strong>nómina</strong> se llevan de las sucursales propias (Inventarios y Cuadro de personal). La <strong>cartera</strong> es real, de Cobranza (Franquicias). Las <strong>ventas</strong> vienen de la plataforma analítica (aquí de ejemplo).
              </div>
            </div>
          )}

          {fsec === "ventas" && <FinVentas units={units} totVenta={totVenta} seg={seg} />}
          {fsec === "transacciones" && <FinTransacciones units={units} seg={seg} />}
          {fsec === "mix" && <FinMix units={units} seg={seg} />}

          {fsec === "costo" && (soloFranq ? <FinNoAplica que="costo de producto" /> : (() => {
            const mesCosto = 5;
            const recsC = (invMes && invMes[mesCosto]) || {};
            const costoFilas = SUCURSALES.map((suc) => {
              const r = recsC[suc];
              const cargado = !!(r && r.cargado);
              const consumo = cargado ? invConsumo(r) : 0;
              const venta = cargado ? (r.ventaPeriodo || 0) : 0;
              const pctc = venta ? (consumo / venta) * 100 : 0;
              return { suc, cargado, consumo, venta, pctc };
            });
            const cargadas = costoFilas.filter((f) => f.cargado);
            const pend = costoFilas.length - cargadas.length;
            const costoTot = cargadas.reduce((s, f) => s + f.consumo, 0);
            const ventaTot = cargadas.reduce((s, f) => s + f.venta, 0);
            const pctGlobalC = ventaTot ? (costoTot / ventaTot) * 100 : 0;
            const mesLblC = `${MESES_LBL[mesCosto]} 2025`;
            const meta = 39;
            const dentro = cargadas.filter((f) => f.pctc <= meta).length;
            const excGlobal = costoTot - (meta / 100) * ventaTot;
            const ordC = [...cargadas].sort((a, b) => b.pctc - a.pctc);
            const maxPct = Math.max(meta + 6, ...cargadas.map((f) => f.pctc));
            const heroCol = finColC(pctGlobalC) === T.ok ? "#7BE0A3" : finColC(pctGlobalC) === T.warn ? "#F2C879" : "#F2A6A2";
            return (
              <div>
                <div style={sx.h1row}><h1 style={sx.h1}>Costo de producto</h1><span style={{ fontSize: 12, color: T.muted }}>consumo real ÷ ventas del periodo · propias</span></div>

                {/* Banda ejecutiva */}
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
                  <div style={{ flex: "1 1 240px", background: T.ink, color: "#fff", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 128 }}>
                    <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Costo de producto · {mesLblC}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 46, lineHeight: 1, color: cargadas.length ? heroCol : "rgba(255,255,255,.5)" }}>{cargadas.length ? `${pctGlobalC.toFixed(1)}%` : "—"}</span>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,.65)", lineHeight: 1.25 }}>global<br />ponderado</span>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.78)", marginTop: 10 }}>Ideal ≤ {meta}% · {!cargadas.length ? "sin datos" : pctGlobalC <= meta ? "dentro del ideal" : `+${(pctGlobalC - meta).toFixed(1)} pts sobre el ideal`}</div>
                  </div>
                  <div style={{ flex: "3 1 340px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                    <Metric big={money(Math.round(costoTot))} label="Consumo total" sub={`ventas ${money(Math.round(ventaTot))}`} accent={T.ink} />
                    <Metric big={`${cargadas.length}/${SUCURSALES.length}`} label="Sucursales cargadas" sub={mesLblC} accent={cargadas.length === SUCURSALES.length ? T.ok : T.warn} alert={pend > 0} />
                    <Metric big={`${dentro}/${cargadas.length || 0}`} label="Dentro del ideal" sub={`≤ ${meta}%`} accent={cargadas.length && dentro === cargadas.length ? T.ok : T.warn} />
                    <Metric
                      big={cargadas.length ? `${excGlobal >= 0 ? "+" : "−"}${money(Math.abs(Math.round(excGlobal)))}` : "—"}
                      label={excGlobal > 0 ? "Excedente sobre ideal" : "Bajo el ideal (ahorro)"}
                      sub={cargadas.length ? `${(pctGlobalC - meta >= 0 ? "+" : "") + (pctGlobalC - meta).toFixed(1)} pts · ideal ≤ ${meta}%` : "sin datos"}
                      accent={!cargadas.length ? T.muted : excGlobal > 0 ? T.bad : T.ok}
                      alert={excGlobal > 0}
                    />
                  </div>
                </div>

                {/* Ranking ejecutivo por sucursal */}
                <div style={sx.sectionTitle}>Detalle por sucursal · mayor a menor costo</div>
                <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.4fr) 2fr auto", alignItems: "center", gap: 14, padding: "8px 16px", background: T.paper }}>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.muted }}>Sucursal · consumo / venta</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.muted }}>Costo vs ideal ≤{meta}%</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.muted, textAlign: "right", minWidth: 84 }}>% · excedente $</span>
                  </div>
                  {ordC.map((f) => {
                    const exc = f.consumo - (meta / 100) * f.venta;
                    return (
                    <div key={f.suc} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.4fr) 2fr auto", alignItems: "center", gap: 14, padding: "10px 16px", borderTop: `1px solid ${T.lineSoft}` }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.suc}</div>
                        <div style={{ fontSize: 10.5, color: T.muted }}>{money(Math.round(f.consumo))} · vta {money(Math.round(f.venta))}</div>
                      </div>
                      <div style={{ height: 10, borderRadius: 99, background: T.lineSoft, overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(100, (f.pctc / maxPct) * 100)}%`, height: "100%", background: finColC(f.pctc), borderRadius: 99 }} />
                      </div>
                      <div style={{ minWidth: 84, textAlign: "right" }}>
                        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 15, color: finColC(f.pctc) }}>{f.pctc.toFixed(1)}%</div>
                        <div style={{ fontSize: 10.5, fontWeight: 600, color: exc > 0 ? T.bad : T.ok }}>{exc > 0 ? "+" : exc < 0 ? "−" : ""}{money(Math.abs(Math.round(exc)))}</div>
                      </div>
                    </div>
                    );
                  })}
                  {cargadas.length === 0 && <div style={{ padding: "16px", fontSize: 12.5, color: T.muted }}>Aún no hay inventarios mensuales cargados para {mesLblC}.</div>}
                  {pend > 0 && <div style={{ padding: "10px 16px", borderTop: `1px solid ${T.lineSoft}`, fontSize: 11.5, color: T.muted, background: T.paper }}>{pend} sucursal{pend === 1 ? "" : "es"} sin captura este mes — no computan en el promedio.</div>}
                </div>

                {/* Nota de enlace */}
                <div style={{ marginTop: 16, background: T.brandSoft, borderRadius: 12, padding: "12px 16px", fontSize: 11.5, color: T.brandDark, display: "flex", alignItems: "center", gap: 10 }}>
                  <Ico name="Link2" size={16} color={T.brandDark} />
                  <span><strong>Enlazado con Inventarios › Inventarios Mensuales.</strong> Estas cifras son exactamente las de la toma mensual (consumo real por producto ÷ ventas del periodo capturado). Al cargar o editar un inventario, este apartado se actualiza solo.</span>
                </div>
              </div>
            );
          })())}

          {fsec === "nomina" && (soloFranq ? <FinNoAplica que="nómina" /> : (
            <div>
              <div style={sx.h1row}><h1 style={sx.h1}>Nómina</h1><span style={{ fontSize: 12, color: T.muted }}>nómina mensual ÷ ventas · propias</span></div>
              <div style={sx.cards4}>
                <Metric big={pct(promN)} label="Nómina promedio" sub="meta ≤ 22%" accent={promN === null ? T.muted : finColN(promN)} />
                <Metric big={money(Math.round(totNomina))} label="Nómina total" sub="mensual estimada" accent={T.ink} />
              </div>
              <div style={{ marginTop: 22 }}>
                <FinTabla filas={propiasSel} cols={[{ h: "Sucursal", render: (f) => f.nombre }, { h: "Ventas", render: (f) => money(f.venta) }, { h: "Nómina mes", render: (f) => money(Math.round(f.nomMes)) }, { h: "% Nómina", strong: true, color: (f) => finColN(f.pctN), render: (f) => `${f.pctN.toFixed(1)}%` }]} />
              </div>
            </div>
          ))}

          {fsec === "rentabilidad" && (soloFranq ? <FinNoAplica que="rentabilidad" /> : (
            <div>
              <div style={sx.h1row}><h1 style={sx.h1}>Rentabilidad</h1><span style={{ fontSize: 12, color: T.muted }}>ventas − consumo − nómina · propias</span></div>
              <div style={sx.cards4}>
                <Metric big={pct(promM)} label="Margen bruto" sub="promedio propias" accent={T.ink} />
                <Metric big={money(Math.round(totMargen))} label="Margen total" sub="del mes" accent={T.brand} />
              </div>
              <div style={{ marginTop: 22 }}>
                <FinTabla filas={[...propiasSel].sort((a, b) => b.pctM - a.pctM)} cols={[{ h: "Sucursal", render: (f) => f.nombre }, { h: "Ventas", render: (f) => money(f.venta) }, { h: "Margen $", render: (f) => money(Math.round(f.margen)) }, { h: "% Margen", strong: true, color: (f) => (f.pctM >= 45 ? T.ok : f.pctM >= 38 ? T.warn : T.bad), render: (f) => `${f.pctM.toFixed(1)}%` }]} />
              </div>
            </div>
          ))}

          {fsec === "cartera" && (
            <div>
              <div style={sx.h1row}><h1 style={sx.h1}>Cartera vencida</h1><span style={{ fontSize: 12, color: T.muted }}>dato real de Cobranza</span></div>
              <div style={sx.cards4}>
                <Metric big={money(cartera)} label="Cartera vencida" sub="total adeudado" accent={cartera ? T.bad : T.ok} alert={cartera > 0} />
                <Metric big={String(conAdeudo)} label="Unidades con adeudo" sub="por cobrar" accent={conAdeudo ? T.warn : T.ok} />
              </div>
              <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
                {units.filter((u) => u.cartera > 0).sort((a, b) => b.cartera - a.cartera).map((u) => (
                  <div key={u.nombre} style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: `3px solid ${T.bad}` }}>
                    <div><div style={{ fontSize: 13, fontWeight: 600 }}>{u.nombre}</div><div style={{ fontSize: 11, color: T.muted }}>{u.tipo}</div></div>
                    <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, color: T.bad }}>{money(u.cartera)}</span>
                  </div>
                ))}
                {cartera === 0 && <div style={sx.empty}>Sin cartera vencida en este segmento.</div>}
              </div>
            </div>
          )}

          {fsec === "er" && (() => {
            const disponibles = units;
            const sel = erSel === "__cons__" ? disponibles : disponibles.filter((u) => u.nombre === erSel);
            const t = erCalc(sel.length ? sel : disponibles);
            const hayReg = t.regalias > 0;
            const pctd = (v) => (t.ingreso ? `${((v / t.ingreso) * 100).toFixed(1)}%` : "—");
            const Row = ({ label, val, bold, total, neg, hide }) => hide ? null : (
              <tr style={{ background: total ? T.paper : "transparent" }}>
                <td style={{ padding: "8px 14px", fontWeight: bold || total ? 700 : 400, color: total ? T.ink : T.inkSoft, borderBottom: `1px solid ${T.lineSoft}` }}>{label}</td>
                <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: bold || total ? 700 : 500, color: neg && val < 0 ? T.bad : total ? T.ink : T.inkSoft, borderBottom: `1px solid ${T.lineSoft}` }}>{money(Math.round(val))}</td>
                <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: total ? 700 : 400, color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{pctd(val)}</td>
              </tr>
            );
            return (
              <div>
                <div style={sx.h1row}><h1 style={sx.h1}>Estado de Resultados</h1><span style={{ fontSize: 12, color: T.muted }}>mensual · {erSel === "__cons__" ? `consolidado (${seg.toLowerCase()})` : erSel}</span></div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
                  <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Ver
                    <select className="sel" value={erSel} onChange={(e) => setErSel(e.target.value)} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
                      <option value="__cons__">Consolidado ({seg})</option>
                      {disponibles.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}</option>)}
                    </select>
                  </label>
                </div>

                <div style={{ maxWidth: 620, border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: T.ink }}>
                        <th style={{ padding: "10px 14px", textAlign: "left", color: "#fff", fontWeight: 700 }}>Concepto</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Importe</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", color: "rgba(255,255,255,.7)", fontWeight: 700 }}>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <Row label="Ingreso (ventas)" val={t.ingreso} bold />
                      <Row label="Costo sobre inventario" val={t.costo} />
                      <Row label="Utilidad Bruta" val={t.utilBruta} total />
                      <Row label="Mano de Obra" val={t.mo} />
                      <Row label="Servicios" val={t.servicios} />
                      <Row label="Gasto Fijo (renta)" val={t.renta} />
                      <Row label="Mantenimiento y varios" val={t.mtto} />
                      <Row label="Comisión TPV" val={t.comision} />
                      <Row label="Regalías" val={t.regalias} hide={!hayReg} />
                      <Row label="Utilidad Operativa" val={t.util} total neg />
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 16, maxWidth: 620, background: T.brandSoft, borderRadius: 12, padding: "12px 16px", fontSize: 11.5, color: T.brandDark }}>
                  <strong>Enlazado:</strong> Ingreso, Costo (Inventarios) y Mano de Obra (Capital Humano) para propias. <strong>Por capturar / ejemplo:</strong> Servicios, Renta, Mantenimiento, Comisión TPV y Regalías. Regalías solo aparece en franquicias.
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </>
  );
}

function FinNoAplica({ que }) {
  return (
    <div>
      <div style={sx.h1row}><h1 style={{ ...sx.h1, textTransform: "capitalize" }}>{que}</h1></div>
      <div style={{ ...sx.repCard, textAlign: "center", padding: "40px 20px", color: T.muted }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ico name="Info" size={26} color={T.muted} /></div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.inkSoft }}>El {que} no aplica para franquicias</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>Las franquicias autogestionan su costo y su nómina. Este indicador se lleva solo de las sucursales propias.</div>
      </div>
    </div>
  );
}

/* ---------------- BARRA LATERAL DE DEPARTAMENTOS ---------------- */
function Sidebar({ depto, onPick }) {
  return (
    <aside className="noprint" style={sx.sidebar}>
      <div style={{ padding: "2px 8px 20px" }}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 40, width: "auto" }} />
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        {DEPTOS.map((d) => {
          const active = depto === d.key;
          const bg = active ? T.brand : d.home ? "rgba(255,255,255,.07)" : "transparent";
          const col = active ? "#fff" : d.home ? "#fff" : "rgba(255,255,255,.62)";
          return (
            <button key={d.key} onClick={() => onPick(d.key)} className="deptobtn" style={{ ...sx.deptoItem, background: bg, color: col, fontWeight: active || d.home ? 700 : 500 }}>
              <span style={{ width: 22, display: "flex", justifyContent: "center" }}><Ico name={d.iconName} size={17} /></span>
              <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>{d.nombre}</span>
              {!d.activo && <span style={sx.proxTag}>Próx.</span>}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 10, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
        Prototipo<br />Frutal Yogurt
      </div>
    </aside>
  );
}

/* ---------------- INICIO ---------------- */
function Inicio({ onEnter, mtto }) {
  const totalSuc = FRANQUICIAS.length;
  const cartera = FRANQUICIAS.reduce((a, f) => a + fqMontoVencido(f), 0);
  const metricasReales = {
    mantenimiento: [["Disponibilidad", `${mtto.disp}%`], ["Reportes abiertos", String(mtto.abiertos)]],
    franquicias: [["Sucursales", String(totalSuc)], ["Cartera vencida", money(cartera)]],
    capital_humano: [["Vacantes activas", String(VACANTES_CH.filter((v) => !(v.colab && v.colab.asignada)).length)], ["Procesos en curso", String(VACANTES_CH.length)]],
    sucursales_propias: [["Cumplimiento prom.", `${Math.round(AUDITORIAS.reduce((s, a) => s + a.calif, 0) / AUDITORIAS.length)}%`], ["Auditorías críticas", String(AUDITORIAS.filter((a) => a.calif < 80).length)]],
  };
  return (
    <div style={{ ...sx.main, width: "100%" }}>
      <div style={sx.hero}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 70, width: "auto" }} />
        <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 23, fontWeight: 600, color: "#fff", marginTop: 16 }}>Plataforma de gestión</div>
        <div style={{ fontSize: 13.5, color: "rgba(255,255,255,.72)", marginTop: 5 }}>Resumen general por departamento</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 24 }}>
        {DEPTOS.filter((d) => d.key !== "inicio").map((d) => {
          const real = !!metricasReales[d.key];
          const metricas = real ? metricasReales[d.key] : (d.metricas || []);
          return (
            <button
              key={d.key}
              className={d.activo ? "rowbtn" : ""}
              onClick={() => d.activo && onEnter(d.key)}
              disabled={!d.activo}
              style={{ ...sx.deptoCard, textAlign: "left", alignItems: "stretch", cursor: d.activo ? "pointer" : "default", opacity: d.activo ? 1 : 0.85 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ color: real ? T.brand : T.inkSoft, display: "flex" }}><Ico name={d.iconName} size={20} /></span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{d.nombre}</span>
                </div>
                {!real && (
                  <span style={{ fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.muted, background: T.lineSoft, padding: "2px 6px", borderRadius: 99 }}>Ejemplo</span>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {metricas.map(([lbl, val], i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 19, color: real ? T.brand : T.ink }}>{val}</div>
                    <div style={{ fontSize: 10.5, color: T.muted, lineHeight: 1.3, marginTop: 2 }}>{lbl}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 11.5, fontWeight: 600, color: d.activo ? T.brand : T.muted }}>
                {d.activo ? "Entrar ›" : "Próximamente"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11, color: T.muted, marginTop: 18, fontStyle: "italic" }}>
        Mantenimiento y Franquicias muestran datos reales del prototipo. Las demás cifras son de ejemplo, para ilustrar cómo se vería el panel completo.
      </div>
    </div>
  );
}

/* ===================== REMODELACIONES ===================== */
const REMO_RUBROS = ["Fachada e imagen exterior", "Piso", "Pintura y muros", "Iluminación", "Mobiliario", "Barra / área de servicio", "Equipo (refrigeración/máquinas)", "Baños", "Señalización / branding", "Limpieza general"];
// Criticidad a partir de la calificación (0-100): <60 Crítica, 60-74 Alta, 75-89 Media, >=90 Baja
const remoCrit = (cal) => (cal < 60 ? ["Crítica", T.crit] : cal < 75 ? ["Alta", T.bad] : cal < 90 ? ["Media", T.warn] : ["Baja", T.ok]);
const remoCalRubro = (suc, r) => { const h = vhash("remo" + suc + r); return Math.max(35, Math.min(100, 55 + (h % 50))); };
const remoDiag = (suc) => { const vals = REMO_RUBROS.map((r) => remoCalRubro(suc, r)); const cal = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length); return { suc, cal, vals }; };
const REMO_DIAG = SUCURSALES.map(remoDiag);

const REMO_ETAPAS = ["Diagnóstico", "Cotización", "Planeación", "Demolición", "Instalaciones", "Acabados", "Equipo e imagen", "Entrega"];
const REMO_PROY = [
  { suc: "República Mexicana", etapa: 5, ini: "2026-06-10", fin: "2026-08-05", resp: "Elias Cavazos", presu: 480000, ejercido: 356000 },
  { suc: "Colón Centro", etapa: 3, ini: "2026-07-01", fin: "2026-09-15", resp: "Elias Cavazos", presu: 640000, ejercido: 180000 },
  { suc: "Mitras", etapa: 1, ini: "2026-07-18", fin: "2026-10-01", resp: "Contratista externo", presu: 520000, ejercido: 40000 },
];

function Remodelaciones() {
  const [sec, setSec] = useState(null);
  const secs = [
    { key: "diagnostico", nombre: "Diagnóstico", iconName: "ClipboardCheck", desc: "Auditoría por sucursal → criticidad" },
    { key: "avance", nombre: "Avance de obra", iconName: "Hammer", desc: "Proyectos en curso y su etapa" },
  ];
  const criticas = REMO_DIAG.filter((d) => d.cal < 60).length;
  const promDiag = Math.round(REMO_DIAG.reduce((a, d) => a + d.cal, 0) / REMO_DIAG.length);
  const avancePr = Math.round(REMO_PROY.reduce((a, p) => a + (p.etapa / (REMO_ETAPAS.length - 1)) * 100, 0) / REMO_PROY.length);
  const metricas = {
    diagnostico: { big: String(criticas), label: `sucursales críticas · ${promDiag}% prom.`, col: criticas ? T.crit : T.ok },
    avance: { big: `${avancePr}%`, label: `avance promedio · ${REMO_PROY.length} obras`, col: T.brand },
  };
  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Remodelaciones</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{sec ? secs.find((s) => s.key === sec).nombre : "Panel del departamento"}</div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {sec && <button onClick={() => setSec(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Secciones</button>}
        </nav>
      </header>
      <main style={sx.main}>
        {!sec && (
          <div>
            <div style={sx.h1row}><h1 style={sx.h1}>Remodelaciones</h1><span style={{ fontSize: 12, color: T.muted }}>diagnóstico → priorización → obra</span></div>
            <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 22 }}>El proceso arranca con un diagnóstico por sucursal; su criticidad define la prioridad de remodelación. Luego se da seguimiento al avance de obra.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {secs.map((s) => {
                const m = metricas[s.key];
                return (
                  <button key={s.key} className="rowbtn" onClick={() => setSec(s.key)} style={{ ...sx.areaCard, cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ color: T.brand, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                        <div style={{ fontSize: 11, color: T.muted }}>{s.desc}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, display: "flex", alignItems: "baseline", gap: 8, textAlign: "left" }}>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 24, color: m.col }}>{m.big}</span>
                      <span style={{ fontSize: 11.5, color: T.muted }}>{m.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {sec === "diagnostico" && <RemoDiagnostico />}
        {sec === "avance" && <RemoAvance />}
      </main>
    </>
  );
}

function RemoDiagnostico() {
  const [sel, setSel] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [extra, setExtra] = useState([]);
  const todos = [...REMO_DIAG, ...extra];
  const ranked = [...todos].sort((a, b) => a.cal - b.cal);
  const criticas = todos.filter((d) => d.cal < 60).length;
  const prom = Math.round(todos.reduce((a, d) => a + d.cal, 0) / todos.length);

  if (nuevo) return <RemoNuevoDiag onCancel={() => setNuevo(false)} onGuardar={(d) => { setExtra((p) => [d, ...p.filter((x) => x.suc !== d.suc)]); setNuevo(false); }} />;

  if (sel) {
    const d = todos.find((x) => x.suc === sel);
    const [crit, cCol] = remoCrit(d.cal);
    const rubros = REMO_RUBROS.map((r, i) => ({ r, v: d.vals[i] })).sort((a, b) => a.v - b.v);
    return (
      <div>
        <button onClick={() => setSel(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver al diagnóstico</button>
        <div style={sx.h1row}><h1 style={sx.h1}>{d.suc}</h1><span style={{ fontSize: 12, color: T.muted }}>diagnóstico de remodelación</span></div>
        <div style={sx.cards4}>
          <Metric big={`${d.cal}%`} label="Calificación general" sub="estado físico e imagen" accent={cCol} />
          <Metric big={crit} label="Criticidad" sub="prioridad de remodelación" accent={cCol} alert={d.cal < 75} />
          <Metric big={`${(d.cal - prom)}%`} label="Vs promedio de la red" sub={`red ${prom}%`} accent={d.cal >= prom ? T.ok : T.warn} />
          <Metric big={rubros[0].r.split(" ")[0]} label="Rubro más bajo" sub={`${rubros[0].v}%`} accent={T.bad} />
        </div>
        <div style={{ marginTop: 24 }}>
          <div style={sx.sectionTitle}>Calificación por rubro</div>
          <div style={{ display: "grid", gap: 7 }}>
            {rubros.map(({ r, v }) => (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 220, minWidth: 220, fontSize: 12, color: T.inkSoft }}>{r}</div>
                <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 10, overflow: "hidden" }}><div style={{ width: `${v}%`, height: "100%", background: remoCrit(v)[1], borderRadius: 99 }} /></div>
                <div style={{ width: 44, textAlign: "right", fontWeight: 700, fontSize: 12, color: remoCrit(v)[1] }}>{v}%</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 16, fontStyle: "italic" }}>Criticidad: menos de 60% = Crítica · 60-74% = Alta · 75-89% = Media · 90%+ = Baja. Datos de ejemplo del diagnóstico.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Diagnóstico</h1>
        <button className="actbtn" onClick={() => setNuevo(true)} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 16px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(15,110,102,.35)" }}><Ico name="Plus" size={16} color="#fff" />Nuevo diagnóstico</button>
      </div>
      <div style={sx.cards4}>
        <Metric big={String(todos.length)} label="Sucursales diagnosticadas" sub="de la red propia" accent={T.ink} />
        <Metric big={String(criticas)} label="En criticidad Crítica" sub="requieren atención" accent={criticas ? T.crit : T.ok} alert={criticas > 0} />
        <Metric big={`${prom}%`} label="Calificación promedio" sub="estado de la red" accent={remoCrit(prom)[1]} />
        <Metric big={ranked[0].suc.split(" ")[0]} label="Más urgente" sub={`${ranked[0].cal}% · ${remoCrit(ranked[0].cal)[0]}`} accent={T.crit} />
      </div>
      <div style={{ marginTop: 22 }}>
        <div style={sx.sectionTitle}>Prioridad de remodelación (peor evaluadas primero)</div>
        <div style={{ display: "grid", gap: 6 }}>
          {ranked.map((d, i) => { const [crit, cCol] = remoCrit(d.cal); return (
            <button key={d.suc} onClick={() => setSel(d.suc)} className="rowbtn" style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", textAlign: "left", width: "100%", borderLeft: `3px solid ${cCol}` }}>
              <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: T.muted }}>{i + 1}</span>
              <div style={{ width: 170, minWidth: 170, fontWeight: 600, fontSize: 13 }}>{d.suc}</div>
              <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 9, minWidth: 60, overflow: "hidden" }}><div style={{ width: `${d.cal}%`, height: "100%", background: cCol, borderRadius: 99 }} /></div>
              <div style={{ width: 44, textAlign: "right", fontWeight: 700, fontSize: 13, color: cCol }}>{d.cal}%</div>
              <span style={{ width: 66, textAlign: "center", fontSize: 10, fontWeight: 700, color: "#fff", background: cCol, padding: "3px 6px", borderRadius: 99 }}>{crit}</span>
            </button>
          ); })}
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>Toca una sucursal para ver su diagnóstico por rubro. La criticidad prioriza qué sucursal se remodela primero.</div>
    </div>
  );
}

function RemoNuevoDiag({ onCancel, onGuardar }) {
  const [suc, setSuc] = useState(SUCURSALES[0]);
  const [vals, setVals] = useState(REMO_RUBROS.map(() => 3));
  const escala = [["1", "Muy malo", 20], ["2", "Malo", 45], ["3", "Regular", 65], ["4", "Bueno", 85], ["5", "Excelente", 100]];
  const pctDe = (n) => escala.find((e) => Number(e[0]) === n)[2];
  const cal = Math.round(vals.reduce((a, n) => a + pctDe(n), 0) / vals.length);
  const [crit, cCol] = remoCrit(cal);
  const set = (i, n) => setVals((p) => p.map((x, j) => (j === i ? n : x)));
  const guardar = () => onGuardar({ suc, cal, vals: vals.map(pctDe) });

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Nuevo diagnóstico</h1><span style={{ fontSize: 12, color: T.muted }}>auditoría de remodelación</span></div>
      <div style={{ ...sx.repCard, marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
        <TField label="Sucursal"><select className="sel" value={suc} onChange={(e) => setSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12.5, minWidth: 200 }}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select></TField>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10.5, color: T.muted }}>Calificación / criticidad</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
            <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 24, color: cCol }}>{cal}%</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: cCol, padding: "3px 10px", borderRadius: 99 }}>{crit}</span>
          </div>
        </div>
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 4, padding: 0, overflow: "hidden" }}>
        {REMO_RUBROS.map((r, i) => (
          <div key={r} style={{ padding: "10px 14px", borderBottom: i < REMO_RUBROS.length - 1 ? `1px solid ${T.lineSoft}` : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, flex: 1, minWidth: 160 }}><strong style={{ color: T.muted, fontWeight: 600 }}>{i + 1}.</strong> {r}</span>
            <div style={{ display: "flex", gap: 5 }}>
              {escala.map(([n, lbl, p]) => (
                <button key={n} onClick={() => set(i, Number(n))} title={lbl} style={{ fontSize: 11, fontWeight: 700, width: 30, height: 30, borderRadius: 7, cursor: "pointer", fontFamily: "inherit", background: vals[i] === Number(n) ? remoCrit(p)[1] : "#fff", color: vals[i] === Number(n) ? "#fff" : T.muted, border: `1px solid ${vals[i] === Number(n) ? remoCrit(p)[1] : T.line}` }}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>Escala: 1 Muy malo · 2 Malo · 3 Regular · 4 Bueno · 5 Excelente. La criticidad se calcula automáticamente.</div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="actbtn" onClick={onCancel} style={{ ...sx.actbtn, fontSize: 12, padding: "9px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
        <button className="actbtn" onClick={guardar} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 20px", background: T.ink, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Check" size={15} color="#fff" />Guardar diagnóstico</button>
      </div>
    </div>
  );
}

function RemoAvance() {
  const hoy = "2026-07-20";
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Avance de obra</h1><span style={{ fontSize: 12, color: T.muted }}>proyectos en curso</span></div>
      <div style={sx.cards4}>
        <Metric big={String(REMO_PROY.length)} label="Proyectos en curso" sub="remodelaciones activas" accent={T.brand} />
        <Metric big={`${Math.round(REMO_PROY.reduce((a, p) => a + (p.etapa / (REMO_ETAPAS.length - 1)) * 100, 0) / REMO_PROY.length)}%`} label="Avance promedio" sub="de las obras" accent={T.ink} />
        <Metric big={money(REMO_PROY.reduce((a, p) => a + p.presu, 0))} label="Presupuesto total" sub="aprobado" accent={T.inkSoft} />
        <Metric big={money(REMO_PROY.reduce((a, p) => a + p.ejercido, 0))} label="Ejercido" sub="a la fecha" accent={T.inkSoft} />
      </div>
      <div style={{ marginTop: 22, display: "grid", gap: 12 }}>
        {REMO_PROY.map((p) => {
          const pct = Math.round((p.etapa / (REMO_ETAPAS.length - 1)) * 100);
          const gasto = Math.round((p.ejercido / p.presu) * 100);
          const atraso = p.fin < hoy;
          return (
            <div key={p.suc} style={{ ...sx.repCard }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{p.suc}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Resp: {p.resp} · {fechaTexto(p.ini)} → {fechaTexto(p.fin)}{atraso ? " · atrasada" : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: T.brand }}>{pct}%</div>
                  <div style={{ fontSize: 10.5, color: gasto > pct + 10 ? T.bad : T.muted }}>{money(p.ejercido)} / {money(p.presu)} ({gasto}%)</div>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start" }}>
                {REMO_ETAPAS.map((e, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minWidth: 0 }}>
                    {i < REMO_ETAPAS.length - 1 && <div style={{ position: "absolute", top: 9, left: "50%", width: "100%", height: 3, background: i < p.etapa ? T.brand : T.line }} />}
                    <div style={{ zIndex: 1, width: 20, height: 20, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: i < p.etapa ? T.brand : "#fff", border: i === p.etapa ? `3px solid ${T.brand}` : `2px solid ${i < p.etapa ? T.brand : T.line}` }}>
                      {i < p.etapa ? <Ico name="Check" size={11} color="#fff" /> : i === p.etapa ? <span style={{ width: 7, height: 7, borderRadius: 99, background: T.brand }} /> : null}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: i === p.etapa ? 700 : 500, color: i < p.etapa ? T.brand : i === p.etapa ? T.ink : T.muted, marginTop: 5, textAlign: "center", lineHeight: 1.15 }}>{e}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>Proyectos de ejemplo. El avance por etapas y el gasto vs presupuesto se alimentan del seguimiento de obra.</div>
    </div>
  );
}

function DeptoPlaceholder({ depto }) {
  if (!depto) return null;
  return (
    <div style={{ ...sx.main, width: "100%" }}>
      <div style={{ textAlign: "center", padding: "56px 20px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", color: T.brand }}><Ico name={depto.iconName} size={46} strokeWidth={1.6} /></div>
        <h1 style={{ ...sx.h1, fontSize: 24, marginTop: 12 }}>{depto.nombre}</h1>
        <p style={{ fontSize: 13.5, color: T.inkSoft, maxWidth: 440, margin: "12px auto 0", lineHeight: 1.55 }}>
          Este departamento es parte de la visión completa de la plataforma. Por ahora el módulo desarrollado es <strong>Mantenimiento</strong>; los demás se irán construyendo cada uno como su propio sistema.
        </p>
        <span style={{ display: "inline-block", marginTop: 16, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, background: T.lineSoft, padding: "5px 12px", borderRadius: 99 }}>
          Próximamente
        </span>
      </div>
    </div>
  );
}

/* ícono de línea (lucide) con respaldo si no existe el nombre */
function Ico({ name, size = 18, color, strokeWidth = 2 }) {
  const C = Icons[name] || Icons.Circle;
  return <C size={size} color={color} strokeWidth={strokeWidth} />;
}

/* ================================================================
   AUDITORÍA INTERNA
   Recepción de cortes → Conteo de cortes → Entrega de efectivo.
   Cada panel de captura termina en una revisión de solo lectura
   antes de "Finalizar" (mismo patrón que Inventarios).
   ================================================================ */

const AI_DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 1];
/* Denominaciones completas del conteo físico: billetes, monedas y centavos.
   Los importes se calculan en centavos enteros para que los decimales no
   arrastren errores de redondeo al sumar. */
const AI_DENOM_CONTEO = [1000, 500, 200, 100, 50, 20];
const AI_MONEDAS_KEY = "monedas";
const aiHoyISO = () => new Date().toISOString().slice(0, 10);
const aiCent = (n) => Math.round((Number(n) || 0) * 100);
const aiTotalTabla = (cant, denoms) => (denoms || AI_DENOMINACIONES).reduce((s, d) => s + (Number(cant[d]) || 0) * aiCent(d), 0) / 100;
const aiMoney = (n) => { const v = Number(n) || 0; return (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
const aiEtiquetaDenom = (d) => (d < 1 ? `${Math.round(d * 100)}¢` : `$${d}`);
const aiGrupoDenom = (d) => (d < 1 ? "Centavos" : d <= 10 ? "Monedas" : "Billetes");
/* Total del conteo: los billetes se cuentan por pieza y las monedas van como
   un solo importe general. Todo se suma en centavos enteros. */
const aiTotalConteo = (c) => { const cant = c || {}; return (AI_DENOM_CONTEO.reduce((s, d) => s + (Number(cant[d]) || 0) * aiCent(d), 0) + aiCent(cant[AI_MONEDAS_KEY])) / 100; };
const aiDiasDesde = (iso) => { if (!iso) return 0; const a = new Date(`${iso}T00:00:00`), b = new Date(`${aiHoyISO()}T00:00:00`); return Math.max(0, Math.round((b - a) / 86400000)); };
const aiColorEspera = (d) => (d >= 7 ? T.bad : d >= 3 ? T.warn : T.muted);
const aiOrdenCorte = (f) => { const [dd = "", mm = "", aa = ""] = (f || "").split("/"); return `${aa}${mm}${dd}`; };
const aiTablaVacia = (cant) => !Object.values(cant || {}).some((v) => v !== "" && v != null && Number(v) > 0);

/* Fecha en formato DD/MM/AA (año de 2 dígitos, ej. "24/07/26") para el corte de sucursal */
const aiFechaCompleta = (f) => { if (!f) return false; const partes = f.split("/"); return partes.length === 3 && partes.every((x) => x && x.length === 2); };
const aiSumarDiaDDMMAA = (f) => {
  const [dd, mm, aa] = (f || "").split("/").map((x) => parseInt(x, 10));
  if (!dd || !mm || isNaN(aa)) return "";
  const d = new Date(2000 + aa, mm - 1, dd);
  d.setDate(d.getDate() + 1);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear() % 100).padStart(2, "0")}`;
};

/* Tabla Denominación / Cantidad / Importe — la misma lógica de la hoja física de conteo.
   Con `denoms` se le pasa una lista distinta (el conteo usa billetes + monedas + centavos)
   y con `agrupado` se separan visualmente los tres bloques. */
function AITablaDenominaciones({ cantidades, onChange, soloLectura, denoms, agrupado, conMonedas }) {
  const lista = denoms || AI_DENOMINACIONES;
  const monedas = cantidades[AI_MONEDAS_KEY] === undefined || cantidades[AI_MONEDAS_KEY] === null ? "" : cantidades[AI_MONEDAS_KEY];
  const total = conMonedas ? aiTotalConteo(cantidades) : aiTotalTabla(cantidades, lista);
  let grupoPrevio = null;
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 10, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: T.paper }}>
            <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700, color: T.inkSoft }}>Denominación</th>
            <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: T.inkSoft }}>Cantidad</th>
            <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: T.inkSoft }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((d) => {
            const c = cantidades[d] === undefined || cantidades[d] === null ? "" : cantidades[d];
            const importe = ((Number(c) || 0) * aiCent(d)) / 100;
            const g = aiGrupoDenom(d);
            const encabezado = agrupado && g !== grupoPrevio;
            if (encabezado) grupoPrevio = g;
            return (
              <Fragment key={d}>
                {encabezado && (
                  <tr>
                    <td colSpan={3} style={{ padding: "5px 12px", background: T.lineSoft, fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "6px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{aiEtiquetaDenom(d)}</td>
                  <td style={{ padding: "4px 8px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}>
                    {soloLectura ? <span>{c === "" ? "—" : c}</span> : (
                      <input data-nav type="number" min="0" value={c} onChange={(e) => onChange(d, e.target.value.replace(/-/g, ""))} onWheel={(e) => e.currentTarget.blur()} placeholder="0" className="sel" style={{ ...sx.sel, fontSize: 12.5, width: 72, textAlign: "right", padding: "5px 8px", marginLeft: "auto" }} />
                    )}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{importe ? aiMoney(importe) : "$ -"}</td>
                </tr>
              </Fragment>
            );
          })}
          {conMonedas && (
            <Fragment>
              <tr>
                <td colSpan={3} style={{ padding: "5px 12px", background: T.lineSoft, fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Monedas</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>Monedas <span style={{ color: T.muted, fontSize: 11 }}>· total en pesos</span></td>
                <td style={{ padding: "4px 8px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}>
                  {soloLectura ? <span>{monedas === "" ? "—" : aiMoney(monedas)}</span> : (
                    <input data-nav type="number" min="0" step="0.01" value={monedas} onChange={(e) => onChange(AI_MONEDAS_KEY, e.target.value.replace(/-/g, ""))} onWheel={(e) => e.currentTarget.blur()} placeholder="0.00" className="sel" style={{ ...sx.sel, fontSize: 12.5, width: 96, textAlign: "right", padding: "5px 8px", marginLeft: "auto" }} />
                  )}
                </td>
                <td style={{ padding: "6px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{monedas === "" || !Number(monedas) ? "$ -" : aiMoney(monedas)}</td>
              </tr>
            </Fragment>
          )}
          <tr>
            <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontStyle: "italic", color: T.muted }}>Total</td>
            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{aiMoney(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const AI_PANELES_CAPTURA = [
  { key: "recepcion", nombre: "Recepción de Cortes", icon: "Inbox", activo: true, desc: "Cortes recibidos de sucursal" },
  { key: "conteo", nombre: "Conteo de Cortes", icon: "Banknote", activo: true, desc: "Conteo físico, billete por billete" },
  { key: "salidas", nombre: "Entrega de Efectivo", icon: "HandCoins", activo: true, desc: "Salidas de efectivo (contadora y generales)" },
  { key: "panel4", nombre: "Próximamente", icon: "CircleDashed", activo: false, desc: "Se definirá más adelante" },
];
const AI_PANELES_VISUAL = [
  { key: "v1", nombre: "Historial cortes", icon: "CalendarClock", activo: true, desc: "Recibidos y por recibir" },
  { key: "v3", nombre: "Saldo de Efectivo", icon: "Wallet", activo: true, desc: "Contado, entregado y disponible" },
];
const AI_PANELES_CONFIG = [
  { key: "config", nombre: "Configuración", icon: "Settings", activo: true, desc: "Preferencias del auditor" },
];

function AIHome({ onEnter }) {
  const tag = { display: "inline-block", marginTop: 8, fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 9px", borderRadius: 99 };
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Auditoría Interna</h1><span style={{ fontSize: 12, color: T.muted }}>control de efectivo, cortes y conciliaciones</span></div>

      <div style={sx.sectionTitle}>Captura</div>
      <div style={{ ...sx.cards4, marginBottom: 30 }}>
        {AI_PANELES_CAPTURA.map((p) => (
          <button key={p.key} disabled={!p.activo} onClick={() => p.activo && onEnter(p.key)} className={p.activo ? "rowbtn" : ""} style={{ ...sx.deptoCard, cursor: p.activo ? "pointer" : "default", opacity: p.activo ? 1 : 0.55 }}>
            <Ico name={p.icon} size={30} strokeWidth={1.6} color={p.activo ? T.brand : T.muted} />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>{p.nombre}</div>
            {p.desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{p.desc}</div>}
            {!p.activo && <span style={tag}>Próximamente</span>}
          </button>
        ))}
      </div>

      <div style={sx.sectionTitle}>Visualización · cierres de semana y de mes</div>
      <div style={{ ...sx.cards4, marginBottom: 30 }}>
        {AI_PANELES_VISUAL.map((p) => (
          <button key={p.key} disabled={!p.activo} onClick={() => p.activo && onEnter(p.key)} className={p.activo ? "rowbtn" : ""} style={{ ...sx.deptoCard, cursor: p.activo ? "pointer" : "default", opacity: p.activo ? 1 : 0.55 }}>
            <Ico name={p.icon} size={30} strokeWidth={1.6} color={p.activo ? T.brand : T.muted} />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>{p.nombre}</div>
            {p.desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{p.desc}</div>}
            {!p.activo && <span style={tag}>Próximamente</span>}
          </button>
        ))}
      </div>

      <div style={sx.sectionTitle}>Configuración</div>
      <div style={sx.cards4}>
        {AI_PANELES_CONFIG.map((p) => (
          <button key={p.key} onClick={() => onEnter(p.key)} className="rowbtn" style={{ ...sx.deptoCard, cursor: "pointer" }}>
            <Ico name={p.icon} size={30} strokeWidth={1.6} color={T.brand} />
            <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 10 }}>{p.nombre}</div>
            {p.desc && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{p.desc}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---- Filtro por mes/año + exportar (imprimir / PDF / Excel), compartido por las
   tres pantallas principales de Auditoría Interna y por sus pantallas de "Ver". ---- */
const aiAniosDe = (items) => [...new Set(items.map((it) => Number(it.fecha.slice(0, 4))))].sort((a, b) => b - a);
const aiFiltrarMesAnio = (items, mes, anio) => items.filter((it) => {
  const [y, m] = it.fecha.split("-").map(Number);
  return (anio === "todos" || y === Number(anio)) && (mes === "todos" || m === Number(mes));
});

/* ===== Exportación compartida por TODA la plataforma =====
   Nombre de archivo corto (2-3 palabras) que identifica lo que se descarga, y un
   encabezado con el logo de Frutal + el título, centrado, tanto en Imprimir como en PDF. */
function aiSlugArchivo(titulo) {
  return (titulo || "archivo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim().replace(/\s+/g, "-").toLowerCase();
}
function imprimirConTitulo(titulo) {
  const anterior = document.title;
  document.title = titulo;
  window.print();
  setTimeout(() => { document.title = anterior; }, 300);
}
function exportarExcelConTitulo(titulo, columnas, filas) {
  const ws = XLSX.utils.json_to_sheet(filas.map((f) => Object.fromEntries(columnas.map((c) => [c.titulo, c.valor(f)]))));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Datos");
  XLSX.writeFile(wb, `${aiSlugArchivo(titulo)}.xlsx`);
}
function exportarPdfConTitulo(titulo, columnas, filas) {
  const cargarJsPDF = () => new Promise((resolve, reject) => {
    if (window.jspdf) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el generador de PDF"));
    document.body.appendChild(s);
  });
  return cargarJsPDF().then(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoW = 28, logoH = logoW / 1.575;
    doc.addImage(LOGO, "PNG", (pageWidth - logoW) / 2, 10, logoW, logoH);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(titulo, pageWidth / 2, 10 + logoH + 8, { align: "center" });
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    let y = 10 + logoH + 14;
    const encabezado = columnas.map((c) => c.titulo).join("   ·   ");
    doc.text(encabezado, pageWidth / 2, y, { align: "center" });
    doc.setTextColor(20);
    y += 8;
    filas.forEach((f) => {
      if (y > 280) { doc.addPage(); y = 16; }
      const linea = columnas.map((c) => String(c.valor(f))).join("   ·   ");
      doc.text(linea, pageWidth / 2, y, { align: "center" });
      y += 6;
    });
    doc.save(`${aiSlugArchivo(titulo)}.pdf`);
  });
}
/* Encabezado con logo + título, oculto en pantalla y visible solo al imprimir
   (ver reglas .print-header en CSS, hasta abajo del archivo). */
function PrintHeader({ titulo }) {
  return (
    <div className="print-header">
      <img src={LOGO} alt="Frutal Yogurt" />
      <div className="print-header-title">{titulo}</div>
    </div>
  );
}

function AIExportMenu({ titulo, columnas, filas }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const imprimir = () => { setAbierto(false); imprimirConTitulo(titulo); };
  const exportarExcel = () => { setAbierto(false); exportarExcelConTitulo(titulo, columnas, filas); };
  const exportarPdf = () => { setAbierto(false); exportarPdfConTitulo(titulo, columnas, filas); };

  /* El PrintHeader NO se pone aquí adentro: este menú vive dentro de una barra
     "noprint", y anidarlo ahí lo ocultaría también al imprimir. Cada pantalla que
     usa este menú pone su propio <PrintHeader titulo=".../> fuera de esa barra. */
  return (
    <div ref={ref} style={{ position: "relative" }} className="noprint">
      <button onClick={() => setAbierto((a) => !a)} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Ico name="Download" size={14} color={T.ink} />Exportar<Ico name="ChevronDown" size={13} color={T.muted} />
      </button>
      {abierto && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", zIndex: 50, minWidth: 160 }}>
          <button onClick={imprimir} className="rowbtn" style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Ico name="Printer" size={14} color={T.inkSoft} />Imprimir</button>
          <button onClick={exportarPdf} className="rowbtn" style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Ico name="FileText" size={14} color={T.inkSoft} />PDF</button>
          <button onClick={exportarExcel} className="rowbtn" style={{ width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Ico name="Sheet" size={14} color={T.inkSoft} />Excel</button>
        </div>
      )}
    </div>
  );
}

/* Barra de filtro (mes/año) + botón Exportar, para las pantallas de lista. */
function AIListToolbar({ items, mes, setMes, anio, setAnio, titulo, columnas, filasExport }) {
  const anios = aiAniosDe(items);
  return (
    <>
      <PrintHeader titulo={titulo} />
      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={mes} onChange={(e) => setMes(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto" }}>
            <option value="todos">Todos los meses</option>
            {MESES_TXT.map((m, i) => <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
          <select value={anio} onChange={(e) => setAnio(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto" }}>
            <option value="todos">Todos los años</option>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <AIExportMenu titulo={titulo} columnas={columnas} filas={filasExport} />
      </div>
    </>
  );
}

/* Botón "+ Nuevo/a ..." compartido por Recepción, Conteo y Entrega: si ya hay uno
   en proceso se bloquea y se explica por qué, en vez de dejar arrancar otro. */
function AIBotonNuevo({ label, enProceso, mensaje, onClick }) {
  if (enProceso) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: T.warn, background: T.warnSoft, padding: "5px 10px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="TriangleAlert" size={13} color={T.warn} />{mensaje}</span>
        <button disabled title={mensaje} className="actbtn" style={{ ...sx.actbtn, background: T.line, color: T.muted, cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Plus" size={15} color={T.muted} />{label}</button>
      </div>
    );
  }
  return <button onClick={onClick} className="actbtn" style={{ ...sx.actbtn, background: T.brand, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Plus" size={15} color="#fff" />{label}</button>;
}

/* ---- Panel 1: Recepción de Cortes ---- */
/* Select de nombre con menú de tres puntos (al pasar el mouse) para agregar o eliminar
   opciones de la lista, sin salir del campo. */
function AISelectorNombre({ label, valor, onChange, opciones, onAgregar, onEliminar, placeholder }) {
  const [hover, setHover] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const contenedorRef = useRef(null);

  // El menú se cierra al hacer clic fuera del contenedor, no al perder el hover
  // (si no, era imposible mover el mouse del botón hacia las opciones).
  useEffect(() => {
    if (!menuAbierto) return;
    const alClicAfuera = (e) => { if (contenedorRef.current && !contenedorRef.current.contains(e.target)) { setMenuAbierto(false); setAgregando(false); } };
    document.addEventListener("mousedown", alClicAfuera);
    return () => document.removeEventListener("mousedown", alClicAfuera);
  }, [menuAbierto]);

  const confirmarAgregar = () => {
    const n = nuevoNombre.trim();
    if (n) { onAgregar(n); onChange(n); }
    setNuevoNombre("");
    setAgregando(false);
    setMenuAbierto(false);
  };
  const eliminarActual = () => {
    if (valor) onEliminar(valor);
    setMenuAbierto(false);
  };

  return (
    <TField label={label}>
      <div ref={contenedorRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 2 }} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
        <select value={valor} onChange={(e) => onChange(e.target.value)} className="sel" style={{ ...sx.sel, flex: 1, minWidth: 0 }}>
          <option value="" disabled>{placeholder}</option>
          {opciones.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuAbierto((m) => !m); setAgregando(false); }}
          title="Más opciones"
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "2px 3px", lineHeight: 0, opacity: hover || menuAbierto ? 1 : 0, pointerEvents: hover || menuAbierto ? "auto" : "none", transition: "opacity .12s" }}
        >
          <Ico name="MoreVertical" size={15} color={T.muted} />
        </button>
        {menuAbierto && (
          <div style={{ position: "absolute", right: 0, top: "100%", marginTop: 4, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.14)", zIndex: 30, minWidth: 190, overflow: "hidden" }}>
            {!agregando ? (
              <>
                <button onClick={() => setAgregando(true)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 12.5 }}>
                  <Ico name="UserPlus" size={14} color={T.brand} />Agregar nombre
                </button>
                <button onClick={eliminarActual} disabled={!valor} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "9px 12px", background: "none", border: "none", borderTop: `1px solid ${T.lineSoft}`, textAlign: "left", cursor: valor ? "pointer" : "not-allowed", fontSize: 12.5, color: valor ? T.bad : T.muted }}>
                  <Ico name="UserMinus" size={14} color={valor ? T.bad : T.muted} />Eliminar {valor ? `"${valor}"` : ""}
                </button>
              </>
            ) : (
              <div style={{ padding: 10, display: "grid", gap: 6 }}>
                <input autoFocus value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirmarAgregar(); }} placeholder="Nombre nuevo" className="sel" style={{ ...sx.sel, fontSize: 12.5, padding: "6px 8px" }} />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button onClick={() => { setAgregando(false); setNuevoNombre(""); }} style={{ fontSize: 11.5, padding: "4px 10px", border: `1px solid ${T.line}`, borderRadius: 6, background: "#fff", cursor: "pointer" }}>Cancelar</button>
                  <button onClick={confirmarAgregar} style={{ fontSize: 11.5, padding: "4px 10px", border: "none", borderRadius: 6, background: T.brand, color: "#fff", cursor: "pointer" }}>Agregar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </TField>
  );
}

function AIRecepcionForm({ onGuardar, onGuardarDirecto, onCancelar, inicial, bloquearFecha, tituloForm, recibidosOtros, nombresEntrega, onAgregarEntrega, onEliminarEntrega, nombresRecibe, onAgregarRecibe, onEliminarRecibe, sucursales }) {
  const [fecha, setFecha] = useState(inicial ? inicial.fecha : aiHoyISO());
  const [entrega, setEntrega] = useState(inicial ? inicial.entrega : "");
  const [recibe, setRecibe] = useState(inicial ? inicial.recibe : "");
  const [observaciones, setObservaciones] = useState(inicial ? inicial.observaciones : "");
  const [cortes, setCortes] = useState(inicial ? inicial.cortes : [{ sucursal: sucursales[0] || "", fecha: "" }]);
  const [confEntrega, setConfEntrega] = useState(inicial ? inicial.confEntrega : false);
  const [confRecibe, setConfRecibe] = useState(inicial ? inicial.confRecibe : false);
  const fieldRefs = useRef([]);
  const enfocarPendiente = useRef(null);

  const setCorte = (i, campo, v) => setCortes((p) => p.map((c, idx) => (idx === i ? { ...c, [campo]: v } : c)));
  const addCorte = () => setCortes((p) => {
    const ultimo = p[p.length - 1];
    const sucursalSugerida = ultimo ? ultimo.sucursal : (sucursales[0] || "");
    const fechaSugerida = ultimo && aiFechaCompleta(ultimo.fecha) ? aiSumarDiaDDMMAA(ultimo.fecha) : "";
    return [...p, { sucursal: sucursalSugerida, fecha: fechaSugerida }];
  });
  const quitarCorte = (i) => setCortes((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const agregarCorteYEnfocar = () => { enfocarPendiente.current = { fila: cortes.length, tipo: "sucursal" }; addCorte(); };
  const quitarCorteYEnfocar = (i, tipo) => { if (cortes.length > 1) enfocarPendiente.current = { fila: Math.max(i - 1, 0), tipo }; quitarCorte(i); };

  // Enter avanza al siguiente campo; "+" agrega otro corte (y enfoca el nuevo); "-" quita
  // el corte actual —solo si hay más de uno— y regresa el cursor al corte anterior.
  const manejarTeclaCorte = (e, i, tipo) => {
    const idx = Number(e.currentTarget.dataset.idx);
    if (e.key === "Enter") { e.preventDefault(); const sig = fieldRefs.current[idx + 1]; if (sig) sig.focus(); }
    else if (e.key === "+") { e.preventDefault(); agregarCorteYEnfocar(); }
    else if (e.key === "-") { e.preventDefault(); quitarCorteYEnfocar(i, tipo); }
  };

  useEffect(() => {
    if (enfocarPendiente.current) {
      const { fila, tipo } = enfocarPendiente.current;
      enfocarPendiente.current = null;
      const el = document.querySelector(`[data-campo="corte__${fila}__${tipo}"]`);
      if (el) el.focus();
    }
  });

  // Detecta si ese mismo corte (sucursal + fecha) ya se había recibido antes, en esta
  // misma tanda o en otra recepción distinta. Mientras haya uno repetido, Guardar y
  // Siguiente quedan bloqueados hasta que se corrija o se quite ese renglón.
  const yaRecibido = (i, c) => {
    if (!c.sucursal || !aiFechaCompleta(c.fecha)) return false;
    if ((recibidosOtros || []).some((r) => r.sucursal === c.sucursal && r.fecha === c.fecha)) return true;
    return cortes.some((o, j) => j !== i && o.sucursal === c.sucursal && o.fecha === c.fecha);
  };
  const hayDuplicado = cortes.some((c, i) => yaRecibido(i, c));

  const ok = fecha && entrega.trim() && recibe.trim() && cortes.every((c) => c.sucursal && aiFechaCompleta(c.fecha)) && confEntrega && confRecibe && !hayDuplicado;
  const construirDatos = () => ({ fecha, entrega, recibe, observaciones, cortes, confEntrega, confRecibe });
  const irSiguiente = () => { if (ok) onGuardar(construirDatos()); };
  const guardarYSalir = () => { if (ok) onGuardarDirecto(construirDatos()); };

  fieldRefs.current = [];
  let campoIdx = 0;
  return (
    <div style={{ ...sx.repCard, display: "grid", gap: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{tituloForm || "Nueva recepción de cortes"}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <TField label="Fecha de recepción">{bloquearFecha ? <div style={{ ...sx.sel, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{fecha}</div> : <input type="date" value={fecha} max={aiHoyISO()} onChange={(e) => setFecha(e.target.value)} className="sel" style={sx.sel} />}</TField>
        <AISelectorNombre label="Quién entrega" valor={entrega} onChange={setEntrega} opciones={nombresEntrega} onAgregar={onAgregarEntrega} onEliminar={(n) => { onEliminarEntrega(n); if (entrega === n) setEntrega(""); }} placeholder="Selecciona quién entrega" />
        <AISelectorNombre label="Quién recibe" valor={recibe} onChange={setRecibe} opciones={nombresRecibe} onAgregar={onAgregarRecibe} onEliminar={(n) => { onEliminarRecibe(n); if (recibe === n) setRecibe(""); }} placeholder="Selecciona quién recibe" />
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, marginBottom: 8 }}>Cortes que se están entregando</div>
        <div style={{ display: "grid", gap: 8 }}>
          {cortes.map((c, i) => {
            const idxSuc = campoIdx++;
            const idxDD = campoIdx++;
            const idxMM = campoIdx++;
            const idxAA = campoIdx++;
            const [dd = "", mm = "", aa = ""] = (c.fecha || "").split("/");
            const setParte = (parte, val) => {
              const limpio = val.replace(/\D/g, "").slice(0, 2);
              const actual = { dd, mm, aa, [parte]: limpio };
              setCorte(i, "fecha", `${actual.dd}/${actual.mm}/${actual.aa}`);
              return limpio;
            };
            const cajaFecha = { ...sx.sel, width: 40, textAlign: "center", padding: "8px 2px" };
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                <select data-idx={idxSuc} data-campo={`corte__${i}__sucursal`} ref={(el) => (fieldRefs.current[idxSuc] = el)} value={c.sucursal} onChange={(e) => setCorte(i, "sucursal", e.target.value)} onKeyDown={(e) => manejarTeclaCorte(e, i, "sucursal")} className="sel" style={{ ...sx.sel, width: "auto", flex: "1 1 200px" }}>
                  {sucursales.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <TField label="Fecha del corte">
                  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                    <input data-idx={idxDD} data-campo={`corte__${i}__dd`} ref={(el) => (fieldRefs.current[idxDD] = el)} type="text" inputMode="numeric" value={dd} onChange={(e) => { const v = setParte("dd", e.target.value); if (v.length === 2) { const sig = fieldRefs.current[idxMM]; if (sig) sig.focus(); } }} onKeyDown={(e) => manejarTeclaCorte(e, i, "dd")} placeholder="DD" className="sel" style={cajaFecha} />
                    <span style={{ color: T.muted }}>/</span>
                    <input data-idx={idxMM} data-campo={`corte__${i}__mm`} ref={(el) => (fieldRefs.current[idxMM] = el)} type="text" inputMode="numeric" value={mm} onChange={(e) => { const v = setParte("mm", e.target.value); if (v.length === 2) { const sig = fieldRefs.current[idxAA]; if (sig) sig.focus(); } }} onKeyDown={(e) => manejarTeclaCorte(e, i, "mm")} placeholder="MM" className="sel" style={cajaFecha} />
                    <span style={{ color: T.muted }}>/</span>
                    <input data-idx={idxAA} data-campo={`corte__${i}__aa`} ref={(el) => (fieldRefs.current[idxAA] = el)} type="text" inputMode="numeric" value={aa} onChange={(e) => setParte("aa", e.target.value)} onKeyDown={(e) => manejarTeclaCorte(e, i, "aa")} placeholder="AA" className="sel" style={cajaFecha} />
                  </div>
                </TField>
                {cortes.length > 1 && <button onClick={() => quitarCorteYEnfocar(i, "sucursal")} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", alignSelf: "flex-end", marginBottom: 6 }}><Ico name="X" size={16} color={T.bad} /></button>}
                {yaRecibido(i, c) && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, color: T.warn, background: T.warnSoft, alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 5 }}><Ico name="TriangleAlert" size={12} color={T.warn} />Este corte ya está recibido</span>}
              </div>
            );
          })}
        </div>
        <button onClick={agregarCorteYEnfocar} className="actbtn" style={{ ...sx.actbtn, marginTop: 10, fontSize: 11.5, padding: "6px 12px", background: "#fff", color: T.brand, border: `1px solid ${T.brand}` }}>+ Agregar otro corte</button>
      </div>

      <TField label="Observaciones (opcional)"><textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej. sobre dañado, abierto, cinta rota..." rows={2} className="sel" style={{ ...sx.sel, resize: "vertical" }} /></TField>

      <div style={{ background: T.paper, borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Confirmación de recepción (sustituye la firma en papel)</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={confEntrega} onChange={(e) => setConfEntrega(e.target.checked)} />
          {entrega ? `${entrega} confirma que hizo la entrega` : "Quien entrega confirma la entrega"}
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={confRecibe} onChange={(e) => setConfRecibe(e.target.checked)} />
          {recibe ? `${recibe} confirma que recibió los cortes` : "Quien recibe confirma la recepción"}
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCancelar} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
        <button onClick={guardarYSalir} disabled={!ok} title={hayDuplicado ? "Hay un corte duplicado — corrígelo o quítalo antes de guardar" : "Guarda lo capturado y regresa a la lista, por si más tarde llegan más cortes de este mismo día"} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: ok ? T.brand : T.muted, border: `1px solid ${ok ? T.brand : T.line}`, cursor: ok ? "pointer" : "not-allowed" }}>Guardar</button>
        <button onClick={irSiguiente} disabled={!ok} title={hayDuplicado ? "Hay un corte duplicado — corrígelo o quítalo antes de continuar" : ""} className="actbtn" style={{ ...sx.actbtn, background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Siguiente</button>
      </div>
    </div>
  );
}

function AIRecepcionRevision({ datos, onAtras, onFinalizar, soloLectura, onCerrar }) {
  return (
    <div style={{ ...sx.repCard, display: "grid", gap: 16 }}>
      {soloLectura && <PrintHeader titulo="Detalle Recepción" />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{soloLectura ? "Detalle de la recepción" : "Revisión de la recepción"}</div>
        {soloLectura && <AIExportMenu titulo="Detalle Recepción" columnas={[{ titulo: "Sucursal", valor: (c) => c.sucursal }, { titulo: "Fecha del corte", valor: (c) => c.fecha }]} filas={datos.cortes} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha de recepción</div><strong>{datos.fecha}</strong></div>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Entrega</div><strong>{datos.entrega}</strong></div>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Recibe</div><strong>{datos.recibe}</strong></div>
      </div>
      {datos.observaciones && <div style={{ fontSize: 12.5, background: T.paper, borderRadius: 8, padding: "8px 12px" }}><span style={{ color: T.muted }}>Observaciones: </span>{datos.observaciones}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead><tr style={{ background: T.paper }}><th style={{ padding: "7px 12px", textAlign: "left" }}>Sucursal</th><th style={{ padding: "7px 12px", textAlign: "left" }}>Fecha del corte</th></tr></thead>
        <tbody>{datos.cortes.map((c, i) => (<tr key={i}><td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{c.sucursal}</td><td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{c.fecha}</td></tr>))}</tbody>
      </table>
      <div style={{ fontSize: 11.5, color: T.ok, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>✓ Confirmado por {datos.entrega}</span>
        <span>✓ Confirmado por {datos.recibe}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {soloLectura ? (
          <button onClick={onCerrar} className="actbtn" style={{ ...sx.actbtn, background: T.ink, color: "#fff" }}>Cerrar</button>
        ) : (
          <>
            <button onClick={onAtras} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>‹ Atrás</button>
            <button onClick={onFinalizar} className="actbtn" style={{ ...sx.actbtn, background: T.ink, color: "#fff" }}>Finalizar</button>
          </>
        )}
      </div>
    </div>
  );
}

function AIModalPassword({ onConfirmar, onCancelar }) {
  const [valor, setValor] = useState("");
  const [error, setError] = useState(false);
  const intentar = () => {
    if (valor === "9191") onConfirmar();
    else { setError(true); setValor(""); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onCancelar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 300, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.25)", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: T.brandSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="Lock" size={16} color={T.brand} /></div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Contraseña requerida</div>
        </div>
        <div style={{ fontSize: 12.5, color: T.muted }}>Para editar una recepción ya capturada, ingresa la contraseña.</div>
        <input autoFocus type="password" value={valor} onChange={(e) => { setValor(e.target.value); setError(false); }} onKeyDown={(e) => { if (e.key === "Enter") intentar(); }} className="sel" style={sx.sel} placeholder="Contraseña" />
        {error && <div style={{ fontSize: 11.5, color: T.bad }}>Contraseña incorrecta.</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onCancelar} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
          <button onClick={intentar} className="actbtn" style={{ ...sx.actbtn, background: T.brand, color: "#fff" }}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Seguimiento de la recepción: qué tan al día va cada sucursal ---- */
const aiCorteISO = (f) => { if (!aiFechaCompleta(f)) return null; const [dd, mm, aa] = f.split("/"); return `20${aa}-${mm}-${dd}`; };
const aiFmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const aiSumaISO = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return aiFmtISO(d); };
const aiDiffISO = (a, b) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
const aiDiaMes = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)} ${MESES_TXT[Number(m) - 1].slice(0, 3)}`; };
const aiDiasCol = (n) => (n === 0 ? T.ok : n <= 2 ? T.warn : T.bad);
const AI_DIAS_SEM = ["D", "L", "M", "M", "J", "V", "S"];

/* Panel A: última fecha de corte recibida por sucursal y cuántos días quedan
   pendientes. El día de hoy no cuenta: se mide hasta ayer. */
function AIUltimaRecepcion({ resumen, sinCortes }) {
  const [verTodas, setVerTodas] = useState(false);
  const lista = verTodas ? resumen : resumen.slice(0, 6);
  const atrasadas = resumen.filter((x) => x.dias > 0).length;

  return (
    <div style={{ ...sx.repCard, display: "grid", gap: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Último corte recibido por sucursal</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>Los días pendientes se cuentan hasta ayer — hoy no cuenta</div>
        </div>
        {atrasadas > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, color: T.bad, background: T.badSoft }}>{atrasadas} con días pendientes</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
        {lista.map((x) => (
          <div key={x.suc} style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.suc}</div>
              <div style={{ fontSize: 11, color: T.muted }}>último: {aiDiaMes(x.ultima)}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: aiDiasCol(x.dias), lineHeight: 1.1 }}>{x.dias}</div>
              <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{x.dias === 0 ? "al día" : x.dias === 1 ? "día" : "días"}</div>
            </div>
          </div>
        ))}
      </div>

      {resumen.length > 6 && (
        <button onClick={() => setVerTodas((v) => !v)} style={{ background: "none", border: "none", color: T.brand, fontSize: 12, fontWeight: 600, cursor: "pointer", justifySelf: "start", padding: 0 }}>
          {verTodas ? "Ver solo las más atrasadas" : `Ver todas (${resumen.length})`}
        </button>
      )}
      {sinCortes.length > 0 && (
        <div style={{ fontSize: 11.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 9 }}>
          Sin ningún corte registrado todavía: {sinCortes.join(" · ")}
        </div>
      )}
    </div>
  );
}

/* Panel B: calendario por sucursal. Verde = corte recibido, rojo = día sin
   corte dentro del periodo que ya lleva registrado esa sucursal. */
function AIHuecosCalendario({ resumen, hoy, ayer }) {
  const [sucSel, setSucSel] = useState("");
  const [mesOff, setMesOff] = useState(0);

  const sel = resumen.find((x) => x.suc === sucSel) || resumen[0];
  if (!sel) return null;

  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + mesOff);
  const anio = base.getFullYear(), mes = base.getMonth();
  const primerDiaSem = new Date(anio, mes, 1).getDay();
  const nDias = new Date(anio, mes + 1, 0).getDate();
  const celdas = [...Array(primerDiaSem).fill(null), ...Array.from({ length: nDias }, (_, i) => i + 1)];

  const isoDe = (d) => `${anio}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const estadoDia = (d) => {
    const iso = isoDe(d);
    if (iso > ayer) return "futuro";
    if (iso < sel.primera) return "previo";
    return sel.set.has(iso) ? "ok" : "falta";
  };
  const faltantesMes = Array.from({ length: nDias }, (_, i) => i + 1).filter((d) => estadoDia(d) === "falta");

  const estilo = {
    ok: { background: T.okSoft, color: T.ok, border: `1px solid ${T.okSoft}` },
    falta: { background: T.badSoft, color: T.bad, border: `1px solid ${T.bad}` },
    previo: { background: "transparent", color: T.line, border: "1px solid transparent" },
    futuro: { background: T.lineSoft, color: T.muted, border: "1px solid transparent" },
  };

  return (
    <div style={{ ...sx.repCard, display: "grid", gap: 12, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Días sin corte recibido</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>Desde el primer corte que registraste de esa sucursal</div>
        </div>
        <select value={sel.suc} onChange={(e) => setSucSel(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto", minWidth: 190 }}>
          {resumen.map((x) => <option key={x.suc} value={x.suc}>{x.suc}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 300px) 1fr", gap: 18, alignItems: "start" }} className="calwrap">
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button onClick={() => setMesOff((m) => m - 1)} title="Mes anterior" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><Ico name="ChevronLeft" size={16} color={T.inkSoft} /></button>
            <div style={{ fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{MESES_TXT[mes]} {anio}</div>
            <button onClick={() => setMesOff((m) => m + 1)} disabled={mesOff >= 0} title="Mes siguiente" style={{ background: "none", border: "none", cursor: mesOff >= 0 ? "not-allowed" : "pointer", padding: 4, opacity: mesOff >= 0 ? 0.3 : 1 }}><Ico name="ChevronRight" size={16} color={T.inkSoft} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {AI_DIAS_SEM.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 9.5, fontWeight: 700, color: T.muted, paddingBottom: 3 }}>{d}</div>)}
            {celdas.map((d, i) => d === null
              ? <div key={`v${i}`} />
              : <div key={d} title={estadoDia(d) === "falta" ? "No se recibió corte de este día" : estadoDia(d) === "ok" ? "Corte recibido" : ""} style={{ aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, fontSize: 11.5, fontWeight: 600, ...estilo[estadoDia(d)] }}>{d}</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10, fontSize: 10.5, color: T.muted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.okSoft, border: `1px solid ${T.ok}` }} />recibido</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: T.badSoft, border: `1px solid ${T.bad}` }} />sin corte</span>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
            <div style={{ background: T.paper, borderRadius: 9, padding: "9px 12px" }}>
              <div style={{ fontSize: 10.5, color: T.muted }}>Faltan en total</div>
              <strong style={{ fontSize: 18, color: sel.huecos.length ? T.bad : T.ok }}>{sel.huecos.length}</strong>
            </div>
            <div style={{ background: T.paper, borderRadius: 9, padding: "9px 12px" }}>
              <div style={{ fontSize: 10.5, color: T.muted }}>Huecos intermedios</div>
              <strong style={{ fontSize: 18, color: sel.internos.length ? T.warn : T.ok }}>{sel.internos.length}</strong>
            </div>
            <div style={{ background: T.paper, borderRadius: 9, padding: "9px 12px" }}>
              <div style={{ fontSize: 10.5, color: T.muted }}>Días pendientes</div>
              <strong style={{ fontSize: 18, color: aiDiasCol(sel.dias) }}>{sel.dias}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkSoft, marginBottom: 6 }}>Sin corte en {MESES_TXT[mes]}</div>
            {faltantesMes.length === 0 ? (
              <div style={{ fontSize: 12, color: T.muted }}>Ningún día pendiente en este mes.</div>
            ) : (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {faltantesMes.map((d) => <span key={d} style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 99, color: T.bad, background: T.badSoft }}>{d} {MESES_TXT[mes].slice(0, 3)}</span>)}
              </div>
            )}
          </div>

          {sel.internos.length > 0 && (
            <div style={{ fontSize: 11.5, color: T.muted, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 9 }}>
              Los huecos intermedios son días que quedaron saltados entre cortes que sí recibiste — normalmente hay que buscarlos con la sucursal.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AIRecepcionResumen({ recepciones, sucursales }) {
  const hoy = aiHoyISO();
  const ayer = aiSumaISO(hoy, -1);

  const { resumen, sinCortes } = useMemo(() => {
    const mapa = {};
    recepciones.forEach((r) => r.cortes.forEach((c) => {
      const iso = aiCorteISO(c.fecha);
      if (!iso) return;
      if (!mapa[c.sucursal]) mapa[c.sucursal] = new Set();
      mapa[c.sucursal].add(iso);
    }));
    const res = Object.keys(mapa).map((suc) => {
      const set = mapa[suc];
      const fechas = [...set].sort();
      const primera = fechas[0], ultima = fechas[fechas.length - 1];
      const dias = Math.max(0, aiDiffISO(ultima, ayer));
      const huecos = [];
      for (let d = aiSumaISO(primera, 1); d <= ayer; d = aiSumaISO(d, 1)) if (!set.has(d)) huecos.push(d);
      return { suc, set, fechas, primera, ultima, dias, huecos, internos: huecos.filter((d) => d < ultima) };
    }).sort((a, b) => b.dias - a.dias || b.huecos.length - a.huecos.length || a.suc.localeCompare(b.suc));
    return { resumen: res, sinCortes: sucursales.filter((s) => !mapa[s]) };
  }, [recepciones, sucursales, ayer]);

  if (!resumen.length) return null;

  return (
    <>
      <AIUltimaRecepcion resumen={resumen} sinCortes={sinCortes} />
      <AIHuecosCalendario resumen={resumen} hoy={hoy} ayer={ayer} />
    </>
  );
}

function AICierreSemanal({ recepciones, sucursales, onSalir }) {
  const hayDatos = recepciones.some((r) => r.cortes.some((c) => aiFechaCompleta(c.fecha)));
  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}><h1 style={sx.h1}>Historial cortes</h1><span style={{ fontSize: 12, color: T.muted }}>recibidos y por recibir</span></div>
      {hayDatos
        ? <AIRecepcionResumen recepciones={recepciones} sucursales={sucursales} />
        : <div style={sx.empty}>Todavía no hay cortes registrados — captúralos en Recepción de Cortes y aquí verás el seguimiento.</div>}
    </div>
  );
}

function AIRecepcion({ recepciones, setRecepciones, onSalir, sucursales }) {
  const [paso, setPaso] = useState("lista"); // lista | captura | revision | ver
  const [borrador, setBorrador] = useState(null);
  const [modoForm, setModoForm] = useState("nuevo"); // nuevo | continuar | editar
  const [idActivo, setIdActivo] = useState(null);
  const [mesF, setMesF] = useState("todos");
  const [anioF, setAnioF] = useState("todos");
  const recepcionesFiltradas = aiFiltrarMesAnio(recepciones, mesF, anioF);
  const columnasRecepcion = [
    { titulo: "Fecha", valor: (r) => r.fecha },
    { titulo: "Estado", valor: (r) => (r.finalizado ? "Finalizado" : "En proceso") },
    { titulo: "Cortes", valor: (r) => r.cortes.length },
    { titulo: "Entregó", valor: (r) => r.entrega },
    { titulo: "Recibió", valor: (r) => r.recibe },
  ];
  const [pidiendoPassword, setPidiendoPassword] = useState(false);
  const [nombresEntrega, setNombresEntrega] = usePersistedList("nombresEntregaAI", ["Gerardo Martínez"]);
  const [nombresRecibe, setNombresRecibe] = usePersistedList("nombresRecibeAI", ["Elías Moreno"]);

  const agregarNombreEntrega = (n) => setNombresEntrega((p) => (p.includes(n) ? p : [...p, n]));
  const eliminarNombreEntrega = (n) => setNombresEntrega((p) => p.filter((x) => x !== n));
  const agregarNombreRecibe = (n) => setNombresRecibe((p) => (p.includes(n) ? p : [...p, n]));
  const eliminarNombreRecibe = (n) => setNombresRecibe((p) => p.filter((x) => x !== n));

  // Cada recepción se identifica por su id, nunca por su fecha —dos recepciones
  // distintas pueden compartir el mismo día sin pisarse entre ellas.
  // Si idObjetivo viene vacío ("Nueva recepción"), SIEMPRE se crea un registro nuevo,
  // aunque la fecha coincida con una recepción que ya existía. Si viene lleno
  // (Continuar / Editar), se actualiza solo esa recepción: los cortes que ya
  // traía conservan su id y su estado "contado" tal cual —para no perder el avance
  // del Panel 2—; solo los cortes realmente nuevos estrenan id.
  const guardarDatos = (datos, finalizado, idObjetivo) => {
    setRecepciones((prev) => {
      if (idObjetivo == null) {
        const cortesConId = datos.cortes.map((c, i) => ({ ...c, id: `${datos.fecha}-${Date.now()}-${i}`, contado: false }));
        return [...prev, { id: Date.now(), fecha: datos.fecha, entrega: datos.entrega, recibe: datos.recibe, observaciones: datos.observaciones, cortes: cortesConId, finalizado }];
      }
      return prev.map((r) => {
        if (r.id !== idObjetivo) return r;
        const cortesFinal = datos.cortes.map((c, i) => {
          const previo = r.cortes.find((p) => p.sucursal === c.sucursal && p.fecha === c.fecha);
          return previo || { ...c, id: `${datos.fecha}-${Date.now()}-${i}`, contado: false };
        });
        return { ...r, fecha: datos.fecha, entrega: datos.entrega, recibe: datos.recibe, observaciones: datos.observaciones, cortes: cortesFinal, finalizado };
      });
    });
  };

  const abrirNueva = () => { setModoForm("nuevo"); setBorrador(null); setIdActivo(null); setPaso("captura"); };
  // Continuar carga TAL CUAL lo ya guardado ese día —nada se pierde y no se agrega
  // ningún renglón de más—; si hace falta otro corte, se usa "+ Agregar otro corte".
  const abrirContinuar = (id) => {
    const rec = recepciones.find((r) => r.id === id);
    setModoForm("continuar");
    setIdActivo(id);
    setBorrador({ fecha: rec.fecha, entrega: rec.entrega, recibe: rec.recibe, observaciones: rec.observaciones, cortes: rec.cortes.map(({ sucursal, fecha }) => ({ sucursal, fecha })), confEntrega: true, confRecibe: true });
    setPaso("captura");
  };
  const pedirEditar = (id) => { setIdActivo(id); setPidiendoPassword(true); };
  const confirmarPassword = () => {
    setPidiendoPassword(false);
    const rec = recepciones.find((r) => r.id === idActivo);
    setModoForm("editar");
    setBorrador({ fecha: rec.fecha, entrega: rec.entrega, recibe: rec.recibe, observaciones: rec.observaciones, cortes: rec.cortes.map(({ sucursal, fecha }) => ({ sucursal, fecha })), confEntrega: true, confRecibe: true });
    setPaso("captura");
  };
  const abrirVer = (id) => { setIdActivo(id); setPaso("ver"); };

  const guardarDirecto = (datos) => {
    const idObjetivo = modoForm === "nuevo" ? null : idActivo;
    const finalizadoFinal = modoForm === "editar" ? (recepciones.find((r) => r.id === idActivo)?.finalizado ?? false) : false;
    guardarDatos(datos, finalizadoFinal, idObjetivo);
    setBorrador(null);
    setPaso("lista");
  };
  const finalizar = () => {
    const idObjetivo = modoForm === "nuevo" ? null : idActivo;
    const finalizadoFinal = modoForm === "editar" ? (recepciones.find((r) => r.id === idActivo)?.finalizado ?? true) : true;
    guardarDatos(borrador, finalizadoFinal, idObjetivo);
    setBorrador(null);
    setPaso("lista");
  };

  const recepcionVista = paso === "ver" ? recepciones.find((r) => r.id === idActivo) : null;
  const recActiva = recepciones.find((r) => r.id === idActivo);
  const tituloForm = modoForm === "editar" ? `Editando la recepción del ${recActiva?.fecha || ""}` : modoForm === "continuar" ? `Agregando más cortes al ${recActiva?.fecha || ""}` : "Nueva recepción de cortes";

  // Cortes ya guardados en OTRAS recepciones (para avisar si se está por recibir
  // un corte que ya se había registrado antes).
  const recibidosOtros = [];
  recepciones.forEach((r) => { if (r.id !== idActivo) r.cortes.forEach((c) => recibidosOtros.push({ sucursal: c.sucursal, fecha: c.fecha })); });

  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Recepción de Cortes</h1>
        {paso === "lista" && <AIBotonNuevo label="Nueva recepción" enProceso={recepciones.some((r) => !r.finalizado)} mensaje="Ya existe una recepción en proceso — termínala antes de iniciar otra." onClick={abrirNueva} />}
      </div>
      {paso === "captura" && <AIRecepcionForm inicial={borrador} tituloForm={tituloForm} bloquearFecha={modoForm !== "nuevo"} recibidosOtros={recibidosOtros} onGuardar={(d) => { setBorrador(d); setPaso("revision"); }} onGuardarDirecto={guardarDirecto} onCancelar={() => { setBorrador(null); setPaso("lista"); }} nombresEntrega={nombresEntrega} onAgregarEntrega={agregarNombreEntrega} onEliminarEntrega={eliminarNombreEntrega} nombresRecibe={nombresRecibe} onAgregarRecibe={agregarNombreRecibe} onEliminarRecibe={eliminarNombreRecibe} sucursales={sucursales} />}
      {paso === "revision" && <AIRecepcionRevision datos={borrador} onAtras={() => setPaso("captura")} onFinalizar={finalizar} />}
      {paso === "ver" && recepcionVista && <AIRecepcionRevision datos={recepcionVista} soloLectura onCerrar={() => { setIdActivo(null); setPaso("lista"); }} />}
      {paso === "lista" && (
        recepciones.length === 0 ? <div style={sx.empty}>Aún no hay recepciones registradas.</div> : (
          <>
          <AIListToolbar items={recepciones} mes={mesF} setMes={setMesF} anio={anioF} setAnio={setAnioF} titulo="Recepción de Cortes" columnas={columnasRecepcion} filasExport={recepcionesFiltradas} />
          {recepcionesFiltradas.length === 0 ? <div style={sx.empty}>No hay recepciones en ese periodo.</div> : (
          <div style={{ display: "grid", gap: 8 }}>
            {[...recepcionesFiltradas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).map((r) => (
              <div key={r.id} style={sx.repCard}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong>{r.fecha}</strong>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: r.finalizado ? T.ok : T.warn, background: r.finalizado ? T.okSoft : T.warnSoft }}>{r.finalizado ? "Finalizado" : "En proceso"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{r.cortes.length} corte{r.cortes.length === 1 ? "" : "s"} · última entrega de {r.entrega} · recibió {r.recibe}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {r.finalizado ? (
                      <>
                        <button onClick={() => abrirVer(r.id)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Ver</button>
                        <button onClick={() => pedirEditar(r.id)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Editar</button>
                      </>
                    ) : (
                      <button onClick={() => abrirContinuar(r.id)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: T.brand }}>Continuar</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}
          </>
        )
      )}
      {pidiendoPassword && <AIModalPassword onConfirmar={confirmarPassword} onCancelar={() => { setPidiendoPassword(false); setIdActivo(null); }} />}
    </div>
  );
}

/* ---- Panel 2: Conteo de Cortes ---- */
const AI_CONTADORES = ["Elías Moreno"];

/* Franja discreta con los cortes ya recibidos que todavía no se cuentan.
   Se alimenta sola de Recepción de Cortes: un corte sale de aquí en cuanto
   se finaliza un conteo que lo incluya. Colapsada por default para que no
   compita con el contenido principal. */
function AIPendientesPanel({ pendientes }) {
  const [abierto, setAbierto] = useState(false);

  if (!pendientes.length) {
    return (
      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "9px 14px", display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: T.muted, marginBottom: 18 }}>
        <Ico name="Check" size={15} color={T.ok} />
        Sin cortes pendientes — todo lo recibido ya se contó.
      </div>
    );
  }

  const orden = [...pendientes].sort((a, b) => aiOrdenCorte(a.fecha).localeCompare(aiOrdenCorte(b.fecha)));
  const esperas = orden.map((c) => aiDiasDesde(c.recepcionFecha));
  const maxEspera = Math.max(...esperas);
  const col = aiColorEspera(maxEspera);
  const bg = maxEspera >= 7 ? T.badSoft : maxEspera >= 3 ? T.warnSoft : T.lineSoft;

  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, marginBottom: 18 }}>
      <button onClick={() => setAbierto((a) => !a)} className="rowbtn" style={{ width: "100%", background: "none", border: "none", padding: "9px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer", textAlign: "left" }}>
        <Ico name="Clock" size={15} color={col} />
        <span style={{ fontSize: 12.5, color: T.inkSoft }}>Pendientes por contar</span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99, color: col, background: bg }}>{orden.length} corte{orden.length === 1 ? "" : "s"}</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
          el más antiguo lleva {maxEspera} día{maxEspera === 1 ? "" : "s"}
          <Ico name={abierto ? "ChevronUp" : "ChevronDown"} size={14} color={T.muted} />
        </span>
      </button>
      {abierto && (
        <div style={{ borderTop: `1px solid ${T.lineSoft}`, padding: "8px 14px 12px", display: "grid", gap: 4 }}>
          {orden.map((c, i) => {
            const dias = esperas[i];
            const cc = aiColorEspera(dias);
            return (
              <div key={c.id} style={{ borderRadius: 7, padding: "5px 6px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ width: 6, height: 6, borderRadius: 99, background: cc, flexShrink: 0 }} />
                <strong style={{ fontWeight: 600 }}>{c.sucursal}</strong>
                <span style={{ color: T.muted }}>corte del {c.fecha}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: cc }}>{dias === 0 ? "recibido hoy" : `esperando ${dias} día${dias === 1 ? "" : "s"}`}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AIConfirmarQuitar({ bloque, onConfirmar, onCancelar }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onCancelar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 340, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.25)", display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: T.badSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="TriangleAlert" size={16} color={T.bad} /></div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>¿Quitar este corte?</div>
        </div>
        <div style={{ fontSize: 12.5, color: T.muted }}>
          Se va a eliminar <strong style={{ color: T.ink }}>{bloque.sucursal || "el corte"}</strong>{aiFechaCompleta(bloque.fecha) ? ` del ${bloque.fecha}` : ""} y todo lo que lleves capturado en él. No se puede deshacer.
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button autoFocus onClick={onCancelar} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
          <button onClick={onConfirmar} className="actbtn" style={{ ...sx.actbtn, background: T.bad, color: "#fff" }}>Sí, quitar</button>
        </div>
      </div>
    </div>
  );
}

/* Pantalla 1 — captura: encabezado del conteo y un bloque por cada corte,
   cada uno con su tabla de billetes y monedas.
   Teclado: Enter avanza al siguiente campo en el orden de la pantalla,
   "+" agrega otro corte (hereda sucursal y el día siguiente del último) y
   "-" pide confirmación para quitar el corte donde está el cursor. */
function AIConteoForm({ inicial, sucursales, recibidos, onVolver, onGuardar, onSiguiente, titulo, onCambio }) {
  // Solo se puede elegir sucursal y fecha de cortes que de verdad estén pendientes por
  // contar (recibidos y no contados). Si un bloque ya cargado (al continuar un borrador)
  // usa una combinación que dejó de estar pendiente, se conserva como opción de todos
  // modos para no perder lo ya capturado.
  const pendientes = (recibidos || []).filter((c) => !c.contado);
  const sucursalesPendientes = [...new Set(pendientes.map((c) => c.sucursal))];
  const fechasPendientesDe = (suc, usadasPorOtros) => pendientes.filter((c) => c.sucursal === suc && !usadasPorOtros.includes(c.fecha)).map((c) => c.fecha);

  const primerDisponible = (usados) => {
    for (const suc of sucursalesPendientes) {
      const usadasDeEsta = usados.filter((u) => u.sucursal === suc).map((u) => u.fecha);
      const libres = fechasPendientesDe(suc, usadasDeEsta);
      if (libres.length) return { sucursal: suc, fecha: libres[0] };
    }
    return { sucursal: "", fecha: "" };
  };

  const [fecha, setFecha] = useState(inicial ? inicial.fecha : aiHoyISO());
  const [contador, setContador] = useState(inicial ? inicial.contador : AI_CONTADORES[0]);
  const [bloques, setBloques] = useState(() => {
    if (inicial && inicial.bloques.length) return inicial.bloques.map((b) => ({ ...b, abierto: true }));
    const sugerido = primerDisponible([]);
    return [{ key: `b${Date.now()}`, sucursal: sugerido.sucursal, fecha: sugerido.fecha, cantidades: {}, abierto: true }];
  });

  const setBloque = (i, campo, v) => setBloques((p) => p.map((b, idx) => (idx === i ? { ...b, [campo]: v, ...(campo === "sucursal" ? { fecha: "" } : {}) } : b)));
  const setCant = (i, d, v) => setBloques((p) => p.map((b, idx) => (idx === i ? { ...b, cantidades: { ...b.cantidades, [d]: v } } : b)));
  const addBloque = () => setBloques((p) => {
    const sugerido = primerDisponible(p.map(({ sucursal, fecha }) => ({ sucursal, fecha })));
    return [...p.map((b) => ({ ...b, abierto: false })), { key: `b${Date.now()}`, sucursal: sugerido.sucursal, fecha: sugerido.fecha, cantidades: {}, abierto: true }];
  });
  const quitarBloque = (i) => setBloques((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  const contRef = useRef(null);
  const enfocarBloque = useRef(null);
  const [confirmarQuitar, setConfirmarQuitar] = useState(null);

  const campos = () => (contRef.current ? Array.from(contRef.current.querySelectorAll("[data-nav]")) : []);
  const avanzar = (desde) => {
    const lista = campos();
    const i = lista.indexOf(desde || document.activeElement);
    const sig = lista[i + 1];
    if (sig) sig.focus();
  };
  const [avisoSinCortes, setAvisoSinCortes] = useState(false);
  useEffect(() => {
    if (!avisoSinCortes) return;
    const t = setTimeout(() => setAvisoSinCortes(false), 3200);
    return () => clearTimeout(t);
  }, [avisoSinCortes]);
  const hayMasDisponibles = () => !!primerDisponible(bloques.map(({ sucursal, fecha }) => ({ sucursal, fecha }))).sucursal;
  const agregarYEnfocar = () => {
    if (!hayMasDisponibles()) { setAvisoSinCortes(true); return; }
    enfocarBloque.current = bloques.length;
    addBloque();
  };
  const pedirQuitar = (i) => { if (bloques.length > 1) setConfirmarQuitar(i); };
  const confirmarQuitarBloque = () => {
    const i = confirmarQuitar;
    setConfirmarQuitar(null);
    enfocarBloque.current = Math.max(i - 1, 0);
    quitarBloque(i);
  };

  const manejarTecla = (e) => {
    if (confirmarQuitar !== null) return;
    if (e.key === "Enter") { e.preventDefault(); avanzar(); }
    else if (e.key === "+") { e.preventDefault(); agregarYEnfocar(); }
    else if (e.key === "-") {
      e.preventDefault();
      const caja = document.activeElement && document.activeElement.closest("[data-bloque]");
      pedirQuitar(caja ? Number(caja.dataset.bloque) : bloques.length - 1);
    }
  };

  /* Al agregar o quitar un corte, el cursor se va al selector de sucursal correspondiente
     y la pantalla baja para que la tarjeta quede completamente visible, sin necesidad
     de usar la ruedita del mouse. */
  useEffect(() => {
    if (enfocarBloque.current === null || enfocarBloque.current === undefined) return;
    const idx = enfocarBloque.current;
    enfocarBloque.current = null;
    const caja = contRef.current && contRef.current.querySelector(`[data-bloque="${idx}"]`);
    if (caja) caja.scrollIntoView({ behavior: "smooth", block: "start" });
    const el = caja && caja.querySelector("[data-nav]");
    if (el) el.focus({ preventScroll: true });
  });

  const totalBloque = (b) => aiTotalConteo(b.cantidades);
  const totalGeneral = bloques.reduce((s, b) => s + totalBloque(b), 0);
  /* Un corte capturado se coteja contra lo registrado en Recepción de Cortes:
     "ok" = recibido y sin contar · "yaContado" = recibido pero ya se contó antes ·
     "noRecibido" = no aparece en ninguna recepción, y eso bloquea el Siguiente.
     Se declara ANTES de `ok` porque `ok` lo usa. */
  const estadoCorte = (b) => {
    if (!b.sucursal || !aiFechaCompleta(b.fecha)) return null;
    const m = (recibidos || []).find((c) => c.sucursal === b.sucursal && c.fecha === b.fecha);
    if (!m) return "noRecibido";
    return m.contado ? "yaContado" : "ok";
  };
  const sinRecibir = bloques.filter((b) => estadoCorte(b) === "noRecibido");

  const ok = fecha && contador && bloques.every((b) => b.sucursal && aiFechaCompleta(b.fecha) && !aiTablaVacia(b.cantidades) && estadoCorte(b) !== "noRecibido");
  const datos = () => ({ fecha, contador, bloques: bloques.map(({ key, sucursal, fecha, cantidades }) => ({ key, sucursal, fecha, cantidades })) });

  /* Reporta lo capturado hacia arriba en cada cambio, para que quede como borrador
     aunque el usuario nunca llegue a darle "Guardar". */
  useEffect(() => { if (onCambio) onCambio(datos()); }, [fecha, contador, bloques]);

  return (
    <div ref={contRef} onKeyDown={manejarTecla} style={{ display: "grid", gap: 14 }}>
      <div style={{ ...sx.repCard, display: "grid", gap: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{titulo || "Nuevo conteo de cortes"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <TField label="Día en que se cuenta">
            <input data-nav type="date" value={fecha} max={aiHoyISO()} onChange={(e) => setFecha(e.target.value)} className="sel" style={sx.sel} />
          </TField>
          <TField label="Quién cuenta">
            <select data-nav value={contador} onChange={(e) => setContador(e.target.value)} className="sel" style={sx.sel}>
              {AI_CONTADORES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </TField>
        </div>
      </div>

      {bloques.map((b, i) => {
        const t = totalBloque(b);
        const est = estadoCorte(b);
        const marca = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 99, marginBottom: 9 };
        // Opciones de sucursal: las que tienen algún corte pendiente, más la actual si ya
        // no calificara (para no perder lo capturado al continuar un borrador viejo).
        const opcionesSucursal = b.sucursal && !sucursalesPendientes.includes(b.sucursal) ? [b.sucursal, ...sucursalesPendientes] : sucursalesPendientes;
        // Opciones de fecha: pendientes de ESA sucursal que ningún otro bloque DE LA MISMA
        // sucursal ya esté usando (dos sucursales distintas pueden compartir fecha de corte).
        const usadasPorOtros = bloques.filter((o, j) => j !== i && o.sucursal === b.sucursal).map((o) => o.fecha).filter((f) => f);
        const opcionesFecha = b.fecha && !pendientes.some((c) => c.sucursal === b.sucursal && c.fecha === b.fecha) ? [b.fecha, ...fechasPendientesDe(b.sucursal, usadasPorOtros)] : fechasPendientesDe(b.sucursal, usadasPorOtros);
        return (
          <div key={b.key} data-bloque={i} style={{ ...sx.repCard, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => setBloque(i, "abierto", !b.abierto)} title={b.abierto ? "Plegar" : "Desplegar"} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 9 }}>
                <Ico name={b.abierto ? "ChevronDown" : "ChevronRight"} size={16} color={T.muted} />
              </button>
              <TField label="Sucursal" hint="Solo se listan sucursales con cortes pendientes">
                <select data-nav value={b.sucursal} onChange={(e) => setBloque(i, "sucursal", e.target.value)} className="sel" style={{ ...sx.sel, width: "auto", minWidth: 190 }}>
                  <option value="">Elige una sucursal</option>
                  {opcionesSucursal.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </TField>
              <TField label="Fecha del corte" hint="Solo fechas de cortes pendientes de esa sucursal">
                <select data-nav value={b.fecha} onChange={(e) => setBloque(i, "fecha", e.target.value)} disabled={!b.sucursal} className="sel" style={{ ...sx.sel, width: "auto", minWidth: 140 }}>
                  <option value="">{b.sucursal ? "Elige una fecha" : "Elige sucursal primero"}</option>
                  {opcionesFecha.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </TField>
              {est === "yaContado" && <span style={{ ...marca, color: T.warn, background: T.warnSoft }}><Ico name="RotateCcw" size={13} color={T.warn} />Este corte ya se había contado</span>}
              {est === "noRecibido" && <span style={{ ...marca, color: T.bad, background: T.badSoft }}><Ico name="TriangleAlert" size={13} color={T.bad} />Este corte aún no ha sido recibido</span>}
              <div style={{ marginLeft: "auto", textAlign: "right", marginBottom: 6 }}>
                <div style={{ fontSize: 10.5, color: T.muted }}>Subtotal</div>
                <strong style={{ fontSize: 14 }}>{aiMoney(t)}</strong>
              </div>
              {bloques.length > 1 && (
                <button onClick={() => pedirQuitar(i)} title="Quitar este corte" style={{ background: "none", border: "none", cursor: "pointer", marginBottom: 9 }}><Ico name="X" size={16} color={T.bad} /></button>
              )}
            </div>
            {b.abierto && <AITablaDenominaciones cantidades={b.cantidades} onChange={(d, v) => setCant(i, d, v)} denoms={AI_DENOM_CONTEO} agrupado conMonedas />}
          </div>
        );
      })}

      <div>
        <button onClick={agregarYEnfocar} disabled={!hayMasDisponibles()} title={hayMasDisponibles() ? "" : "Ya no hay más cortes recibidos pendientes por contar"} className="actbtn" style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: "#fff", color: hayMasDisponibles() ? T.brand : T.muted, border: `1px solid ${hayMasDisponibles() ? T.brand : T.line}`, cursor: hayMasDisponibles() ? "pointer" : "not-allowed" }}>+ Agregar otro corte</button>
        <span style={{ marginLeft: 10, fontSize: 11, color: T.muted }}>Enter avanza · <strong>+</strong> agrega otro corte · <strong>−</strong> quita el corte actual</span>
        {avisoSinCortes && (
          <div style={{ marginTop: 8, fontSize: 11.5, color: T.bad, display: "flex", alignItems: "center", gap: 5 }}>
            <Ico name="TriangleAlert" size={13} color={T.bad} />
            Ya no hay más cortes disponibles para contar.
          </div>
        )}
      </div>

      <div style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", position: "sticky", bottom: 12, boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
        <div>
          <div style={{ fontSize: 11, color: T.muted }}>Total capturado · {bloques.length} corte{bloques.length === 1 ? "" : "s"}</div>
          <strong style={{ fontSize: 20 }}>{aiMoney(totalGeneral)}</strong>
          {sinRecibir.length > 0 && (
            <div style={{ fontSize: 11, color: T.bad, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
              <Ico name="TriangleAlert" size={12} color={T.bad} />
              {sinRecibir.length === 1 ? "Hay 1 corte que no aparece en Recepción — regístralo ahí para poder continuar." : `Hay ${sinRecibir.length} cortes que no aparecen en Recepción — regístralos ahí para poder continuar.`}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={onVolver} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>‹ Volver</button>
          <button onClick={() => !sinRecibir.length && onGuardar(datos())} disabled={!!sinRecibir.length} title={sinRecibir.length ? "Hay cortes que todavía no se registran en Recepción de Cortes" : "Guarda lo capturado hasta ahora y regresa a la lista"} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: sinRecibir.length ? T.muted : T.brand, border: `1px solid ${sinRecibir.length ? T.line : T.brand}`, cursor: sinRecibir.length ? "not-allowed" : "pointer" }}>Guardar</button>
          <button onClick={() => ok && onSiguiente(datos())} disabled={!ok} title={ok ? "" : (sinRecibir.length ? "Hay cortes que todavía no se registran en Recepción de Cortes" : "Completa sucursal, fecha y al menos una denominación en cada corte")} className="actbtn" style={{ ...sx.actbtn, background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Siguiente ›</button>
        </div>
      </div>

      {confirmarQuitar !== null && bloques[confirmarQuitar] && (
        <AIConfirmarQuitar bloque={bloques[confirmarQuitar]} onConfirmar={confirmarQuitarBloque} onCancelar={() => setConfirmarQuitar(null)} />
      )}
    </div>
  );
}

/* Pantalla 2 — resumen de lo contado, conteo físico consolidado obligatorio,
   salida de centavos y diferencia final. */
function AIConteoResumen({ datos, acumCentavos, soloLectura, onAtras, onGuardar, onFinalizar, onCerrar }) {
  const [consolidado, setConsolidado] = useState(datos.consolidado || {});
  const [salida, setSalida] = useState(datos.salidaCentavos === undefined || datos.salidaCentavos === null ? "" : datos.salidaCentavos);
  const [comentario, setComentario] = useState(datos.comentario || "");

  const totalDe = (b) => aiTotalConteo(b.cantidades);
  const teorico = datos.bloques.reduce((s, b) => s + totalDe(b), 0);
  const fisico = aiTotalConteo(consolidado);
  const salidaNum = salida === "" ? 0 : Number(salida) || 0;
  const diferencia = Math.round((fisico + salidaNum - teorico) * 100) / 100;
  const cuadra = diferencia === 0;

  const capturado = !aiTablaVacia(consolidado);
  const listo = capturado && (cuadra || comentario.trim());
  const paquete = () => ({ ...datos, consolidado, salidaCentavos: salida, comentario });

  // Enter recorre los campos en orden: billetes y monedas del consolidado,
  // salida de centavos y —si aparece— la explicación de la diferencia.
  // Dentro del textarea, Enter hace salto de línea normal, no avanza.
  const contRef = useRef(null);
  const manejarTecla = (e) => {
    if (e.key !== "Enter") return;
    if (e.target && e.target.tagName === "TEXTAREA") return;
    e.preventDefault();
    const lista = contRef.current ? Array.from(contRef.current.querySelectorAll("[data-nav]")) : [];
    const sig = lista[lista.indexOf(e.target) + 1];
    if (sig) sig.focus();
  };

  const fila = (label, valor, opts = {}) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, ...(opts.top ? { paddingTop: 6, borderTop: `1px solid ${T.line}` } : {}) }}>
      <span style={{ color: opts.fuerte ? T.ink : T.muted, fontWeight: opts.fuerte ? 700 : 400 }}>{label}</span>
      <strong style={{ color: opts.color || T.ink }}>{valor}</strong>
    </div>
  );

  return (
    <div ref={contRef} onKeyDown={manejarTecla} style={{ display: "grid", gap: 14 }}>
      <div style={{ ...sx.repCard, display: "grid", gap: 14 }}>
        {soloLectura && <PrintHeader titulo="Detalle Conteo" />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{soloLectura ? "Detalle del conteo" : "Resumen de lo contado"}</div>
            <div style={{ fontSize: 11.5, color: T.muted }}>Contó {datos.contador} · {fechaTexto(datos.fecha)}</div>
          </div>
          {soloLectura && <AIExportMenu titulo="Detalle Conteo" columnas={[{ titulo: "Sucursal", valor: (b) => b.sucursal }, { titulo: "Corte del", valor: (b) => b.fecha }, { titulo: "Total", valor: (b) => aiMoney(aiTotalConteo(b.cantidades)) }]} filas={datos.bloques} />}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: T.paper }}>
              <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700, color: T.inkSoft }}>Sucursal</th>
              <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700, color: T.inkSoft }}>Corte del</th>
              <th style={{ padding: "7px 12px", textAlign: "right", fontWeight: 700, color: T.inkSoft }}>Total contado</th>
            </tr>
          </thead>
          <tbody>
            {datos.bloques.map((b, i) => (
              <tr key={i}>
                <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{b.sucursal}</td>
                <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{b.fecha}</td>
                <td style={{ padding: "7px 12px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}>{aiMoney(totalDe(b))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, fontStyle: "italic", color: T.muted }}>Total teórico</td>
              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700 }}>{aiMoney(teorico)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Conteo físico consolidado</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>Ya juntos todos los billetes y monedas de los {datos.bloques.length} corte{datos.bloques.length === 1 ? "" : "s"}, cuéntalos aquí completos</div>
        </div>
        <AITablaDenominaciones cantidades={consolidado} onChange={(d, v) => setConsolidado((p) => ({ ...p, [d]: v }))} denoms={AI_DENOM_CONTEO} agrupado conMonedas soloLectura={soloLectura} />
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, alignItems: "end" }}>
          <TField label="Salida de centavos (opcional)" hint="Los centavos que se apartan y se van acumulando">
            {soloLectura ? <div style={{ ...sx.sel, background: T.paper }}>{aiMoney(salidaNum)}</div> : (
              <input data-nav type="number" min="0" step="0.01" value={salida} onChange={(e) => setSalida(e.target.value.replace(/-/g, ""))} onWheel={(e) => e.currentTarget.blur()} placeholder="0.00" className="sel" style={sx.sel} />
            )}
          </TField>
          <div style={{ fontSize: 11.5, color: T.muted, paddingBottom: 10 }}>Acumulado de centavos hasta hoy: <strong style={{ color: T.ink }}>{aiMoney(acumCentavos + (soloLectura ? 0 : salidaNum))}</strong></div>
        </div>

        <div style={{ background: T.paper, borderRadius: 10, padding: 14, display: "grid", gap: 6, fontSize: 13 }}>
          {fila("Total teórico (lo que debería haber)", aiMoney(teorico))}
          {fila("Total físico consolidado", aiMoney(fisico))}
          {fila("+ Salida de centavos", aiMoney(salidaNum))}
          {fila("Diferencia (contado − teórico)", `${diferencia > 0 ? "+" : ""}${aiMoney(diferencia)}`, { top: true, fuerte: true, color: cuadra ? T.ok : T.bad })}
        </div>

        {!cuadra && capturado && (
          <TField label={soloLectura ? "Explicación de la diferencia" : "Explicación de la diferencia (obligatoria)"}>
            {soloLectura ? <div style={{ fontSize: 12.5, background: T.paper, borderRadius: 8, padding: "8px 12px" }}>{comentario || "—"}</div> : (
              <textarea data-nav value={comentario} onChange={(e) => setComentario(e.target.value)} rows={2} placeholder="Ej. faltante en el corte de Azteca, se avisó a la sucursal..." className="sel" style={{ ...sx.sel, resize: "vertical" }} />
            )}
          </TField>
        )}
        {capturado && (
          cuadra
            ? <div style={{ fontSize: 11.5, color: T.ok, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Check" size={14} color={T.ok} />El conteo cuadra en ceros.</div>
            : <div style={{ fontSize: 11.5, color: T.bad, display: "flex", alignItems: "center", gap: 6 }}><Ico name="TriangleAlert" size={14} color={T.bad} />{diferencia < 0 ? `Faltan ${aiMoney(Math.abs(diferencia))} respecto a lo que sumaron los cortes.` : `Sobran ${aiMoney(diferencia)} respecto a lo que sumaron los cortes.`}</div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
        {soloLectura ? (
          <button onClick={onCerrar} className="actbtn" style={{ ...sx.actbtn, background: T.ink, color: "#fff" }}>Cerrar</button>
        ) : (
          <>
            <button onClick={onAtras} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>‹ Atrás</button>
            <button onClick={() => onGuardar(paquete())} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.brand, border: `1px solid ${T.brand}` }}>Guardar</button>
            <button onClick={() => listo && onFinalizar(paquete(), cuadra)} disabled={!listo} title={listo ? "" : (!capturado ? "Captura el conteo físico consolidado" : "Explica la diferencia para poder finalizar")} className="actbtn" style={{ ...sx.actbtn, background: listo ? T.ink : T.line, color: listo ? "#fff" : T.muted, cursor: listo ? "pointer" : "not-allowed" }}>Finalizar</button>
          </>
        )}
      </div>
    </div>
  );
}

function AIConteo({ recepciones, setRecepciones, conteos, setConteos, borradores, setBorradores, onSalir, sucursales }) {
  const [paso, setPaso] = useState("lista"); // lista | captura | resumen | ver
  const [vistaLista, setVistaLista] = useState("conteos"); // conteos | borradores
  const [borrador, setBorrador] = useState(null);
  const [idActivo, setIdActivo] = useState(null);
  const [mesF, setMesF] = useState("todos");
  const [anioF, setAnioF] = useState("todos");
  // Id del borrador que se está capturando (solo aplica mientras NO exista todavía
  // como conteo guardado — en cuanto se guarda, se borra de la lista de borradores).
  const draftIdRef = useRef(null);

  const recibidos = [];
  recepciones.forEach((r) => r.cortes.forEach((c) => recibidos.push({ ...c, recepcionFecha: r.fecha })));
  const pendientes = recibidos.filter((c) => !c.contado);

  // Un conteo pasa por tres estados: "proceso" (todavía capturando o recién guardado),
  // "revision" (llegó a Finalizar pero la diferencia no dio cero — hay que corregirla) y
  // "finalizado" (Finalizar con diferencia en cero). El acumulado de centavos solo suma
  // conteos ya finalizados, no los que están en revisión.
  const acumCentavos = conteos.filter((c) => c.estado === "finalizado" && c.id !== idActivo).reduce((s, c) => s + (Number(c.salidaCentavos) || 0), 0);
  const totalConteo = (c) => c.bloques.reduce((s, b) => s + aiTotalConteo(b.cantidades), 0);
  // Una vez que se llegó al consolidado (revisión o finalizado), el total que se muestra
  // es el del conteo físico consolidado, no la suma teórica de los cortes.
  const totalMostrar = (c) => (c.estado === "proceso" ? totalConteo(c) : aiTotalConteo(c.consolidado));
  const diferenciaDe = (c) => Math.round((aiTotalConteo(c.consolidado) + (Number(c.salidaCentavos) || 0) - totalConteo(c)) * 100) / 100;

  // Solo un conteo ya GUARDADO ("proceso") bloquea abrir uno nuevo — un borrador no.
  const hayEnProceso = conteos.some((c) => c.estado === "proceso");

  const abrirNuevo = () => {
    setIdActivo(null);
    draftIdRef.current = Date.now();
    setBorrador({ fecha: aiHoyISO(), contador: AI_CONTADORES[0], bloques: [] });
    setPaso("captura");
  };
  const abrirContinuar = (c) => { setIdActivo(c.id); draftIdRef.current = null; setBorrador(c); setPaso("captura"); };
  // Un conteo "en revisión" se reabre directo en la pantalla de consolidado, no en la
  // captura de cortes por bloque.
  const abrirRevision = (c) => { setIdActivo(c.id); draftIdRef.current = null; setBorrador(c); setPaso("resumen"); };
  const abrirVer = (c) => { setIdActivo(c.id); draftIdRef.current = null; setBorrador(c); setPaso("ver"); };
  const abrirBorrador = (b) => { setIdActivo(null); draftIdRef.current = b.id; setBorrador({ fecha: b.fecha, contador: b.contador, bloques: b.bloques }); setPaso("captura"); };
  const descartarBorrador = (id) => setBorradores((prev) => prev.filter((b) => b.id !== id));

  /* Mientras se está capturando un conteo nuevo (todavía no guardado), cada cambio se
     guarda solo como borrador — así no se pierde nada si se sale sin darle "Guardar". */
  const reportarBorrador = (d) => {
    const id = draftIdRef.current;
    if (id == null) return;
    const tieneContenido = d.bloques.some((b) => b.sucursal || aiFechaCompleta(b.fecha) || !aiTablaVacia(b.cantidades));
    setBorradores((prev) => {
      if (!tieneContenido) return prev.filter((b) => b.id !== id);
      const registro = { id, fecha: d.fecha, contador: d.contador, bloques: d.bloques, actualizado: new Date() };
      return prev.some((b) => b.id === id) ? prev.map((b) => (b.id === id ? registro : b)) : [...prev, registro];
    });
  };

  /* Guarda o actualiza el conteo. Al llegar a "revision" o "finalizado" (ambos son el
     resultado de darle Finalizar), se marcan como contados los cortes recibidos que
     empatan en sucursal y fecha, y así salen del panel de pendientes. */
  const persistir = (datos, estado) => {
    const id = idActivo || Date.now();
    const registro = { id, fecha: datos.fecha, contador: datos.contador, bloques: datos.bloques, consolidado: datos.consolidado || {}, salidaCentavos: datos.salidaCentavos ?? "", comentario: datos.comentario || "", estado };
    setConteos((prev) => (prev.some((c) => c.id === id) ? prev.map((c) => (c.id === id ? registro : c)) : [...prev, registro]));
    if (estado === "revision" || estado === "finalizado") {
      setRecepciones((prev) => prev.map((r) => ({
        ...r,
        cortes: r.cortes.map((c) => (datos.bloques.some((b) => b.sucursal === c.sucursal && b.fecha === c.fecha) ? { ...c, contado: true } : c)),
      })));
    }
    if (draftIdRef.current != null) {
      setBorradores((prev) => prev.filter((b) => b.id !== draftIdRef.current));
      draftIdRef.current = null;
    }
    setBorrador(null);
    setIdActivo(null);
    setPaso("lista");
  };

  const salirDeCaptura = () => { setBorrador(null); setIdActivo(null); setPaso("lista"); };

  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Conteo de Cortes</h1>
        {paso === "lista" && <AIBotonNuevo label="Nuevo conteo" enProceso={hayEnProceso} mensaje="Ya existe un conteo en proceso — termínalo antes de iniciar otro." onClick={abrirNuevo} />}
      </div>

      {paso === "lista" && (
        <>
          <AIPendientesPanel pendientes={pendientes} />

          <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2, marginBottom: 14 }}>
            {[["conteos", "Conteos"], ["borradores", `Borradores${borradores.length ? ` (${borradores.length})` : ""}`]].map(([k, l]) => (
              <button key={k} onClick={() => setVistaLista(k)} style={{ padding: "6px 13px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: vistaLista === k ? T.ink : "transparent", color: vistaLista === k ? "#fff" : T.muted }}>{l}</button>
            ))}
          </div>

          {vistaLista === "conteos" ? (
            conteos.length === 0 ? <div style={sx.empty}>Aún no hay conteos registrados.</div> : (
              <>
              <AIListToolbar items={conteos} mes={mesF} setMes={setMesF} anio={anioF} setAnio={setAnioF} titulo="Conteo de Cortes" columnas={[
                { titulo: "Fecha", valor: (c) => c.fecha },
                { titulo: "Estado", valor: (c) => (c.estado === "finalizado" ? "Finalizado" : c.estado === "revision" ? "En revisión" : "En proceso") },
                { titulo: "Cortes", valor: (c) => c.bloques.length },
                { titulo: "Contó", valor: (c) => c.contador },
                { titulo: "Total", valor: (c) => aiMoney(totalMostrar(c)) },
              ]} filasExport={aiFiltrarMesAnio(conteos, mesF, anioF)} />
              {aiFiltrarMesAnio(conteos, mesF, anioF).length === 0 ? <div style={sx.empty}>No hay conteos en ese periodo.</div> : (
              <div style={{ display: "grid", gap: 8 }}>
                {[...aiFiltrarMesAnio(conteos, mesF, anioF)].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).map((c) => (
                  <div key={c.id} style={sx.repCard}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong>{c.fecha}</strong>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: c.estado === "finalizado" ? T.ok : c.estado === "revision" ? T.bad : T.warn, background: c.estado === "finalizado" ? T.okSoft : c.estado === "revision" ? T.badSoft : T.warnSoft }}>{c.estado === "finalizado" ? "Finalizado" : c.estado === "revision" ? "En revisión" : "En proceso"}</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{c.bloques.length} corte{c.bloques.length === 1 ? "" : "s"} · contó {c.contador} · {aiMoney(totalMostrar(c))}</div>
                        {c.estado === "revision" && (
                          <div style={{ fontSize: 11.5, color: T.bad, marginTop: 3, display: "flex", alignItems: "center", gap: 5 }}>
                            <Ico name="TriangleAlert" size={12} color={T.bad} />
                            Quedó una diferencia de {aiMoney(Math.abs(diferenciaDe(c)))} sin resolver
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        {c.estado === "finalizado" && <button onClick={() => abrirVer(c)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Ver</button>}
                        {c.estado === "revision" && <button onClick={() => abrirRevision(c)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: T.bad, color: "#fff" }}>Editar</button>}
                        {c.estado === "proceso" && <button onClick={() => abrirContinuar(c)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: T.brand }}>Continuar</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
              </>
            )
          ) : (
            borradores.length === 0 ? <div style={sx.empty}>No hay borradores — se guardan aquí solos en cuanto capturas algo sin darle "Guardar".</div> : (
              <div style={{ display: "grid", gap: 8 }}>
                {[...borradores].sort((a, b) => b.id - a.id).map((b) => {
                  const total = b.bloques.reduce((s, x) => s + aiTotalConteo(x.cantidades), 0);
                  return (
                    <div key={b.id} style={sx.repCard}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong>{b.fecha}</strong>
                            <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: T.muted, background: T.lineSoft }}>Borrador</span>
                          </div>
                          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{b.bloques.length} corte{b.bloques.length === 1 ? "" : "s"} · contó {b.contador} · {aiMoney(total)}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => descartarBorrador(b.id)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: "#fff", color: T.bad, border: `1px solid ${T.line}` }}>Descartar</button>
                          <button onClick={() => abrirBorrador(b)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: T.brand }}>Continuar</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {paso === "captura" && borrador && (
        <AIConteoForm
          inicial={borrador}
          sucursales={sucursales}
          recibidos={recibidos}
          titulo={idActivo ? `Continuando el conteo del ${borrador.fecha}` : "Nuevo conteo de cortes"}
          onCambio={idActivo == null ? reportarBorrador : undefined}
          onVolver={salirDeCaptura}
          onGuardar={(d) => persistir({ ...borrador, ...d }, "proceso")}
          onSiguiente={(d) => { setBorrador({ ...borrador, ...d }); setPaso("resumen"); }}
        />
      )}

      {paso === "resumen" && borrador && (
        <AIConteoResumen
          datos={borrador}
          acumCentavos={acumCentavos}
          onAtras={() => setPaso("captura")}
          onGuardar={(d) => persistir(d, "proceso")}
          onFinalizar={(d, cuadra) => persistir(d, cuadra ? "finalizado" : "revision")}
        />
      )}

      {paso === "ver" && borrador && (
        <AIConteoResumen datos={borrador} acumCentavos={acumCentavos} soloLectura onCerrar={() => { setBorrador(null); setIdActivo(null); setPaso("lista"); }} />
      )}
    </div>
  );
}

/* ---- Panel 3: Entrega de Efectivo (salidas) ----
   El efectivo disponible sale de los conteos finalizados (lo que realmente se
   contó físico) menos lo que ya se entregó. */
const AI_ENTREGA_RECIBE = ["Sonia Sánchez"];
const AI_ENTREGA_ENTREGA = ["Elías Moreno"];

function AISalidaForm({ onGuardar, onGuardarDirecto, onCancelar, folio, inicial, disponible }) {
  const [fecha, setFecha] = useState(inicial ? inicial.fecha : aiHoyISO());
  const [recibe, setRecibe] = useState(inicial ? inicial.recibe : AI_ENTREGA_RECIBE[0]);
  const [entrega, setEntrega] = useState(inicial ? inicial.entrega : AI_ENTREGA_ENTREGA[0]);
  const [cantidades, setCantidades] = useState(inicial ? inicial.cantidades || {} : {});
  const [confEntrega, setConfEntrega] = useState(inicial ? inicial.confEntrega : false);
  const [confRecibe, setConfRecibe] = useState(inicial ? inicial.confRecibe : false);

  const monto = aiTotalConteo(cantidades);
  const restante = Math.round((disponible - monto) * 100) / 100;
  const excede = restante < 0;
  const ok = fecha && recibe && entrega && monto > 0 && !excede && confEntrega && confRecibe;
  const guardar = () => { if (ok) onGuardar({ folio, fecha, recibe, entrega, cantidades, monto, disponible, confEntrega, confRecibe }); };

  return (
    <div style={{ ...sx.repCard, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Nueva entrega de efectivo</div>
        <span style={{ fontSize: 11.5, color: T.muted }}>Folio {folio}</span>
      </div>

      <div style={{ background: T.brandSoft, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.brandDark, textTransform: "uppercase", letterSpacing: "0.05em" }}>Saldo disponible</div>
          <strong style={{ fontSize: 22, color: T.brandDark }}>{aiMoney(disponible)}</strong>
          <div style={{ fontSize: 11, color: T.brandDark, opacity: 0.75 }}>efectivo contado que todavía no se entrega</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: T.brandDark, opacity: 0.75 }}>Se está entregando</div>
          <strong style={{ fontSize: 16, color: T.brandDark }}>{aiMoney(monto)}</strong>
          <div style={{ fontSize: 11.5, marginTop: 3, color: excede ? T.bad : T.brandDark, fontWeight: excede ? 700 : 400 }}>
            {excede ? `Excede el saldo por ${aiMoney(Math.abs(restante))}` : `Quedarían ${aiMoney(restante)}`}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <TField label="Fecha"><input type="date" value={fecha} max={aiHoyISO()} onChange={(e) => setFecha(e.target.value)} className="sel" style={sx.sel} /></TField>
        <TField label="Quién recibe">
          <select value={recibe} onChange={(e) => setRecibe(e.target.value)} className="sel" style={sx.sel}>
            {AI_ENTREGA_RECIBE.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </TField>
        <TField label="Quién entrega">
          <select value={entrega} onChange={(e) => setEntrega(e.target.value)} className="sel" style={sx.sel}>
            {AI_ENTREGA_ENTREGA.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </TField>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft }}>Billetes y monedas que se entregan</div>
        <AITablaDenominaciones cantidades={cantidades} onChange={(d, v) => setCantidades((p) => ({ ...p, [d]: v }))} denoms={AI_DENOM_CONTEO} agrupado conMonedas />
      </div>

      <div style={{ background: T.paper, borderRadius: 10, padding: 14, display: "grid", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Confirmación (sustituye la firma en papel)</div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={confEntrega} onChange={(e) => setConfEntrega(e.target.checked)} />
          {`${entrega} confirma que entregó el efectivo`}
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, cursor: "pointer" }}>
          <input type="checkbox" checked={confRecibe} onChange={(e) => setConfRecibe(e.target.checked)} />
          {`${recibe} confirma que recibió el efectivo`}
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {excede && <span style={{ fontSize: 11.5, color: T.bad, marginRight: "auto" }}>No puedes entregar más efectivo del que hay disponible.</span>}
        <button onClick={onCancelar} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
        <button onClick={() => !excede && onGuardarDirecto({ folio, fecha, recibe, entrega, cantidades, monto, disponible, confEntrega, confRecibe })} disabled={excede} title={excede ? "El monto excede el saldo disponible" : "Guarda lo capturado hasta ahora y regresa a la lista"} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: excede ? T.muted : T.brand, border: `1px solid ${excede ? T.line : T.brand}`, cursor: excede ? "not-allowed" : "pointer" }}>Guardar</button>
        <button onClick={guardar} disabled={!ok} title={ok ? "" : (monto <= 0 ? "Captura los billetes o monedas que se entregan" : excede ? "El monto excede el saldo disponible" : "Falta confirmar la entrega y la recepción")} className="actbtn" style={{ ...sx.actbtn, background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Siguiente</button>
      </div>
    </div>
  );
}

function AISalidaRevision({ datos, onAtras, onFinalizar, soloLectura, onCerrar }) {
  const restante = Math.round((datos.disponible - datos.monto) * 100) / 100;
  const filasDenoms = AI_DENOM_CONTEO.filter((d) => Number(datos.cantidades[d]) > 0).map((d) => ({ denom: aiEtiquetaDenom(d), cant: Number(datos.cantidades[d]), importe: (aiCent(d) * Number(datos.cantidades[d])) / 100 }));
  if (Number(datos.cantidades[AI_MONEDAS_KEY]) > 0) filasDenoms.push({ denom: "Monedas", cant: "—", importe: Number(datos.cantidades[AI_MONEDAS_KEY]) });
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ ...sx.repCard, display: "grid", gap: 16 }}>
        {soloLectura && <PrintHeader titulo="Detalle Entrega" />}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{soloLectura ? "Detalle de la entrega" : "Revisión de la entrega"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11.5, color: T.muted }}>Folio {datos.folio}</span>
            {soloLectura && <AIExportMenu titulo="Detalle Entrega" columnas={[{ titulo: "Denominación", valor: (f) => f.denom }, { titulo: "Cantidad", valor: (f) => f.cant }, { titulo: "Importe", valor: (f) => aiMoney(f.importe) }]} filas={filasDenoms} />}
          </div>
        </div>

        <div style={{ background: T.brandSoft, borderRadius: 10, padding: "12px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, color: T.brandDark, opacity: 0.8 }}>Saldo antes</div>
            <strong style={{ fontSize: 15, color: T.brandDark }}>{aiMoney(datos.disponible)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: T.brandDark, opacity: 0.8 }}>Se entrega</div>
            <strong style={{ fontSize: 15, color: T.brandDark }}>− {aiMoney(datos.monto)}</strong>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: T.brandDark, textTransform: "uppercase", letterSpacing: "0.05em" }}>Saldo actual</div>
            <strong style={{ fontSize: 22, color: T.brandDark }}>{aiMoney(restante)}</strong>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha</div><strong>{fechaTexto(datos.fecha)}</strong></div>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Quién entrega</div><strong>{datos.entrega}</strong></div>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Quién recibe</div><strong>{datos.recibe}</strong></div>
          {datos.motivo && <div><div style={{ color: T.muted, fontSize: 11 }}>Motivo</div><strong>{datos.motivo}</strong></div>}
        </div>
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Detalle de lo que se entrega</div>
          <div style={{ fontSize: 11.5, color: T.muted }}>Cuántas piezas de cada denominación</div>
        </div>
        <AITablaDenominaciones cantidades={datos.cantidades} denoms={AI_DENOM_CONTEO} agrupado conMonedas soloLectura />
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11.5, color: T.ok, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span>✓ Confirmado por {datos.entrega}</span>
          <span>✓ Confirmado por {datos.recibe}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {soloLectura ? (
            <button onClick={onCerrar} className="actbtn" style={{ ...sx.actbtn, background: T.ink, color: "#fff" }}>Cerrar</button>
          ) : (
            <>
              <button onClick={onAtras} className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>‹ Atrás</button>
              <button onClick={onFinalizar} className="actbtn" style={{ ...sx.actbtn, background: T.ink, color: "#fff" }}>Finalizar</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Tarjeta de solo lectura para Visualización — mismo cálculo que Entrega de Efectivo,
   más el desglose de lo ya contado (filtrable por fecha/mes y por sucursal). */
function AISaldoEfectivo({ conteos, salidas, onSalir }) {
  const contado = conteos.filter((c) => c.estado === "finalizado").reduce((s, c) => s + aiTotalConteo(c.consolidado), 0);
  const entregado = salidas.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const disponible = Math.round((contado - entregado) * 100) / 100;

  /* Una línea por corte (bloque) de cada conteo ya finalizado — es lo único que trae
     sucursal y fecha propias; el consolidado físico es un solo total sin desglose. */
  const lineas = useMemo(() => {
    const out = [];
    conteos.filter((c) => c.estado === "finalizado").forEach((c) => {
      c.bloques.forEach((b) => {
        const iso = aiCorteISO(b.fecha);
        if (!iso) return;
        out.push({ id: `${c.id}-${b.key}`, sucursal: b.sucursal, fecha: iso, fechaTxt: b.fecha, monto: aiTotalConteo(b.cantidades) });
      });
    });
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [conteos]);

  const sucursalesConDatos = [...new Set(lineas.map((l) => l.sucursal))].sort();

  const [personalizado, setPersonalizado] = useState(false);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [mesF, setMesF] = useState("todos");
  const [anioF, setAnioF] = useState("todos");
  const [sucF, setSucF] = useState("todas");

  const anios = aiAniosDe(lineas);

  const lineasFiltradas = lineas.filter((l) => {
    if (personalizado) {
      if (desde && l.fecha < desde) return false;
      if (hasta && l.fecha > hasta) return false;
    } else {
      const [y, m] = l.fecha.split("-").map(Number);
      if (anioF !== "todos" && y !== Number(anioF)) return false;
      if (mesF !== "todos" && m !== Number(mesF)) return false;
    }
    if (sucF !== "todas" && l.sucursal !== sucF) return false;
    return true;
  });
  const totalFiltrado = lineasFiltradas.reduce((s, l) => s + l.monto, 0);

  const salidasFiltradas = salidas.filter((x) => {
    if (personalizado) {
      if (desde && x.fecha < desde) return false;
      if (hasta && x.fecha > hasta) return false;
    } else {
      const [y, m] = (x.fecha || "").split("-").map(Number);
      if (anioF !== "todos" && y !== Number(anioF)) return false;
      if (mesF !== "todos" && m !== Number(mesF)) return false;
    }
    return true;
  });
  const entregadoFiltrado = salidasFiltradas.reduce((s, x) => s + (Number(x.monto) || 0), 0);

  const porSucursal = useMemo(() => {
    const mapa = {};
    lineasFiltradas.forEach((l) => { mapa[l.sucursal] = (mapa[l.sucursal] || 0) + l.monto; });
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [lineasFiltradas]);

  const porMes = useMemo(() => {
    const mapa = {};
    lineasFiltradas.forEach((l) => { const k = l.fecha.slice(0, 7); mapa[k] = (mapa[k] || 0) + l.monto; });
    return Object.entries(mapa).sort((a, b) => b[0].localeCompare(a[0]));
  }, [lineasFiltradas]);
  const mesLabel = (k) => { const [y, m] = k.split("-"); return `${MESES_TXT[Number(m) - 1]} ${y}`; };

  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}><h1 style={sx.h1}>Saldo de Efectivo</h1><span style={{ fontSize: 12, color: T.muted }}>contado en cortes, entregado y disponible</span></div>

      <div style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Saldo disponible</div>
          <strong style={{ fontSize: 28, color: disponible > 0 ? T.brand : T.muted }}>{aiMoney(disponible)}</strong>
        </div>
        <div style={{ display: "flex", gap: 22, fontSize: 12, color: T.muted, flexWrap: "wrap" }}>
          <div><div>Contado en cortes</div><strong style={{ color: T.ink, fontSize: 14 }}>{aiMoney(contado)}</strong></div>
          <div><div>Ya entregado</div><strong style={{ color: T.ink, fontSize: 14 }}>− {aiMoney(entregado)}</strong></div>
        </div>
      </div>

      <div style={sx.sectionTitle}>Conteo acumulado</div>
      <div style={{ ...sx.repCard, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <TField label="Sucursal">
          <select value={sucF} onChange={(e) => setSucF(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto", minWidth: 190 }}>
            <option value="todas">Todas las sucursales</option>
            {sucursalesConDatos.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </TField>
        {!personalizado ? (
          <>
            <TField label="Mes">
              <select value={mesF} onChange={(e) => setMesF(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto" }}>
                <option value="todos">Todos</option>
                {MESES_TXT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </TField>
            <TField label="Año">
              <select value={anioF} onChange={(e) => setAnioF(e.target.value)} className="sel" style={{ ...sx.sel, width: "auto" }}>
                <option value="todos">Todos</option>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </TField>
            <button onClick={() => setPersonalizado(true)} className="actbtn" style={{ ...sx.actbtn, fontSize: 12, padding: "8px 14px", background: "#fff", color: T.inkSoft, border: `1px solid ${T.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Calendar" size={14} color={T.inkSoft} />Elegir fechas</button>
          </>
        ) : (
          <>
            <TField label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="sel" style={sx.sel} /></TField>
            <TField label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="sel" style={sx.sel} /></TField>
            <button onClick={() => { setPersonalizado(false); setDesde(""); setHasta(""); }} className="actbtn" style={{ ...sx.actbtn, fontSize: 12, padding: "8px 14px", background: T.brandSoft, color: T.brand, border: `1px solid ${T.brand}` }}>Usar mes / año</button>
          </>
        )}
      </div>

      {lineasFiltradas.length === 0 ? (
        <div style={sx.empty}>No hay conteos finalizados en ese periodo.</div>
      ) : (
        <>
          <div style={{ ...sx.cards4, marginBottom: 20 }}>
            <Metric big={aiMoney(totalFiltrado)} label="Contado en el periodo" sub={`${lineasFiltradas.length} corte${lineasFiltradas.length === 1 ? "" : "s"}`} accent={T.brand} />
            <Metric big={aiMoney(entregadoFiltrado)} label="Entregado en el periodo" sub={`${salidasFiltradas.length} entrega${salidasFiltradas.length === 1 ? "" : "s"}`} accent={T.inkSoft} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 20 }}>
            <div style={{ ...sx.repCard, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Total por sucursal</div>
              <ListaTop rows={porSucursal} vacio="Sin datos en este periodo." fmt={aiMoney} />
            </div>
            <div style={{ ...sx.repCard, display: "grid", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Total por mes</div>
              <ListaTop rows={porMes.map(([k, v]) => [mesLabel(k), v])} vacio="Sin datos en este periodo." fmt={aiMoney} />
            </div>
          </div>

          <div style={{ ...sx.repCard, display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6 }}>Detalle de cortes contados</div>
            {lineasFiltradas.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, padding: "7px 0", borderTop: `1px solid ${T.lineSoft}` }}>
                <span style={{ color: T.muted }}>{l.fechaTxt}</span>
                <span style={{ flex: 1 }}>{l.sucursal}</span>
                <strong>{aiMoney(l.monto)}</strong>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AISalidas({ salidas, setSalidas, conteos, onSalir }) {
  const [paso, setPaso] = useState("lista"); // lista | captura | revision | ver
  const [borrador, setBorrador] = useState(null);
  const [idActivo, setIdActivo] = useState(null);
  const [verSalida, setVerSalida] = useState(null);
  const [mesF, setMesF] = useState("todos");
  const [anioF, setAnioF] = useState("todos");
  const folioSiguiente = salidas.filter((s) => s.estado === "finalizado").length + 1;

  const hayEnProceso = salidas.some((s) => s.estado === "proceso");
  const contado = conteos.filter((c) => c.estado === "finalizado").reduce((s, c) => s + aiTotalConteo(c.consolidado), 0);
  const entregado = salidas.reduce((s, x) => s + (Number(x.monto) || 0), 0);
  const disponible = Math.round((contado - entregado) * 100) / 100;

  // Guarda o actualiza una entrega. "proceso" es un borrador que se puede retomar;
  // "finalizado" ya quedó lista con sus confirmaciones y cuenta contra el saldo.
  const persistir = (datos, estado) => {
    const id = idActivo || Date.now();
    const registro = { id, ...datos, estado };
    setSalidas((prev) => (prev.some((s) => s.id === id) ? prev.map((s) => (s.id === id ? registro : s)) : [...prev, registro]));
    setBorrador(null);
    setIdActivo(null);
    setPaso("lista");
  };

  const abrirNueva = () => { setIdActivo(null); setBorrador(null); setPaso("captura"); };
  const abrirContinuar = (s) => { setIdActivo(s.id); setBorrador(s); setPaso("captura"); };
  const abrirVer = (s) => { setIdActivo(s.id); setVerSalida(s); setPaso("ver"); };

  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Entrega de Efectivo</h1>
        {paso === "lista" && <AIBotonNuevo label="Nueva entrega" enProceso={hayEnProceso} mensaje="Ya existe una entrega en proceso — termínala antes de iniciar otra." onClick={abrirNueva} />}
      </div>

      {paso === "captura" && <AISalidaForm folio={borrador ? borrador.folio : folioSiguiente} inicial={borrador} disponible={disponible} onGuardar={(d) => { setBorrador(d); setPaso("revision"); }} onGuardarDirecto={(d) => persistir(d, "proceso")} onCancelar={() => { setBorrador(null); setIdActivo(null); setPaso("lista"); }} />}
      {paso === "revision" && borrador && <AISalidaRevision datos={borrador} onAtras={() => setPaso("captura")} onFinalizar={() => persistir(borrador, "finalizado")} />}
      {paso === "ver" && verSalida && <AISalidaRevision datos={verSalida} soloLectura onCerrar={() => { setVerSalida(null); setIdActivo(null); setPaso("lista"); }} />}

      {paso === "lista" && (
        <>
          {salidas.length === 0 ? <div style={sx.empty}>Aún no hay entregas de efectivo registradas.</div> : (
            <>
            <AIListToolbar items={salidas} mes={mesF} setMes={setMesF} anio={anioF} setAnio={setAnioF} titulo="Entrega de Efectivo" columnas={[
              { titulo: "Folio", valor: (s) => s.folio },
              { titulo: "Fecha", valor: (s) => s.fecha },
              { titulo: "Estado", valor: (s) => (s.estado === "finalizado" ? "Finalizado" : "En proceso") },
              { titulo: "Recibe", valor: (s) => s.recibe },
              { titulo: "Entrega", valor: (s) => s.entrega },
              { titulo: "Monto", valor: (s) => aiMoney(s.monto) },
            ]} filasExport={aiFiltrarMesAnio(salidas, mesF, anioF)} />
            {aiFiltrarMesAnio(salidas, mesF, anioF).length === 0 ? <div style={sx.empty}>No hay entregas en ese periodo.</div> : (
            <div style={{ display: "grid", gap: 8 }}>
              {[...aiFiltrarMesAnio(salidas, mesF, anioF)].sort((a, b) => b.id - a.id).map((s) => (
                <div key={s.id} style={sx.repCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong>Folio {s.folio}</strong> · {s.fecha} · a {s.recibe || s.destinatario}
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: s.estado === "finalizado" ? T.ok : T.warn, background: s.estado === "finalizado" ? T.okSoft : T.warnSoft }}>{s.estado === "finalizado" ? "Finalizado" : "En proceso"}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>{aiMoney(s.monto)}</div>
                      {s.estado === "finalizado" ? (
                        <button onClick={() => abrirVer(s)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Ver</button>
                      ) : (
                        <button onClick={() => abrirContinuar(s)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "5px 10px", background: T.brand }}>Continuar</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---- Contenedor principal de Auditoría Interna ---- */
/* ---- Configuración: preferencias del auditor (sucursales, y lo que se vaya agregando) ---- */
function AIModalSucursales({ sucursalesAI, setSucursalesAI, onCerrar }) {
  const [nueva, setNueva] = useState("");
  const agregar = () => {
    const n = nueva.trim();
    if (n && !sucursalesAI.includes(n)) setSucursalesAI((p) => [...p, n]);
    setNueva("");
  };
  const quitar = (s) => setSucursalesAI((p) => p.filter((x) => x !== s));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onCerrar}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 380, maxWidth: "90vw", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 12px 40px rgba(0,0,0,.25)", display: "grid", gap: 14 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Sucursales</div>
          <button onClick={onCerrar} style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}><Ico name="X" size={18} color={T.muted} /></button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input autoFocus value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} placeholder="Nombre de la sucursal" className="sel" style={{ ...sx.sel, flex: 1 }} />
          <button onClick={agregar} className="actbtn" style={{ ...sx.actbtn, background: T.brand }}>Agregar</button>
        </div>
        <div style={{ display: "grid", gap: 6 }}>
          {sucursalesAI.map((s) => (
            <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.paper, borderRadius: 8, padding: "8px 12px" }}>
              <span style={{ fontSize: 13 }}>{s}</span>
              <button onClick={() => quitar(s)} title="Quitar" style={{ background: "none", border: "none", cursor: "pointer", lineHeight: 0 }}><Ico name="X" size={15} color={T.bad} /></button>
            </div>
          ))}
          {sucursalesAI.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>No hay sucursales — agrega al menos una.</div>}
        </div>
      </div>
    </div>
  );
}

function AIConfiguracion({ sucursalesAI, setSucursalesAI, onSalir }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div>
      <button onClick={onSalir} style={sx.back}>‹ Auditoría Interna</button>
      <div style={sx.h1row}><h1 style={sx.h1}>Configuración</h1></div>

      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, maxWidth: 520 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", gap: 14 }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500 }}>Sucursales</div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Aplica a Recepción de Cortes y Conteo de Cortes</div>
          </div>
          <button onClick={() => setAbierto(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${T.line}`, borderRadius: 8, padding: "7px 12px", background: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap" }}>
            Agregar o eliminar<Ico name="ChevronRight" size={14} color={T.muted} />
          </button>
        </div>
      </div>

      {abierto && <AIModalSucursales sucursalesAI={sucursalesAI} setSucursalesAI={setSucursalesAI} onCerrar={() => setAbierto(false)} />}
    </div>
  );
}

function AuditoriaInterna() {
  const [panel, setPanel] = useState(null);
  // Estos cinco ya no viven solo en memoria: se leen y se guardan de verdad
  // en la base de datos del servidor (ver src/hooks/persistence.js). El resto
  // del módulo (AIRecepcion, AIConteo, AISalidas, AIConfiguracion, etc.) no
  // cambia nada — sigue usando [valor, setValor] exactamente igual que antes.
  const [recepciones, setRecepciones, recepcionesListas] = usePersistedCollection("recepciones");
  const [salidas, setSalidas, salidasListas] = usePersistedCollection("salidas");
  const [conteos, setConteos, conteosListos] = usePersistedCollection("conteos");
  const [borradoresConteo, setBorradoresConteo, borradoresListos] = usePersistedCollection("borradores_conteo");
  const [sucursalesAI, setSucursalesAI] = usePersistedList("sucursalesAI", [...SUCURSALES]);

  const datosListos = recepcionesListas && salidasListas && conteosListos && borradoresListos;

  const tituloPanel = AI_PANELES_CAPTURA.find((p) => p.key === panel)?.nombre || AI_PANELES_VISUAL.find((p) => p.key === panel)?.nombre || AI_PANELES_CONFIG.find((p) => p.key === panel)?.nombre || "Panel principal";

  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Auditoría Interna</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{panel ? tituloPanel : "Panel principal"}</div>
        </div>
      </header>
      <main style={sx.main}>
        {!datosListos && <div style={sx.empty}>Cargando datos…</div>}
        {datosListos && !panel && <AIHome onEnter={setPanel} />}
        {datosListos && panel === "recepcion" && <AIRecepcion recepciones={recepciones} setRecepciones={setRecepciones} onSalir={() => setPanel(null)} sucursales={sucursalesAI} />}
        {datosListos && panel === "conteo" && <AIConteo recepciones={recepciones} setRecepciones={setRecepciones} conteos={conteos} setConteos={setConteos} borradores={borradoresConteo} setBorradores={setBorradoresConteo} onSalir={() => setPanel(null)} sucursales={sucursalesAI} />}
        {datosListos && panel === "v1" && <AICierreSemanal recepciones={recepciones} sucursales={sucursalesAI} onSalir={() => setPanel(null)} />}
        {datosListos && panel === "v3" && <AISaldoEfectivo conteos={conteos} salidas={salidas} onSalir={() => setPanel(null)} />}
        {datosListos && panel === "salidas" && <AISalidas salidas={salidas} setSalidas={setSalidas} conteos={conteos} onSalir={() => setPanel(null)} />}
        {datosListos && panel === "config" && <AIConfiguracion sucursalesAI={sucursalesAI} setSucursalesAI={setSucursalesAI} onSalir={() => setPanel(null)} />}
      </main>
    </>
  );
}

/* ---------------- MENÚ DE ÁREAS ---------------- */
function AreasHome({ resumen, onEnter }) {
  const activas = AREAS.filter((a) => a.activa).length;
  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Panel de mantenimiento</h1>
        <span style={{ fontSize: 12, color: T.muted }}>{activas} de {AREAS.length} áreas activas</span>
      </div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 22 }}>
        Entra a un área para ver su tablero, reportes e informes. Las áreas marcadas como "Por configurar" se irán activando conforme definamos sus equipos.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {AREAS.map((a) => {
          const r = resumen[a.key];
          const disp = r ? r.disp : null;
          return (
            <button
              key={a.key}
              className={a.activa ? "rowbtn" : ""}
              onClick={() => a.activa && onEnter(a.key)}
              disabled={!a.activa}
              style={{
                ...sx.areaCard,
                cursor: a.activa ? "pointer" : "default",
                opacity: a.activa ? 1 : 0.72,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: a.activa ? T.brand : T.muted, display: "flex" }}><Ico name={a.iconName} size={24} strokeWidth={1.8} /></span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{a.nombre}</div>
                    <div style={{ fontSize: 11.5, color: T.muted }}>{a.desc}</div>
                  </div>
                </div>
                {a.activa && r
                  ? <span style={{ width: 10, height: 10, borderRadius: 99, background: disp >= 90 ? T.ok : disp >= 75 ? T.warn : T.bad, marginTop: 6 }} />
                  : <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 8px", borderRadius: 99 }}>Por configurar</span>}
              </div>

              {a.activa && r ? (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 22, color: disp >= 90 ? T.ok : disp >= 75 ? T.warn : T.bad }}>{disp}%</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{r.total} equipos · {r.abiertos} reportes abiertos</div>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.brand }}>Ver detalle ›</span>
                </div>
              ) : (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.lineSoft}`, fontSize: 11.5, color: T.muted, textAlign: "left" }}>
                  Probablemente incluya: {a.hint}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AreaPlaceholder({ area, onBack }) {
  if (!area) return null;
  return (
    <div style={{ maxWidth: 560 }}>
      <button className="link" style={sx.back} onClick={onBack}>‹ Volver a áreas</button>
      <div style={{ textAlign: "center", padding: "40px 20px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, marginTop: 8 }}>
        <div style={{ fontSize: 44 }}><span style={{ display: "flex", justifyContent: "center", color: T.brand }}><Ico name={area.iconName} size={46} strokeWidth={1.6} /></span></div>
        <h1 style={{ ...sx.h1, fontSize: 22, marginTop: 10 }}>{area.nombre}</h1>
        <p style={{ fontSize: 13.5, color: T.inkSoft, maxWidth: 420, margin: "12px auto 0", lineHeight: 1.5 }}>
          Esta área todavía no está configurada. Cuando definamos sus equipos, sus fallas y su criticidad —igual que hicimos con Sucursales— aquí aparecerán su tablero, sus reportes y sus informes.
        </p>
        {area.hint && (
          <p style={{ fontSize: 12, color: T.muted, marginTop: 14, fontStyle: "italic" }}>
            Probablemente incluya: {area.hint}
          </p>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DEPARTAMENTO DE INVENTARIOS
   ============================================================ */
const addDaysISO = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1);
const INVMES_SEED = { 5: {} };
const invConsumo = (r) => r.productos ? r.productos.reduce((s, p) => s + (p.inicial + p.compras - p.final) * p.precio, 0) : (r.inicial + r.compras - r.final);

const INV_SECCIONES = [
  { key: "mensuales", nombre: "Inventarios Mensuales", iconName: "CalendarRange", activa: true, desc: "Toma por periodo · consumo y costo" },
  { key: "desechables", nombre: "Inventario de Desechables", iconName: "Package", activa: true, desc: "Vasos por tamaño · sistema vs conteo físico" },
  { key: "criticos", nombre: "Inventarios Productos Críticos", iconName: "AlertTriangle", activa: false, desc: "Insumos de alto costo o alta rotación" },
];

/* Usuarios con acceso a "Ver detalle" y "Editar" en Inventarios Mensuales.
   Simula el inicio de sesión: solo estos dos ven y editan el detalle capturado. */
const INV_USUARIOS_ACCESO_TOTAL = ["Ricardo Administrador", "Carlos Administrador"];
const INV_USUARIOS = ["Ricardo Administrador", "Carlos Administrador", "Encargado de Almacén", "Gerente de Sucursal", "Auditor"];

function Inventarios({ inv, setInv, invMes, setInvMes }) {
  const [sec, setSec] = useState(null);
  // Sin selector visible por ahora (aún no hay sistema de usuarios/login real). El acceso
  // completo de Ricardo y Carlos se mantiene tal cual para cuando exista un login de verdad.
  const usuario = INV_USUARIOS[0];
  const secMeta = INV_SECCIONES.find((s) => s.key === sec);
  const draftFlushRef = useRef(null);
  const irASecciones = () => {
    if (draftFlushRef.current) draftFlushRef.current(); // si hay una captura en curso, se guarda como borrador antes de salir
    setSec(null);
  };
  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Inventarios</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{secMeta ? secMeta.nombre : "Panel del departamento"}</div>
        </div>
        <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {sec && <button onClick={irASecciones} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Secciones</button>}
        </nav>
      </header>
      <main style={sx.main}>
        {!sec && <InvHome invMes={invMes} onEnter={setSec} />}
        {sec === "mensuales" && <InvMensuales invMes={invMes} setInvMes={setInvMes} draftFlushRef={draftFlushRef} usuario={usuario} />}
        {sec === "desechables" && <InvDesechables />}
        {secMeta && !secMeta.activa && <FranqPlaceholder sec={secMeta} />}
      </main>
    </>
  );
}

/* ===== Inventario de Desechables (vasos por tamaño: sistema vs físico) =====
   Conexión con Almacén: cada NOTA que genera Almacén se autocarga como ENTRADA (Recibido).
   Sistema = Inicial + Recibido (notas de almacén) − Vendido (punto de venta).
   La sucursal NO confirma recibido: Almacén es la fuente de verdad de las entradas. */
const VASO_TAMANOS = ["7 oz", "8 oz", "10 oz", "12 oz", "32 oz", "Cono", "Súper cono"];
const OTROS_DESECH = ["Cucharas", "Servilletas", "Bolsas chicas", "Bolsas grandes", "Tapas"];
const DESECH_ITEMS = [...VASO_TAMANOS.map((t) => (t.includes("oz") ? `Vaso ${t}` : t)), ...OTROS_DESECH];
const PERIODO_FACTOR = { "Mes actual": 1, "Últimos 7 días": 0.28, "Ayer": 0.05, "Personalizado": 0.5 };
const inPeriodoNota = (dias, periodo) => (periodo === "Ayer" ? dias <= 1 : periodo === "Últimos 7 días" ? dias <= 7 : true);
const porCajaDe = (item) => (item.startsWith("Vaso") || item === "Cono" || item === "Súper cono" ? 50 : 100);
/* Feed simulado del servidor de Almacén: cada sucursal recibe varias notas al mes.
   En producción esto llega por integración (API/webhook o export del sistema de almacén). */
const NOTAS_ALMACEN = (() => {
  const notas = [];
  SUCURSALES.forEach((suc) => {
    const n = 3 + (vhash("nn" + suc) % 3); // 3–5 notas al mes
    for (let k = 0; k < n; k++) {
      const dias = 1 + (vhash("nd" + suc + k) % 28);
      const items = DESECH_ITEMS.map((item) => {
        if (vhash("ni" + suc + k + item) % 3 === 0) return null; // ~⅓ de ítems no vienen en cada nota
        const cajas = 1 + (vhash("nc" + suc + k + item) % 6);
        return { item, cant: cajas * porCajaDe(item) };
      }).filter(Boolean);
      notas.push({ folio: `AL-${1000 + (vhash("nf" + suc + k) % 9000)}`, suc, dias, items });
    }
  });
  return notas;
})();
const entradasDe = (suc, item, periodo) => NOTAS_ALMACEN.filter((nt) => nt.suc === suc && inPeriodoNota(nt.dias, periodo)).reduce((a, nt) => { const it = nt.items.find((x) => x.item === item); return a + (it ? it.cant : 0); }, 0);
const inicialDe = (suc, item) => 150 + (vhash("di" + suc + item) % 350);
const vendidoDe = (suc, item, periodo) => Math.round((550 + (vhash("dv" + suc + item) % 1500)) * (PERIODO_FACTOR[periodo] ?? 1));
const sistemaDe = (suc, item, periodo) => Math.max(0, inicialDe(suc, item) + entradasDe(suc, item, periodo) - vendidoDe(suc, item, periodo));
const fisicoDefault = (suc, item, periodo) => { const s = sistemaDe(suc, item, periodo); const merma = Math.round(s * ((vhash("dm" + suc + item + periodo) % 8) / 100)); return Math.max(0, s - merma); };

function InvDesechables() {
  const [suc, setSuc] = useState(SUCURSALES[0]);
  const [modo, setModo] = useState("comparar"); // comparar | capturar
  const [periodo, setPeriodo] = useState("Mes actual");
  const [fIni, setFIni] = useState("");
  const [fFin, setFFin] = useState("");
  const items = [...VASO_TAMANOS.map((t) => ({ item: t.includes("oz") ? `Vaso ${t}` : t, grupo: "Vasos" })), ...OTROS_DESECH.map((o) => ({ item: o, grupo: "Otros" }))];
  const [fisico, setFisico] = useState({});
  const keyOf = (item) => `${suc}|${periodo}|${item}`;
  const fisVal = (item) => (fisico[keyOf(item)] !== undefined ? fisico[keyOf(item)] : fisicoDefault(suc, item, periodo));
  const setFis = (item, v) => setFisico((p) => ({ ...p, [keyOf(item)]: v === "" ? 0 : Number(v) }));

  const filas = items.map(({ item, grupo }) => { const sis = sistemaDe(suc, item, periodo); const ent = entradasDe(suc, item, periodo); const fis = fisVal(item); const dif = fis - sis; const pct = sis ? (dif / sis) * 100 : 0; return { item, grupo, sis, ent, fis, dif, pct }; });
  const vasos = filas.filter((f) => f.grupo === "Vasos");
  const totSis = filas.reduce((a, f) => a + f.sis, 0);
  const totFis = filas.reduce((a, f) => a + f.fis, 0);
  const totEnt = filas.reduce((a, f) => a + f.ent, 0);
  const totDif = totFis - totSis;
  const descuadres = filas.filter((f) => Math.abs(f.pct) >= 3).length;
  const difCol = (pct) => (Math.abs(pct) < 2 ? T.ok : Math.abs(pct) < 5 ? T.warn : T.bad);
  const notasSuc = NOTAS_ALMACEN.filter((n) => n.suc === suc && inPeriodoNota(n.dias, periodo)).sort((a, b) => a.dias - b.dias);
  const faltantes = filas.filter((f) => f.ent > 0 && f.pct <= -5);

  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Inventario de Desechables</h1>
        <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2 }}>
          {[["comparar", "Comparativo"], ["capturar", "Capturar conteo"]].map(([k, l]) => <button key={k} onClick={() => setModo(k)} style={{ padding: "6px 13px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: modo === k ? T.ink : "transparent", color: modo === k ? "#fff" : T.muted }}>{l}</button>)}
        </div>
      </div>
      <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" }}>
        <select className="sel" value={suc} onChange={(e) => setSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12.5, width: "auto", minWidth: 200 }}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: 3, gap: 2 }}>
            {["Mes actual", "Últimos 7 días", "Ayer"].map((p) => <button key={p} onClick={() => setPeriodo(p)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, background: periodo === p ? T.ink : "transparent", color: periodo === p ? "#fff" : T.muted }}>{p}</button>)}
          </div>
          <button onClick={() => setPeriodo("Personalizado")} className="actbtn" style={{ ...sx.actbtn, fontSize: 12, padding: "8px 14px", background: periodo === "Personalizado" ? T.brandSoft : "#fff", color: periodo === "Personalizado" ? T.brand : T.inkSoft, border: `1px solid ${periodo === "Personalizado" ? T.brand : T.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Calendar" size={14} color={periodo === "Personalizado" ? T.brand : T.inkSoft} />Elegir fechas</button>
        </div>
      </div>
      {periodo === "Personalizado" && (
        <div style={{ ...sx.repCard, display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <TField label="Desde"><input type="date" value={fIni} onChange={(e) => setFIni(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} /></TField>
          <TField label="Hasta"><input type="date" value={fFin} onChange={(e) => setFFin(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} /></TField>
        </div>
      )}

      <div style={sx.cards4}>
        <Metric big={totSis.toLocaleString("es-MX")} label="Existencia según sistema" sub="inicial + recibido − vendido" accent={T.ink} />
        <Metric big={`+${totEnt.toLocaleString("es-MX")}`} label="Recibido de almacén" sub={`${notasSuc.length} nota(s) · ${periodo.toLowerCase()}`} accent={T.brand} />
        <Metric big={totFis.toLocaleString("es-MX")} label="Conteo físico" sub="capturado en sucursal" accent={T.inkSoft} />
        <Metric big={`${totDif >= 0 ? "+" : ""}${totDif.toLocaleString("es-MX")}`} label="Diferencia total" sub={`${((totDif / (totSis || 1)) * 100).toFixed(1)}% descuadre`} accent={difCol((totDif / (totSis || 1)) * 100)} alert={Math.abs(totDif / (totSis || 1)) * 100 >= 3} />
        <Metric big={String(descuadres)} label="Ítems con descuadre" sub="diferencia ≥ 3%" accent={descuadres ? T.warn : T.ok} alert={descuadres > 0} />
      </div>

      {faltantes.length > 0 && (
        <div style={{ marginTop: 14, background: T.badSoft, border: `1px solid ${T.bad}`, borderRadius: 12, padding: "11px 14px", fontSize: 12, color: T.bad, display: "flex", alignItems: "center", gap: 9 }}>
          <Ico name="AlertTriangle" size={16} color={T.bad} />
          <span><strong>Posible faltante de pedido:</strong> {faltantes.length} ítem(s) con conteo físico ≥5% por debajo del sistema tras recibir almacén ({faltantes.slice(0, 3).map((f) => f.item).join(", ")}{faltantes.length > 3 ? "…" : ""}). Revisa si alguna nota llegó incompleta.</span>
        </div>
      )}

      <div style={{ marginTop: 16, border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 14px", background: T.paper, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Truck" size={15} color={T.brand} />Notas de almacén recibidas · {suc}</span>
          <span style={{ fontSize: 10.5, color: T.muted }}>autocargadas del servidor de almacén · se reflejan como entradas</span>
        </div>
        {notasSuc.length === 0 && <div style={{ padding: "12px 14px", fontSize: 12, color: T.muted }}>Sin notas de almacén en {periodo.toLowerCase()}.</div>}
        {notasSuc.map((n, i) => { const pz = n.items.reduce((a, it) => a + it.cant, 0); return (
          <div key={n.folio + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderTop: `1px solid ${T.lineSoft}`, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.brand, background: T.brandSoft, padding: "2px 8px", borderRadius: 99 }}>{n.folio}</span>
            <span style={{ fontSize: 11.5, color: T.muted }}>{n.dias === 1 ? "ayer" : `hace ${n.dias} días`}</span>
            <span style={{ fontSize: 11.5, color: T.inkSoft }}>{n.items.length} ítems</span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700 }}>{pz.toLocaleString("es-MX")} pz</span>
          </div>
        ); })}
      </div>

      {modo === "capturar" ? (
        <div style={{ marginTop: 22 }}>
          <div style={sx.sectionTitle}>Capturar conteo físico · {suc}</div>
          <div style={{ ...sx.repCard, display: "grid", gap: 4, padding: 0, overflow: "hidden" }}>
            {filas.map((f, i) => (
              <div key={f.item} style={{ padding: "9px 14px", borderBottom: i < filas.length - 1 ? `1px solid ${T.lineSoft}` : "none", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, fontWeight: f.grupo === "Vasos" ? 600 : 400 }}>{f.item}</span>
                <span style={{ fontSize: 11, color: T.muted, width: 96 }}>Recibido: <strong style={{ color: T.brand }}>{f.ent.toLocaleString("es-MX")}</strong></span>
                <span style={{ fontSize: 11, color: T.muted, width: 120 }}>Sistema: <strong style={{ color: T.ink }}>{f.sis.toLocaleString("es-MX")}</strong></span>
                <input type="number" value={fisVal(f.item)} onChange={(e) => setFis(f.item, e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12.5, width: 110, textAlign: "right" }} />
                <span style={{ width: 70, textAlign: "right", fontSize: 12, fontWeight: 700, color: difCol(f.pct) }}>{f.dif >= 0 ? "+" : ""}{f.dif}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 10, fontStyle: "italic" }}>Escribe lo contado físicamente; la diferencia contra el sistema se calcula en vivo. El "sistema" viene del punto de venta (marcado por tamaño de vaso).</div>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 22 }}>
            <div style={sx.sectionTitle}>Vasos y conos por tipo · sistema vs físico</div>
            <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
                <thead>
                  <tr style={{ background: T.paper, textAlign: "left" }}>
                    {["Tipo", "Recibido", "Sistema", "Físico", "Diferencia", "%", ""].map((h, i) => <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: T.inkSoft, textAlign: i === 0 || i === 6 ? "left" : "right", borderBottom: `1px solid ${T.line}` }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {vasos.map((f) => (
                    <tr key={f.item}>
                      <td style={{ padding: "9px 14px", fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}` }}>{f.item}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, color: f.ent ? T.brand : T.muted, fontWeight: 600 }}>{f.ent ? "+" + f.ent.toLocaleString("es-MX") : "—"}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, color: T.inkSoft }}>{f.sis.toLocaleString("es-MX")}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 600 }}>{f.fis.toLocaleString("es-MX")}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, fontWeight: 700, color: difCol(f.pct) }}>{f.dif >= 0 ? "+" : ""}{f.dif}</td>
                      <td style={{ padding: "9px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, color: difCol(f.pct), fontWeight: 600 }}>{f.pct >= 0 ? "+" : ""}{f.pct.toFixed(1)}%</td>
                      <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: difCol(f.pct), padding: "2px 8px", borderRadius: 99 }}>{Math.abs(f.pct) < 2 ? "OK" : Math.abs(f.pct) < 5 ? "Revisar" : "Descuadre"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={sx.sectionTitle}>Otros desechables</div>
            <div style={{ display: "grid", gap: 6 }}>
              {filas.filter((f) => f.grupo === "Otros").map((f) => (
                <div key={f.item} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", flexWrap: "wrap" }}>
                  <span style={{ flex: 1, minWidth: 120, fontSize: 12.5, fontWeight: 600 }}>{f.item}</span>
                  <span style={{ fontSize: 11.5, color: T.muted }}>Recibido <strong style={{ color: T.brand }}>{f.ent.toLocaleString("es-MX")}</strong> · Sistema {f.sis.toLocaleString("es-MX")} · Físico {f.fis.toLocaleString("es-MX")}</span>
                  <span style={{ width: 60, textAlign: "right", fontWeight: 700, fontSize: 12.5, color: difCol(f.pct) }}>{f.dif >= 0 ? "+" : ""}{f.dif}</span>
                  <span style={{ width: 54, textAlign: "right", fontSize: 11.5, color: difCol(f.pct) }}>{f.pct >= 0 ? "+" : ""}{f.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>El "sistema" ahora se arma con <strong>Inicial + Recibido − Vendido</strong>: el <strong>Recibido</strong> son las notas que genera Almacén y se autocargan aquí (la sucursal no confirma nada); el <strong>Vendido</strong> viene del punto de venta. El <strong>físico</strong> es el conteo del inventarista, y la diferencia contra el sistema es la merma/descuadre.</div>
        </>
      )}
    </div>
  );
}

function InvHome({ invMes, onEnter }) {
  const mesActual = 5;
  const recs = invMes[mesActual] || {};
  const colC = (p) => (p <= 39 ? T.ok : p <= 43 ? T.warn : T.bad);
  const filas = SUCURSALES.map((suc) => {
    const r = recs[suc];
    const cargado = !!(r && r.cargado);
    const consumo = cargado ? invConsumo(r) : 0;
    const venta = cargado ? (r.ventaPeriodo || 0) : 0;
    const pct = venta ? (consumo / venta) * 100 : 0;
    return { suc, cargado, consumo, venta, pct };
  });
  const cargados = filas.filter((f) => f.cargado).length;
  const pendientes = SUCURSALES.length - cargados;
  const totConsumo = filas.reduce((s, f) => s + f.consumo, 0);
  const totVenta = filas.reduce((s, f) => s + f.venta, 0);
  const pctGlobal = totVenta ? (totConsumo / totVenta) * 100 : 0;
  const mesLbl = `${MESES_LBL[mesActual]} 2025`;

  const miniMetrics = [
    { big: `${cargados}/${SUCURSALES.length}`, label: "sucursales cargadas", sub: mesLbl, col: cargados === SUCURSALES.length ? T.ok : T.warn },
    { big: String(pendientes), label: pendientes === 1 ? "pendiente por cargar" : "pendientes por cargar", sub: pendientes ? "requieren captura" : "todo al día", col: pendientes ? T.bad : T.ok },
    { big: cargados ? `${pctGlobal.toFixed(1)}%` : "—", label: "% de costo del mes", sub: "ideal ≤ 39%", col: cargados ? colC(pctGlobal) : T.muted },
    { big: money(totConsumo), label: "costo del mes", sub: "sucursales cargadas", col: T.ink },
  ];

  /* pendientes primero (acción), luego cargadas por mayor % de costo */
  const ordenadas = [...filas].sort((a, b) => (a.cargado === b.cargado ? b.pct - a.pct : a.cargado ? 1 : -1));
  const restantes = INV_SECCIONES.filter((s) => s.key !== "mensuales");

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Inventarios</h1><span style={{ fontSize: 12, color: T.muted }}>toma de inventario · consumo y costo</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 20 }}>Los inventarios mensuales se muestran al detalle con su avance de captura y consumo por sucursal; las demás secciones conservan su indicador clave por ahora.</p>

      {/* === Vista rápida: Inventarios Mensuales === */}
      <div className="rowbtn" onClick={() => onEnter("mensuales")} style={{ ...sx.areaCard, padding: 0, overflow: "hidden", cursor: "pointer", marginBottom: 16, borderColor: pendientes ? T.warn : T.line }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "16px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: T.brand, display: "flex" }}><Ico name="CalendarRange" size={24} strokeWidth={1.8} /></span>
            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Inventarios Mensuales</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.brand, background: T.brandSoft, padding: "2px 8px", borderRadius: 99 }}>Vista rápida</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, background: T.lineSoft, padding: "2px 8px", borderRadius: 99 }}>{mesLbl}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Toma por periodo · consumo y costo por sucursal</div>
            </div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.brand, whiteSpace: "nowrap", alignSelf: "center" }}>Entrar ›</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, background: T.paper }}>
          {miniMetrics.map((m, i) => (
            <div key={i} style={{ padding: "11px 16px", borderLeft: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 21, color: m.col }}>{m.big}</span>
              <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "6px 0 2px" }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted }}>Captura por sucursal · {SUCURSALES.length} sucursales</span>
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, fontSize: 10, color: T.muted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: T.ok }} />Finalizado</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 6, height: 6, borderRadius: 99, background: T.warn }} />Pendiente</span>
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", columnGap: 24 }}>
            {[ordenadas.slice(0, Math.ceil(ordenadas.length / 2)), ordenadas.slice(Math.ceil(ordenadas.length / 2))].map((col, ci) => (
              <div key={ci}>
                {col.map((f) => (
                  <div key={f.suc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px solid ${T.lineSoft}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: f.cargado ? T.ok : T.warn, flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.suc}</span>
                    <span style={{ marginLeft: "auto", flexShrink: 0 }}>
                      {f.cargado
                        ? <span style={{ fontSize: 12.5, fontWeight: 700, color: colC(f.pct) }}>{f.pct.toFixed(1)}%</span>
                        : <span style={{ fontSize: 10.5, color: T.muted }}>pendiente</span>}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* === Resto de secciones === */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {restantes.map((s) => (
          <button key={s.key} className={s.activa ? "rowbtn" : ""} onClick={() => s.activa && onEnter(s.key)} disabled={!s.activa} style={{ ...sx.areaCard, cursor: s.activa ? "pointer" : "default", opacity: s.activa ? 1 : 0.72 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: s.activa ? T.brand : T.muted, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.desc}</div>
                </div>
              </div>
              {!s.activa && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 8px", borderRadius: 99 }}>Por configurar</span>}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 12, fontWeight: 600, color: s.activa ? T.brand : T.muted }}>{s.activa ? "Ver sección ›" : "Próximamente"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const PROD_PUENTES = [
  { cat: "Fórmula", nombre: "MIX BASE BLUEBERRY", precio: 46.0 },
  { cat: "Fórmula", nombre: "MIX BASE VAINILLA", precio: 50.0 },
  { cat: "Fórmula", nombre: "MIX BASE YOGURT", precio: 54.0 },
  { cat: "Fórmula", nombre: "MIX BASE YOGURT LIGHT", precio: 58.0 },
  { cat: "Fruta", nombre: "BLUEBERRY ENCHAROLADA", precio: 36.0 },
  { cat: "Fruta", nombre: "CEREZA MITADES", precio: 37.33 },
  { cat: "Fruta", nombre: "CEREZA SIN TALLO", precio: 38.67 },
  { cat: "Fruta", nombre: "DURAZNO MITADES", precio: 40.0 },
  { cat: "Fruta", nombre: "FRESA ENCHAROLADA", precio: 41.33 },
  { cat: "Fruta", nombre: "FRESA CONGELADA", precio: 42.67 },
  { cat: "Fruta", nombre: "KIWI", precio: 44.0 },
  { cat: "Fruta", nombre: "MANGO", precio: 45.33 },
  { cat: "Fruta", nombre: "MANZANA", precio: 46.67 },
  { cat: "Fruta", nombre: "FRAMBUESA ENCHAROLADA", precio: 48.0 },
  { cat: "Fruta", nombre: "ZARZAMORA ENCHAROLADA", precio: 49.33 },
  { cat: "Fruta", nombre: "PIÑA", precio: 50.67 },
  { cat: "Fruta", nombre: "UVA", precio: 52.0 },
  { cat: "Granos", nombre: "ALMENDRA FILETEADA", precio: 58.0 },
  { cat: "Granos", nombre: "AMARANTO ENMIELADO", precio: 60.4 },
  { cat: "Granos", nombre: "AMARANTO INFLADO", precio: 62.8 },
  { cat: "Granos", nombre: "ARANDANO DESHIDRATADO", precio: 65.2 },
  { cat: "Granos", nombre: "AVENA TOSTADA", precio: 67.6 },
  { cat: "Granos", nombre: "CACAHUATE CANTINERO", precio: 70.0 },
  { cat: "Granos", nombre: "CACAHUATE QUEBRADO", precio: 72.4 },
  { cat: "Granos", nombre: "COCO RALLADO", precio: 74.8 },
  { cat: "Granos", nombre: "GRANOLA MIX", precio: 77.2 },
  { cat: "Granos", nombre: "NUEZ GRANILLO", precio: 79.6 },
  { cat: "Granos", nombre: "UVA PASA", precio: 82.0 },
  { cat: "Confitería", nombre: "BANDERILLA CHOCOLATE", precio: 58.0 },
  { cat: "Confitería", nombre: "CAJETA UNTABLE", precio: 58.93 },
  { cat: "Confitería", nombre: "POLVO CHAVITO", precio: 59.85 },
  { cat: "Confitería", nombre: "CHOCOTINES", precio: 60.78 },
  { cat: "Confitería", nombre: "COBERTURA CLASICA", precio: 61.71 },
  { cat: "Confitería", nombre: "COBERTURA COOKIES", precio: 62.63 },
  { cat: "Confitería", nombre: "COBERTURA FERRERO", precio: 63.56 },
  { cat: "Confitería", nombre: "CONFICHOCKY", precio: 64.49 },
  { cat: "Confitería", nombre: "CREMA ALMENDRA", precio: 65.41 },
  { cat: "Confitería", nombre: "CREMA AVELLANA", precio: 66.34 },
  { cat: "Confitería", nombre: "CREMINO BICOLOR", precio: 67.27 },
  { cat: "Confitería", nombre: "CREMA NUEZ", precio: 68.2 },
  { cat: "Confitería", nombre: "GRANILLO CHOCOLATE", precio: 69.12 },
  { cat: "Confitería", nombre: "GRANILLO COLORES", precio: 70.05 },
  { cat: "Confitería", nombre: "HORMIGUITAS", precio: 70.98 },
  { cat: "Confitería", nombre: "LECHERA NESTLE", precio: 71.9 },
  { cat: "Confitería", nombre: "LACTEO CONDENSADO", precio: 72.83 },
  { cat: "Confitería", nombre: "LUCKY GUMMYS OSITOS", precio: 73.76 },
  { cat: "Confitería", nombre: "MIEL MAPLE", precio: 74.68 },
  { cat: "Confitería", nombre: "MAZAPAN AZTECA", precio: 75.61 },
  { cat: "Confitería", nombre: "MERMELADA FRESA", precio: 76.54 },
  { cat: "Confitería", nombre: "MERMELADA MANGO", precio: 77.46 },
  { cat: "Confitería", nombre: "MERMELADA PIÑA", precio: 78.39 },
  { cat: "Confitería", nombre: "MERMELADA ZARZAMORA", precio: 79.32 },
  { cat: "Confitería", nombre: "POLVO MIGUELITO", precio: 80.24 },
  { cat: "Confitería", nombre: "MIEL ABEJA", precio: 81.17 },
  { cat: "Confitería", nombre: "MALVABON FRESA", precio: 82.1 },
  { cat: "Confitería", nombre: "MINI MINI BIANCHI", precio: 83.02 },
  { cat: "Confitería", nombre: "MINIKISS", precio: 83.95 },
  { cat: "Confitería", nombre: "MINI SELFIES YOGURT", precio: 84.88 },
  { cat: "Confitería", nombre: "MOIBON", precio: 85.8 },
  { cat: "Confitería", nombre: "NUGS", precio: 86.73 },
  { cat: "Confitería", nombre: "OREO TAPA", precio: 87.66 },
  { cat: "Confitería", nombre: "PANDITAS RICOLINO", precio: 88.59 },
  { cat: "Confitería", nombre: "PAN VAINILLA", precio: 89.51 },
  { cat: "Confitería", nombre: "QUESO CREMA", precio: 90.44 },
  { cat: "Confitería", nombre: "RAFAELLO", precio: 91.37 },
  { cat: "Confitería", nombre: "ROMPOPE", precio: 92.29 },
  { cat: "Confitería", nombre: "SELFIES CHOCO MENTA", precio: 93.22 },
  { cat: "Confitería", nombre: "SELFIES CONFITADOS CHOCOLATE", precio: 94.15 },
  { cat: "Confitería", nombre: "SUAVICREMAS", precio: 95.07 },
  { cat: "Confitería", nombre: "TARUGOS MINI BANDERILLA", precio: 96.0 },
  { cat: "Conos", nombre: "CANASTA VAINILLA", precio: 3.0 },
  { cat: "Conos", nombre: "CONO MARTINEZ", precio: 3.4 },
  { cat: "Conos", nombre: "PORTACONO FY VERDE", precio: 3.8 },
  { cat: "Conos", nombre: "SUPER CONO WAFFLE", precio: 4.2 },
  { cat: "Snacks", nombre: "CREPA ENCHAROLADA", precio: 14.0 },
  { cat: "Snacks", nombre: "QUESO CHEDDAR", precio: 16.22 },
  { cat: "Snacks", nombre: "DORITOS NACHO", precio: 18.44 },
  { cat: "Snacks", nombre: "ELOTE DESGRANADO", precio: 20.67 },
  { cat: "Snacks", nombre: "HOT NUTS", precio: 22.89 },
  { cat: "Snacks", nombre: "NACHOS EMPACADOS", precio: 25.11 },
  { cat: "Snacks", nombre: "QUESO RALLADO", precio: 27.33 },
  { cat: "Snacks", nombre: "RUFFLES QUESO", precio: 29.56 },
  { cat: "Snacks", nombre: "TOSTITO FLAMING HOT", precio: 31.78 },
  { cat: "Snacks", nombre: "TOSTITO SALSA VERDE", precio: 34.0 },
  { cat: "Líquidos", nombre: "AGUA EMBOTELLADA 500ML", precio: 8.0 },
  { cat: "Líquidos", nombre: "MAYONESA BOTE", precio: 12.77 },
  { cat: "Líquidos", nombre: "CREMA VEGETAL CAMELIA", precio: 17.54 },
  { cat: "Líquidos", nombre: "CREMA BATIDA", precio: 22.31 },
  { cat: "Líquidos", nombre: "COCA-COLA 450ML", precio: 27.08 },
  { cat: "Líquidos", nombre: "CHAMOY 1LT", precio: 31.85 },
  { cat: "Líquidos", nombre: "COMPUESTO ACEITE", precio: 36.62 },
  { cat: "Líquidos", nombre: "DIP CHIPOTLE", precio: 41.38 },
  { cat: "Líquidos", nombre: "JARABE TRES LECHES", precio: 46.15 },
  { cat: "Líquidos", nombre: "SALSA ELOTERA", precio: 50.92 },
  { cat: "Líquidos", nombre: "SALSA ROJA", precio: 55.69 },
  { cat: "Líquidos", nombre: "SALSA VERDE", precio: 60.46 },
  { cat: "Líquidos", nombre: "YOGURT LALA NATURAL", precio: 65.23 },
  { cat: "Líquidos", nombre: "YOGURT LALA LIGHT", precio: 70.0 },
  { cat: "Limpieza", nombre: "BOLSA BASURA 70X90", precio: 18.0 },
  { cat: "Limpieza", nombre: "BOLSA BASURA 90X120", precio: 23.11 },
  { cat: "Limpieza", nombre: "CLORO EMBOTELLADO", precio: 28.22 },
  { cat: "Limpieza", nombre: "DETERGENTE POLVO", precio: 33.33 },
  { cat: "Limpieza", nombre: "ESCOBA", precio: 38.44 },
  { cat: "Limpieza", nombre: "FIBRA TRASTES", precio: 43.56 },
  { cat: "Limpieza", nombre: "GEL ANTIBACTERIAL", precio: 48.67 },
  { cat: "Limpieza", nombre: "GOTERO DESINFECTANTE", precio: 53.78 },
  { cat: "Limpieza", nombre: "JABON LIQUIDO", precio: 58.89 },
  { cat: "Limpieza", nombre: "MICRO FIBRA COLORES", precio: 64.0 },
  { cat: "Limpieza", nombre: "PAPEL HIGIENICO", precio: 69.11 },
  { cat: "Limpieza", nombre: "PAPEL SECANTE MANOS", precio: 74.22 },
  { cat: "Limpieza", nombre: "RECOGEDOR PLASTICO", precio: 79.33 },
  { cat: "Limpieza", nombre: "RED PELO NEGRA", precio: 84.44 },
  { cat: "Limpieza", nombre: "CUCHILLA GRANDE 17", precio: 89.56 },
  { cat: "Limpieza", nombre: "CUCHILLA MEDIANA 13", precio: 94.67 },
  { cat: "Limpieza", nombre: "LUBRICANTE TAYLOR", precio: 99.78 },
  { cat: "Limpieza", nombre: "CUCHILLA CHICA 8", precio: 104.89 },
  { cat: "Limpieza", nombre: "TRAPEADOR", precio: 110.0 },
  { cat: "Desechables", nombre: "VASO 12OZ ROJO", precio: 0.45 },
  { cat: "Desechables", nombre: "TAPA 12OZ TRANSLUCIDA", precio: 0.51 },
  { cat: "Desechables", nombre: "VASO 14OZ MORADO", precio: 0.57 },
  { cat: "Desechables", nombre: "ENVASE NIEVE 4OZ", precio: 0.63 },
  { cat: "Desechables", nombre: "TAPA TP10D-TP7", precio: 0.69 },
  { cat: "Desechables", nombre: "VASO 6OZ AMARILLO", precio: 0.75 },
  { cat: "Desechables", nombre: "CHAROLA 9X9", precio: 0.81 },
  { cat: "Desechables", nombre: "BOLSA MORRALLA 10X20", precio: 0.87 },
  { cat: "Desechables", nombre: "BOLSA 30X60 CAMISETA", precio: 0.93 },
  { cat: "Desechables", nombre: "BOLSA CELOFAN 25X40", precio: 1.0 },
  { cat: "Desechables", nombre: "BOLSA CELOFAN 30X50", precio: 1.06 },
  { cat: "Desechables", nombre: "BOLSA 25X40 ROLLO", precio: 1.12 },
  { cat: "Desechables", nombre: "CHAROLA CREPA", precio: 1.18 },
  { cat: "Desechables", nombre: "ENVASE 10OZ PAPEL", precio: 1.24 },
  { cat: "Desechables", nombre: "CUCHARA DEGUSTACION", precio: 1.3 },
  { cat: "Desechables", nombre: "CUCHARA PLASTICA BARRA", precio: 1.36 },
  { cat: "Desechables", nombre: "BOLSA DELIVERY 26X32", precio: 1.42 },
  { cat: "Desechables", nombre: "TAPA 10OZ DOMO", precio: 1.48 },
  { cat: "Desechables", nombre: "VASO 10OZ ELOTERO", precio: 1.54 },
  { cat: "Desechables", nombre: "VASO 12OZ ELOTERO", precio: 1.6 },
  { cat: "Desechables", nombre: "GUANTE POLIETILENO GRANDE", precio: 1.66 },
  { cat: "Desechables", nombre: "GUANTE POLIETILENO MEDIANO", precio: 1.72 },
  { cat: "Desechables", nombre: "TENEDOR DESECHABLE", precio: 1.78 },
  { cat: "Desechables", nombre: "ENVIO MERCANCIA", precio: 1.84 },
  { cat: "Desechables", nombre: "CUCHARA LOGO FY", precio: 1.9 },
  { cat: "Desechables", nombre: "VASO 32OZ ENCERADO", precio: 1.96 },
  { cat: "Desechables", nombre: "EMPLAYE PVC 3X30", precio: 2.02 },
  { cat: "Desechables", nombre: "VASO 1LT JAGUAR", precio: 2.09 },
  { cat: "Desechables", nombre: "VASO 1/2LT JAGUAR", precio: 2.15 },
  { cat: "Desechables", nombre: "TAPA JAGUAR", precio: 2.21 },
  { cat: "Desechables", nombre: "CUCHILLO DESECHABLE", precio: 2.27 },
  { cat: "Desechables", nombre: "CHAROLA PLATOBANANA", precio: 2.33 },
  { cat: "Desechables", nombre: "TAPA 32OZ ENCERADO", precio: 2.39 },
  { cat: "Desechables", nombre: "PORTAVASOS PACTIVI", precio: 2.45 },
  { cat: "Desechables", nombre: "GUANTE NITRILO GRANDE", precio: 2.51 },
  { cat: "Desechables", nombre: "GUANTE NITRILO MEDIANO", precio: 2.57 },
  { cat: "Desechables", nombre: "ENVASE DEGUSTACION 1OZ", precio: 2.63 },
  { cat: "Desechables", nombre: "ENVASE TOPPING 2OZ", precio: 2.69 },
  { cat: "Desechables", nombre: "TAZON 7OZ BLANCO", precio: 2.75 },
  { cat: "Desechables", nombre: "ENSALADERO PRESENTABOWL", precio: 2.81 },
  { cat: "Desechables", nombre: "TAPA TOPPING 2OZ", precio: 2.87 },
  { cat: "Desechables", nombre: "VASO 16OZ REMOLINO", precio: 2.93 },
  { cat: "Desechables", nombre: "ROLLO TERMICO 80X70", precio: 2.99 },
  { cat: "Desechables", nombre: "SERVILLETA ELITE", precio: 3.05 },
  { cat: "Desechables", nombre: "TAZON 7OZ VERDE", precio: 3.12 },
  { cat: "Desechables", nombre: "TAZON 8OZ MORADO", precio: 3.18 },
  { cat: "Desechables", nombre: "TAZON 10OZ CELESTE", precio: 3.24 },
  { cat: "Desechables", nombre: "TAZON 12OZ AMARILLO", precio: 3.3 },
  { cat: "Desechables", nombre: "VASO PANDI 10OZ", precio: 3.36 },
  { cat: "Desechables", nombre: "VASO PANDI 7OZ", precio: 3.42 },
  { cat: "Desechables", nombre: "VASO N10 REYMA", precio: 3.48 },
  { cat: "Desechables", nombre: "TAZON 6OZ BLANCO", precio: 3.54 },
  { cat: "Desechables", nombre: "TAZON 8OZ BLANCO PAPEL", precio: 3.6 },
];
const numv = (x) => (x === "" || x == null ? 0 : Number(x));
const prodConsumo = (p) => numv(p.inicial) + numv(p.compras) - numv(p.final);

/* Pantalla previa a la revisión final: aquí se captura el peso físico (báscula) por producto.
   Tara = peso del recipiente vacío. Peso = uno o más pesajes (ej. producto repartido en varios
   lugares/recipientes); con el "+" se agregan más recuadros de peso para el mismo producto.
   Final = suma de los pesos capturados menos la tara. */
function CapturaPesos({ mesSel, sucInicial, invMes, onSiguiente, onCancel, draftFlushRef }) {
  const [suc] = useState(sucInicial);
  const recs = invMes[mesSel] || {};
  const recExistente = recs[suc];
  const esBorrador = !!(recExistente && !recExistente.cargado);
  const esEdicion = !!(recExistente && recExistente.cargado);

  const prevRec = (() => {
    for (let m = mesSel - 1; m >= 0; m--) { const r = invMes[m] && invMes[m][suc]; if (r && r.productos) return r; }
    return null;
  })();
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  const [ini, setIni] = useState((esBorrador || esEdicion) ? recExistente.ini : (prevRec ? prevRec.fin : hoyISO()));
  const [fin, setFin] = useState((esBorrador || esEdicion) ? (recExistente.fin || "") : hoyISO());
  const pesosDeEdicion = () => {
    if (recExistente.pesos) return recExistente.pesos; // desglose original de tara/peso, si se guardó
    if (!recExistente.productos) return {};
    const mapa = {};
    recExistente.productos.forEach((pr) => { mapa[pr.nombre] = { formato: "kg", taras: [""], cajas: [String(pr.final)] }; });
    return mapa;
  };
  const [pesos, setPesos] = useState(esBorrador ? (recExistente.pesosTemp || {}) : esEdicion ? pesosDeEdicion() : {});
  const [hover, setHover] = useState(null); // { nombre, col: "tara" | "peso" }
  const [confirmarBorrar, setConfirmarBorrar] = useState(false);
  const fieldRefs = useRef([]);

  // Quita signos negativos siempre; si soloEntero, además quita todo lo que no sea dígito (para Ud).
  const sanitizar = (v, soloEntero) => {
    if (v === "") return v;
    let s = String(v).replace(/-/g, "");
    if (soloEntero) s = s.replace(/[^\d]/g, ""); else s = s.replace(/(?!^)-/g, "");
    return s;
  };
  const sinRueda = (e) => e.currentTarget.blur();
  const irSiguienteCampo = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const i = Number(e.currentTarget.dataset.idx);
    const sig = fieldRefs.current[i + 1];
    if (sig) sig.focus();
  };

  const getPeso = (nombre) => pesos[nombre] || { formato: "kg", taras: [""], cajas: [""] };
  const setFormato = (nombre, v) => setPesos((p) => ({ ...p, [nombre]: { ...getPeso(nombre), formato: v } }));
  const setTaraBox = (nombre, idx, v) => setPesos((p) => { const act = getPeso(nombre); const taras = [...act.taras]; taras[idx] = v; return { ...p, [nombre]: { ...act, taras } }; });
  const addTara = (nombre) => setPesos((p) => { const act = getPeso(nombre); return { ...p, [nombre]: { ...act, taras: [...act.taras, ""] } }; });
  const quitarTara = (nombre, idx) => setPesos((p) => { const act = getPeso(nombre); if (act.taras.length <= 1) return p; return { ...p, [nombre]: { ...act, taras: act.taras.filter((_, i) => i !== idx) } }; });
  const setCaja = (nombre, idx, v) => setPesos((p) => { const act = getPeso(nombre); const cajas = [...act.cajas]; cajas[idx] = v; return { ...p, [nombre]: { ...act, cajas } }; });
  const addCaja = (nombre) => setPesos((p) => { const act = getPeso(nombre); return { ...p, [nombre]: { ...act, cajas: [...act.cajas, ""] } }; });
  const quitarCaja = (nombre, idx) => setPesos((p) => { const act = getPeso(nombre); if (act.cajas.length <= 1) return p; return { ...p, [nombre]: { ...act, cajas: act.cajas.filter((_, i) => i !== idx) } }; });

  // Teclado en las casillas de Tara / Peso: Enter avanza al siguiente campo, "+" agrega otra
  // casilla (de tara o de peso, según en cuál estés) y enfoca esa casilla nueva automáticamente,
  // y "-" quita la casilla actual, solo si hay más de una.
  const enfocarPendiente = useRef(null);
  useEffect(() => {
    if (enfocarPendiente.current) {
      const { nombre, col, idx } = enfocarPendiente.current;
      enfocarPendiente.current = null;
      const el = document.querySelector(`[data-campo="${nombre}__${col}__${idx}"]`);
      if (el) el.focus();
    }
  });
  const manejarTeclaCasilla = (e, nombre, col, idx) => {
    const i = Number(e.currentTarget.dataset.idx);
    if (e.key === "Enter") {
      e.preventDefault();
      const sig = fieldRefs.current[i + 1];
      if (sig) sig.focus();
    } else if (e.key === "+") {
      e.preventDefault();
      const nuevoIdx = getPeso(nombre)[col === "tara" ? "taras" : "cajas"].length;
      enfocarPendiente.current = { nombre, col, idx: nuevoIdx };
      if (col === "tara") addTara(nombre); else addCaja(nombre);
    } else if (e.key === "-") {
      e.preventDefault();
      const total = getPeso(nombre)[col === "tara" ? "taras" : "cajas"].length;
      if (total > 1) enfocarPendiente.current = { nombre, col, idx: Math.max(idx - 1, 0) };
      if (col === "tara") quitarTara(nombre, idx); else quitarCaja(nombre, idx);
    }
  };

  const tieneCaptura = (nombre) => { const { taras, cajas } = getPeso(nombre); return cajas.some((c) => c !== "" && c != null) || taras.some((t) => t !== "" && t != null); };
  const finalDe = (nombre) => {
    const { formato, taras, cajas } = getPeso(nombre);
    const sumaCajas = cajas.reduce((s, c) => s + (c === "" || c == null ? 0 : Number(c)), 0);
    const bruto = formato === "ud" ? sumaCajas : sumaCajas - taras.reduce((s, t) => s + (t === "" || t == null ? 0 : Number(t)), 0);
    return Math.round(bruto * 100) / 100;
  };

  // Guarda el avance (tara/pesos/formato) como borrador (ahora "En proceso") al cancelar o salir a Secciones.
  const construirBorrador = () => (esEdicion ? null : { ini, fin, pesosTemp: pesos, cargado: false, borrador: true });
  useEffect(() => {
    if (draftFlushRef) draftFlushRef.current = () => onCancel(suc, construirBorrador());
    return () => { if (draftFlushRef) draftFlushRef.current = null; };
  });

  const dias = ini && fin ? diasEntre(ini, fin) : 0;
  const ok = suc && ini && fin && new Date(fin) > new Date(ini);
  const capturadosCount = PROD_PUENTES.filter((p) => tieneCaptura(p.nombre)).length;

  const irSiguiente = () => {
    if (!ok) return;
    const finalesCalc = {};
    PROD_PUENTES.forEach((p) => { const { cajas } = getPeso(p.nombre); if (cajas.some((c) => c !== "" && c != null)) finalesCalc[p.nombre] = finalDe(p.nombre); });
    onSiguiente({ ini, fin, pesos, finales: finalesCalc });
  };
  const borrarTodo = () => { setPesos({}); setConfirmarBorrar(false); };

  const guardarYExportar = () => {
    const filas = PROD_PUENTES.filter((p) => tieneCaptura(p.nombre)).map((p) => {
      const { formato, taras, cajas } = getPeso(p.nombre);
      const sumaTaras = taras.reduce((s, t) => s + (t === "" || t == null ? 0 : Number(t)), 0);
      const sumaCajas = cajas.reduce((s, c) => s + (c === "" || c == null ? 0 : Number(c)), 0);
      return {
        Producto: p.nombre,
        Formato: formato === "ud" ? "Ud" : "Kg",
        Tara: formato === "ud" ? "" : sumaTaras,
        "Peso / Unidad": sumaCajas,
        Final: finalDe(p.nombre),
      };
    });
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [{ wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 13 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `inventario-${suc}-${MESES_LBL[mesSel]}-2025.xlsx`);
    const draft = construirBorrador();
    onCancel(suc, draft ? { ...draft, guardado: true } : null);
  };

  let lastCat = null;
  fieldRefs.current = [];
  let campoIdx = 0;
  return (
    <div style={{ ...sx.repCard, marginTop: 16, display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva captura de inventario · {MESES_LBL[mesSel]} 2025</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <TField label="Sucursal"><div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{suc}</div></TField>
        <TField label={prevRec ? "Fecha inicio (heredada)" : "Fecha inicio"}>{prevRec ? <div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{ini}</div> : <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} />}</TField>
        <TField label="Fecha fin"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} /></TField>
        <TField label="Días del periodo"><div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 700, color: dias ? T.ink : T.muted, background: T.paper }}>{dias || "—"} días</div></TField>
      </div>

      <div style={{ fontSize: 11.5, color: T.muted, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><strong style={{ color: T.inkSoft }}>Inicio:</strong> {prevRec ? "cierre del periodo anterior" : "primer inventario (editable)"}</span>
        <span><strong style={{ color: T.inkSoft }}>Inicial:</strong> {prevRec ? "heredado del cierre anterior" : "estimado (sin cierre previo)"}</span>
        <span><strong style={{ color: T.inkSoft }}>Compras:</strong> notas de almacén del periodo (simulado, escala con los días)</span>
        <span><strong style={{ color: T.brand }}>Final:</strong> lo capturas tú (conteo físico)</span>
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 10, maxHeight: "62vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
          <thead style={{ position: "sticky", top: 0 }}>
            <tr style={{ background: T.ink }}>
              <th style={{ padding: "8px 12px", textAlign: "left", color: "#fff", fontWeight: 700 }}>Producto</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Tara</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: "#fff", fontWeight: 700 }}>Peso / Unidad</th>
              <th style={{ padding: "8px 12px", textAlign: "center", color: "#fff", fontWeight: 700 }}>Formato</th>
              <th style={{ padding: "8px 12px", textAlign: "right", color: "#fff", fontWeight: 700, background: T.brandDark }}>Final</th>
            </tr>
          </thead>
          <tbody>
            {PROD_PUENTES.map((p, i) => {
              const header = p.cat !== lastCat; lastCat = p.cat;
              const { formato, taras, cajas } = getPeso(p.nombre);
              const esUd = formato === "ud";
              const capturado = tieneCaptura(p.nombre);
              const finV = capturado ? finalDe(p.nombre) : null;
              const neg = finV != null && finV < 0;
              return (
                <Fragment key={i}>
                  {header && <tr><td colSpan={5} style={{ padding: "6px 12px", background: T.paper, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted }}>{p.cat}</td></tr>}
                  <tr style={{ background: neg ? T.badSoft : "transparent" }}>
                    <td style={{ padding: "5px 12px", fontWeight: 500, borderBottom: `1px solid ${T.lineSoft}` }}>{p.nombre}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }} onMouseEnter={() => setHover({ nombre: p.nombre, col: "tara" })} onMouseLeave={() => setHover(null)}>
                      {esUd ? <span style={{ color: T.muted, fontSize: 11.5 }}>No aplica</span> : (
                        <div style={{ display: "inline-flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                          {taras.map((t, idx) => {
                            const myIdx = campoIdx++;
                            return <input key={idx} data-idx={myIdx} data-campo={`${p.nombre}__tara__${idx}`} ref={(el) => (fieldRefs.current[myIdx] = el)} type="number" min="0" value={t} onChange={(e) => setTaraBox(p.nombre, idx, sanitizar(e.target.value, false))} onWheel={sinRueda} onKeyDown={(e) => manejarTeclaCasilla(e, p.nombre, "tara", idx)} placeholder="0" className="sel" style={{ ...sx.sel, fontSize: 12, width: 62, textAlign: "right", padding: "6px 6px" }} />;
                          })}
                          {hover && hover.nombre === p.nombre && hover.col === "tara" && (
                            <button onClick={() => addTara(p.nombre)} title="Agregar otra tara" style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${T.line}`, background: "#fff", color: T.brand, fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: 0 }}>+</button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }} onMouseEnter={() => setHover({ nombre: p.nombre, col: "peso" })} onMouseLeave={() => setHover(null)}>
                      <div style={{ display: "inline-flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                        {cajas.map((c, idx) => {
                          const myIdx = campoIdx++;
                          return <input key={idx} data-idx={myIdx} data-campo={`${p.nombre}__peso__${idx}`} ref={(el) => (fieldRefs.current[myIdx] = el)} type="number" min="0" step={esUd ? "1" : "any"} value={c} onChange={(e) => setCaja(p.nombre, idx, sanitizar(e.target.value, esUd))} onWheel={sinRueda} onKeyDown={(e) => manejarTeclaCasilla(e, p.nombre, "peso", idx)} placeholder="0" className="sel" style={{ ...sx.sel, fontSize: 12, width: 58, textAlign: "right", padding: "6px 6px" }} />;
                        })}
                        {hover && hover.nombre === p.nombre && hover.col === "peso" && (
                          <button onClick={() => addCaja(p.nombre)} title="Agregar otro peso" style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${T.line}`, background: "#fff", color: T.brand, fontSize: 13, fontWeight: 700, cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: 0 }}>+</button>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "3px 6px", textAlign: "center", borderBottom: `1px solid ${T.lineSoft}` }}>
                      {(() => {
                        const myIdx = campoIdx++;
                        return (
                          <select data-idx={myIdx} ref={(el) => (fieldRefs.current[myIdx] = el)} value={formato} onChange={(e) => setFormato(p.nombre, e.target.value)} onKeyDown={irSiguienteCampo} className="sel" style={{ ...sx.sel, fontSize: 12, width: 74, textAlign: "center", padding: "6px 4px" }}>
                            <option value="kg">Kg</option>
                            <option value="ud">Ud</option>
                          </select>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "5px 12px", textAlign: "right", fontWeight: 700, color: neg ? T.bad : T.ink, borderBottom: `1px solid ${T.lineSoft}`, background: T.brandSoft }}>{finV == null ? "—" : finV}{neg ? " ⚠" : ""}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11.5, color: T.muted }}>{capturadosCount} de {PROD_PUENTES.length} productos con peso capturado.</div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <button className="actbtn" onClick={() => setConfirmarBorrar(true)} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: "#fff", color: T.bad, border: `1px solid ${T.bad}` }}>Borrar todo</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="actbtn" onClick={() => onCancel(suc, construirBorrador())} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
          <button className="actbtn" onClick={guardarYExportar} title="Guarda lo capturado como 'Guardado' y lo descarga en Excel" style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: "#fff", color: T.brand, border: `1px solid ${T.brand}`, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Download" size={14} color={T.brand} />Guardar inventario</button>
          <button className="actbtn" disabled={!ok} onClick={irSiguiente} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 18px", background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Siguiente</button>
        </div>
      </div>

      {confirmarBorrar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,20,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={() => setConfirmarBorrar(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 22, width: 320, maxWidth: "90vw", boxShadow: "0 12px 40px rgba(0,0,0,.25)", display: "grid", gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: T.badSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="AlertTriangle" size={17} color={T.bad} /></div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>¿Borrar todo lo capturado?</div>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted }}>Se borrarán todas las taras y pesos que llevas capturados en esta sucursal. Esta acción no se puede deshacer.</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="actbtn" onClick={() => setConfirmarBorrar(false)} style={{ ...sx.actbtn, fontSize: 12.5, padding: "8px 18px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>No</button>
              <button className="actbtn" onClick={borrarTodo} style={{ ...sx.actbtn, fontSize: 12.5, padding: "8px 18px", background: T.bad, color: "#fff" }}>Sí, borrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NuevoInventario({ mesSel, sucInicial, invMes, onSave, onCancel, draftFlushRef, soloVisualizacion, pesoData, onAtras, soloLectura, onCerrar }) {
  const [suc, setSuc] = useState(sucInicial);
  const recs = invMes[mesSel] || {};
  const recExistente = recs[suc];
  const esBorrador = !!(recExistente && !recExistente.cargado);
  const esEdicion = !!(recExistente && recExistente.cargado);

  const prevRec = (() => {
    for (let m = mesSel - 1; m >= 0; m--) { const r = invMes[m] && invMes[m][suc]; if (r && r.productos) return r; }
    return null;
  })();
  const finalesDeEdicion = () => {
    if (!recExistente.productos) return {}; // registro de ejemplo sin detalle por producto: se captura de nuevo por producto
    const mapa = {};
    recExistente.productos.forEach((p) => { mapa[p.nombre] = p.final; });
    return mapa;
  };
  const [ini, setIni] = useState(soloVisualizacion ? pesoData.ini : ((esBorrador || esEdicion) ? recExistente.ini : (prevRec ? prevRec.fin : `2025-${String(mesSel + 1).padStart(2, "0")}-01`)));
  const [fin, setFin] = useState(soloVisualizacion ? pesoData.fin : ((esBorrador || esEdicion) ? (recExistente.fin || "") : ""));
  const [finales, setFinales] = useState(soloVisualizacion ? pesoData.finales : (esBorrador ? (recExistente.finalesTemp || {}) : esEdicion ? finalesDeEdicion() : {}));

  // Guarda el avance actual como borrador al cancelar o salir a Secciones.
  // Si ya era un inventario CARGADO (edición), cancelar no debe degradarlo a borrador:
  // se devuelve null y se conserva el inventario original tal como estaba.
  const construirBorrador = () => (esEdicion ? null : { ini, fin, finalesTemp: finales, cargado: false, borrador: true });
  useEffect(() => {
    if (soloVisualizacion) return; // en este paso el avance ya lo guarda la pantalla de pesos
    if (draftFlushRef) draftFlushRef.current = () => onCancel(suc, construirBorrador());
    return () => { if (draftFlushRef) draftFlushRef.current = null; };
  });

  const cambiarSuc = (nueva) => {
    setSuc(nueva); setFinales({});
    let prev = null;
    for (let m = mesSel - 1; m >= 0; m--) { const r = invMes[m] && invMes[m][nueva]; if (r && r.productos) { prev = r; break; } }
    setIni(prev ? prev.fin : `2025-${String(mesSel + 1).padStart(2, "0")}-01`);
  };

  // === ENLACE CON ALMACÉN (pendiente) ===
  // En el sistema real, aquí se debe consultar el sistema de almacén y sumar las
  // NOTAS DE COMPRA / SURTIDO de esta sucursal entre `ini` y `fin` (por producto).
  // Reemplazar `comprasBase` por esa consulta real (API/BD de almacén por rango de fechas).
  // Por ahora se SIMULA: se toma una compra base por producto y se ESCALA con los días
  // del periodo (más días → más compras), para ilustrar el comportamiento esperado.
  const comprasAlmacen = (p) => {
    const h = vhash(suc + p.nombre);
    const porDia = (p.precio < 5 ? 100 + (h % 400) : p.precio < 60 ? 5 + (h % 35) : 2 + (h % 13)) / 30;
    const d = ini && fin ? diasEntre(ini, fin) : 30;
    return Math.max(1, Math.round(porDia * d));
  };
  const inicialDe = (p) => { if (prevRec) { const x = prevRec.productos.find((q) => q.nombre === p.nombre); if (x) return x.final; } return Math.round(comprasAlmacen(p) * 0.3); };

  // Salidas: mermas, transferencias u otras salidas que no son venta/consumo directo.
  // Aún no hay una forma de capturarlas en la app, así que por ahora se simulan en 0
  // hasta que se defina cómo registrarlas.
  const salidasDe = () => 0;
  const unidadDe = (nombre) => (pesoData && pesoData.pesos && pesoData.pesos[nombre] && pesoData.pesos[nombre].formato === "ud" ? "Ud" : "Kg");

  const filas = PROD_PUENTES.map((p) => {
    const inicial = inicialDe(p);
    const compras = comprasAlmacen(p);
    const salidas = salidasDe(p);
    const finalV = finales[p.nombre] === "" || finales[p.nombre] == null ? null : Number(finales[p.nombre]);
    const consumo = finalV == null ? null : inicial + compras - salidas - finalV;
    return { ...p, unidad: unidadDe(p.nombre), inicial, compras, salidas, finalV, consumo };
  });
  const filasVisibles = soloVisualizacion ? filas.filter((f) => f.finalV != null) : filas;

  const dias = ini && fin ? diasEntre(ini, fin) : 0;
  const ventaPeriodo = dias ? Math.round((VENTAS_MES[suc] * dias) / 30) : 0;
  const totCosto = filas.reduce((s, f) => s + (f.consumo == null ? 0 : f.consumo * f.precio), 0);
  const pct = ventaPeriodo ? (totCosto / ventaPeriodo) * 100 : 0;
  const colC = (p) => (p <= 39 ? T.ok : p <= 43 ? T.warn : T.bad);
  const capturados = filas.filter((f) => f.finalV != null).length;
  const alertas = filas.filter((f) => f.consumo != null && f.consumo < 0).length;
  const ok = suc && ini && fin && new Date(fin) > new Date(ini) && capturados > 0;

  const guardar = () => {
    if (!ok) return;
    const productos = filas.filter((f) => f.finalV != null).map((f) => ({ nombre: f.nombre, cat: f.cat, precio: f.precio, inicial: f.inicial, compras: f.compras, final: f.finalV }));
    onSave(suc, { cargado: true, ini, fin, ventaPeriodo, productos, consumoImporte: totCosto, pesos: soloVisualizacion && pesoData ? pesoData.pesos : undefined });
  };

  let lastCat = null;
  return (
    <div style={{ ...sx.repCard, marginTop: 16, display: "grid", gap: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{soloLectura ? "Inventario finalizado" : soloVisualizacion ? "Revisión de inventario" : "Nueva captura de inventario"} · {MESES_LBL[mesSel]} 2025</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <TField label="Sucursal"><div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{suc}</div></TField>
        <TField label={soloVisualizacion || prevRec ? "Fecha inicio (heredada)" : "Fecha inicio"}>{soloVisualizacion || prevRec ? <div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{ini}</div> : <input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} />}</TField>
        <TField label="Fecha fin">{soloVisualizacion ? <div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 600, background: T.paper, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}><Ico name="Lock" size={12} color={T.muted} />{fin}</div> : <input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12 }} />}</TField>
        <TField label="Días del periodo"><div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 700, color: dias ? T.ink : T.muted, background: T.paper }}>{dias || "—"} días</div></TField>
      </div>

      <div style={{ fontSize: 11.5, color: T.muted, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span><strong style={{ color: T.inkSoft }}>Inicio:</strong> {prevRec ? "cierre del periodo anterior" : "primer inventario (editable)"}</span>
        <span><strong style={{ color: T.inkSoft }}>Inicial:</strong> {prevRec ? "heredado del cierre anterior" : "estimado (sin cierre previo)"}</span>
        <span><strong style={{ color: T.inkSoft }}>Entradas:</strong> notas de almacén del periodo (simulado, escala con los días)</span>
        <span><strong style={{ color: T.inkSoft }}>Salidas:</strong> aún no capturable (simulado en 0 por ahora)</span>
        <span><strong style={{ color: T.brand }}>Final físico:</strong> {soloVisualizacion ? "calculado con la tara y los pesos capturados" : "lo capturas tú (conteo físico)"}</span>
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 10, maxHeight: "62vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead style={{ position: "sticky", top: 0 }}>
            <tr style={{ background: T.ink }}>
              {["Producto", "Unidad", "Inicial", "Entradas", "Salidas", soloVisualizacion ? "Final físico" : "Final físico ✎", "Consumo real", "Costo unitario", "Importe"].map((h, i) => (
                <th key={h} style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "right", color: "#fff", fontWeight: 700, whiteSpace: "nowrap", background: i === 5 ? T.brandDark : "transparent" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filasVisibles.map((f, i) => {
              const neg = f.consumo != null && f.consumo < 0;
              const header = f.cat !== lastCat; lastCat = f.cat;
              return (
                <Fragment key={i}>
                  {header && <tr><td colSpan={9} style={{ padding: "6px 12px", background: T.paper, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted }}>{f.cat}</td></tr>}
                  <tr style={{ background: neg ? T.badSoft : "transparent" }}>
                    <td style={{ padding: "5px 12px", fontWeight: 500, borderBottom: `1px solid ${T.lineSoft}` }}>{f.nombre}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{f.unidad}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{f.inicial}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{f.compras}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}` }}>{f.salidas}</td>
                    <td style={{ padding: "3px 6px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}`, background: T.brandSoft }}>{soloVisualizacion ? <div style={{ ...sx.sel, fontSize: 12.5, width: 90, marginLeft: "auto", textAlign: "right", padding: "6px 8px", background: "#fff", fontWeight: 700 }}>{finales[f.nombre] == null ? "—" : finales[f.nombre]}</div> : <input type="number" min="0" value={finales[f.nombre] == null ? "" : finales[f.nombre]} onChange={(e) => setFinales((p) => ({ ...p, [f.nombre]: e.target.value === "" ? "" : e.target.value.replace(/-/g, "") }))} onWheel={(e) => e.currentTarget.blur()} placeholder="—" className="sel" style={{ ...sx.sel, fontSize: 12.5, width: 90, textAlign: "right", padding: "6px 8px", borderColor: T.brand }} />}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", fontWeight: 600, color: neg ? T.bad : T.inkSoft, borderBottom: `1px solid ${T.lineSoft}` }}>{f.consumo == null ? "—" : f.consumo}{neg ? " ⚠" : ""}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", color: T.muted, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{"$" + Number(f.precio).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style={{ padding: "5px 12px", textAlign: "right", fontWeight: 700, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{f.consumo == null ? "—" : money(Math.round(f.consumo * f.precio))}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 11.5, color: T.muted }}>{soloVisualizacion ? `${capturados} producto${capturados === 1 ? "" : "s"} con conteo final capturado.` : `${capturados} de ${filas.length} productos con conteo final capturado.`}{alertas > 0 ? ` · ${alertas} con consumo negativo (revisa el conteo).` : ""}</div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        {soloLectura ? (
          <button className="actbtn" onClick={onCerrar} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 18px", background: T.ink, color: "#fff" }}>Cerrar</button>
        ) : (
          <>
            {soloVisualizacion ? (
              <button className="actbtn" onClick={onAtras} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>‹ Atrás</button>
            ) : (
              <button className="actbtn" onClick={() => onCancel(suc, construirBorrador())} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
            )}
            <button className="actbtn" disabled={!ok} onClick={guardar} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 18px", background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Finalizar</button>
          </>
        )}
      </div>
    </div>
  );
}

/* Informe de Desempeño de una sucursal (mes finalizado). Todas las cifras de venta son
   simuladas (aún no hay conexión a ventas reales); el resto se calcula a partir del propio
   inventario capturado. "Costo ideal" de referencia = 39% de la venta (el mismo estándar que
   ya usa el resto de la app para colorear el % de costo en verde/ámbar/rojo). */
function InformeSucursal({ suc, r, mesSel }) {
  const colC = (p) => (p <= 39 ? T.ok : p <= 43 ? T.warn : T.bad);
  const costoIdealPct = 39;
  const dd = diasEntre(r.ini, r.fin);
  const consumoVal = invConsumo(r);
  const ventas = r.ventaPeriodo || 0;
  const costoPct = ventas ? (consumoVal / ventas) * 100 : 0;
  const utilidadBruta = ventas - consumoVal;
  const margenPct = ventas ? (utilidadBruta / ventas) * 100 : 0;
  const invInicialVal = (r.productos || []).reduce((s, p) => s + p.inicial * p.precio, 0);
  const invFinalVal = (r.productos || []).reduce((s, p) => s + p.final * p.precio, 0);
  const invPromedio = (invInicialVal + invFinalVal) / 2;
  const rotacion = invPromedio ? consumoVal / invPromedio : 0;
  const diasInventario = rotacion ? dd / rotacion : 0;
  const consumoTeorico = ventas * (costoIdealPct / 100);
  const diferenciaTeorico = consumoVal - consumoTeorico;
  const diferenciaPct = costoPct - costoIdealPct;
  const costoDia = dd ? consumoVal / dd : 0;
  const favorable = diferenciaTeorico <= 0;
  const tituloInforme = `Informe ${suc}`;
  const filasInforme = [
    { Concepto: "Sucursal", Valor: suc },
    { Concepto: "Periodo", Valor: `${r.ini} a ${r.fin} (${dd} días)` },
    { Concepto: "Ventas del periodo (simuladas)", Valor: money(ventas) },
    { Concepto: "Costo (consumo valorizado)", Valor: money(Math.round(consumoVal)) },
    { Concepto: "Costo %", Valor: costoPct.toFixed(1) + "%" },
    { Concepto: "Utilidad bruta", Valor: money(Math.round(utilidadBruta)) },
    { Concepto: "Margen bruto %", Valor: margenPct.toFixed(1) + "%" },
    { Concepto: "Inventario promedio valorizado", Valor: money(Math.round(invPromedio)) },
    { Concepto: "Rotación de inventario (veces/periodo)", Valor: rotacion.toFixed(2) + "x" },
    { Concepto: "Días de inventario", Valor: diasInventario.toFixed(1) + " días" },
    { Concepto: `Consumo teórico (${costoIdealPct}% ideal de venta)`, Valor: money(Math.round(consumoTeorico)) },
    { Concepto: "Diferencia vs. teórico", Valor: (diferenciaTeorico >= 0 ? "+" : "") + money(Math.round(diferenciaTeorico)) },
    { Concepto: "Diferencia en puntos de costo", Valor: diferenciaPct.toFixed(1) + " pts" },
    { Concepto: "Costo por día", Valor: money(Math.round(costoDia)) },
  ];
  const columnasInforme = [{ titulo: "Concepto", valor: (f) => f.Concepto }, { titulo: "Valor", valor: (f) => f.Valor }];

  const botonExport = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, background: "rgba(255,255,255,.12)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", cursor: "pointer" };
  const seccionLbl = { fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, marginBottom: 8 };
  const gridMet = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };

  return (
    <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
      <PrintHeader titulo={tituloInforme} />
      <div style={{ background: T.ink, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", letterSpacing: "0.01em" }}>Informe de Desempeño</div>
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.7)" }}>{suc} · {MESES_LBL[mesSel]} 2025 · {r.ini} a {r.fin} ({dd} días)</div>
        </div>
        <div className="noprint" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => imprimirConTitulo(tituloInforme)} style={botonExport}><Ico name="Printer" size={13} color="#fff" />Imprimir</button>
          <button onClick={() => exportarPdfConTitulo(tituloInforme, columnasInforme, filasInforme).catch(() => alert("No se pudo generar el PDF — revisa tu conexión a internet e intenta de nuevo."))} style={botonExport}><Ico name="FileText" size={13} color="#fff" />PDF</button>
          <button onClick={() => exportarExcelConTitulo(tituloInforme, columnasInforme, filasInforme)} style={botonExport}><Ico name="Download" size={13} color="#fff" />Excel</button>
        </div>
      </div>

      <div style={{ padding: 18, display: "grid", gap: 22 }}>
        <div>
          <div style={seccionLbl}>Ventas y rentabilidad</div>
          <div style={gridMet}>
            <Metric big={money(ventas)} label="Ventas del periodo" sub="cifra simulada de ejemplo" accent={T.brand} />
            <Metric big={costoPct.toFixed(1) + "%"} label="Costo %" sub="consumo valorizado ÷ ventas" accent={colC(costoPct)} />
            <Metric big={money(Math.round(utilidadBruta))} label="Utilidad bruta" sub="ventas − costo" accent={utilidadBruta >= 0 ? T.ok : T.bad} />
            <Metric big={margenPct.toFixed(1) + "%"} label="Margen bruto" sub="utilidad bruta ÷ ventas" accent={margenPct >= 61 ? T.ok : T.warn} />
          </div>
        </div>
        <div>
          <div style={seccionLbl}>Inventario y rotación</div>
          <div style={gridMet}>
            <Metric big={money(Math.round(invPromedio))} label="Inventario promedio" sub="(inicial + final) ÷ 2, valorizado" accent={T.brandDark} />
            <Metric big={rotacion.toFixed(2) + "x"} label="Rotación" sub="veces que giró en el periodo" accent={T.brand} />
            <Metric big={diasInventario.toFixed(1)} label="Días de inventario" sub="días de consumo que cubre" accent={T.inkSoft} />
            <Metric big={money(Math.round(costoDia))} label="Costo por día" sub="consumo valorizado ÷ días" accent={T.muted} />
          </div>
        </div>
        <div>
          <div style={seccionLbl}>Vs. consumo teórico</div>
          <div style={gridMet}>
            <Metric big={money(Math.round(consumoTeorico))} label="Consumo teórico" sub={`ventas × ${costoIdealPct}% ideal`} accent={T.muted} />
            <Metric big={money(Math.round(consumoVal))} label="Consumo real" sub="lo que de verdad se consumió" accent={T.ink} />
            <Metric big={(diferenciaTeorico >= 0 ? "+" : "") + money(Math.round(diferenciaTeorico))} label="Diferencia" sub={favorable ? "por debajo del ideal (favorable)" : "por arriba del ideal (revisar)"} accent={favorable ? T.ok : T.bad} alert={!favorable} />
            <Metric big={(diferenciaPct >= 0 ? "+" : "") + diferenciaPct.toFixed(1) + " pts"} label="Puntos de costo" sub="costo real − costo ideal" accent={favorable ? T.ok : T.bad} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InvMensuales({ invMes, setInvMes, draftFlushRef, usuario }) {
  const [mesSel, setMesSel] = useState(5);
  const [paso, setPaso] = useState(null); // null | "pesos" | "revision" | "editar"
  const [capSuc, setCapSuc] = useState(SUCURSALES[0]);
  const [pesoData, setPesoData] = useState(null);
  const [verDetalle, setVerDetalle] = useState(null);
  const puedeVerEditar = INV_USUARIOS_ACCESO_TOTAL.includes(usuario);
  const recs = invMes[mesSel] || {};
  const pendientes = SUCURSALES.filter((s) => !recs[s]);

  const guardarRec = (suc, rec) => { setInvMes((p) => ({ ...p, [mesSel]: { ...(p[mesSel] || {}), [suc]: rec } })); setPaso(null); setPesoData(null); };
  const guardarBorrador = (suc, draft) => { if (draft) setInvMes((p) => ({ ...p, [mesSel]: { ...(p[mesSel] || {}), [suc]: draft } })); setPaso(null); setPesoData(null); };
  const abrirCaptura = (suc) => { setCapSuc(suc); setPaso("pesos"); };
  const abrirEditar = (suc) => { setCapSuc(suc); setPaso("editar"); };
  const abrirVer = (suc) => {
    const rec = (invMes[mesSel] || {})[suc];
    if (!rec) return;
    const finalesMap = {};
    (rec.productos || []).forEach((p) => { finalesMap[p.nombre] = p.final; });
    setCapSuc(suc);
    setPesoData({ ini: rec.ini, fin: rec.fin, finales: finalesMap, pesos: rec.pesos });
    setPaso("ver");
  };

  const cargados = SUCURSALES.filter((s) => recs[s] && recs[s].cargado).length;
  const colC = (p) => (p <= 39 ? T.ok : p <= 43 ? T.warn : T.bad);
  const totConsumo = Object.values(recs).filter((r) => r.cargado).reduce((s, r) => s + invConsumo(r), 0);

  const exportarExcel = () => {
    const filas = SUCURSALES.map((suc) => {
      const r = recs[suc];
      if (!r) return { Sucursal: suc, Estado: "Pendiente", "Periodo (días)": "", "Costo (consumo valorizado)": "", "Ventas del periodo": "", "% Costo": "", "Costo/día": "" };
      if (!r.cargado) return { Sucursal: suc, Estado: r.guardado ? "Guardado" : "En proceso", "Periodo (días)": "", "Costo (consumo valorizado)": "", "Ventas del periodo": "", "% Costo": "", "Costo/día": "" };
      const dd = diasEntre(r.ini, r.fin);
      const cons = invConsumo(r);
      const pct = r.ventaPeriodo ? (cons / r.ventaPeriodo) * 100 : 0;
      return {
        Sucursal: suc,
        Estado: "Finalizado",
        "Periodo (días)": dd,
        "Costo (consumo valorizado)": Math.round(cons),
        "Ventas del periodo": r.ventaPeriodo,
        "% Costo": Number(pct.toFixed(1)),
        "Costo/día": Math.round(cons / dd),
      };
    });
    const ws = XLSX.utils.json_to_sheet(filas);
    ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 13 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventarios");
    XLSX.writeFile(wb, `${aiSlugArchivo("Inventarios Mensuales")}.xlsx`);
  };

  return (
    <div>
      {paso === "pesos" ? (
        <CapturaPesos mesSel={mesSel} sucInicial={capSuc} invMes={invMes} onCancel={guardarBorrador} draftFlushRef={draftFlushRef} onSiguiente={(data) => { const existente = (invMes[mesSel] || {})[capSuc]; const yaFinalizado = existente && existente.cargado; if (!yaFinalizado) { setInvMes((p) => ({ ...p, [mesSel]: { ...(p[mesSel] || {}), [capSuc]: { ini: data.ini, fin: data.fin, pesosTemp: data.pesos, cargado: false, borrador: true } } })); } setPesoData(data); setPaso("revision"); }} />
      ) : paso === "revision" ? (
        <NuevoInventario mesSel={mesSel} sucInicial={capSuc} invMes={invMes} onSave={guardarRec} onCancel={guardarBorrador} draftFlushRef={draftFlushRef} soloVisualizacion pesoData={pesoData} onAtras={() => setPaso("pesos")} />
      ) : paso === "editar" ? (
        <NuevoInventario mesSel={mesSel} sucInicial={capSuc} invMes={invMes} onSave={guardarRec} onCancel={guardarBorrador} draftFlushRef={draftFlushRef} />
      ) : paso === "ver" ? (
        <NuevoInventario mesSel={mesSel} sucInicial={capSuc} invMes={invMes} onSave={() => {}} onCancel={() => {}} soloVisualizacion soloLectura pesoData={pesoData} onCerrar={() => { setPaso(null); setPesoData(null); }} />
      ) : (
      <>
      <div style={{ ...sx.h1row, marginBottom: 12 }}>
        <h1 style={sx.h1}>Inventarios Mensuales</h1>
        <button className="actbtn" onClick={() => { setCapSuc(pendientes[0] || SUCURSALES[0]); setPaso("pesos"); }} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 16px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(15,110,102,.35)" }}><Ico name="Plus" size={16} color="#fff" />Nuevo inventario</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Mes de control
          <select className="sel" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
            {MESES_LBL.map((m, i) => <option key={m} value={i}>{m} 2025</option>)}
          </select>
        </label>
        <button className="actbtn" onClick={exportarExcel} style={{ ...sx.actbtn, fontSize: 12, padding: "7px 14px", background: "#fff", color: T.ink, border: `1px solid ${T.line}`, display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Download" size={14} color={T.ink} />Exportar</button>
      </div>

      <div style={sx.cards4}>
        <Metric big={`${cargados}/${SUCURSALES.length}`} label="Cargados" sub={`${MESES_LBL[mesSel]} 2025`} accent={cargados === SUCURSALES.length ? T.ok : T.warn} />
        <Metric big={String(SUCURSALES.length - cargados)} label="Pendientes" sub="por capturar" accent={SUCURSALES.length - cargados ? T.bad : T.ok} alert={SUCURSALES.length - cargados > 0} />
        <Metric big={money(totConsumo)} label="Costo del mes" sub="cargadas" accent={T.brand} />
      </div>

      <div style={{ marginTop: 20, overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 520 }}>
          <thead>
            <tr style={{ background: T.paper, textAlign: "left" }}>
              {["Sucursal", "Estado", "Detalle"].map((h, i) => (
                <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: T.inkSoft, textAlign: i === 0 || i === 1 ? "left" : "right", borderBottom: `1px solid ${T.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUCURSALES.map((suc) => {
              const r = recs[suc];
              if (!r) return (
                <tr key={suc} style={{ opacity: 0.75 }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}` }}>{suc}</td>
                  <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10.5, fontWeight: 700, color: T.warn, background: T.warnSoft, padding: "2px 8px", borderRadius: 99 }}>Pendiente</span></td>
                  <td style={{ padding: "6px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}><button className="actbtn" onClick={() => abrirCaptura(suc)} style={{ ...sx.actbtn, fontSize: 10.5, padding: "5px 10px", background: T.brand }}>Capturar</button></td>
                </tr>
              );
              if (!r.cargado) return (
                <tr key={suc} style={{ opacity: 0.9 }}>
                  <td style={{ padding: "9px 14px", fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}` }}>{suc}</td>
                  <td style={{ padding: "9px 14px", borderBottom: `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10.5, fontWeight: 700, color: r.guardado ? T.ok : T.warn, background: r.guardado ? T.okSoft : T.warnSoft, padding: "2px 8px", borderRadius: 99 }}>{r.guardado ? "Guardado" : "En proceso"}</span></td>
                  <td style={{ padding: "6px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}><button className="actbtn" onClick={() => abrirCaptura(suc)} style={{ ...sx.actbtn, fontSize: 10.5, padding: "5px 10px", background: T.brand }}>Continuar</button></td>
                </tr>
              );
              const dd = diasEntre(r.ini, r.fin);
              const cons = invConsumo(r);
              const pct = r.ventaPeriodo ? (cons / r.ventaPeriodo) * 100 : 0;
              const abierto = verDetalle === suc;
              return (
                <Fragment key={suc}>
                  <tr>
                    <td style={{ padding: "9px 14px", fontWeight: 600, borderBottom: abierto ? "none" : `1px solid ${T.lineSoft}` }}>{suc}</td>
                    <td style={{ padding: "9px 14px", borderBottom: abierto ? "none" : `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10.5, fontWeight: 700, color: T.ok, background: T.okSoft, padding: "2px 8px", borderRadius: 99 }}>Finalizado</span></td>
                    <td style={{ padding: "6px 14px", textAlign: "right", borderBottom: abierto ? "none" : `1px solid ${T.lineSoft}` }}>
                      {puedeVerEditar ? (
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button className="actbtn" onClick={() => setVerDetalle(abierto ? null : suc)} style={{ ...sx.actbtn, fontSize: 10.5, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>{abierto ? "Ocultar" : "Ver detalle"}</button>
                          <button className="actbtn" onClick={() => abrirVer(suc)} style={{ ...sx.actbtn, fontSize: 10.5, padding: "5px 10px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Ver</button>
                          <button className="actbtn" onClick={() => abrirCaptura(suc)} style={{ ...sx.actbtn, fontSize: 10.5, padding: "5px 10px", background: T.brand }}>Editar</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: T.muted, display: "inline-flex", alignItems: "center", gap: 5 }}><Ico name="Lock" size={12} color={T.muted} />Sin acceso</span>
                      )}
                    </td>
                  </tr>
                  {abierto && puedeVerEditar && (
                    <tr>
                      <td colSpan={3} style={{ padding: "14px", background: T.paper, borderBottom: `1px solid ${T.lineSoft}` }}>
                        <InformeSucursal suc={suc} r={r} mesSel={mesSel} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 12 }}>El <strong>mes</strong> controla quién cargó y quién no. El <strong>% de costo</strong> usa las <strong>ventas del periodo real</strong> (según los días capturados). El <strong>costo</strong> sale de la captura por producto (unidades × precio de almacén, aquí simulado).</div>
      </>
      )}
    </div>
  );
}

/* ============================================================
   DEPARTAMENTO DE SUCURSALES PROPIAS (Operaciones)
   ============================================================ */
/* ===== AUDITORÍAS REMOTAS (videovigilancia) ===== */
/* Datos reales tomados de la plataforma actual (capturas del portal auditorias.mifrutalyogurt.com) */
const AUDR_REAL = {
  "Las Puentes": [14, 85.4],
  "Soriana Cadereyta": [5, 88.4],
  "Mitras": [8, 81.8],
  "Berneses": [6, 91.2],
  "Juárez Centro": [7, 91.0],
  "Escobedo Lineal": [8, 97.0],
  "República Mexicana": [1, 72.5],
};
const AUDR_SUC = SUCURSALES.map((s) => {
  if (AUDR_REAL[s]) return { suc: s, aud: AUDR_REAL[s][0], cal: AUDR_REAL[s][1] };
  const h = vhash(s);
  return { suc: s, aud: 3 + (h % 8), cal: Math.round((80 + (h % 180) / 10) * 10) / 10 };
});
const AUDR_BLOQUES = [["Imagen del Establecimiento", 96.5], ["Barra de Toppings", 95.6], ["Cierre", 95.5], ["Apertura", 93.8], ["Preparación de Productos", 92.9], ["Estandarización de Porciones", 91.9], ["Presentación de Colaboradores", 83.6], ["Atención al Cliente", 80.9], ["Seguridad e Higiene", 76.6]];
const AUDR_HIST = [["Feb", 89], ["Mar", 91], ["Abr", 90], ["May", 93], ["Jun", 95], ["Jul", 94]];
const AUDR_PROG = [["Apertura", 24, 22], ["Operativa", 60, 56], ["Cierre", 24, 21]];
const PROG_SEED = {
  "Las Puentes": { Apertura: 3, Operativa: 14, Cierre: 3 },
  "Juárez Centro": { Apertura: 3, Operativa: 14, Cierre: 3 },
  "Soriana Cadereyta": { Apertura: 1, Operativa: 7, Cierre: 1 },
  "Walmart San Sebastián": { Apertura: 2, Operativa: 14, Cierre: 2 },
  "Escobedo Lineal": { Apertura: 2, Operativa: 7, Cierre: 2 },
  "Mitras": { Apertura: 1, Operativa: 7, Cierre: 1 },
  "Berneses": { Apertura: 2, Operativa: 7, Cierre: 2 },
};
const AUDR_TIPOS = ["General", "Apertura", "Operativa", "Cierre"];
const AUDR_GENERAL = AUDR_SUC.reduce((s, x) => s + x.cal * x.aud, 0) / AUDR_SUC.reduce((s, x) => s + x.aud, 0);
const AUDR_TOTAL = AUDR_SUC.reduce((s, x) => s + x.aud, 0);
const audCol = (v) => (v >= 95 ? T.ok : v >= 80 ? T.warn : T.bad);
const AUDR_CONCEPTOS = {
  Apertura: ["El colaborador del primer turno llega a tiempo", "Abre al público en máximo 15 min desde su entrada", "Prepara la fórmula de helado correctamente, sin omitir pasos", "Realiza la producción solicitada para el día", "Uniforme completo, guantes y cofia", "Saluda y se despide amablemente de los primeros clientes", "Hace venta sugestiva desde el inicio del turno", "Entrega ticket a cada cliente", "Actitud servicial desde la apertura", "Se encuentra a la vista del cliente en todo momento", "Barra de toppings limpia y abastecida al abrir", "Fruta en la barra con buen aspecto visual", "Sirve la cantidad correcta de cuchara y de helado por vaso", "Áreas de trabajo y atención limpias y ordenadas al abrir"],
  Operativa: ["Uniforme completo, guantes y cofia", "Saluda y se despide amablemente", "Hace venta sugestiva activamente", "Entrega ticket a cada cliente", "Actitud servicial", "Se encuentra a la vista del cliente", "Barra de toppings limpia y abastecida", "Fruta en la barra con buen aspecto", "Sirve la cantidad correcta de cuchara y helado", "Áreas de trabajo y atención limpias y ordenadas"],
  Cierre: ["Áreas de trabajo limpias y ordenadas", "Guarda la mercancía de forma correcta", "Apaga todos los equipos en el orden correcto", "Realiza el corte del día con el protocolo completo"],
};
const AUDR_ALERTAS = ["Falla en máquina Taylor (ruidos, no enfría, no sirve)", "Falta de insumo base para la venta (producto crítico)", "Mal servicio al cliente evidente en cámara", "Personal sin uniforme completo en turno activo", "Barra de toppings en malas condiciones", "Riesgo sanitario o de seguridad visible"];
const calPorTipo = (suc, tipo) => { if (tipo === "General") return suc.cal; const d = ((vhash(suc.suc + tipo) % 21) - 10) * 0.9; return Math.max(60, Math.min(100, Math.round((suc.cal + d) * 10) / 10)); };
const CUR_ANIO = 2026, CUR_MES = 6;
const esFuturo = (mes, anio) => anio > CUR_ANIO || (anio === CUR_ANIO && mes > CUR_MES);
const POE_DEF = Object.values(PROG_SEED).reduce((a, v) => ({ Apertura: a.Apertura + v.Apertura, Operativa: a.Operativa + v.Operativa, Cierre: a.Cierre + v.Cierre }), { Apertura: 0, Operativa: 0, Cierre: 0 });
const POE_SNAPSHOT = (() => { const o = {}; SUCURSALES.forEach((s) => { o[s] = PROG_SEED[s] || { Apertura: 0, Operativa: 0, Cierre: 0 }; }); return o; })();
const audCalMes = (suc, mes, anio) => {
  const base = AUDR_REAL[suc] ? AUDR_REAL[suc][1] : 80 + (vhash(suc) % 180) / 10;
  const drift = (mes - CUR_MES) * 0.4 + (anio - CUR_ANIO) * 1.5 + (((vhash(suc + "m" + mes + anio) % 21) - 10) / 10) * 2.2;
  return Math.max(60, Math.min(100, Math.round((base + drift) * 10) / 10));
};
const audAudMes = (suc, mes, anio) => { const b = AUDR_REAL[suc] ? AUDR_REAL[suc][0] : 3 + (vhash(suc) % 8); return Math.max(1, b + ((vhash(suc + "a" + mes + anio) % 5) - 2)); };
const audSucMes = (mes, anio) => SUCURSALES.map((s) => ({ suc: s, cal: audCalMes(s, mes, anio), aud: audAudMes(s, mes, anio) }));
const genMes = (mes, anio) => { const u = audSucMes(mes, anio); const t = u.reduce((a, x) => a + x.aud, 0); return t ? u.reduce((a, x) => a + x.cal * x.aud, 0) / t : 0; };
const progTotales = (anio, mes, progStore, formato) => {
  const key = `${anio}|${mes}|${formato || "Propia"}`;
  if (progStore && progStore[key]) {
    return Object.values(progStore[key]).reduce((a, v) => ({ Apertura: a.Apertura + (v.Apertura || 0), Operativa: a.Operativa + (v.Operativa || 0), Cierre: a.Cierre + (v.Cierre || 0) }), { Apertura: 0, Operativa: 0, Cierre: 0 });
  }
  return (formato || "Propia") === "Propia" ? POE_DEF : { Apertura: 0, Operativa: 0, Cierre: 0 };
};

function AuditoriasRemotas() {
  const [nuevo, setNuevo] = useState(false);
  const [progOpen, setProgOpen] = useState(false);
  const [mes, setMes] = useState(6);
  const [anio, setAnio] = useState(2026);
  const [progStore, setProgStore] = useState({ "2026|5|Propia": POE_SNAPSHOT, "2026|4|Propia": POE_SNAPSHOT });
  const [toast, setToast] = useState(null);
  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Auditorías Remotas</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Videovigilancia · POE-OP-001</div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {(nuevo || progOpen) && <button onClick={() => { setNuevo(false); setProgOpen(false); }} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Volver</button>}
        </nav>
      </header>
      <main style={sx.main}>
      {nuevo ? (
        <NuevaAuditoria onCancel={() => setNuevo(false)} onGuardar={(r) => { setNuevo(false); setToast(`Auditoría de ${r.tipo} guardada · ${r.suc} · ${r.calif.toFixed(1)}%`); setTimeout(() => setToast(null), 4000); }} />
      ) : progOpen ? (
        <AudRProgramacion progStore={progStore} setProgStore={setProgStore} onGuardado={(m, mm, aa) => { setProgOpen(false); if (mm != null) setMes(mm); if (aa != null) setAnio(aa); setToast(m); setTimeout(() => setToast(null), 3000); }} />
      ) : (
      <>
      <div style={{ ...sx.h1row, marginBottom: 18 }}>
        <h1 style={sx.h1}>Auditorías Remotas</h1>
        <button className="actbtn" onClick={() => setNuevo(true)} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 16px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: "0 2px 8px rgba(15,110,102,.35)" }}><Ico name="Plus" size={16} color="#fff" />Nueva auditoría</button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Mes
          <select className="sel" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
            {MESES_LBL.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Año
          <select className="sel" value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
            {[2026, 2025, 2024].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 11, color: T.muted }}>Todo el tablero refleja el mes seleccionado</span>
      </div>

      {esFuturo(mes, anio) && !progStore[`${anio}|${mes}|Propia`] ? (
        <div style={{ ...sx.repCard, textAlign: "center", padding: "40px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ico name="CalendarClock" size={26} color={T.muted} /></div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{MESES_LBL[mes]} {anio} · mes futuro</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>Aún no hay auditorías ejecutadas en este mes. Puedes dejar lista su <strong>programación</strong>; los resultados aparecerán conforme se realicen las auditorías.</div>
          <button className="actbtn" onClick={() => setProgOpen(true)} style={{ ...sx.actbtn, fontSize: 12, padding: "9px 18px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7, marginTop: 16 }}><Ico name="CalendarRange" size={15} color="#fff" />Nueva programación</button>
        </div>
      ) : (
      <>
      <AudRDesempeno mes={mes} anio={anio} progStore={progStore} onProgramar={() => setProgOpen(true)} />

      <div style={{ borderTop: `1px solid ${T.line}`, margin: "32px 0 24px" }} />
      <AudRAnalisis mes={mes} anio={anio} />
      </>
      )}

      <div style={{ borderTop: `1px solid ${T.line}`, margin: "32px 0 24px" }} />
      <div style={sx.sectionTitle}>Panel del día</div>
      <AudRProximamente titulo="Panel del día" desc="Aquí vivirá lo diario y accionable del POE: cumplimiento del calendario de hoy, Alertas Rojas activas con su cronómetro (¿atendida en menos de 30 min?), y las situaciones gestionadas pendientes. Es la pieza que hoy vive solo en WhatsApp." />

      <div style={{ marginTop: 24 }}><div style={sx.sectionTitle}>Reporte diario</div></div>
      <AudRProximamente titulo="Reporte Diario de Gestión" desc="El reporte de la Auxiliar Operativa se generará solo con lo capturado en el día (alertas, situaciones, calificaciones, resumen), en vez de llenarlo a mano." />
      </>
      )}
      {toast && <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 12.5, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 50 }}>{toast}</div>}
      </main>
    </>
  );
}

function NuevaAuditoria({ onCancel, onGuardar }) {
  const [iniciada, setIniciada] = useState(false);
  const [suc, setSuc] = useState(SUCURSALES[0]);
  const [tipo, setTipo] = useState("Apertura");
  const [formato, setFormato] = useState("Propia");
  const [marks, setMarks] = useState({});
  const [coments, setComents] = useState({});
  const [alertas, setAlertas] = useState([]);
  const conceptos = AUDR_CONCEPTOS[tipo];

  const setMark = (i, val) => setMarks((p) => ({ ...p, [i]: val }));
  const marcados = conceptos.filter((_, i) => marks[i]).length;
  const cumple = conceptos.filter((_, i) => marks[i] === "ok").length;
  const calif = conceptos.length ? (cumple / conceptos.length) * 100 : 0;
  const noSinComent = conceptos.some((_, i) => marks[i] === "no" && !(coments[i] && coments[i].trim()));
  const ok = marcados === conceptos.length && !noSinComent;

  const toggleAlerta = (a) => setAlertas((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const guardar = () => { if (!ok) return; onGuardar({ suc, tipo, formato, calif, alertas }); };

  const sucOpciones = formato === "Propia" ? SUCURSALES : FRANQUICIAS.map((f) => f.suc);
  const cambiarFormato = (f) => { setFormato(f); const lista = f === "Propia" ? SUCURSALES : FRANQUICIAS.map((x) => x.suc); setSuc(lista[0]); };

  if (!iniciada) {
    return (
      <div>
        <div style={sx.h1row}><h1 style={sx.h1}>Nueva auditoría por cámaras</h1></div>
        <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 20 }}>Configura la auditoría antes de iniciar.</p>
        <div style={{ ...sx.repCard, maxWidth: 460, display: "grid", gap: 16 }}>
          <TField label="Formato"><select className="sel" value={formato} onChange={(e) => cambiarFormato(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>{["Propia", "Franquicia"].map((f) => <option key={f}>{f}</option>)}</select></TField>
          <TField label="Sucursal"><select className="sel" value={suc} onChange={(e) => setSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>{sucOpciones.map((s) => <option key={s} value={s}>{s}</option>)}</select></TField>
          <TField label="Tipo"><select className="sel" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>{["Apertura", "Operativa", "Cierre"].map((t) => <option key={t}>{t}</option>)}</select></TField>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="actbtn" onClick={onCancel} style={{ ...sx.actbtn, fontSize: 12, padding: "9px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
            <button className="actbtn" onClick={() => setIniciada(true)} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 20px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Play" size={15} color="#fff" />Iniciar auditoría</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Auditoría en curso</h1><span style={{ fontSize: 12, color: T.muted }}>{suc} · {tipo} · {formato}</span></div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <button onClick={() => setIniciada(false)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, padding: "6px 10px" }}>‹ Cambiar configuración</button>
        <div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 700, background: T.paper, color: T.ink, width: "auto" }}>{marcados}/{conceptos.length} · {calif.toFixed(0)}%</div>
      </div>

      <div style={{ ...sx.repCard, display: "grid", gap: 4, padding: 0, overflow: "hidden" }}>
        {conceptos.map((c, i) => (
          <div key={i} style={{ padding: "10px 14px", borderBottom: i < conceptos.length - 1 ? `1px solid ${T.lineSoft}` : "none", background: marks[i] === "no" ? T.badSoft : marks[i] === "ok" ? T.okSoft : "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12.5, flex: 1 }}><strong style={{ color: T.muted, fontWeight: 600 }}>{i + 1}.</strong> {c}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setMark(i, "ok")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", background: marks[i] === "ok" ? T.ok : "#fff", color: marks[i] === "ok" ? "#fff" : T.muted, border: `1px solid ${marks[i] === "ok" ? T.ok : T.line}` }}>Cumple</button>
                <button onClick={() => setMark(i, "no")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", background: marks[i] === "no" ? T.bad : "#fff", color: marks[i] === "no" ? "#fff" : T.muted, border: `1px solid ${marks[i] === "no" ? T.bad : T.line}` }}>No cumple</button>
              </div>
            </div>
            {marks[i] === "no" && (
              <input value={coments[i] || ""} onChange={(e) => setComents((p) => ({ ...p, [i]: e.target.value }))} placeholder="Comentario obligatorio (qué observaste)" className="sel" style={{ ...sx.sel, fontSize: 11.5, marginTop: 8, borderColor: coments[i] && coments[i].trim() ? T.line : T.bad }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={sx.sectionTitle}>Alerta Roja (marca si observas alguna situación crítica)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 8 }}>
          {AUDR_ALERTAS.map((a) => (
            <button key={a} onClick={() => toggleAlerta(a)} style={{ textAlign: "left", fontSize: 12, padding: "10px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", background: alertas.includes(a) ? T.badSoft : "#fff", border: `1px solid ${alertas.includes(a) ? T.bad : T.line}`, color: alertas.includes(a) ? T.crit : T.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
              <Ico name={alertas.includes(a) ? "AlertTriangle" : "Circle"} size={14} color={alertas.includes(a) ? T.bad : T.muted} />{a}
            </button>
          ))}
        </div>
        {alertas.length > 0 && <div style={{ fontSize: 11.5, color: T.bad, fontWeight: 600, marginTop: 8 }}>{alertas.length} alerta{alertas.length === 1 ? "" : "s"} roja{alertas.length === 1 ? "" : "s"} · en el sistema real se adjunta captura con hora y se notifica de inmediato.</div>}
      </div>

      <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13 }}>Calificación: <strong style={{ color: audCol(calif), fontSize: 16 }}>{calif.toFixed(1)}%</strong></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="actbtn" onClick={onCancel} style={{ ...sx.actbtn, fontSize: 12, padding: "9px 16px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Cancelar</button>
          <button className="actbtn" disabled={!ok} onClick={guardar} style={{ ...sx.actbtn, fontSize: 12, padding: "9px 20px", background: ok ? T.ink : T.line, color: ok ? "#fff" : T.muted, cursor: ok ? "pointer" : "not-allowed" }}>Finalizar auditoría</button>
        </div>
      </div>
      {!ok && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8, textAlign: "right" }}>Marca todos los conceptos y agrega comentario a cada "No cumple".</div>}
    </div>
  );
}

function AudRProgramacion({ progStore, setProgStore, onGuardado }) {
  const [prog, setProg] = useState({});
  const [formato, setFormato] = useState("Propia");
  const [mesSel, setMesSel] = useState(7);
  const [anioSel, setAnioSel] = useState(2026);
  const sucList = formato === "Propia" ? SUCURSALES : FRANQUICIAS.map((f) => f.suc);
  const key = (s) => `${formato}|${mesSel}|${anioSel}|${s}`;
  const guardadaKey = `${anioSel}|${mesSel}|${formato}`;
  const defOf = (s) => (formato === "Propia" && PROG_SEED[s] ? PROG_SEED[s] : { Apertura: 0, Operativa: 0, Cierre: 0 });
  const valOf = (s) => prog[key(s)] || (progStore[guardadaKey] && progStore[guardadaKey][s]) || defOf(s);
  const setVal = (s, tipo, val) => setProg((p) => ({ ...p, [key(s)]: { ...valOf(s), [tipo]: val === "" ? 0 : Number(val) } }));
  const totalSuc = (s) => { const v = valOf(s); return v.Apertura + v.Operativa + v.Cierre; };
  const totMes = sucList.reduce((a, s) => a + totalSuc(s), 0);
  const porTipo = (tipo) => sucList.reduce((a, s) => a + valOf(s)[tipo], 0);
  const guardar = () => {
    const snapshot = {};
    sucList.forEach((s) => { snapshot[s] = { ...valOf(s) }; });
    setProgStore((g) => ({ ...g, [guardadaKey]: snapshot }));
    onGuardado(`Programación de ${MESES_LBL[mesSel]} ${anioSel} guardada`, mesSel, anioSel);
  };

  return (
    <div>
      <div style={{ ...sx.h1row, marginBottom: 12 }}>
        <h1 style={sx.h1}>Programación mensual</h1>
        {progStore[guardadaKey] && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.ok, background: T.okSoft, padding: "3px 10px", borderRadius: 99 }}>Guardada</span>}
      </div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 18 }}>Define cuántas auditorías lleva cada sucursal en el mes, por tipo. Cada mes arranca con la frecuencia base del POE; ajústala y guárdala. Al guardar, se actualizan las métricas de programación del tablero de ese mes.</p>

      <div style={{ ...sx.repCard, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 18 }}>
        <TField label="Formato"><select className="sel" value={formato} onChange={(e) => setFormato(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>{["Propia", "Franquicia"].map((f) => <option key={f}>{f}</option>)}</select></TField>
        <TField label="Mes"><select className="sel" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5 }}>{MESES_LBL.map((m, i) => <option key={m} value={i}>{m}</option>)}</select></TField>
        <TField label="Año"><select className="sel" value={anioSel} onChange={(e) => setAnioSel(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5 }}>{[2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}</select></TField>
      </div>

      <div style={sx.cards4}>
        <Metric big={String(totMes)} label="Auditorías del mes" sub={`${sucList.length} sucursales ${formato.toLowerCase()}s`} accent={T.brand} />
        <Metric big={String(porTipo("Apertura"))} label="Apertura / mes" sub="programadas" accent={T.inkSoft} />
        <Metric big={String(porTipo("Operativa"))} label="Operativa / mes" sub="programadas" accent={T.inkSoft} />
        <Metric big={String(porTipo("Cierre"))} label="Cierre / mes" sub="programadas" accent={T.inkSoft} />
      </div>

      <div style={{ marginTop: 20, overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 560 }}>
          <thead>
            <tr style={{ background: T.paper, textAlign: "left" }}>
              {["Sucursal", "Apertura", "Operativa", "Cierre", "Total / mes"].map((h, i) => (
                <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: T.inkSoft, textAlign: i === 0 ? "left" : "right", borderBottom: `1px solid ${T.line}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sucList.map((s) => (
              <tr key={s}>
                <td style={{ padding: "8px 14px", fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}` }}>{s}</td>
                {["Apertura", "Operativa", "Cierre"].map((tipo) => (
                  <td key={tipo} style={{ padding: "6px 14px", textAlign: "right", borderBottom: `1px solid ${T.lineSoft}` }}>
                    <input type="number" value={valOf(s)[tipo]} onChange={(e) => setVal(s, tipo, e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12, width: 66, textAlign: "right", padding: "5px 8px" }} />
                  </td>
                ))}
                <td style={{ padding: "8px 14px", textAlign: "right", fontWeight: 700, borderBottom: `1px solid ${T.lineSoft}` }}>{totalSuc(s)}</td>
              </tr>
            ))}
            <tr style={{ background: T.paper }}>
              <td style={{ padding: "9px 14px", fontWeight: 700 }}>Total red</td>
              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>{porTipo("Apertura")}</td>
              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>{porTipo("Operativa")}</td>
              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700 }}>{porTipo("Cierre")}</td>
              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: T.brand }}>{totMes}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>Frecuencia mensual por sucursal (base del POE-OP-001). Se aplica al mes elegido en adelante.</div>
        <button className="actbtn" onClick={guardar} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 20px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Check" size={15} color="#fff" />Guardar programación</button>
      </div>
    </div>
  );
}

function AudRProximamente({ titulo, desc }) {
  return (
    <div style={{ ...sx.repCard, textAlign: "center", padding: "40px 24px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Ico name="Clock" size={26} color={T.muted} /></div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{titulo}</div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8, maxWidth: 560, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>{desc}</div>
      <div style={{ marginTop: 14, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.brand, background: T.brandSoft, display: "inline-block", padding: "5px 12px", borderRadius: 99 }}>Siguiente a construir</div>
    </div>
  );
}

function AudRCalDona({ label, pct, color }) {
  const r = 30, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ ...sx.repCard, textAlign: "center", padding: "16px 12px" }}>
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto" }}>
        <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke={T.lineSoft} strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 15, color }}>{pct.toFixed(1)}%</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: T.muted }}>calificación</div>
    </div>
  );
}

function AudRDonut({ label, prog, real }) {
  const pct = prog ? Math.round((real / prog) * 100) : 0;
  const col = audCol(pct);
  const r = 30, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div style={{ ...sx.repCard, textAlign: "center", padding: "16px 12px" }}>
      <div style={{ position: "relative", width: 80, height: 80, margin: "0 auto" }}>
        <svg width="80" height="80" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="40" cy="40" r={r} fill="none" stroke={T.lineSoft} strokeWidth="8" />
          <circle cx="40" cy="40" r={r} fill="none" stroke={col} strokeWidth="8" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 15, color: col }}>{pct}%</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 10.5, color: T.muted }}>{real}/{prog} realizadas</div>
    </div>
  );
}

function AudRDesempeno({ mes, anio, progStore, onProgramar }) {
  const sucs = audSucMes(mes, anio);
  const total = sucs.reduce((a, x) => a + x.aud, 0);
  const general = genMes(mes, anio);
  const genPrev = mes > 0 ? genMes(mes - 1, anio) : genMes(11, anio - 1);
  const progT = progTotales(anio, mes, progStore, "Propia");
  const rFactor = 0.85 + (vhash("r" + mes + anio) % 13) / 100;
  const donas = [["Apertura", progT.Apertura], ["Operativa", progT.Operativa], ["Cierre", progT.Cierre]].map(([l, p]) => [l, p, Math.min(p, Math.round(p * rFactor))]);
  const progTotal = progT.Apertura + progT.Operativa + progT.Cierre;
  const realTotal = donas.reduce((a, d) => a + d[2], 0);
  const cumpl = progTotal ? Math.round((realTotal / progTotal) * 100) : 0;
  const kpis = [
    { l: "Cumplimiento del calendario", v: `${cumpl}%`, meta: "≥ 95%", ok: cumpl >= 95 },
    { l: "Alertas rojas gestionadas en tiempo", v: "100%", meta: "100%", ok: true },
    { l: "Situaciones resueltas en el día", v: `${78 + (vhash("s" + mes + anio) % 18)}%`, meta: "≥ 80%", ok: 78 + (vhash("s" + mes + anio) % 18) >= 80 },
    { l: "Reportes diarios en tiempo", v: "100%", meta: "100%", ok: true },
    { l: "Tiempo de registro de alerta roja", v: "3 min", meta: "≤ 5 min", ok: true },
  ];
  const histRaw = Array.from({ length: 6 }, (_, i) => i - 5).map((off) => { let m = mes + off, a = anio; while (m < 0) { m += 12; a -= 1; } return { m, a, v: genMes(m, a) }; });
  const maxH = Math.max(...histRaw.map((h) => h.v), 1);
  const tend = general - genPrev;
  return (
    <div>
      <div style={sx.cards4}>
        <Metric big={`${general.toFixed(1)}%`} label="Calificación general" sub={`${MESES_LBL[mes]} ${anio}`} accent={audCol(general)} />
        <Metric big={`${tend >= 0 ? "+" : ""}${tend.toFixed(1)}%`} label="Vs mes anterior" sub={`${genPrev.toFixed(1)}% previo`} accent={tend >= 0 ? T.ok : T.bad} />
        {(() => {
          const snap = progStore && progStore[`${anio}|${mes}|Propia`];
          const saved = !!snap;
          const esPasado = anio < CUR_ANIO || (anio === CUR_ANIO && mes < CUR_MES);
          const estado = !saved ? "Sin programar" : esPasado ? "Realizada" : "En progreso";
          const realizada = estado === "Realizada";
          const eCol = estado === "Realizada" ? T.ok : estado === "En progreso" ? T.warn : T.muted;
          const eBg = estado === "Realizada" ? T.okSoft : estado === "En progreso" ? T.warnSoft : T.lineSoft;
          const sumTipo = (t) => (snap ? Object.values(snap).reduce((a, v) => a + (v[t] || 0), 0) : 0);
          const progApe = sumTipo("Apertura"), progOpe = sumTipo("Operativa"), progCie = sumTipo("Cierre");
          const progTotalCard = progApe + progOpe + progCie;
          const ejecShown = realizada ? realTotal : 0;
          return (
            <div style={{ ...sx.repCard, display: "flex", flexDirection: "column", gap: 10, borderTop: `3px solid ${eCol}` }}>
              <span style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: "0.02em" }}>Auditorías del mes</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 26, color: T.ink, lineHeight: 1 }}>{ejecShown}<span style={{ fontSize: 14, color: T.muted, fontWeight: 500 }}> / {progTotalCard}</span></span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: eCol, background: eBg, padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>{estado}</span>
              </div>
              <div style={{ display: "flex", gap: 10, fontSize: 10.5, color: T.muted, flexWrap: "wrap" }}>
                <span>Apertura <strong style={{ color: T.inkSoft }}>{progApe}</strong></span>
                <span>Operativa <strong style={{ color: T.inkSoft }}>{progOpe}</strong></span>
                <span>Cierre <strong style={{ color: T.inkSoft }}>{progCie}</strong></span>
              </div>
              <button className="actbtn" onClick={onProgramar} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 10px", background: "#fff", color: T.brand, border: `1px solid ${T.brand}`, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 2 }}><Ico name="CalendarRange" size={13} color={T.brand} />{saved ? "Editar programación" : "Nueva programación"}</button>
            </div>
          );
        })()}
        <Metric big={`${cumpl}%`} label="Cumplimiento calendario" sub={`${realTotal}/${progTotal} programadas`} accent={audCol(cumpl >= 95 ? 96 : cumpl)} alert={cumpl < 95} />
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>KPIs del proceso (POE-OP-001)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
          {kpis.map((k) => (
            <div key={k.l} style={{ ...sx.repCard, borderLeft: `3px solid ${k.ok ? T.ok : T.warn}` }}>
              <div style={{ fontSize: 11.5, color: T.inkSoft, minHeight: 32 }}>{k.l}</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 20, color: k.ok ? T.ok : T.warn }}>{k.v}</span>
                <span style={{ fontSize: 10.5, color: T.muted }}>meta {k.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Cumplimiento de programación por tipo</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {donas.map(([l, p, r]) => <AudRDonut key={l} label={l} prog={p} real={r} />)}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Histórico de calificación (tendencia de la red)</div>
        <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "18px 16px 10px", display: "flex", alignItems: "flex-end", gap: 14, height: 160 }}>
          {histRaw.map((h) => (
            <div key={`${h.a}-${h.m}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: audCol(h.v) }}>{h.v.toFixed(1)}</div>
              <div style={{ width: "100%", maxWidth: 54, height: `${(h.v / maxH) * 100}%`, minHeight: 3, background: h.m === mes && h.a === anio ? audCol(h.v) : T.brandSoft, border: h.m === mes && h.a === anio ? "none" : `1px solid ${T.brand}`, borderRadius: "5px 5px 0 0" }} />
              <div style={{ fontSize: 10, color: h.m === mes && h.a === anio ? T.ink : T.muted, fontWeight: h.m === mes && h.a === anio ? 700 : 400 }}>{MESES_LBL[h.m]}{h.a !== anio ? ` '${String(h.a).slice(2)}` : ""}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8, fontStyle: "italic" }}>Calificaciones de ejemplo por mes; el histórico deja ver si la red mejora o cae. El mes seleccionado se resalta.</div>
      </div>
    </div>
  );
}

function AudRAnalisis({ mes, anio }) {
  const [sel, setSel] = useState(null);
  const [tipo, setTipo] = useState("General");
  const data = audSucMes(mes, anio);
  const general = genMes(mes, anio);
  const ranked = [...data].sort((a, b) => b.cal - a.cal);
  const maxCal = 100;

  if (sel) {
    const u = data.find((x) => x.suc === sel) || data[0];
    const rank = ranked.findIndex((x) => x.suc === sel) + 1;
    const cumpl = 80 + (vhash(u.suc + mes + anio) % 20);
    const calPrev = mes > 0 ? audCalMes(u.suc, mes - 1, anio) : audCalMes(u.suc, 11, anio - 1);
    const tend = Math.round((u.cal - calPrev) * 10) / 10;
    const alertas = vhash(u.suc + "a" + mes + anio) % 4;
    const pend = vhash(u.suc + "p" + mes + anio) % 3;
    const bloquesSuc = AUDR_BLOQUES.map(([b, v]) => { const d = (vhash(u.suc + b + mes + anio) % 15) - 7; return [b, Math.max(50, Math.min(100, Math.round((v + d) * 10) / 10))]; });
    const bloqueBajo = bloquesSuc.reduce((min, x) => (x[1] < min[1] ? x : min), bloquesSuc[0]);
    const trend = Array.from({ length: 6 }, (_, i) => i - 5).map((off) => { let m = mes + off, a = anio; while (m < 0) { m += 12; a -= 1; } return { m, a, v: audCalMes(u.suc, m, a) }; });
    const maxT = Math.max(...trend.map((t) => t.v), 1);
    return (
      <div>
        <button onClick={() => setSel(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver al análisis</button>
        <div style={sx.h1row}><h1 style={sx.h1}>{u.suc}</h1><span style={{ fontSize: 12, color: T.muted }}>{MESES_LBL[mes]} {anio} · auditorías remotas</span></div>
        <div style={sx.cards4}>
          <Metric big={`${u.cal.toFixed(1)}%`} label="Calificación" sub={`${MESES_LBL[mes]} ${anio}`} accent={audCol(u.cal)} />
          <Metric big={String(u.aud)} label="Auditorías" sub="ejecutadas" accent={T.ink} />
          <Metric big={`${(u.cal - general).toFixed(1)}%`} label="Vs promedio de la red" sub={`red ${general.toFixed(1)}%`} accent={u.cal >= general ? T.ok : T.warn} />
          <Metric big={`#${rank}`} label="Ranking en la red" sub={`de ${ranked.length} sucursales`} accent={rank <= 3 ? T.ok : rank > ranked.length - 3 ? T.bad : T.inkSoft} />
        </div>
        <div style={{ marginTop: 12, ...sx.cards4 }}>
          <Metric big={`${cumpl}%`} label="Cumplimiento del calendario" sub="ejecutadas / programadas" accent={audCol(cumpl >= 95 ? 96 : cumpl)} alert={cumpl < 95} />
          <Metric big={`${tend >= 0 ? "+" : ""}${tend}%`} label="Vs mes anterior" sub="tendencia" accent={tend >= 0 ? T.ok : T.bad} />
          <Metric big={String(alertas)} label="Alertas rojas del mes" sub="detectadas" accent={alertas ? T.bad : T.ok} alert={alertas > 0} />
          <Metric big={String(pend)} label="Situaciones pendientes" sub="sin cerrar" accent={pend ? T.warn : T.ok} alert={pend > 0} />
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={sx.sectionTitle}>Tendencia de la sucursal (últimos meses)</div>
          <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "18px 16px 10px", display: "flex", alignItems: "flex-end", gap: 14, height: 150 }}>
            {trend.map((t) => (
              <div key={`${t.a}-${t.m}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: audCol(t.v) }}>{t.v.toFixed(1)}</div>
                <div style={{ width: "100%", maxWidth: 50, height: `${(t.v / maxT) * 100}%`, minHeight: 3, background: t.m === mes && t.a === anio ? audCol(t.v) : T.brandSoft, border: t.m === mes && t.a === anio ? "none" : `1px solid ${T.brand}`, borderRadius: "5px 5px 0 0" }} />
                <div style={{ fontSize: 10, color: t.m === mes && t.a === anio ? T.ink : T.muted, fontWeight: t.m === mes && t.a === anio ? 700 : 400 }}>{MESES_LBL[t.m]}{t.a !== anio ? ` '${String(t.a).slice(2)}` : ""}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={sx.sectionTitle}>Calificación por tipo</div>
          <div style={{ display: "grid", gap: 8 }}>
            {["Apertura", "Operativa", "Cierre"].map((tp) => { const v = calPorTipo(u, tp); return (
              <div key={tp} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 90, fontSize: 12.5, fontWeight: 600 }}>{tp}</div>
                <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 10, overflow: "hidden" }}><div style={{ width: `${v}%`, height: "100%", background: audCol(v), borderRadius: 99 }} /></div>
                <div style={{ width: 44, textAlign: "right", fontWeight: 700, fontSize: 12.5, color: audCol(v) }}>{v.toFixed(1)}%</div>
              </div>
            ); })}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={sx.sectionTitle}>Calificación por bloques</div>
            <span style={{ fontSize: 11.5, color: T.bad, fontWeight: 600 }}>Bloque más bajo: {bloqueBajo[0]} ({bloqueBajo[1]}%)</span>
          </div>
          <div style={{ display: "grid", gap: 7 }}>
            {bloquesSuc.map(([b, v]) => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 210, minWidth: 210, fontSize: 12, color: T.inkSoft }}>{b}</div>
                <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 9, overflow: "hidden" }}><div style={{ width: `${v}%`, height: "100%", background: audCol(v), borderRadius: 99 }} /></div>
                <div style={{ width: 44, textAlign: "right", fontWeight: 700, fontSize: 12, color: audCol(v) }}>{v}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const porTipo = [...data].map((s) => ({ suc: s.suc, v: calPorTipo(s, tipo) })).sort((a, b) => b.v - a.v);
  const top5 = porTipo.slice(0, 5);
  const bottom5 = porTipo.slice(-5).reverse();

  return (
    <div>
      <div style={sx.sectionTitle}>Calificación general por tipo · {MESES_LBL[mes]} {anio}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 26 }}>
        {[["Apertura", T.brand], ["Operativa", T.brandDark], ["Cierre", T.ink]].map(([tp, col]) => {
          const vals = data.map((s) => calPorTipo(s, tp));
          const prom = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          return <AudRCalDona key={tp} label={tp} pct={prom} color={col} />;
        })}
      </div>

      <div style={sx.sectionTitle}>Promedio por sucursal · {MESES_LBL[mes]} {anio} (toca para ver detalle)</div>
      <div style={{ display: "grid", gap: 6 }}>
        {ranked.map((u, i) => (
          <button key={u.suc} onClick={() => setSel(u.suc)} className="rowbtn" style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer", textAlign: "left", width: "100%", borderLeft: `3px solid ${audCol(u.cal)}` }}>
            <span style={{ width: 18, fontSize: 12, fontWeight: 700, color: T.muted }}>{i + 1}</span>
            <div style={{ width: 150, minWidth: 150 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{u.suc}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{u.aud} auditorías</div>
            </div>
            <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 9, minWidth: 60, overflow: "hidden" }}><div style={{ width: `${(u.cal / maxCal) * 100}%`, height: "100%", background: audCol(u.cal), borderRadius: 99 }} /></div>
            <div style={{ width: 56, textAlign: "right", fontWeight: 700, fontSize: 13, color: audCol(u.cal) }}>{u.cal.toFixed(1)}%</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Calificación por bloques (general)</div>
        <div style={{ display: "grid", gap: 7 }}>
          {AUDR_BLOQUES.map(([b, v]) => (
            <div key={b} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 210, minWidth: 210, fontSize: 12, color: T.inkSoft }}>{b}</div>
              <div style={{ flex: 1, background: T.lineSoft, borderRadius: 99, height: 9, overflow: "hidden" }}><div style={{ width: `${v}%`, height: "100%", background: audCol(v), borderRadius: 99 }} /></div>
              <div style={{ width: 44, textAlign: "right", fontWeight: 700, fontSize: 12, color: audCol(v) }}>{v}%</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <div style={sx.sectionTitle}>Ranking por tipo de auditoría</div>
          <select className="sel" value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{AUDR_TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, marginTop: 8 }}>
          <div style={{ ...sx.repCard }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ok, marginBottom: 8 }}>Top 5</div>
            {top5.map((r) => (
              <div key={r.suc} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5 }}><span>{r.suc}</span><strong style={{ color: audCol(r.v) }}>{r.v.toFixed(1)}%</strong></div>
            ))}
          </div>
          <div style={{ ...sx.repCard }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.bad, marginBottom: 8 }}>Bottom 5</div>
            {bottom5.map((r) => (
              <div key={r.suc} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${T.lineSoft}`, fontSize: 12.5 }}><span>{r.suc}</span><strong style={{ color: audCol(r.v) }}>{r.v.toFixed(1)}%</strong></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const OP_SECCIONES = [
  { key: "objetivos", nombre: "Objetivos y Metas", iconName: "Target", activa: true, desc: "Metas por sucursal · venta e indicadores" },
  { key: "auditorias_fisicas", nombre: "Auditorías Físicas", iconName: "ClipboardCheck", activa: true, desc: "Apertura, operativa y cierre · presenciales" },
  { key: "auditorias_remotas", nombre: "Auditorías Remotas", iconName: "Video", activa: true, desc: "Supervisión por cámara · planes correctivos" },
  { key: "estandares", nombre: "Cumplimiento de estándares (SOPs)", iconName: "BadgeCheck", activa: false, desc: "Calidad, porcionamiento e higiene" },
  { key: "gerentes", nombre: "Seguimiento a gerentes", iconName: "Users", activa: false, desc: "Reuniones, metas y retroalimentación" },
  { key: "mantenimiento", nombre: "Mantenimiento (seguimiento)", iconName: "Wrench", activa: false, desc: "Tickets abiertos, prioridad máquina de helado" },
  { key: "abasto", nombre: "Abasto e inventarios", iconName: "Package", activa: false, desc: "Stock y pedidos al CEDIS" },
  { key: "plantilla", nombre: "Vacantes y plantilla", iconName: "UserPlus", activa: false, desc: "Plantillas completas · enlace con RH" },
  { key: "reportes", nombre: "Reportes a Dirección", iconName: "BarChart3", activa: true, desc: "Automáticos + entregas con carga" },
];
const AUD_TIPOS = ["Apertura", "Operativa", "Cierre"];
const OP_REPORTES = {
  automaticos: [
    { nombre: "Resultado de Auditorías (semanal)", per: "Semanal · lunes", fuente: "Auditorías" },
    { nombre: "Resultado de Auditorías (mensual)", per: "Mensual · primeros 7 días", fuente: "Auditorías" },
    { nombre: "Estado de la red", per: "Mensual · primeros 7 días", fuente: "Tablero de la red" },
  ],
  entregas: [
    { nombre: "Reporte operativo semanal", periodicidad: "Semanal", dia: "Lunes", resp: "Osvaldo", estado: "Entregado", archivo: "operativo_semana.pdf" },
    { nombre: "Cumplimiento de estándares (SOPs)", periodicidad: "Semanal", dia: "Miércoles", resp: "Pamela Segovia", estado: "Pendiente", archivo: null },
    { nombre: "Seguimiento a reportes", periodicidad: "Semanal", dia: "Viernes", resp: "Viridiana", estado: "Pendiente", archivo: null },
    { nombre: "Reporte mensual a Dirección", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Osvaldo", estado: "Pendiente", archivo: null },
    { nombre: "Abasto e inventarios", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Kathia", estado: "Vencido", archivo: null },
    { nombre: "Plantilla y rotación", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Ruben Reyes", estado: "Pendiente", archivo: null },
    { nombre: "Seguimiento a reportes", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Viridiana", estado: "Pendiente", archivo: null },
    { nombre: "Reporte trimestral a Dirección", periodicidad: "Trimestral", dia: "Primer semana del trimestre", resp: "Osvaldo", estado: "Entregado", archivo: "trimestral_Q.pdf" },
    { nombre: "Reporte anual a Dirección", periodicidad: "Anual", dia: "Enero", resp: "Osvaldo", estado: "Pendiente", archivo: null },
  ],
};
const AUDR_REPORTES = {
  automaticos: [
    { nombre: "Calificación general por sucursal", per: "Mensual", fuente: "Auditorías Remotas" },
    { nombre: "Cumplimiento de programación", per: "Mensual", fuente: "Programación" },
  ],
  entregas: [
    { nombre: "Reporte Diario de Gestión Operativa", periodicidad: "Diario", dia: "Antes del cierre", resp: "Mayela Leal", estado: "Entregado", archivo: "gestion_diaria.pdf" },
    { nombre: "Resumen semanal de videovigilancia", periodicidad: "Semanal", dia: "Lunes", resp: "Mayela Leal", estado: "Pendiente", archivo: null },
    { nombre: "Puntos reincidentes de la semana", periodicidad: "Semanal", dia: "Lunes", resp: "Mayela Leal", estado: "Pendiente", archivo: null },
    { nombre: "Informe mensual de auditorías", periodicidad: "Mensual", dia: "Primeros 5 días", resp: "Carlos Morales", estado: "Pendiente", archivo: null },
  ],
};
const CH_REPORTES = {
  automaticos: [{ nombre: "Cuadro de personal y nómina", per: "Semanal", fuente: "Capital Humano" }],
  entregas: [
    { nombre: "Nómina semanal", periodicidad: "Semanal", dia: "Viernes", resp: "Kathia", estado: "Pendiente", archivo: null },
    { nombre: "Reporte de incorporaciones", periodicidad: "Mensual", dia: "Primeros 5 días", resp: "Abi", estado: "Pendiente", archivo: null },
    { nombre: "Rotación de personal", periodicidad: "Mensual", dia: "Primeros 5 días", resp: "Abi", estado: "Entregado", archivo: "rotacion.pdf" },
  ],
};
const MTTO_REPORTES = {
  automaticos: [{ nombre: "Órdenes y costos de mantenimiento", per: "Mensual", fuente: "Mantenimiento" }],
  entregas: [
    { nombre: "Incidencias de mantenimiento", periodicidad: "Semanal", dia: "Viernes", resp: "Elias", estado: "Pendiente", archivo: null },
    { nombre: "Costos de mantenimiento del mes", periodicidad: "Mensual", dia: "Primeros 5 días", resp: "Elias", estado: "Pendiente", archivo: null },
  ],
};
const AUDITORIAS = [
  { id: "AU-01", suc: "Mitras", origen: "Física", tipo: "Operativa", fecha: dOff(-3), calif: 92, incidencias: [{ desc: "Faltó etiquetado PEPS en refrigerador", plan: "Reetiquetar y capacitar al equipo", resp: "Pamela Segovia", limite: dOff(2), cerrado: false }] },
  { id: "AU-02", suc: "Las Puentes", origen: "Física", tipo: "Apertura", fecha: dOff(-5), calif: 100, incidencias: [] },
  { id: "AU-03", suc: "Soriana Cadereyta", origen: "Remota", tipo: "Operativa", fecha: dOff(-2), calif: 74, incidencias: [{ desc: "Porcionamiento fuera de estándar", plan: "Recalibrar porciones con báscula", resp: "Osvaldo", limite: dOff(1), cerrado: false }, { desc: "Barra sin limpieza profunda", plan: "Programar limpieza profunda semanal", resp: "Osvaldo", limite: dOff(4), cerrado: false }] },
  { id: "AU-04", suc: "Juárez Centro", origen: "Física", tipo: "Cierre", fecha: dOff(-1), calif: 88, incidencias: [{ desc: "Corte de caja con diferencia menor", plan: "Reforzar protocolo de corte", resp: "Kathia", limite: dOff(3), cerrado: false }] },
  { id: "AU-05", suc: "Escobedo Lineal", origen: "Remota", tipo: "Operativa", fecha: dOff(-2), calif: 68, incidencias: [{ desc: "Máquina de helado sin bitácora de limpieza", plan: "Implementar bitácora diaria", resp: "Jesus", limite: dOff(-1), cerrado: false }, { desc: "Personal sin uniforme completo", plan: "Dotar uniformes y supervisar", resp: "Jesus", limite: dOff(5), cerrado: true }] },
  { id: "AU-06", suc: "Berneses", origen: "Física", tipo: "Operativa", fecha: dOff(-6), calif: 84, incidencias: [{ desc: "Promoción exhibida incorrecta", plan: "Actualizar material POP", resp: "Abi", limite: dOff(-2), cerrado: true }] },
  { id: "AU-07", suc: "Mitras", origen: "Remota", tipo: "Operativa", fecha: dOff(-4), calif: 90, incidencias: [] },
  { id: "AU-08", suc: "Walmart San Sebastián", origen: "Remota", tipo: "Operativa", fecha: dOff(-3), calif: 86, incidencias: [{ desc: "Uniforme incompleto en barra", plan: "Supervisar dotación de uniformes", resp: "Viridiana", limite: dOff(2), cerrado: false }] },
];

function SucursalesPropias() {
  const [sec, setSec] = useState(null);
  const secMeta = OP_SECCIONES.find((s) => s.key === sec);
  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Sucursales Propias</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{secMeta ? secMeta.nombre : "Operaciones · panel del departamento"}</div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {sec && <button onClick={() => setSec(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Secciones</button>}
        </nav>
      </header>
      <main style={sx.main}>
        {!sec && <OpHome onEnter={setSec} />}
        {sec === "objetivos" && <ObjetivosMetas />}
        {sec === "auditorias_fisicas" && <Auditorias origen="Física" />}
        {sec === "auditorias_remotas" && <Auditorias origen="Remota" />}
        {sec === "reportes" && <ReportesSeccion config={OP_REPORTES} titulo="Reportes a Dirección" />}
        {secMeta && !secMeta.activa && <FranqPlaceholder sec={secMeta} />}
      </main>
    </>
  );
}

/* ===== Objetivos y Metas por sucursal ===== */
// NOTA PARA EL PROGRAMADOR: la meta de VENTA definida aquí debe ser la misma fuente que alimenta
// el "cumplimiento de meta" en Finanzas › Ventas (una sola fuente de verdad).
const OBJ_SEED = (suc, mes) => {
  const base = VENTAS_MES[suc] || 250000;
  const h = vhash(suc + mes);
  const venta = Math.round((base * (0.98 + (h % 8) / 100)) / 1000) * 1000;
  return {
    venta,
    ticket: 90 + (h % 25),
    transacciones: Math.round(venta / (90 + (h % 25))),
    pctCosto: 30 + (h % 6),
    pctNomina: 18 + (h % 5),
    calAuditoria: 90 + (h % 8),
    foco: "",
  };
};
const OBJ_SEM = (venta) => { const base = Math.round(venta / 4 / 1000) * 1000; return [base, base, base, venta - base * 3]; };

function ObjetivosMetas() {
  const [mes, setMes] = useState(6);
  const [suc, setSuc] = useState(SUCURSALES[0]);
  const [store, setStore] = useState({});
  const [archivo, setArchivo] = useState([]);
  const [mesArch, setMesArch] = useState(6);
  const [msg, setMsg] = useState("");
  const key = `${mes}|${suc}`;
  const obj = store[key] || OBJ_SEED(suc, mes);
  const semanas = obj.semanas || OBJ_SEM(obj.venta);
  const set = (campo, val) => setStore((p) => ({ ...p, [key]: { ...obj, semanas, [campo]: val } }));
  const setSem = (i, val) => { const s = semanas.map((x, j) => (j === i ? (val === "" ? 0 : Number(val)) : x)); setStore((p) => ({ ...p, [key]: { ...obj, semanas: s } })); };
  const sumSem = semanas.reduce((a, b) => a + b, 0);
  const guardar = () => {
    const doc = { ...obj, semanas };
    setStore((p) => ({ ...p, [key]: doc }));
    setArchivo((p) => [{ id: Date.now(), mes, suc, fecha: new Date().toISOString().slice(0, 10), doc }, ...p.filter((a) => !(a.mes === mes && a.suc === suc))]);
    setMesArch(mes);
    setMsg("Objetivos guardados y archivados");
    setTimeout(() => setMsg(""), 2500);
  };

  const Campo = ({ label, campo, prefix, suffix }) => (
    <TField label={label}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {prefix && <span style={{ fontSize: 12, color: T.muted }}>{prefix}</span>}
        <input type="number" value={obj[campo]} onChange={(e) => set(campo, e.target.value === "" ? 0 : Number(e.target.value))} className="sel" style={{ ...sx.sel, fontSize: 12.5 }} />
        {suffix && <span style={{ fontSize: 12, color: T.muted }}>{suffix}</span>}
      </div>
    </TField>
  );

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Objetivos y Metas</h1><span style={{ fontSize: 12, color: T.muted }}>por sucursal · mensual</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 18 }}>El Gerente de Operaciones define aquí las metas de cada gerente de sucursal: venta (mensual y semanal), indicadores financieros y operativos, y el foco del mes.</p>

      <div style={{ ...sx.repCard, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
        <TField label="Sucursal"><select className="sel" value={suc} onChange={(e) => setSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select></TField>
        <TField label="Mes"><select className="sel" value={mes} onChange={(e) => setMes(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5 }}>{MESES_LBL.map((m, i) => <option key={m} value={i}>{m} 2026</option>)}</select></TField>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={sx.sectionTitle}>Objetivo de venta</div>
        <div style={{ ...sx.repCard, display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
            <TField label="Venta del mes"><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 12, color: T.muted }}>$</span><input type="number" value={obj.venta} onChange={(e) => set("venta", e.target.value === "" ? 0 : Number(e.target.value))} className="sel" style={{ ...sx.sel, fontSize: 12.5 }} /></div></TField>
            <TField label="Suma semanal"><div style={{ ...sx.sel, fontSize: 12.5, fontWeight: 700, background: T.paper, color: sumSem === obj.venta ? T.ok : T.warn }}>{money(sumSem)}{sumSem !== obj.venta ? " ⚠" : " ✓"}</div></TField>
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: T.inkSoft, marginBottom: 6 }}>Reparto por semana</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {semanas.map((s, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10.5, color: T.muted, marginBottom: 3 }}>Semana {i + 1}</div>
                  <input type="number" value={s} onChange={(e) => setSem(i, e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12, padding: "6px 8px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
        <div>
          <div style={sx.sectionTitle}>Indicadores financieros</div>
          <div style={{ ...sx.repCard, display: "grid", gap: 12 }}>
            <Campo label="Ticket promedio objetivo" campo="ticket" prefix="$" />
            <Campo label="Transacciones objetivo" campo="transacciones" />
            <Campo label="Costo de producto objetivo" campo="pctCosto" suffix="%" />
            <Campo label="Nómina objetivo" campo="pctNomina" suffix="%" />
          </div>
        </div>
        <div>
          <div style={sx.sectionTitle}>Indicadores operativos</div>
          <div style={{ ...sx.repCard, display: "grid", gap: 12 }}>
            <Campo label="Calificación de auditoría objetivo (físicas + remotas)" campo="calAuditoria" suffix="%" />
            <TField label="Foco / enfoque del mes" hint="La prioridad que Dirección quiere para esta sucursal">
              <textarea value={obj.foco} onChange={(e) => set("foco", e.target.value)} placeholder="Ej. Subir ticket promedio con venta sugestiva y reforzar limpieza de barra." className="sel" style={{ ...sx.sel, fontSize: 12.5, minHeight: 92, resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            </TField>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>La meta de venta es la misma que alimenta el "cumplimiento de meta" en Finanzas › Ventas.</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {msg && <span style={{ fontSize: 12, fontWeight: 600, color: T.ok }}>{msg}</span>}
          <button className="actbtn" onClick={guardar} style={{ ...sx.actbtn, fontSize: 12.5, padding: "9px 20px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Check" size={15} color="#fff" />Guardar objetivos</button>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.line}`, margin: "28px 0 20px" }} />
      <div style={sx.sectionTitle}>Documentos archivados</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {MESES_LBL.map((m, i) => {
          const n = archivo.filter((a) => a.mes === i).length;
          const activo = mesArch === i;
          return (
            <button key={m} onClick={() => setMesArch(i)} className="roletab" style={{ ...sx.roletab, fontSize: 12, position: "relative", background: activo ? T.ink : "#fff", color: activo ? "#fff" : n ? T.inkSoft : T.muted, borderColor: activo ? T.ink : T.line }}>
              {m}{n > 0 ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>
      {(() => {
        const docs = archivo.filter((a) => a.mes === mesArch);
        if (docs.length === 0) return <div style={{ ...sx.repCard, textAlign: "center", padding: "28px 20px", color: T.muted, fontSize: 12.5 }}>No hay documentos guardados en {MESES_LBL[mesArch]} 2026. Al guardar los objetivos de un mes, el documento se archiva aquí para consultarlo y compartirlo con la sucursal.</div>;
        return (
          <div style={{ display: "grid", gap: 8 }}>
            {docs.map((a) => (
              <div key={a.id} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: `3px solid ${T.brand}` }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: T.brandSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Ico name="FileText" size={18} color={T.brand} /></div>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Metas · {a.suc}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{MESES_LBL[a.mes]} 2026 · guardado {a.fecha}</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: T.muted }}>Venta</div><div style={{ fontWeight: 700, fontSize: 12.5, color: T.brand }}>{money(a.doc.venta)}</div></div>
                  <div style={{ textAlign: "right" }}><div style={{ fontSize: 9, color: T.muted }}>Auditoría</div><div style={{ fontWeight: 700, fontSize: 12.5 }}>{a.doc.calAuditoria}%</div></div>
                  <button onClick={() => { setSuc(a.suc); setMes(a.mes); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>Ver</button>
                  <button className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: T.ink, color: "#fff", display: "inline-flex", alignItems: "center", gap: 5 }}><Ico name="Download" size={13} color="#fff" />Descargar PDF</button>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>El documento se archiva por mes y sucursal. "Descargar PDF" genera el documento con el diseño de marca para compartirlo con la sucursal (lo conecta el programador).</div>
    </div>
  );
}

function OpHome({ onEnter }) {
  const planesF = AUDITORIAS.filter((a) => a.origen === "Física").reduce((s, a) => s + a.incidencias.filter((i) => !i.cerrado).length, 0);
  const planesR = AUDITORIAS.filter((a) => a.origen === "Remota").reduce((s, a) => s + a.incidencias.filter((i) => !i.cerrado).length, 0);
  const resumen = {
    objetivos: "Metas por sucursal · venta, financieros y operativos",
    auditorias_fisicas: `${AUDITORIAS.filter((a) => a.origen === "Física").length} auditorías · ${planesF} planes abiertos`,
    auditorias_remotas: `${AUDITORIAS.filter((a) => a.origen === "Remota").length} auditorías · ${planesR} planes abiertos`,
    reportes: `${OP_REPORTES.entregas.filter((e) => e.estado !== "Entregado").length} por entregar · ${OP_REPORTES.automaticos.length} automáticos`,
  };
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Sucursales Propias</h1><span style={{ fontSize: 12, color: T.muted }}>operaciones · 12 sucursales</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 22 }}>Gestión operativa de las sucursales de la empresa (distinta de Franquicias, que son de terceros).</p>

      <TableroRed />

      <div style={{ marginTop: 30 }}>
        <div style={sx.sectionTitle}>Secciones del departamento</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {OP_SECCIONES.map((s) => (
            <button key={s.key} className={s.activa ? "rowbtn" : ""} onClick={() => s.activa && onEnter(s.key)} disabled={!s.activa} style={{ ...sx.areaCard, cursor: s.activa ? "pointer" : "default", opacity: s.activa ? 1 : 0.72 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: s.activa ? T.brand : T.muted, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{s.desc}</div>
                  </div>
                </div>
                {!s.activa && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 8px", borderRadius: 99 }}>Por configurar</span>}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 12, fontWeight: 600, color: s.activa ? T.brand : T.muted }}>{s.activa ? resumen[s.key] : "Próximamente"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableroRed() {
  const red = SUCURSALES.map((suc, i) => {
    const a = AUDITORIAS.filter((x) => x.suc === suc).sort((x, y) => (x.fecha < y.fecha ? 1 : -1));
    const ult = a[0];
    const calif = ult ? ult.calif : [96, 93, 90, 88, 86, 91, 94, 82][i % 8];
    const planes = a.reduce((s, x) => s + x.incidencias.filter((z) => !z.cerrado).length, 0);
    return { suc, calif, planes, fecha: ult ? ult.fecha : "sin auditoría reciente" };
  });
  const col = (c) => (c >= 90 ? T.ok : c >= 80 ? T.warn : T.bad);
  const est = (c) => (c >= 90 ? "Sano" : c >= 80 ? "Observación" : "Crítico");
  const sanos = red.filter((r) => r.calif >= 90).length;
  const obs = red.filter((r) => r.calif >= 80 && r.calif < 90).length;
  const crit = red.filter((r) => r.calif < 80).length;
  const planesT = red.reduce((s, r) => s + r.planes, 0);
  return (
    <div>
      <div style={sx.sectionTitle}>Estado de la red</div>
      <div style={sx.cards4}>
        <Metric big={String(sanos)} label="Sanas" sub="≥ 90% operativo" accent={T.ok} />
        <Metric big={String(obs)} label="En observación" sub="80–89%" accent={T.warn} alert={obs > 0} />
        <Metric big={String(crit)} label="Críticas" sub="< 80%" accent={T.bad} alert={crit > 0} />
        <Metric big={String(planesT)} label="Planes abiertos" sub="acciones correctivas" accent={planesT ? T.warn : T.ok} />
      </div>
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginBottom: 10 }}>Estado operativo por sucursal</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
          {red.map((r) => (
            <div key={r.suc} style={{ ...sx.areaCard, borderTop: `3px solid ${col(r.calif)}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, minWidth: 0 }}>{r.suc}</div>
                <span style={{ width: 11, height: 11, borderRadius: 99, background: col(r.calif), flexShrink: 0, marginTop: 3 }} />
              </div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 30, color: col(r.calif), marginTop: 8 }}>{r.calif}%</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: col(r.calif) }}>{est(r.calif)}</div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}`, fontSize: 11, color: T.muted, display: "flex", justifyContent: "space-between" }}>
                <span>{r.planes} plan{r.planes === 1 ? "" : "es"}</span>
                <span>{r.fecha}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>El estado sale de la última auditoría de cada sucursal. Las que no tienen auditoría reciente muestran un valor de referencia.</div>
      </div>
    </div>
  );
}

function Auditorias({ origen }) {
  const [auds, setAuds] = useState(AUDITORIAS);
  const [abierta, setAbierta] = useState(null);
  const [nueva, setNueva] = useState(false);
  const blank = { suc: SUCURSALES[0], tipo: "Operativa", fecha: new Date().toISOString().slice(0, 10), calif: "" };
  const [na, setNa] = useState(blank);
  const hoy = new Date().toISOString().slice(0, 10);

  const crearAud = () => { if (na.calif === "") return; setAuds((p) => [{ id: "AU-" + Date.now(), suc: na.suc, origen, tipo: na.tipo, fecha: na.fecha, calif: Number(na.calif), incidencias: [] }, ...p]); setNa(blank); setNueva(false); };
  const cerrarInc = (aid, idx) => setAuds((p) => p.map((a) => (a.id === aid ? { ...a, incidencias: a.incidencias.map((i, k) => (k === idx ? { ...i, cerrado: !i.cerrado } : i)) } : a)));
  const addInc = (aid, inc) => setAuds((p) => p.map((a) => (a.id === aid ? { ...a, incidencias: [...a.incidencias, { ...inc, cerrado: false }] } : a)));

  const lista = auds.filter((a) => a.origen === origen);
  const prom = lista.length ? Math.round(lista.reduce((s, a) => s + a.calif, 0) / lista.length) : 0;
  const criticas = lista.filter((a) => a.calif < 80).length;
  const planesAbiertos = lista.reduce((s, a) => s + a.incidencias.filter((i) => !i.cerrado).length, 0);
  const planesVencidos = lista.reduce((s, a) => s + a.incidencias.filter((i) => !i.cerrado && i.limite < hoy).length, 0);

  return (
    <div>
      <div style={{ ...sx.h1row, marginBottom: 14 }}>
        <h1 style={sx.h1}>Auditorías {origen === "Física" ? "físicas" : "remotas"}</h1>
        <button className="actbtn" onClick={() => setNueva(!nueva)} style={{ ...sx.actbtn, fontSize: 12, padding: "8px 14px", background: nueva ? T.ink : T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name={nueva ? "X" : "Plus"} size={15} color="#fff" />{nueva ? "Cancelar" : "Registrar auditoría"}</button>
      </div>

      <div style={sx.cards4}>
        <Metric big={String(auds.length)} label="Auditorías" sub="en el periodo" accent={T.brand} />
        <Metric big={`${prom}%`} label="Cumplimiento promedio" sub="meta ≥ 80%" accent={prom >= 80 ? T.ok : T.bad} />
        <Metric big={String(criticas)} label="Sucursales críticas" sub="por debajo de 80%" accent={T.bad} alert={criticas > 0} />
        <Metric big={String(planesAbiertos)} label="Planes abiertos" sub={`${planesVencidos} vencidos`} accent={planesVencidos ? T.bad : planesAbiertos ? T.warn : T.ok} alert={planesVencidos > 0} />
      </div>

      {nueva && (
        <div style={{ ...sx.repCard, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
          <select className="sel" value={na.suc} onChange={(e) => setNa({ ...na, suc: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="sel" value={na.tipo} onChange={(e) => setNa({ ...na, tipo: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{AUD_TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
          <input type="date" value={na.fecha} onChange={(e) => setNa({ ...na, fecha: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: "auto" }} />
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.muted }}>Calif. %<input type="number" min="0" max="100" placeholder="0-100" value={na.calif} onChange={(e) => setNa({ ...na, calif: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: 80 }} /></label>
          <button className="actbtn" disabled={na.calif === ""} onClick={crearAud} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: na.calif === "" ? T.line : T.ink, color: na.calif === "" ? T.muted : "#fff" }}>Guardar</button>
        </div>
      )}

      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        {lista.map((a) => <AudCard key={a.id} a={a} open={abierta === a.id} onToggle={() => setAbierta(abierta === a.id ? null : a.id)} cerrarInc={cerrarInc} addInc={addInc} hoy={hoy} />)}
      </div>
    </div>
  );
}

function AudCard({ a, open, onToggle, cerrarInc, addInc, hoy }) {
  const [ni, setNi] = useState({ desc: "", plan: "", resp: COLABS[0], limite: dOff(3) });
  const aprob = a.calif >= 80;
  const abiertos = a.incidencias.filter((i) => !i.cerrado).length;
  return (
    <div style={{ ...sx.repCard, borderLeft: !aprob ? `3px solid ${T.bad}` : undefined }}>
      <button onClick={onToggle} className="rowbtn" style={{ width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{a.suc}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.inkSoft, background: T.lineSoft, padding: "2px 8px", borderRadius: 99 }}>{a.tipo}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: aprob ? T.ok : T.bad, background: aprob ? T.okSoft : T.badSoft, padding: "2px 8px", borderRadius: 99 }}>{aprob ? "Aprobada" : "Crítica"}</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{a.fecha} · {abiertos} plan{abiertos === 1 ? "" : "es"} abierto{abiertos === 1 ? "" : "s"}</div>
        </div>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 22, color: aprob ? T.ok : T.bad }}>{a.calif}%</span>
      </button>

      {open && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}`, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted }}>Incidencias y planes de acción</div>
          {a.incidencias.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Sin incidencias. Auditoría limpia.</div>}
          {a.incidencias.map((i, idx) => {
            const venc = !i.cerrado && i.limite < hoy;
            return (
              <div key={idx} style={{ background: T.paper, borderRadius: 10, padding: "10px 12px", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, textDecoration: i.cerrado ? "line-through" : "none", color: i.cerrado ? T.muted : T.ink }}>{i.desc}</div>
                  <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 2 }}>Plan: {i.plan}</div>
                  <div style={{ fontSize: 11, color: venc ? T.bad : T.muted, marginTop: 2, fontWeight: venc ? 700 : 400 }}>{i.resp} · límite {i.limite}{venc ? " · vencido" : ""}</div>
                </div>
                <button className="actbtn" onClick={() => cerrarInc(a.id, idx)} style={{ ...sx.actbtn, fontSize: 11, padding: "5px 12px", background: i.cerrado ? T.ok : T.ink }}>{i.cerrado ? "Cerrado ✓" : "Cerrar plan"}</button>
              </div>
            );
          })}
          {/* agregar incidencia */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
            <input placeholder="Incidencia detectada" value={ni.desc} onChange={(e) => setNi({ ...ni, desc: e.target.value })} className="sel" style={{ ...sx.sel, flex: 1, minWidth: 150, fontSize: 12 }} />
            <input placeholder="Plan de acción" value={ni.plan} onChange={(e) => setNi({ ...ni, plan: e.target.value })} className="sel" style={{ ...sx.sel, flex: 1, minWidth: 150, fontSize: 12 }} />
            <select className="sel" value={ni.resp} onChange={(e) => setNi({ ...ni, resp: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>{COLABS.map((x) => <option key={x}>{x}</option>)}</select>
            <input type="date" value={ni.limite} onChange={(e) => setNi({ ...ni, limite: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: "auto" }} />
            <button className="actbtn" disabled={!ni.desc.trim() || !ni.plan.trim()} onClick={() => { addInc(a.id, ni); setNi({ desc: "", plan: "", resp: COLABS[0], limite: dOff(3) }); }} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: ni.desc.trim() && ni.plan.trim() ? T.ink : T.line, color: ni.desc.trim() && ni.plan.trim() ? "#fff" : T.muted }}>Agregar plan</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   DEPARTAMENTO DE CAPITAL HUMANO
   ============================================================ */
const CH_SECCIONES = [
  { key: "incorporacion", nombre: "Incorporación de Personal", iconName: "UserPlus", activa: true, desc: "Gerentes y ayudantes · vacante → asignación" },
  { key: "cuadro", nombre: "Cuadro de personal", iconName: "Users", activa: true, desc: "Plantilla y sueldos · actualización semanal" },
  { key: "banco", nombre: "Banco de Candidatos", iconName: "UsersRound", activa: true, desc: "Prospectos guardados para futuras vacantes" },
  { key: "expedientes", nombre: "Expedientes del personal", iconName: "FolderOpen", activa: true, desc: "Ficha de cada colaborador · gerentes con desempeño" },
  { key: "evaluaciones", nombre: "Evaluaciones de desempeño", iconName: "ClipboardCheck", activa: false, desc: "Seguimientos y calificaciones" },
  { key: "rotacion", nombre: "Rotación y reportes", iconName: "BarChart3", activa: false, desc: "Índice de rotación por sucursal" },
  { key: "nomina", nombre: "Nómina y asistencia", iconName: "Wallet", activa: false, desc: "Pagos, faltas e incidencias" },
  { key: "capacitacion", nombre: "Capacitación continua", iconName: "GraduationCap", activa: false, desc: "Cursos y certificaciones" },
];
const CAND_ETAPAS = ["Contactado", "Entrevista RH", "Entrevista Operaciones", "Oferta enviada", "Contratado", "Descartado"];
const ETAPAS_CH = ["Vacante", "Reclutamiento", "Contratación", "Inducción", "Evaluación de perfil", "Capacitación", "Evaluación", "Asignación"];
const MOTIVOS_VAC = ["Renuncia del gerente anterior", "Promoción interna", "Nueva apertura", "Despido / baja", "Incapacidad o licencia", "Reestructura de la sucursal", "Crecimiento del equipo"];
const URGENCIAS = [["Baja", T.ok], ["Media", T.warn], ["Alta", T.bad], ["Crítica", T.crit]];
const urgMeta = (u) => (URGENCIAS.find(([n]) => n === u) || URGENCIAS[1]);
const DOCS_TPL = ["Contrato firmado", "INE", "CURP / NSS / RFC", "Comprobante de domicilio", "Alta ante el IMSS"];
const CAPA_TPL = [
  ["Día 1 · Productos e imagen", ["Catálogo, toppings y precios", "Estándares de imagen", "Protocolo de atención al cliente"]],
  ["Día 2 · Preparación y máquina", ["Desinfección y corte de fruta", "Preparación de toppings y fórmulas", "Limpieza de áreas", "Operación de máquina Taylor"]],
  ["Día 3 · Mercancía e insumos", ["Recepción y etiquetado", "Rotación PEPS", "Organización de almacenes", "Manejo de merma"]],
  ["Día 4 · Punto de venta", ["Operación del POS", "Cobro efectivo / tarjeta / mixto", "Corte de caja y terminal"]],
  ["Día 5 · Gestión del gerente", ["Reportes de ventas y caja chica", "Pedidos al CEDIS", "Conteo de inventario", "Uso de la plataforma"]],
];
const EVAL_TPL = ["Imagen y limpieza", "Atención al cliente", "Manejo de máquina Taylor", "Corte de caja correcto", "Manejo de inventario y PEPS", "Uso de la plataforma"];
function nuevoColab(nombre, seed) {
  return {
    nombre, ingreso: "10/06/2026",
    docs: DOCS_TPL.map((d, i) => ({ nombre: d, ok: seed ? i < 4 : false, archivo: seed && i < 4 ? "documento.pdf" : null })),
    induccion: !!seed,
    induccionArchivo: seed ? "induccion.pdf" : null,
    capa: CAPA_TPL.map(([t, items], di) => ({ titulo: t, archivo: seed && di < 2 ? "evidencia_dia.pdf" : null, items: items.map((x) => ({ txt: x, done: seed ? di < 2 : false })) })),
    evalItems: EVAL_TPL.map((x) => ({ txt: x, val: false })),
    evalHecha: false, asignada: false,
  };
}
const PUESTOS_CH = ["Gerente de sucursal", "Ayudante general"];
const VACANTES_CH = [
  { id: "VAC-01", puesto: "Gerente de sucursal", sucursal: "Mitras", motivo: "Renuncia del gerente anterior", diasAbierta: 18, fuente: "OCC", candidatos: [{ nombre: "Luis Herrera", etapa: "Contratado", fuente: "OCC" }, { nombre: "Ana Ríos", etapa: "Descartado", fuente: "Indeed" }, { nombre: "Pablo Cantú", etapa: "Descartado", fuente: "Referido" }], colab: nuevoColab("Luis Herrera", true) },
  { id: "VAC-02", puesto: "Gerente de sucursal", sucursal: "Escobedo Lineal", motivo: "Nueva apertura", aperturaFecha: "2026-08-15", diasAbierta: 4, fuente: "Referido", candidatos: [{ nombre: "Marcos Tijerina", etapa: "Entrevista RH", fuente: "Referido" }, { nombre: "Diana Sosa", etapa: "Contactado", fuente: "OCC" }, { nombre: "Iván Lozano", etapa: "Contactado", fuente: "Indeed" }], colab: null },
  { id: "VAC-03", puesto: "Ayudante general", sucursal: "Las Puentes", motivo: "Crecimiento del equipo", diasAbierta: 6, fuente: "Bolsa local", candidatos: [{ nombre: "Brenda Flores", etapa: "Entrevista RH", fuente: "Bolsa local" }, { nombre: "Kevin Salas", etapa: "Contactado", fuente: "Referido" }], colab: null },
];
const capaPct = (c) => { const its = c.capa.flatMap((d) => d.items); return Math.round((its.filter((i) => i.done).length / its.length) * 100); };
const evalPct = (c) => Math.round((c.evalItems.filter((i) => i.val).length / c.evalItems.length) * 100);
function faseDe(v) {
  const c = v.colab;
  if (!c) return v.candidatos.length ? 1 : 0;
  if (c.asignada) return 7;
  if (c.evalHecha && evalPct(c) >= 80) return 7;
  if (capaPct(c) >= 100) return 6;
  if (c.induccion) return capaPct(c) > 0 ? 5 : 4;
  if (c.docs.every((d) => d.ok)) return 3;
  return 2;
}

const MUNICIPIOS_CH = ["San Nicolás", "Escobedo", "Apodaca", "Guadalupe", "Cadereyta"];
const NOMBRES_CH = ["José", "María", "Juan", "Ana", "Luis", "Carmen", "Miguel", "Laura", "Jorge", "Sofía", "Carlos", "Fernanda", "Diego", "Paola", "Ricardo", "Andrea", "Raúl", "Gabriela", "Héctor", "Mariana", "Alejandro", "Daniela", "Roberto", "Verónica", "Sergio", "Patricia"];
const APELLIDOS_CH = ["García", "Martínez", "López", "Hernández", "González", "Rodríguez", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Cruz", "Morales", "Reyes", "Gutiérrez", "Ortiz", "Chávez"];
const genNombreCH = (seed) => `${NOMBRES_CH[vhash("n" + seed) % NOMBRES_CH.length]} ${APELLIDOS_CH[vhash("a" + seed) % APELLIDOS_CH.length]} ${APELLIDOS_CH[vhash("b" + seed) % APELLIDOS_CH.length]}`;
const ingresoDe = (nombre) => { const h = vhash("ing" + nombre); const y = 2019 + (h % 7), m = 1 + (h % 12), d = 1 + (h % 27); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
const antiguedadTxt = (iso) => { const [y, m] = iso.split("-").map(Number); const meses = 2026 * 12 + 7 - (y * 12 + m); const a = Math.floor(meses / 12), mm = meses % 12; return a > 0 ? `${a} año${a > 1 ? "s" : ""}${mm ? ` ${mm} m` : ""}` : `${mm} meses`; };
const telDe = (nombre) => { const h = vhash("tel" + nombre); return `81 ${1000 + (h % 9000)} ${1000 + (vhash("t2" + nombre) % 9000)}`; };
const DOCS_CH = ["Acta de nacimiento", "INE", "Comprobante de domicilio", "RFC / CURP", "Contrato firmado", "Alta IMSS"];
const docsDe = (p) => DOCS_CH.map((d) => ({ d, ok: p.puesto === "Gerente de sucursal" ? true : vhash(p.nombre + d) % 6 !== 0 }));
const PLANTILLA_CH = (() => {
  const arr = []; let id = 1;
  SUCURSALES.forEach((suc) => {
    arr.push({ id: id++, nombre: genNombreCH("ger" + suc), puesto: "Gerente de sucursal", sucursal: suc });
    const n = 5 + (vhash(suc) % 4);
    for (let k = 0; k < n; k++) arr.push({ id: id++, nombre: genNombreCH("ay" + suc + k), puesto: "Ayudante general", sucursal: suc });
  });
  return arr.map((p) => ({ ...p, ingreso: ingresoDe(p.nombre), tel: telDe(p.nombre) }));
})();
// Desempeño del gerente = 40% cumplimiento de meta + 30% auditoría + 30% cumplimiento de objetivos
const gerMeta = (suc) => 85 + (vhash("meta" + suc) % 24);
const gerObj = (suc) => 80 + (vhash("obj" + suc) % 25);
const gerTicket = (suc) => 88 + (vhash(suc) % 30);
const gerTrans = (suc) => Math.round((VENTAS_MES[suc] || 250000) / gerTicket(suc));
const gerDesempeno = (suc) => { const meta = gerMeta(suc); const audit = Math.round(audCalMes(suc, 2026, 6)); const obj = gerObj(suc); const score = Math.round(Math.min(100, meta) * 0.4 + audit * 0.3 + Math.min(100, obj) * 0.3); return { meta, audit, obj, score }; };
const desCol = (v) => (v >= 90 ? T.ok : v >= 80 ? T.warn : T.bad);
const BANCO_SEED = [
  { id: 1, nombre: "Rodrigo Peña", fuente: "OCC", puesto: "Gerente de sucursal", municipio: "San Nicolás", origen: "Mitras", fecha: "2026-06-20" },
  { id: 2, nombre: "Sofía Cárdenas", fuente: "LinkedIn", puesto: "Gerente de sucursal", municipio: "Guadalupe", origen: "Berneses", fecha: "2026-06-28" },
  { id: 3, nombre: "Emilio Vega", fuente: "Redes sociales", puesto: "Ayudante general", municipio: "Escobedo", origen: "Las Puentes", fecha: "2026-07-02" },
];

function BancoCandidatos({ banco, setBanco }) {
  const [q, setQ] = useState("");
  const [fPuesto, setFPuesto] = useState("Todos");
  const [fMuni, setFMuni] = useState("Todos");
  const lista = banco.filter((c) => (fPuesto === "Todos" || c.puesto === fPuesto) && (fMuni === "Todos" || c.municipio === fMuni) && (!q || c.nombre.toLowerCase().includes(q.toLowerCase())));
  const quitar = (id) => setBanco((p) => p.filter((c) => c.id !== id));
  const nGer = banco.filter((c) => c.puesto === "Gerente de sucursal").length;
  const nAyu = banco.filter((c) => c.puesto === "Ayudante general").length;
  const porMuni = MUNICIPIOS_CH.map((m) => ({ muni: m, items: lista.filter((c) => c.municipio === m) })).concat([{ muni: "Sin municipio", items: lista.filter((c) => !MUNICIPIOS_CH.includes(c.municipio)) }]).filter((g) => g.items.length);

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Banco de Candidatos</h1><span style={{ fontSize: 12, color: T.muted }}>prospectos por municipio</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 18 }}>Buenos prospectos que no quedaron en una vacante, guardados por municipio para tenerlos a la mano en la siguiente búsqueda de la zona.</p>

      <div style={sx.cards4}>
        <Metric big={String(banco.length)} label="Candidatos disponibles" sub="en el banco" accent={T.brand} />
        <Metric big={String(nGer)} label="Para gerente" sub="prospectos" accent={T.ink} />
        <Metric big={String(nAyu)} label="Para ayudante" sub="prospectos" accent={T.inkSoft} />
        <Metric big={String(new Set(banco.map((c) => c.municipio)).size)} label="Municipios" sub="con candidatos" accent={T.inkSoft} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 18, marginBottom: 14 }}>
        <input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12.5, maxWidth: 220 }} />
        <select className="sel" value={fMuni} onChange={(e) => setFMuni(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
          <option value="Todos">Todos los municipios</option>
          {MUNICIPIOS_CH.map((m) => <option key={m}>{m}</option>)}
        </select>
        <select className="sel" value={fPuesto} onChange={(e) => setFPuesto(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
          <option value="Todos">Todos los puestos</option>
          {PUESTOS_CH.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: T.muted, marginLeft: "auto" }}>{lista.length} candidato{lista.length === 1 ? "" : "s"}</span>
      </div>

      {lista.length === 0 ? (
        <div style={{ ...sx.repCard, textAlign: "center", padding: "28px 20px", color: T.muted, fontSize: 12.5 }}>No hay candidatos en el banco con ese filtro. Desde una vacante, usa "Mover a banco" para guardar prospectos aquí.</div>
      ) : (
        <div style={{ display: "grid", gap: 20 }}>
          {porMuni.map((g) => (
            <div key={g.muni}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Ico name="MapPin" size={15} color={T.brand} />
                <div style={{ fontSize: 13, fontWeight: 700 }}>{g.muni}</div>
                <span style={{ fontSize: 11, color: T.muted }}>({g.items.length})</span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.items.map((c) => (
                  <div key={c.id} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: `3px solid ${T.brand}` }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.brandSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, color: T.brand, fontSize: 14 }}>{c.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{c.nombre}</span>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: c.puesto === "Ayudante general" ? T.brandDark : T.brand, background: T.brandSoft, padding: "2px 9px", borderRadius: 99 }}>{c.puesto}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>fuente: {c.fuente} · guardado {fechaTexto(c.fecha)}</div>
                    </div>
                    <span style={{ fontSize: 10.5, color: T.muted }}>Venía de: {c.origen}</span>
                    <button onClick={() => quitar(c.id)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: "#fff", color: T.bad, border: `1px solid ${T.line}` }}>Quitar</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>Datos de ejemplo. Al usar "Mover a banco" desde una vacante, se te pedirá el municipio del candidato.</div>
    </div>
  );
}

function Expedientes() {
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [fSuc, setFSuc] = useState("Todas");
  const [fPuesto, setFPuesto] = useState("Todos");
  const lista = PLANTILLA_CH
    .filter((p) => (fSuc === "Todas" || p.sucursal === fSuc) && (fPuesto === "Todos" || p.puesto === fPuesto) && (!q || p.nombre.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.puesto === b.puesto ? a.sucursal.localeCompare(b.sucursal) : a.puesto === "Gerente de sucursal" ? -1 : 1));
  const nGer = PLANTILLA_CH.filter((p) => p.puesto === "Gerente de sucursal").length;

  if (sel) {
    const p = PLANTILLA_CH.find((x) => x.id === sel);
    const esGer = p.puesto === "Gerente de sucursal";
    const docs = docsDe(p);
    const completos = docs.filter((d) => d.ok).length;
    const des = esGer ? gerDesempeno(p.sucursal) : null;
    return (
      <div>
        <button onClick={() => setSel(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver a expedientes</button>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: esGer ? T.brand : T.brandSoft, color: esGer ? "#fff" : T.brand, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>{p.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
          <div>
            <h1 style={{ ...sx.h1, marginBottom: 2 }}>{p.nombre}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: esGer ? "#fff" : T.brandDark, background: esGer ? T.brand : T.brandSoft, padding: "2px 9px", borderRadius: 99 }}>{p.puesto}</span>
              <span style={{ fontSize: 12, color: T.muted }}>{p.sucursal}</span>
            </div>
          </div>
        </div>

        {esGer && (
          <div style={{ marginBottom: 22 }}>
            <div style={sx.sectionTitle}>Desempeño en su sucursal ({p.sucursal})</div>
            <div style={sx.cards4}>
              <Metric big={`${des.score}`} label="Desempeño del gerente" sub="meta 40% · auditoría 30% · objetivos 30%" accent={desCol(des.score)} alert={des.score < 80} />
              <Metric big={`${des.meta}%`} label="Cumplimiento de meta" sub="ventas de la sucursal" accent={desCol(des.meta > 100 ? 95 : des.meta)} />
              <Metric big={`${des.audit}%`} label="Calificación de auditoría" sub="físicas + remotas" accent={desCol(des.audit)} />
              <Metric big={`${des.obj}%`} label="Cumplimiento de objetivos" sub="del mes" accent={desCol(des.obj > 100 ? 95 : des.obj)} />
            </div>
            <div style={{ ...sx.cards4, marginTop: 12 }}>
              <Metric big={money(gerTicket(p.sucursal))} label="Ticket promedio" sub="su sucursal" accent={T.ink} />
              <Metric big={gerTrans(p.sucursal).toLocaleString("es-MX")} label="Transacciones" sub="del mes" accent={T.inkSoft} />
              <Metric big={money(VENTAS_MES[p.sucursal] || 0)} label="Ventas del mes" sub="su sucursal" accent={T.brand} />
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 8, fontStyle: "italic" }}>Desempeño conectado con Finanzas › Ventas, Auditorías y Objetivos y Metas de su sucursal (de ejemplo en la maqueta).</div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
          <div>
            <div style={sx.sectionTitle}>Información personal</div>
            <div style={{ ...sx.repCard, display: "grid", gap: 10 }}>
              {[["Puesto", p.puesto], ["Sucursal", p.sucursal], ["Fecha de ingreso", fechaTexto(p.ingreso)], ["Antigüedad", antiguedadTxt(p.ingreso)], ["Teléfono", p.tel], ["Estatus", "Activo"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, borderBottom: `1px solid ${T.lineSoft}`, paddingBottom: 7 }}>
                  <span style={{ color: T.muted }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={sx.sectionTitle}>Documentos del expediente</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: completos === docs.length ? T.ok : T.warn }}>{completos}/{docs.length}</span>
            </div>
            <div style={{ ...sx.repCard, display: "grid", gap: 8 }}>
              {docs.map(({ d, ok }) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 99, background: ok ? T.ok : "#fff", border: `1.5px solid ${ok ? T.ok : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ok && <Ico name="Check" size={11} color="#fff" />}</span>
                  <span style={{ flex: 1, color: ok ? T.ink : T.muted }}>{d}</span>
                  {!ok && <UploadBtn archivo={null} onPick={() => {}} label="Subir" />}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>Todo lo que se sube (documentos, avance) se concentra en este expediente. En la maqueta los adjuntos no se guardan al recargar.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Expedientes del personal</h1><span style={{ fontSize: 12, color: T.muted }}>ficha por colaborador</span></div>
      <div style={sx.cards4}>
        <Metric big={String(PLANTILLA_CH.length)} label="Colaboradores" sub="con ficha" accent={T.ink} />
        <Metric big={String(nGer)} label="Gerentes" sub="con desempeño" accent={T.brand} />
        <Metric big={String(SUCURSALES.length)} label="Sucursales" sub="de la red propia" accent={T.inkSoft} />
        <Metric big={String(PLANTILLA_CH.length - nGer)} label="Ayudantes generales" sub="en plantilla" accent={T.inkSoft} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 18, marginBottom: 14 }}>
        <input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12.5, maxWidth: 220 }} />
        <select className="sel" value={fSuc} onChange={(e) => setFSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
          <option value="Todas">Todas las sucursales</option>
          {SUCURSALES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="sel" value={fPuesto} onChange={(e) => setFPuesto(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
          <option value="Todos">Todos los puestos</option>
          {PUESTOS_CH.map((p) => <option key={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: T.muted, marginLeft: "auto" }}>{lista.length} colaborador{lista.length === 1 ? "" : "es"}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 10 }}>
        {lista.map((p) => {
          const esGer = p.puesto === "Gerente de sucursal";
          const des = esGer ? gerDesempeno(p.sucursal) : null;
          return (
            <button key={p.id} onClick={() => setSel(p.id)} className="rowbtn" style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", width: "100%", borderLeft: `3px solid ${esGer ? T.brand : T.lineSoft}` }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: esGer ? T.brand : T.brandSoft, color: esGer ? "#fff" : T.brand, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{p.nombre.split(" ").map((x) => x[0]).slice(0, 2).join("")}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{esGer ? "Gerente" : "Ayudante"} · {p.sucursal}</div>
              </div>
              {esGer && <div style={{ textAlign: "right", flexShrink: 0 }}><div style={{ fontWeight: 700, fontSize: 15, color: desCol(des.score) }}>{des.score}</div><div style={{ fontSize: 9, color: T.muted }}>desempeño</div></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CapitalHumano({ cuadro, setCuadro }) {
  const [sec, setSec] = useState(null);
  const [banco, setBanco] = useState(BANCO_SEED);
  const moverABanco = (cand, origen, municipio) => setBanco((p) => (p.some((x) => x.nombre === cand.nombre) ? p : [{ id: Date.now() + Math.random(), nombre: cand.nombre, fuente: cand.fuente, puesto: origen.puesto, municipio: municipio || MUNICIPIOS_CH[0], origen: origen.sucursal, fecha: new Date().toISOString().slice(0, 10) }, ...p]));
  const secMeta = CH_SECCIONES.find((s) => s.key === sec);
  return (
    <>
      <header style={sx.header} className="noprint">
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Capital Humano</div>
          <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{secMeta ? secMeta.nombre : "Panel del departamento"}</div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {sec && <button onClick={() => setSec(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Secciones</button>}
        </nav>
      </header>
      <main style={sx.main}>
        {!sec && <CHHome onEnter={setSec} cuadro={cuadro} banco={banco} />}
        {sec === "incorporacion" && <Incorporacion onBanco={moverABanco} />}
        {sec === "cuadro" && <CuadroPersonal cuadro={cuadro} setCuadro={setCuadro} />}
        {sec === "banco" && <BancoCandidatos banco={banco} setBanco={setBanco} />}
        {sec === "expedientes" && <Expedientes />}
        {secMeta && !secMeta.activa && <FranqPlaceholder sec={secMeta} />}
      </main>
    </>
  );
}

function CuadroPersonal({ cuadro, setCuadro }) {
  const [suc, setSuc] = useState(SUCURSALES[0]);
  const [ne, setNe] = useState({ puesto: "Colaborador", sueldo: "" });
  const lista = cuadro[suc] || [];
  const semanal = nominaSemanal(lista);
  const mensual = semanal * 4.33;
  const venta = VENTAS_MES[suc] || 0;
  const pctN = venta ? (mensual / venta) * 100 : 0;
  const colN = (p) => (p <= 22 ? T.ok : p <= 28 ? T.warn : T.bad);

  const add = () => { if (!ne.puesto.trim() || ne.sueldo === "") return; setCuadro((p) => ({ ...p, [suc]: [...(p[suc] || []), { puesto: ne.puesto.trim(), sueldo: Number(ne.sueldo) }] })); setNe({ puesto: "Colaborador", sueldo: "" }); };
  const quitar = (idx) => setCuadro((p) => ({ ...p, [suc]: p[suc].filter((_, i) => i !== idx) }));
  const editar = (idx, val) => setCuadro((p) => ({ ...p, [suc]: p[suc].map((e, i) => (i === idx ? { ...e, sueldo: val === "" ? 0 : Number(val) } : e)) }));

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Cuadro de personal</h1><span style={{ fontSize: 12, color: T.muted }}>plantilla y sueldos · semanal</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 18 }}>Registra la plantilla de cada sucursal y el sueldo semanal de cada puesto. Se actualiza cada semana y alimenta el % de nómina en Finanzas.</p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Sucursal
          <select className="sel" value={suc} onChange={(e) => setSuc(e.target.value)} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>{SUCURSALES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
      </div>

      <div style={sx.cards4}>
        <Metric big={String(lista.length)} label="Colaboradores" sub={suc} accent={T.brand} />
        <Metric big={money(semanal)} label="Nómina semanal" sub="suma de sueldos" accent={T.ink} />
        <Metric big={money(Math.round(mensual))} label="Nómina mensual" sub="semanal × 4.33" accent={T.inkSoft} />
        <Metric big={`${pctN.toFixed(1)}%`} label="Nómina sobre ventas" sub="alimenta Finanzas" accent={colN(pctN)} />
      </div>

      <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
        {lista.map((e, i) => (
          <div key={i} style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 140 }}>{e.puesto}</span>
            <label style={{ fontSize: 11.5, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>Sueldo semanal $
              <input type="number" value={e.sueldo} onChange={(ev) => editar(i, ev.target.value)} className="sel" style={{ ...sx.sel, fontSize: 12, width: 100, textAlign: "right", padding: "5px 8px" }} />
            </label>
            <button className="rowbtn" onClick={() => quitar(i)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.bad, fontSize: 11.5, fontWeight: 600 }}>Quitar</button>
          </div>
        ))}
        <div style={{ ...sx.repCard, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input placeholder="Puesto" value={ne.puesto} onChange={(e) => setNe({ ...ne, puesto: e.target.value })} className="sel" style={{ ...sx.sel, flex: 1, minWidth: 140, fontSize: 12 }} />
          <label style={{ fontSize: 11.5, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>Sueldo semanal $
            <input type="number" placeholder="0" value={ne.sueldo} onChange={(e) => setNe({ ...ne, sueldo: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: 100, textAlign: "right", padding: "5px 8px" }} />
          </label>
          <button className="actbtn" disabled={!ne.puesto.trim() || ne.sueldo === ""} onClick={add} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: ne.puesto.trim() && ne.sueldo !== "" ? T.ink : T.line, color: ne.puesto.trim() && ne.sueldo !== "" ? "#fff" : T.muted }}>Agregar al cuadro</button>
        </div>
      </div>
    </div>
  );
}

function CHHome({ onEnter, cuadro, banco }) {
  const activas = VACANTES_CH.filter((v) => !(v.colab && v.colab.asignada)).length;
  let plantilla = 96;
  try { const vals = Object.values(cuadro || {}); const n = vals.reduce((a, v) => a + (Array.isArray(v) ? v.length : 0), 0); if (n) plantilla = n; } catch (e) {}

  /* --- datos para la vista rápida de Incorporación --- */
  const vacActivas = VACANTES_CH.filter((v) => !(v.colab && v.colab.asignada));
  const enProceso = VACANTES_CH.reduce((a, v) => a + v.candidatos.filter((c) => c.etapa !== "Contratado" && c.etapa !== "Descartado").length, 0);
  const vacGer = vacActivas.filter((v) => v.puesto === "Gerente de sucursal").length;
  const vacAyu = vacActivas.filter((v) => v.puesto === "Ayudante general").length;
  const criticas = vacActivas.filter((v) => v.urgencia === "Crítica").length;
  const tProm = VACANTES_CH.length ? Math.round(VACANTES_CH.reduce((a, v) => a + v.diasAbierta, 0) / VACANTES_CH.length) : 0;
  const miniMetrics = [
    { big: String(activas), label: "vacantes activas", sub: `${vacGer} ger · ${vacAyu} ayu`, col: activas ? T.warn : T.ok },
    { big: String(enProceso), label: "candidatos en proceso", sub: "sin decisión", col: T.brand },
    { big: String(criticas), label: criticas === 1 ? "urgencia crítica" : "urgencias críticas", sub: criticas ? "requieren acción" : "sin críticas", col: criticas ? T.bad : T.muted },
    { big: `${tProm} d`, label: "cobertura promedio", sub: "meta 15–23 d", col: T.ink },
  ];

  const metricas = {
    cuadro: { big: String(plantilla), label: "colaboradores en plantilla", col: T.ink },
    banco: { big: String((banco || []).length), label: "candidatos disponibles", col: T.brand },
    expedientes: { big: String(PLANTILLA_CH.length), label: "colaboradores con ficha", col: T.ink },
    evaluaciones: { big: "8.6", label: "desempeño promedio /10", col: T.brand },
    rotacion: { big: "4.2%", label: "rotación mensual", col: T.warn },
    nomina: { big: "97%", label: "asistencia del mes", col: T.ok },
    capacitacion: { big: "78%", label: "cursos completados", col: T.warn },
  };
  /* --- datos para la vista compacta del Banco de candidatos --- */
  const bancoArr = banco || [];
  const bGer = bancoArr.filter((c) => c.puesto === "Gerente de sucursal").length;
  const bAyu = bancoArr.filter((c) => c.puesto === "Ayudante general").length;
  const bMunis = [...new Set(bancoArr.map((c) => c.municipio))];
  const bFuentes = [...new Set(bancoArr.map((c) => c.fuente))];
  const bReciente = bancoArr.reduce((a, c) => (!a || c.fecha > a.fecha ? c : a), null);
  const bancoMini = [
    { big: String(bancoArr.length), label: "disponibles" },
    { big: String(bGer), label: "para gerente" },
    { big: String(bAyu), label: "para ayudante" },
    { big: String(bMunis.length), label: bMunis.length === 1 ? "municipio" : "municipios" },
  ];

  const restantes = CH_SECCIONES.filter((s) => s.key !== "incorporacion" && s.key !== "banco");

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Panel de Capital Humano</h1><span style={{ fontSize: 12, color: T.muted }}>{CH_SECCIONES.filter((s) => s.activa).length} de {CH_SECCIONES.length} secciones activas</span></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 22 }}>Cada sección se muestra según su peso. La incorporación de personal aparece al detalle, el banco de candidatos en versión compacta, y el resto conserva su indicador clave por ahora.</p>

      {/* === Vista rápida: Incorporación de Personal === */}
      <div className="rowbtn" onClick={() => onEnter("incorporacion")} style={{ ...sx.areaCard, padding: 0, overflow: "hidden", cursor: "pointer", marginBottom: 16, borderColor: criticas ? T.bad : T.line }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "16px 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: T.brand, display: "flex" }}><Ico name="UserPlus" size={24} strokeWidth={1.8} /></span>
            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Incorporación de Personal</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.brand, background: T.brandSoft, padding: "2px 8px", borderRadius: 99 }}>Vista rápida</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>Vacantes y procesos en curso · vacante → asignación</div>
            </div>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.brand, whiteSpace: "nowrap", alignSelf: "center" }}>Entrar ›</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, background: T.paper }}>
          {miniMetrics.map((m, i) => (
            <div key={i} style={{ padding: "11px 16px", borderLeft: i ? `1px solid ${T.lineSoft}` : "none" }}>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 21, color: m.col }}>{m.big}</span>
              <div style={{ fontSize: 10.5, color: T.inkSoft, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "8px 18px 14px" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, margin: "6px 0 0" }}>Procesos en curso</div>
          {vacActivas.length === 0 && <div style={{ fontSize: 12, color: T.muted, padding: "10px 0" }}>Sin vacantes activas por ahora.</div>}
          {vacActivas.slice(0, 4).map((v) => {
            const fase = faseDe(v);
            const etapa = ETAPAS_CH[Math.min(fase, ETAPAS_CH.length - 1)];
            const critica = v.urgencia === "Crítica";
            const esAyu = v.puesto === "Ayudante general";
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${T.lineSoft}`, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{v.sucursal}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: esAyu ? T.brandDark : T.brand, background: T.brandSoft, padding: "2px 7px", borderRadius: 99 }}>{esAyu ? "Ayudante" : "Gerente"}</span>
                {critica && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#fff", background: T.bad, padding: "2px 7px", borderRadius: 99 }}>CRÍTICA</span>}
                <span style={{ fontSize: 10.5, color: T.muted }}>{v.diasAbierta} d abierta</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 72, height: 4, borderRadius: 99, background: T.line, overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ width: `${Math.round((fase / (ETAPAS_CH.length - 1)) * 100)}%`, height: "100%", background: critica ? T.bad : T.brand }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.brand, minWidth: 78, textAlign: "right" }}>{etapa}</span>
                </div>
              </div>
            );
          })}
          {vacActivas.length > 4 && <div style={{ fontSize: 11, color: T.brand, fontWeight: 600, paddingTop: 10 }}>+{vacActivas.length - 4} vacante(s) más ›</div>}
        </div>
      </div>

      {/* === Vista compacta: Banco de candidatos === */}
      <div className="rowbtn" onClick={() => onEnter("banco")} style={{ ...sx.areaCard, padding: 0, overflow: "hidden", cursor: "pointer", marginBottom: 16, background: T.paper }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", flexWrap: "wrap" }}>
          <span style={{ color: T.muted, display: "flex" }}><Ico name="Users" size={18} strokeWidth={1.8} /></span>
          <div style={{ textAlign: "left", minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: T.inkSoft }}>Banco de Candidatos</div>
            <div style={{ fontSize: 11, color: T.muted }}>Prospectos guardados por municipio</div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginLeft: "auto", flexWrap: "wrap" }}>
            {bancoMini.map((m, i) => (
              <div key={i} style={{ textAlign: "right" }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15, color: T.inkSoft }}>{m.big}</span>
                <span style={{ fontSize: 10.5, color: T.muted, marginLeft: 4 }}>{m.label}</span>
              </div>
            ))}
            <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, whiteSpace: "nowrap" }}>Entrar ›</span>
          </div>
        </div>

        {bancoArr.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderTop: `1px solid ${T.lineSoft}`, flexWrap: "wrap" }}>
            {bMunis.slice(0, 4).map((m) => (
              <span key={m} style={{ fontSize: 10, color: T.muted, background: T.lineSoft, padding: "2px 8px", borderRadius: 99 }}>{m} · {bancoArr.filter((c) => c.municipio === m).length}</span>
            ))}
            {bMunis.length > 4 && <span style={{ fontSize: 10, color: T.muted }}>+{bMunis.length - 4}</span>}
            {bReciente && <span style={{ fontSize: 10, color: T.muted, marginLeft: "auto" }}>último alta: {bReciente.nombre} · {bFuentes.length} fuente{bFuentes.length === 1 ? "" : "s"}</span>}
          </div>
        )}
      </div>

      {/* === Resto de secciones === */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {restantes.map((s) => {
          const m = metricas[s.key] || { big: "—", label: "", col: T.muted };
          return (
            <button key={s.key} className={s.activa ? "rowbtn" : ""} onClick={() => s.activa && onEnter(s.key)} disabled={!s.activa} style={{ ...sx.areaCard, cursor: s.activa ? "pointer" : "default", opacity: s.activa ? 1 : 0.82 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: s.activa ? T.brand : T.muted, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{s.desc}</div>
                  </div>
                </div>
                {!s.activa && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 8px", borderRadius: 99 }}>Por configurar</span>}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, display: "flex", alignItems: "baseline", gap: 8, textAlign: "left" }}>
                <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 24, color: m.col }}>{m.big}</span>
                <span style={{ fontSize: 11.5, color: T.muted }}>{m.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Incorporacion({ onBanco }) {
  const [vac, setVac] = useState(VACANTES_CH);
  const [sel, setSel] = useState(null);
  const updV = (id, fn) => setVac((prev) => prev.map((v) => (v.id === id ? fn(v) : v)));
  const h = {
    setEtapa: (vid, ci, etapa) => updV(vid, (v) => ({ ...v, candidatos: v.candidatos.map((c, i) => (i === ci ? { ...c, etapa } : c)) })),
    contratar: (vid, ci) => updV(vid, (v) => ({ ...v, candidatos: v.candidatos.map((c, i) => (i === ci ? { ...c, etapa: "Contratado" } : c)), colab: nuevoColab(v.candidatos[ci].nombre, false) })),
    toggleDoc: (vid, di) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, docs: v.colab.docs.map((d, i) => (i === di ? (d.archivo ? { ...d, ok: !d.ok } : d) : d)) } })),
    subirDoc: (vid, di, name) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, docs: v.colab.docs.map((d, i) => (i === di ? { ...d, archivo: name } : d)) } })),
    toggleInd: (vid) => updV(vid, (v) => ({ ...v, colab: v.colab.induccionArchivo ? { ...v.colab, induccion: !v.colab.induccion } : v.colab })),
    subirInd: (vid, name) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, induccionArchivo: name } })),
    toggleCapa: (vid, di, ii) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, capa: v.colab.capa.map((d, j) => (j === di ? (d.archivo ? { ...d, items: d.items.map((it, k) => (k === ii ? { ...it, done: !it.done } : it)) } : d) : d)) } })),
    subirCapaDoc: (vid, di, name) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, capa: v.colab.capa.map((d, j) => (j === di ? { ...d, archivo: name } : d)) } })),
    toggleEval: (vid, ei) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, evalItems: v.colab.evalItems.map((it, i) => (i === ei ? { ...it, val: !it.val } : it)) } })),
    registrarEval: (vid) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, evalHecha: true } })),
    asignar: (vid) => updV(vid, (v) => ({ ...v, colab: { ...v.colab, asignada: true } })),
    agregarCand: (vid, datos) => updV(vid, (v) => ({ ...v, candidatos: [...v.candidatos, { etapa: "Contactado", ...datos }] })),
    moverBanco: (vid, ci, municipio) => { const vv = vac.find((x) => x.id === vid); if (vv && vv.candidatos[ci] && onBanco) onBanco(vv.candidatos[ci], vv, municipio); updV(vid, (v) => ({ ...v, candidatos: v.candidatos.filter((_, i) => i !== ci) })); },
  };
  const [nueva, setNueva] = useState(false);
  const [nv, setNv] = useState({ puesto: "Gerente de sucursal", sucursal: "", conGerente: "No", motivo: "", urgencia: "Crítica", fecha: new Date().toISOString().slice(0, 10), aperturaFecha: "" });
  const nvOk = nv.sucursal && nv.motivo && nv.urgencia && nv.fecha && (nv.motivo !== "Nueva apertura" || nv.aperturaFecha);
  const agregarVacante = () => {
    if (!nvOk) return;
    const dias = Math.max(0, Math.round((Date.now() - new Date(nv.fecha).getTime()) / 86400000));
    setVac((prev) => [...prev, { id: "VAC-" + String(prev.length + 1).padStart(2, "0"), puesto: nv.puesto, sucursal: nv.sucursal, conGerente: nv.puesto === "Gerente de sucursal" ? nv.conGerente : "—", motivo: nv.motivo, aperturaFecha: nv.motivo === "Nueva apertura" ? nv.aperturaFecha : null, diasAbierta: isNaN(dias) ? 0 : dias, urgencia: nv.urgencia, candidatos: [], colab: null }]);
    setNv({ puesto: "Gerente de sucursal", sucursal: "", conGerente: "No", motivo: "", urgencia: "Crítica", fecha: new Date().toISOString().slice(0, 10), aperturaFecha: "" });
    setNueva(false);
  };
  const elegido = vac.find((v) => v.id === sel);

  if (elegido) return <VacanteDetalle v={elegido} h={h} onBack={() => setSel(null)} />;

  const activas = vac.filter((v) => !(v.colab && v.colab.asignada)).length;
  const enProceso = vac.reduce((a, v) => a + v.candidatos.filter((c) => c.etapa !== "Contratado" && c.etapa !== "Descartado").length, 0);
  const enCapa = vac.filter((v) => v.colab && !v.colab.asignada);
  const avance = enCapa.length ? Math.round(enCapa.reduce((a, v) => a + capaPct(v.colab), 0) / enCapa.length) : 0;
  const tProm = Math.round(vac.reduce((a, v) => a + v.diasAbierta, 0) / vac.length);
  const vacGer = vac.filter((v) => v.puesto === "Gerente de sucursal" && !(v.colab && v.colab.asignada)).length;
  const vacAyu = vac.filter((v) => v.puesto === "Ayudante general" && !(v.colab && v.colab.asignada)).length;
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Incorporación de Personal</h1><span style={{ fontSize: 12, color: T.muted }}>gerentes y ayudantes · vacante → asignación</span></div>
      <div style={sx.cards4}>
        <Metric big={String(activas)} label="Vacantes activas" sub={`${vacGer} gerente${vacGer === 1 ? "" : "s"} · ${vacAyu} ayudante${vacAyu === 1 ? "" : "s"}`} accent={activas ? T.warn : T.ok} alert={activas > 0} />
        <Metric big={String(enProceso)} label="Candidatos en proceso" sub="sin decisión" accent={T.brand} />
        <Metric big={`${avance}%`} label="Avance capacitación" sub="promedio en curso" accent={T.brand} />
        <Metric big={`${tProm} d`} label="Tiempo de cobertura" sub="promedio (meta 15-23)" accent={T.ink} />
      </div>
      <div style={{ marginTop: 26 }}>
        <div style={{ ...sx.h1row, marginBottom: 12 }}>
          <div style={sx.sectionTitle}>Vacantes y procesos</div>
          <button className="actbtn" onClick={() => setNueva(!nueva)} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>{nueva ? "Cancelar" : "+ Nueva vacante"}</button>
        </div>
        {nueva && (
          <div style={{ ...sx.repCard, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <select className="sel" value={nv.puesto} onChange={(e) => setNv({ ...nv, puesto: e.target.value })} style={{ ...sx.sel, width: "auto", minWidth: 160, fontSize: 12, fontWeight: 600 }}>
              {PUESTOS_CH.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="sel" value={nv.sucursal} onChange={(e) => setNv({ ...nv, sucursal: e.target.value })} style={{ ...sx.sel, width: "auto", minWidth: 150, fontSize: 12, color: nv.sucursal ? T.ink : T.muted }}>
              <option value="">Sucursal…</option>
              {SUCURSALES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {nv.puesto === "Gerente de sucursal" && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.muted }}>
                ¿Cuenta con gerente?
                <select className="sel" value={nv.conGerente} onChange={(e) => setNv({ ...nv, conGerente: e.target.value, urgencia: e.target.value === "No" ? "Crítica" : nv.urgencia })} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
                  <option>Sí</option><option>No</option>
                </select>
              </label>
            )}
            <select className="sel" value={nv.motivo} onChange={(e) => setNv({ ...nv, motivo: e.target.value })} style={{ ...sx.sel, flex: 1, minWidth: 170, fontSize: 12, color: nv.motivo ? T.ink : T.muted }}>
              <option value="">Motivo…</option>
              {MOTIVOS_VAC.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select className="sel" value={nv.urgencia} onChange={(e) => setNv({ ...nv, urgencia: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }} title="Urgencia de contratación">
              {URGENCIAS.map(([n]) => <option key={n} value={n}>Urgencia: {n}</option>)}
            </select>
            {nv.motivo === "Nueva apertura" && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.brand, fontWeight: 600 }}>
                Fecha de apertura
                <input type="date" value={nv.aperturaFecha || ""} onChange={(e) => setNv({ ...nv, aperturaFecha: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: "auto", borderColor: T.brand }} />
              </label>
            )}
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.muted }}>
              Vacante publicada
              <input type="date" value={nv.fecha} onChange={(e) => setNv({ ...nv, fecha: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: "auto" }} />
            </label>
            <button className="actbtn" disabled={!nvOk} onClick={agregarVacante} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: nvOk ? T.ink : T.line, color: nvOk ? "#fff" : T.muted, cursor: nvOk ? "pointer" : "not-allowed" }}>Publicar vacante</button>
            {!nvOk && <span style={{ fontSize: 10.5, color: T.muted, width: "100%" }}>Completa los campos para publicar{nv.motivo === "Nueva apertura" ? " (incluida la fecha de apertura)" : ""}.</span>}
          </div>
        )}
        <div style={{ display: "grid", gap: 10 }}>
          {vac.map((v) => {
            const fase = faseDe(v);
            const cerrada = v.colab && v.colab.asignada;
            const critica = !cerrada && v.urgencia === "Crítica";
            return (
              <button key={v.id} className="rowbtn" onClick={() => setSel(v.id)} style={{ ...sx.repCard, cursor: "pointer", textAlign: "left", width: "100%", ...(critica ? { borderLeft: `4px solid ${T.bad}`, background: T.badSoft, borderColor: T.bad } : {}) }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{v.sucursal}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: v.puesto === "Ayudante general" ? T.brandDark : T.brand, background: T.brandSoft, padding: "2px 8px", borderRadius: 99 }}>{v.puesto || "Gerente de sucursal"}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: cerrada ? T.ok : T.warn, background: cerrada ? T.okSoft : T.warnSoft, padding: "2px 8px", borderRadius: 99 }}>{cerrada ? "Cubierta" : "Vacante activa"}</span>
                      {v.urgencia && !cerrada && (critica
                        ? <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: T.bad, padding: "2px 9px", borderRadius: 99, display: "inline-flex", alignItems: "center", gap: 4, letterSpacing: "0.02em" }}><Ico name="AlertTriangle" size={11} color="#fff" />URGENCIA CRÍTICA</span>
                        : <span style={{ fontSize: 10, fontWeight: 700, color: urgMeta(v.urgencia)[1], border: `1px solid ${urgMeta(v.urgencia)[1]}`, padding: "2px 8px", borderRadius: 99 }}>Urgencia {v.urgencia}</span>)}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>{v.motivo}{v.conGerente && v.conGerente !== "—" ? ` · gerente actual: ${v.conGerente}` : ""} · {cerrada ? "proceso cerrado" : `${v.diasAbierta} días abierta`}</div>
                    {v.aperturaFecha && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, background: T.brand, color: "#fff", padding: "5px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        <Ico name="CalendarClock" size={14} color="#fff" />Apertura: {fechaTexto(v.aperturaFecha)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: T.brand, alignSelf: "center" }}>Ver detalle ›</span>
                </div>
                {/* barra de estatus del proceso */}
                <div style={{ marginTop: 14, display: "flex", alignItems: "flex-start" }}>
                  {ETAPAS_CH.map((e, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minWidth: 0 }}>
                      {i < ETAPAS_CH.length - 1 && <div style={{ position: "absolute", top: 9, left: "50%", width: "100%", height: 3, background: i < fase ? T.brand : T.line }} />}
                      <div style={{ zIndex: 1, width: 20, height: 20, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", background: i < fase ? T.brand : "#fff", border: i === fase ? `3px solid ${T.brand}` : `2px solid ${i < fase ? T.brand : T.line}` }}>
                        {i < fase ? <Ico name="Check" size={11} color="#fff" /> : i === fase ? <span style={{ width: 7, height: 7, borderRadius: 99, background: T.brand }} /> : null}
                      </div>
                      <div style={{ fontSize: 9.5, fontWeight: i === fase ? 700 : 500, color: i < fase ? T.brand : i === fase ? T.ink : T.muted, marginTop: 5, textAlign: "center", lineHeight: 1.2 }}>{e}</div>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChkLine({ ok, label, onClick, disabled }) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} className="rowbtn" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "5px 0", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: disabled ? 0.55 : 1 }}>
      <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: ok ? T.brand : "#fff", border: `1.5px solid ${ok ? T.brand : disabled ? T.lineSoft : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>{ok && <Ico name="Check" size={13} color="#fff" />}</span>
      <span style={{ fontSize: 12.5, color: ok ? T.muted : T.ink, textDecoration: ok ? "line-through" : "none" }}>{label}</span>
    </button>
  );
}
function UploadBtn({ archivo, onPick, label }) {
  return (
    <label className="rowbtn" style={{ fontSize: 11, fontWeight: 600, color: archivo ? T.ok : T.brand, background: archivo ? T.okSoft : T.brandSoft, border: `1px solid ${archivo ? T.ok : T.brand}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 220, flexShrink: 0 }}>
      <input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onPick(f.name); }} />
      <Ico name={archivo ? "FileCheck" : "Upload"} size={13} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{archivo || label || "Subir archivo"}</span>
    </label>
  );
}

const CAND_BADGE = (e) => e === "Contratado" ? { c: T.ok, bg: T.okSoft } : e === "Descartado" ? { c: T.muted, bg: T.lineSoft } : { c: T.warn, bg: T.warnSoft };

function VacanteDetalle({ v, h, onBack }) {
  const c = v.colab;
  const [nc, setNc] = useState({ nombre: "", fuente: "OCC", cv: null, edad: "", calif: "3" });
  const [pickMuni, setPickMuni] = useState(null);
  const ncOk = nc.nombre.trim() && nc.cv && nc.edad !== "";
  const fase = faseDe(v);
  return (
    <div>
      <button onClick={onBack} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver a vacantes</button>
      <div style={sx.h1row}><h1 style={sx.h1}>{v.sucursal}</h1><span style={{ fontSize: 12, color: T.muted }}>{c ? c.nombre : "sin candidato contratado"}</span></div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: -8 }}>{v.motivo} · fuente {v.fuente} · {v.colab && v.colab.asignada ? "vacante cubierta" : `${v.diasAbierta} días abierta`}</div>

      {/* stepper de 7 etapas */}
      <div style={{ ...sx.stepper, marginTop: 18 }}>
        {ETAPAS_CH.map((e, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i === ETAPAS_CH.length - 1 ? "0 0 auto" : 1, minWidth: 0 }}>
            <span title={e} style={{ width: 13, height: 13, borderRadius: 99, background: i < fase ? T.brand : i === fase ? "#fff" : T.lineSoft, border: i === fase ? `3px solid ${T.brand}` : `1px solid ${i < fase ? T.brand : T.line}` }} />
            {i < ETAPAS_CH.length - 1 && <div style={{ flex: 1, height: 2, background: i < fase ? T.brand : T.line, margin: "0 4px" }} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{ETAPAS_CH.map((e, i) => i === fase ? `Etapa actual: ${e}` : "").filter(Boolean)[0] || "Proceso completo"}</div>

      {/* CANDIDATOS */}
      <div style={{ marginTop: 24 }}>
        <div style={sx.sectionTitle}>Candidatos</div>
        <div style={{ display: "grid", gap: 8 }}>
          {v.candidatos.map((cand, ci) => {
            const bd = CAND_BADGE(cand.etapa);
            const esContratado = c && cand.etapa === "Contratado";
            return (
              <div key={ci} style={{ display: "grid", gap: esContratado ? 10 : 0 }}>
                <div style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", ...(esContratado ? { borderLeft: `3px solid ${T.ok}` } : {}) }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{cand.nombre}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: bd.c, background: bd.bg, padding: "2px 8px", borderRadius: 99, marginLeft: 8 }}>{cand.etapa}</span>
                    <span style={{ fontSize: 11, color: T.muted, marginLeft: 8 }}>fuente: {cand.fuente}{cand.edad ? ` · ${cand.edad} años` : ""}</span>
                    {cand.calif && <span style={{ fontSize: 10, fontWeight: 600, color: T.brand, background: T.brandSoft, padding: "2px 7px", borderRadius: 99, marginLeft: 8 }}>CV {cand.calif}/5</span>}
                    {cand.cv && <span style={{ fontSize: 10, fontWeight: 600, color: T.ok, background: T.okSoft, padding: "2px 7px", borderRadius: 99, marginLeft: 8 }}>CV: {cand.cv}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select className="sel" value={cand.etapa} onChange={(e) => (e.target.value === "Contratado" ? h.contratar(v.id, ci) : h.setEtapa(v.id, ci, e.target.value))} style={{ ...sx.sel, fontSize: 12, padding: "5px 8px", width: "auto" }}>
                      {CAND_ETAPAS.map((e) => <option key={e}>{e}</option>)}
                    </select>
                    {!c && cand.etapa !== "Descartado" && <button className="actbtn" onClick={() => h.contratar(v.id, ci)} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px" }}>Contratar</button>}
                    {cand.etapa !== "Contratado" && (pickMuni === ci ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <select id={`muni-${ci}`} className="sel" defaultValue={MUNICIPIOS_CH[0]} style={{ ...sx.sel, fontSize: 11.5, width: "auto", padding: "5px 8px" }}>
                          {MUNICIPIOS_CH.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <button className="actbtn" onClick={() => { const sel = document.getElementById(`muni-${ci}`); h.moverBanco(v.id, ci, sel ? sel.value : MUNICIPIOS_CH[0]); setPickMuni(null); }} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 10px", background: T.brand }}>Guardar</button>
                        <button className="actbtn" onClick={() => setPickMuni(null)} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 8px", background: "#fff", color: T.muted, border: `1px solid ${T.line}` }}>✕</button>
                      </span>
                    ) : (
                      <button className="actbtn" onClick={() => setPickMuni(ci)} title="Guardar en el banco de candidatos y quitar de esta vacante" style={{ ...sx.actbtn, fontSize: 11, padding: "6px 10px", background: "#fff", color: T.brand, border: `1px solid ${T.brand}`, display: "inline-flex", alignItems: "center", gap: 5 }}><Ico name="UsersRound" size={13} color={T.brand} />Mover a banco</button>
                    ))}
                  </div>
                </div>
                {esContratado && <Expediente v={v} c={c} h={h} />}
              </div>
            );
          })}
        </div>
        {!c && (
          <div style={{ ...sx.repCard, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
            <input placeholder="Nombre del candidato" value={nc.nombre} onChange={(e) => setNc({ ...nc, nombre: e.target.value })} className="sel" style={{ ...sx.sel, flex: 1, minWidth: 150, fontSize: 12 }} />
            <input type="number" min="18" max="80" placeholder="Edad" value={nc.edad} onChange={(e) => setNc({ ...nc, edad: e.target.value })} className="sel" style={{ ...sx.sel, fontSize: 12, width: 75 }} />
            <select className="sel" value={nc.fuente} onChange={(e) => setNc({ ...nc, fuente: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }}>
              {["OCC", "Indeed", "Referido", "LinkedIn", "Bolsa local"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <select className="sel" value={nc.calif} onChange={(e) => setNc({ ...nc, calif: e.target.value })} style={{ ...sx.sel, fontSize: 12, width: "auto" }} title="Calificación inicial del CV">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>CV: {n}/5</option>)}
            </select>
            <UploadBtn archivo={nc.cv} onPick={(n) => setNc({ ...nc, cv: n })} label="Subir CV" />
            <button className="actbtn" disabled={!ncOk} onClick={() => { h.agregarCand(v.id, { nombre: nc.nombre.trim(), fuente: nc.fuente, cv: nc.cv, edad: nc.edad, calif: nc.calif }); setNc({ nombre: "", fuente: "OCC", cv: null, edad: "", calif: "3" }); }} style={{ ...sx.actbtn, fontSize: 11.5, padding: "6px 12px", background: ncOk ? T.ink : T.line, color: ncOk ? "#fff" : T.muted, cursor: ncOk ? "pointer" : "not-allowed" }}>Agregar candidato</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Expediente({ v, c, h }) {
  const docsPend = c.docs.filter((d) => !d.ok).length;
  const ep = evalPct(c);
  const aprueba = c.evalHecha && ep >= 80;
  return (
    <div style={{ borderLeft: `3px solid ${T.lineSoft}`, paddingLeft: 14, marginLeft: 4, display: "grid", gap: 18 }}>
      <div>
        <div style={sx.sectionTitle}>Documentos {docsPend > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.bad, background: T.badSoft, padding: "2px 8px", borderRadius: 99, marginLeft: 8 }}>{docsPend} pendiente{docsPend > 1 ? "s" : ""}</span>}</div>
        <div style={sx.repCard}>
          {c.docs.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", flexWrap: "wrap" }}>
              <button onClick={() => h.toggleDoc(v.id, i)} disabled={!d.archivo} title={d.archivo ? "Marcar recibido" : "Carga el archivo primero"}
                style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, background: d.ok ? T.brand : "#fff", border: `1.5px solid ${d.ok ? T.brand : d.archivo ? T.line : T.lineSoft}`, cursor: d.archivo ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {d.ok && <Ico name="Check" size={13} color="#fff" />}
              </button>
              <span style={{ fontSize: 12.5, flex: 1, minWidth: 120, color: d.ok ? T.muted : T.ink, textDecoration: d.ok ? "line-through" : "none" }}>{d.nombre}</span>
              <label className="rowbtn" style={{ fontSize: 11, fontWeight: 600, color: d.archivo ? T.ok : T.brand, background: d.archivo ? T.okSoft : T.brandSoft, border: `1px solid ${d.archivo ? T.ok : T.brand}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 200 }}>
                <input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) h.subirDoc(v.id, i, f.name); }} />
                <Ico name={d.archivo ? "FileCheck" : "Upload"} size={13} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.archivo || "Subir archivo"}</span>
              </label>
            </div>
          ))}
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Un documento solo se puede marcar como recibido después de cargar su archivo.</div>
        </div>
      </div>

      <div>
        <div style={sx.sectionTitle}>Inducción</div>
        <div style={sx.repCard}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}><ChkLine ok={c.induccion} disabled={!c.induccionArchivo} label="Inducción a la empresa completada (historia, valores, reglamento)" onClick={() => h.toggleInd(v.id)} /></div>
            <UploadBtn archivo={c.induccionArchivo} onPick={(n) => h.subirInd(v.id, n)} label="Acuse de inducción" />
          </div>
          {!c.induccionArchivo && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Sube el acuse firmado para poder marcar la inducción.</div>}
        </div>
      </div>

      <div>
        <div style={sx.sectionTitle}>Capacitación en sucursal maestra · {capaPct(c)}% de avance</div>
        <div style={{ display: "grid", gap: 8 }}>
          {c.capa.map((d, di) => {
            const tot = d.items.length, done = d.items.filter((i) => i.done).length;
            return (
              <div key={di} style={sx.repCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{d.titulo} <span style={{ color: T.muted, fontWeight: 400 }}>· {done}/{tot}</span></div>
                  <UploadBtn archivo={d.archivo} onPick={(n) => h.subirCapaDoc(v.id, di, n)} label="Evidencia del día" />
                </div>
                {d.items.map((it, ii) => <ChkLine key={ii} ok={it.done} disabled={!d.archivo} label={it.txt} onClick={() => h.toggleCapa(v.id, di, ii)} />)}
                {!d.archivo && <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>Sube la evidencia del día para poder marcar los puntos.</div>}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={sx.sectionTitle}>Evaluación final · aprobación mínima 80%</div>
        <div style={sx.repCard}>
          {c.evalItems.map((it, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0" }}>
              <span style={{ fontSize: 12.5 }}>{it.txt}</span>
              <button onClick={() => h.toggleEval(v.id, i)} className="actbtn" style={{ ...sx.actbtn, fontSize: 11, padding: "4px 12px", background: it.val ? T.ok : T.line, color: it.val ? "#fff" : T.inkSoft }}>{it.val ? "Sí" : "No"}</button>
            </div>
          ))}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: ep >= 80 ? T.ok : T.bad }}>Resultado: {ep}%</span>
            {!c.evalHecha
              ? <button className="actbtn" onClick={() => h.registrarEval(v.id)} style={{ ...sx.actbtn }}>Registrar resultado</button>
              : aprueba
                ? <span style={{ fontSize: 12, fontWeight: 600, color: T.ok }}>Aprobado · Vo.Bo. de liberación</span>
                : <span style={{ fontSize: 12, fontWeight: 600, color: T.bad }}>No aprobado · se genera Plan de Acción de refuerzo</span>}
          </div>
        </div>
      </div>

      <div>
        <div style={sx.sectionTitle}>Asignación y seguimiento</div>
        <div style={sx.repCard}>
          {!c.asignada
            ? aprueba
              ? <button className="actbtn" onClick={() => h.asignar(v.id)} style={{ ...sx.actbtn }}>Asignar a {v.sucursal} y cerrar la vacante</button>
              : <span style={{ fontSize: 12, color: T.muted }}>Disponible cuando la evaluación final sea aprobada (≥ 80%).</span>
            : (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ok, marginBottom: 8 }}>Colaborador activo en {v.sucursal} · vacante cerrada automáticamente</div>
                <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>Seguimientos generados:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["15 días", "30 días", "90 días"].map((t) => <span key={t} style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, background: T.lineSoft, padding: "5px 12px", borderRadius: 99 }}>Alerta a {t}</span>)}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

/* ===== Sección de Reportes (híbrida y reutilizable por departamento) ===== */
const FRANQ_REPORTES = {
  automaticos: [
    { nombre: "Reporte de Pagos", per: "Semanal · martes", fuente: "Cobranza" },
    { nombre: "Reporte Mensual de Pagos", per: "Mensual · primeros 7 días", fuente: "Cobranza" },
    { nombre: "Resultado de Auditorías (semanal)", per: "Semanal · lunes", fuente: "Auditorías" },
    { nombre: "Resultado de Auditorías (mensual)", per: "Mensual · primeros 7 días", fuente: "Auditorías" },
  ],
  entregas: [
    { nombre: "Resultado Semanal de Ventas", periodicidad: "Semanal", dia: "Lunes", resp: "Pamela Segovia", estado: "Entregado", archivo: "ventas_semana.pdf" },
    { nombre: "Gestión de Auditorías", periodicidad: "Semanal", dia: "Martes", resp: "Osvaldo", estado: "Pendiente", archivo: null },
    { nombre: "Consumo Semanal de Compras", periodicidad: "Semanal", dia: "Miércoles", resp: "Kathia", estado: "Vencido", archivo: null },
    { nombre: "Seguimiento a reportes", periodicidad: "Semanal", dia: "Viernes", resp: "Viridiana", estado: "Pendiente", archivo: null },
    { nombre: "Resultado Mensual de Ventas", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Pamela Segovia", estado: "Entregado", archivo: "ventas_mes.pdf" },
    { nombre: "Consumo Mensual de Compras", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Kathia", estado: "Pendiente", archivo: null },
    { nombre: "Plan de publicidad y estrategias", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Abi", estado: "Pendiente", archivo: null },
    { nombre: "Respuesta y Satisfacción de Franquiciatarios", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Ruben Reyes", estado: "Pendiente", archivo: null },
    { nombre: "Presentaciones a Franquiciatarios", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Elias", estado: "Pendiente", archivo: null },
    { nombre: "Seguimiento a reportes", periodicidad: "Mensual", dia: "Primeros 7 días", resp: "Viridiana", estado: "Pendiente", archivo: null },
  ],
};
const REP_COLOR = { Entregado: T.ok, Pendiente: T.warn, Vencido: T.bad };

function ReportesSeccion({ config, titulo }) {
  const [entregas, setEntregas] = useState(config.entregas);
  const [filtro, setFiltro] = useState("Todos");
  const [verAuto, setVerAuto] = useState(null);
  const subir = (idx, name) => setEntregas((p) => p.map((e, i) => (i === idx ? { ...e, archivo: name, estado: "Entregado" } : e)));
  const cnt = (st) => entregas.filter((e) => e.estado === st).length;
  const lista = entregas.map((e, i) => ({ ...e, _i: i })).filter((e) => filtro === "Todos" || e.periodicidad === filtro);
  const periodicidades = ["Todos", ...Array.from(new Set(config.entregas.map((e) => e.periodicidad)))];
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>{titulo || "Reportes"}</h1><span style={{ fontSize: 12, color: T.muted }}>automáticos + entregas</span></div>
      <div style={sx.cards4}>
        <Metric big={String(cnt("Entregado"))} label="Entregados" sub="del periodo" accent={T.ok} />
        <Metric big={String(cnt("Pendiente"))} label="Pendientes" sub="por entregar" accent={cnt("Pendiente") ? T.warn : T.ok} alert={cnt("Pendiente") > 0} />
        <Metric big={String(cnt("Vencido"))} label="Vencidos" sub="fuera de plazo" accent={T.bad} alert={cnt("Vencido") > 0} />
        <Metric big={String(config.automaticos.length)} label="Automáticos" sub="los genera la plataforma" accent={T.brand} />
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Reportes automáticos</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>La plataforma los arma sola con los datos ya capturados. No requieren carga.</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {config.automaticos.map((r, i) => (
            <div key={i} style={{ ...sx.areaCard, borderTop: `3px solid ${T.brand}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.nombre}</div>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: T.brand, background: T.brandSoft, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>Auto</span>
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{r.per} · fuente: {r.fuente}</div>
              <button className="actbtn" onClick={() => setVerAuto(verAuto === i ? null : i)} style={{ ...sx.actbtn, marginTop: 12, fontSize: 11.5, padding: "6px 12px", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}>{verAuto === i ? "Ocultar" : "Ver reporte"}</button>
              {verAuto === i && <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 8, background: T.paper, borderRadius: 8, padding: "8px 10px" }}>Generado automáticamente con los datos de <strong>{r.fuente}</strong> al corte de hoy. En el sistema real se abriría o imprimiría aquí.</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <div style={sx.sectionTitle}>Calendario de entregas</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>El responsable sube su reporte en tiempo y forma. Sin archivo a tiempo, se marca vencido.</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {periodicidades.map((f) => (
            <button key={f} className="roletab" onClick={() => setFiltro(f)} style={{ ...sx.roletab, fontSize: 12, background: filtro === f ? T.ink : "#fff", color: filtro === f ? "#fff" : T.inkSoft, borderColor: filtro === f ? T.ink : T.line }}>{f}</button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {lista.map((e) => (
            <div key={e._i} style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: e.estado === "Vencido" ? `3px solid ${T.bad}` : undefined }}>
              <div style={{ minWidth: 200, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.nombre}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{e.periodicidad} · {e.dia} · {e.resp}{e.archivo ? ` · ${e.archivo}` : ""}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: REP_COLOR[e.estado], background: e.estado === "Entregado" ? T.okSoft : e.estado === "Pendiente" ? T.warnSoft : T.badSoft, padding: "3px 9px", borderRadius: 99 }}>{e.estado}</span>
                <UploadBtn archivo={e.archivo} onPick={(n) => subir(e._i, n)} label="Subir reporte" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== Encuestas de Satisfacción de Franquiciatarios ===== */
const ENC_MARCA = [
  { area: "Acompañamiento del corporativo", items: ["Rapidez de respuesta a tus solicitudes y tickets", "Solución efectiva de tus quejas o conflictos", "Presentación mensual de resultados de tu franquicia"] },
  { area: "Auditorías y planes de acción", items: ["Claridad y justicia de las auditorías", "Utilidad de los planes de acción para mejorar", "Realismo de los tiempos que te dan para corregir"] },
  { area: "Suministro y almacén", items: ["Surtido completo de producto (sin faltantes)", "Puntualidad en la entrega de pedidos", "Justicia de la regla de bloqueo por pagos (48 h)"] },
  { area: "Cobranza y finanzas", items: ["Claridad y exactitud de tus cobros (regalías, rentas, publicidad)", "Transparencia en el cálculo de regalías y financiamientos"] },
  { area: "Marketing y publicidad", items: ["Calidad del plan de publicidad corporativa", "Apoyo para tu publicidad local", "Materiales y campañas que te proporcionan"] },
  { area: "Capacitación y desarrollo", items: ["Capacitación inicial de tu personal", "Capacitación continua y correctiva", "Apoyo técnico con las máquinas"] },
  { area: "Rentabilidad y relación contractual", items: ["Rentabilidad general de tu franquicia", "Claridad en tus derechos y obligaciones del contrato", "Gestión oportuna de renovaciones"] },
];
const ENC_MARCA_ITEMS = ENC_MARCA.flatMap((g, gi) => g.items.map((it) => ({ area: g.area, gi, item: it })));
const ENC_COLABS = ["Gerente de Franquicias", "Coordinador de Mercadotecnia", "Auditor de Franquicias"];
const ENC_ESCALA = [["Muy insatisfecho", 1], ["Insatisfecho", 2], ["Neutral", 3], ["Satisfecho", 4], ["Muy satisfecho", 5]];
const ENC_RECOM = [["Definitivamente sí", 5], ["Probablemente sí", 4], ["Tal vez", 3], ["Probablemente no", 2], ["Definitivamente no", 1]];
const ENC_COMENTARIOS = [
  "Buen acompañamiento, pero el suministro a veces tarda.",
  "Muy satisfecho con la capacitación del personal.",
  "Necesito más apoyo en publicidad local.",
  "La rentabilidad ha mejorado este año.",
  "Excelente atención del Gerente de Franquicias.",
  "El surtido de almacén podría ser más puntual.",
  "El auditor es muy claro con los planes de acción.",
];
const encCol = (c) => (c >= 4 ? T.ok : c >= 3 ? T.warn : T.bad);
const npsCol = (n) => (n >= 9 ? T.ok : n >= 7 ? T.warn : T.bad);

function EncuestasSatisfaccion({ franqs }) {
  const duenos = [...new Set(franqs.map((f) => f.franq))];
  const seedMes = (mesIdx) => duenos.map((d, i) => {
    const h = vhash(d + "-" + mesIdx);
    const respondio = (i + mesIdx) % 6 !== 0;
    const drift = (mesIdx - 3) * 0.12;
    const gen = (extra) => Math.max(1, Math.min(5, Math.round((3 + (h % 21) / 10 + extra + drift) * 10) / 10));
    const marca = respondio ? ENC_MARCA_ITEMS.map((_, j) => gen(((h >> (j % 12)) % 3 - 1) * 0.5)) : null;
    const colabs = respondio ? ENC_COLABS.map((_, j) => gen(((h >> (j + 2)) % 3 - 1) * 0.5)) : null;
    const prom = respondio ? Math.round(([...marca, ...colabs].reduce((s, x) => s + x, 0) / (marca.length + colabs.length)) * 10) / 10 : null;
    const nps = respondio ? Math.max(0, Math.min(10, Math.round(prom * 2))) : null;
    return { dueno: d, respondio, prom, nps, fecha: respondio ? `2025-${String(mesIdx + 1).padStart(2, "0")}-${String(5 + (h % 20)).padStart(2, "0")}` : null, comentario: respondio ? ENC_COMENTARIOS[h % ENC_COMENTARIOS.length] : "", marca, colabs };
  });
  const [encMes, setEncMes] = useState({ 3: seedMes(3), 4: seedMes(4), 5: seedMes(5) });
  const [mesSel, setMesSel] = useState(5);
  const [tab, setTab] = useState("resultados");
  const [genm, setGenm] = useState({ 5: true });
  const [abriendo, setAbriendo] = useState(null);
  const [copiado, setCopiado] = useState(null);
  const enc = encMes[mesSel] || seedMes(mesSel);

  const linkDe = (dueno) => `frutalyogurt.app/encuesta/2025-${String(mesSel + 1).padStart(2, "0")}/${(vhash(dueno + mesSel) % 1000000).toString(36)}`;
  const registrarResp = (dueno, r) => { setEncMes((p) => ({ ...p, [mesSel]: (p[mesSel] || seedMes(mesSel)).map((e) => (e.dueno === dueno ? { ...e, ...r, respondio: true, fecha: new Date().toISOString().slice(0, 10) } : e)) })); setAbriendo(null); setTab("resultados"); };
  const copiar = (dueno) => { const t = linkDe(dueno); try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) {} setCopiado(dueno); setTimeout(() => setCopiado(null), 1500); };

  const respondieron = enc.filter((e) => e.respondio);
  const prom = respondieron.length ? respondieron.reduce((s, e) => s + e.prom, 0) / respondieron.length : 0;
  const npsProm = respondieron.length ? respondieron.reduce((s, e) => s + e.nps, 0) / respondieron.length : 0;
  const detractores = respondieron.filter((e) => e.prom < 3).length;
  const avgMarcaItem = (j) => { const v = respondieron.map((e) => e.marca[j]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
  const avgColab = (j) => { const v = respondieron.map((e) => e.colabs[j]).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0; };
  const avgArea = (gi) => { const idxs = ENC_MARCA_ITEMS.map((it, k) => (it.gi === gi ? k : -1)).filter((k) => k >= 0); const vals = idxs.map(avgMarcaItem); return vals.reduce((s, x) => s + x, 0) / vals.length; };
  const promMesDe = (arr) => { const r = arr.filter((e) => e.respondio); return r.length ? r.reduce((s, e) => s + e.prom, 0) / r.length : 0; };
  const tendencia = Object.keys(encMes).map(Number).sort((a, b) => a - b).map((m) => ({ m, v: promMesDe(encMes[m]) }));

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Encuestas de Satisfacción</h1><span style={{ fontSize: 12, color: T.muted }}>evaluación mensual · escala 1 a 5</span></div>
      <div style={{ display: "flex", gap: 10, marginTop: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[["resultados", "Resultados"], ["enviar", "Enviar encuesta"], ["encuesta", "Ver encuesta"]].map(([k, l]) => (
            <button key={k} className="roletab" onClick={() => setTab(k)} style={{ ...sx.roletab, background: tab === k ? T.ink : "#fff", color: tab === k ? "#fff" : T.inkSoft, borderColor: tab === k ? T.ink : T.line }}>{l}</button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: T.muted, display: "inline-flex", alignItems: "center", gap: 8 }}>Mes
          <select className="sel" value={mesSel} onChange={(e) => setMesSel(Number(e.target.value))} style={{ ...sx.sel, fontSize: 12.5, width: "auto" }}>
            {MESES_LBL.map((m, i) => <option key={m} value={i}>{m} 2025</option>)}
          </select>
        </label>
      </div>

      {tab === "resultados" && (
        <div>
          <div style={sx.cards4}>
            <Metric big={`${prom.toFixed(1)}/5`} label="Satisfacción promedio" sub={`${MESES_LBL[mesSel]} 2025`} accent={encCol(prom)} />
            <Metric big={`${npsProm.toFixed(1)}/10`} label="Recomendación (NPS)" sub="meta ≥ 8" accent={npsCol(npsProm)} />
            <Metric big={`${respondieron.length}/${enc.length}`} label="Respondieron" sub="tasa de respuesta" accent={respondieron.length === enc.length ? T.ok : T.warn} />
            <Metric big={String(detractores)} label="Insatisfechos" sub="promedio < 3" accent={detractores ? T.bad : T.ok} alert={detractores > 0} />
          </div>

          {tendencia.length > 1 && (
            <div style={{ marginTop: 22 }}>
              <div style={sx.sectionTitle}>Tendencia mensual de satisfacción</div>
              <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff", padding: "18px 16px 10px", display: "flex", alignItems: "flex-end", gap: 14, height: 150 }}>
                {tendencia.map((t) => (
                  <div key={t.m} onClick={() => setMesSel(t.m)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end", cursor: "pointer" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: encCol(t.v) }}>{t.v.toFixed(1)}</div>
                    <div style={{ width: "100%", maxWidth: 60, height: `${(t.v / 5) * 100}%`, minHeight: 3, background: t.m === mesSel ? T.brand : T.brandSoft, border: t.m === mesSel ? "none" : `1px solid ${T.brand}`, borderRadius: "5px 5px 0 0" }} />
                    <div style={{ fontSize: 11, color: t.m === mesSel ? T.ink : T.muted, fontWeight: t.m === mesSel ? 700 : 400 }}>{MESES_LBL[t.m]}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 26 }}>
            <div style={sx.sectionTitle}>Aspectos de la marca (por área y criterio)</div>
            <div style={{ display: "grid", gap: 14 }}>
              {ENC_MARCA.map((g, gi) => (
                <div key={g.area} style={{ ...sx.repCard }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>{g.area}</div>
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 16, color: encCol(avgArea(gi)) }}>{avgArea(gi).toFixed(1)}</div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {g.items.map((it) => { const k = ENC_MARCA_ITEMS.findIndex((x) => x.item === it); const v = avgMarcaItem(k); return (
                      <div key={it} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ flex: 1, fontSize: 11.5, color: T.inkSoft }}>{it}</div>
                        <div style={{ width: 120, background: T.lineSoft, borderRadius: 99, height: 7, overflow: "hidden" }}><div style={{ width: `${(v / 5) * 100}%`, height: "100%", background: encCol(v), borderRadius: 99 }} /></div>
                        <div style={{ width: 28, textAlign: "right", fontWeight: 700, fontSize: 11.5, color: encCol(v) }}>{v.toFixed(1)}</div>
                      </div>
                    ); })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={sx.sectionTitle}>Evaluación a colaboradores</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
              {ENC_COLABS.map((a, j) => { const v = avgColab(j); return (
                <div key={a} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>{a}</div>
                    <div style={{ background: T.lineSoft, borderRadius: 99, height: 8, overflow: "hidden", marginTop: 5 }}><div style={{ width: `${(v / 5) * 100}%`, height: "100%", background: encCol(v), borderRadius: 99 }} /></div>
                  </div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, color: encCol(v) }}>{v.toFixed(1)}</div>
                </div>
              ); })}
            </div>
            <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", marginTop: 8 }}>Por rol; al conectar de verdad se muestra el nombre de quien atiende a cada franquiciatario.</div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div style={sx.sectionTitle}>Respuestas de {MESES_LBL[mesSel]}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {enc.map((e) => (
                <div key={e.dueno} style={{ ...sx.repCard, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: e.respondio ? `3px solid ${encCol(e.prom)}` : `3px solid ${T.line}` }}>
                  <div style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{e.dueno}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{e.respondio ? `Respondió · ${e.fecha}` : "Pendiente de responder"}</div>
                  </div>
                  {e.respondio && <span style={{ fontSize: 12, color: T.muted, maxWidth: 300, fontStyle: "italic", flex: 1 }}>"{e.comentario}"</span>}
                  {e.respondio ? (
                    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                      <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, color: encCol(e.prom) }}>{e.prom}</div><div style={{ fontSize: 9, color: T.muted }}>satisf.</div></div>
                      <div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, color: npsCol(e.nps) }}>{e.nps}</div><div style={{ fontSize: 9, color: T.muted }}>NPS</div></div>
                    </div>
                  ) : <span style={{ fontSize: 10.5, fontWeight: 700, color: T.warn, background: T.warnSoft, padding: "3px 9px", borderRadius: 99 }}>Pendiente</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "enviar" && (
        abriendo ? (
          <div>
            <button onClick={() => setAbriendo(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft, marginBottom: 12 }}>‹ Volver a la lista de envío</button>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Vista pública del franquiciatario · <strong>{abriendo}</strong> · {MESES_LBL[mesSel]} 2025</div>
            <EncuestaVista mesLbl={MESES_LBL[mesSel]} fijo={abriendo} onEnviar={registrarResp} />
          </div>
        ) : (
          <div>
            {/* NOTA PARA EL PROGRAMADOR:
                En el sistema real, "Generar links" debe crear un enlace PÚBLICO por franquiciatario
                (accesible sin login, fuera de esta plataforma), único por mes, que identifique al
                franquiciatario y guarde su respuesta en la BD asociada al mes en curso. */}
            {!genm[mesSel] ? (
              <div style={{ ...sx.repCard, textAlign: "center", padding: "36px 20px" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><Ico name="Link" size={26} color={T.brand} /></div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Encuesta de {MESES_LBL[mesSel]} 2025</div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 4, marginBottom: 16 }}>Genera un link personalizado por franquiciatario para enviárselo este mes.</div>
                <button className="actbtn" onClick={() => setGenm((p) => ({ ...p, [mesSel]: true }))} style={{ ...sx.actbtn, fontSize: 12.5, padding: "10px 18px", background: T.brand, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="Link" size={15} color="#fff" />Generar links del mes</button>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  <div style={{ fontSize: 12.5, color: T.inkSoft }}>Links de <strong>{MESES_LBL[mesSel]} 2025</strong> · {enc.filter((e) => e.respondio).length}/{enc.length} respondieron</div>
                  <span style={{ fontSize: 11, color: T.muted }}>Envía cada link a su franquiciatario</span>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {enc.map((e) => (
                    <div key={e.dueno} style={{ ...sx.repCard, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: `3px solid ${e.respondio ? T.ok : T.warn}` }}>
                      <div style={{ minWidth: 150 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.dueno}</div>
                        <div style={{ fontSize: 11, color: e.respondio ? T.ok : T.warn, fontWeight: 600 }}>{e.respondio ? "Respondió" : "Pendiente"}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 200, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.muted, background: T.paper, borderRadius: 8, padding: "7px 10px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{linkDe(e.dueno)}</div>
                      <button className="actbtn" onClick={() => copiar(e.dueno)} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: "#fff", color: copiado === e.dueno ? T.ok : T.ink, border: `1px solid ${copiado === e.dueno ? T.ok : T.line}` }}>{copiado === e.dueno ? "Copiado ✓" : "Copiar"}</button>
                      {!e.respondio && <button className="actbtn" onClick={() => setAbriendo(e.dueno)} style={{ ...sx.actbtn, fontSize: 11, padding: "6px 12px", background: T.brand }}>Abrir</button>}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>"Abrir" simula que el franquiciatario entra a su link y contesta; su respuesta se registra en {MESES_LBL[mesSel]}. En el sistema real, el link es público y lo contesta él mismo.</div>
              </div>
            )}
          </div>
        )
      )}
      {tab === "encuesta" && <EncuestaVista soloVista mesLbl={MESES_LBL[mesSel]} />}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>Evaluación mensual · datos de ejemplo. En el sistema real las respuestas llegan de la encuesta enviada cada mes a los franquiciatarios.</div>
    </div>
  );
}

function OpcionEscala({ val, onSet, soloVista, opciones }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opciones.map(([lbl, v]) => (
        <button key={lbl} disabled={soloVista} onClick={() => onSet && onSet(v)} style={{ fontSize: 11, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: soloVista ? "default" : "pointer", fontFamily: "inherit", background: val === v ? encCol(v) : "#fff", color: val === v ? "#fff" : T.muted, border: `1px solid ${val === v ? encCol(v) : T.line}` }}>{lbl}</button>
      ))}
    </div>
  );
}

function EncuestaVista({ soloVista, pendientes, onEnviar, mesLbl, fijo }) {
  const [dueno, setDueno] = useState(fijo || (pendientes && pendientes.length ? pendientes[0] : ""));
  const [marca, setMarca] = useState(ENC_MARCA_ITEMS.map(() => 0));
  const [col, setCol] = useState(ENC_COLABS.map(() => 0));
  const [recom, setRecom] = useState(null);
  const [coment, setComent] = useState("");

  const completo = !soloVista && dueno && marca.every((x) => x > 0) && col.every((x) => x > 0) && recom != null;
  const enviar = () => {
    if (!completo) return;
    const prom = Math.round(([...marca, ...col].reduce((s, x) => s + x, 0) / (marca.length + col.length)) * 10) / 10;
    onEnviar(dueno, { marca, colabs: col, nps: Math.round(prom * 2), prom, comentario: coment });
  };

  let n = 0;
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ ...sx.repCard, display: "grid", gap: 20 }}>
        <div style={{ borderBottom: `1px solid ${T.line}`, paddingBottom: 12 }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18 }}>Encuesta de Satisfacción</div>
          <div style={{ fontSize: 12, color: T.muted }}>Franquiciatarios de Frutal Yogurt · {mesLbl ? `${mesLbl} 2025 · ` : ""}opción múltiple</div>
        </div>

        {!soloVista && !fijo && (
          <TField label="Franquiciatario">
            <select className="sel" value={dueno} onChange={(e) => setDueno(e.target.value)} style={{ ...sx.sel, fontSize: 12.5 }}>
              {(pendientes || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </TField>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.brand }}>Bloque 1 · Aspectos de la marca</div>
        {ENC_MARCA.map((g) => (
          <div key={g.area}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.inkSoft, marginBottom: 10, paddingBottom: 4, borderBottom: `1px solid ${T.lineSoft}` }}>{g.area}</div>
            <div style={{ display: "grid", gap: 14 }}>
              {g.items.map((it) => { const k = ENC_MARCA_ITEMS.findIndex((x) => x.item === it); n += 1; return (
                <div key={it}>
                  <div style={{ fontSize: 12.5, marginBottom: 6 }}><strong style={{ color: T.muted, fontWeight: 600 }}>{n}.</strong> {it}</div>
                  <OpcionEscala val={marca[k]} soloVista={soloVista} opciones={ENC_ESCALA} onSet={(v) => setMarca((a) => a.map((x, i) => (i === k ? v : x)))} />
                </div>
              ); })}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.brand, borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>Bloque 2 · Colaboradores que te atienden</div>
        <div style={{ display: "grid", gap: 14 }}>
          {ENC_COLABS.map((q, j) => { n += 1; return (
            <div key={q}>
              <div style={{ fontSize: 12.5, marginBottom: 6 }}><strong style={{ color: T.muted, fontWeight: 600 }}>{n}.</strong> {q}</div>
              <OpcionEscala val={col[j]} soloVista={soloVista} opciones={ENC_ESCALA} onSet={(v) => setCol((a) => a.map((x, i) => (i === j ? v : x)))} />
            </div>
          ); })}
        </div>

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>{n + 1}. ¿Recomendarías ser franquiciatario de Frutal Yogurt?</div>
          <OpcionEscala val={recom} soloVista={soloVista} opciones={ENC_RECOM} onSet={setRecom} />
        </div>

        <TField label={`${n + 2}. Comentarios y sugerencias`}>
          <textarea disabled={soloVista} value={coment} onChange={(e) => setComent(e.target.value)} placeholder="Escribe aquí lo que quieras compartir…" className="sel" style={{ ...sx.sel, fontSize: 12.5, minHeight: 60, resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
        </TField>

        {soloVista ? (
          <div style={{ fontSize: 11.5, color: T.muted, fontStyle: "italic" }}>Vista previa de la encuesta que recibe el franquiciatario. Para capturar una respuesta, usa la pestaña "Registrar respuesta".</div>
        ) : (
          <button className="actbtn" disabled={!completo} onClick={enviar} style={{ ...sx.actbtn, fontSize: 12.5, padding: "10px 18px", background: completo ? T.brand : T.line, color: completo ? "#fff" : T.muted, cursor: completo ? "pointer" : "not-allowed" }}>Enviar respuesta</button>
        )}
      </div>
    </div>
  );
}

/* ===== Relación y Reportes (portal de franquicias) ===== */
const PORTAL_URL = "https://auditorias.mifrutalyogurt.com/portal-franquicias/";
const REP_TIPOS = ["Reporte operativo", "Situación crítica", "Aclaración de pago o pedido", "Otro"];
const REP_AREAS = ["Operaciones", "Cobranza", "Suministro / Almacén", "Marketing", "Contrato", "Otro"];
const REP_URG = { "Normal": T.ok, "Importante": T.warn, "Crítico": T.bad };
const REP_URGBG = { "Normal": T.okSoft, "Importante": T.warnSoft, "Crítico": T.badSoft };
const REP_EST = { "Abierto": T.brand, "En revisión": T.warn, "Resuelto": T.ok };
const REP_ESTBG = { "Abierto": T.brandSoft, "En revisión": T.warnSoft, "Resuelto": T.okSoft };
// NOTA PARA EL PROGRAMADOR: estos reportes deben provenir del formulario público del portal
// (PORTAL_URL). Cada envío genera un folio y llega aquí para seguimiento. Reemplazar el seed
// por la lectura real de los reportes capturados en el portal.
const REPORTES_FQ = [
  { folio: "FY-2026-000010", suc: "Frutal Yogurt", franq: "Mauricio Garza", tipo: "Otro", area: "Otro", urgencia: "Importante", estatus: "Abierto", fecha: "22/06/2026 14:46", actualizacion: "22/06/2026 14:46", adjuntos: 0, titulo: "Solicitud de material POP", desc: "Requiero lonas nuevas para la promoción de temporada." },
  { folio: "FY-2026-000009", suc: "Las Puentes", franq: "Mauricio Garza", tipo: "Reporte operativo", area: "Operaciones", urgencia: "Crítico", estatus: "Resuelto", fecha: "17/06/2026 14:16", actualizacion: "17/06/2026 14:19", adjuntos: 0, titulo: "Falla en máquina de helado", desc: "La máquina dejó de enfriar; se atendió con mantenimiento." },
  { folio: "FY-2026-000008", suc: "Las Puentes", franq: "Mauricio Garza", tipo: "Situación crítica", area: "Suministro / Almacén", urgencia: "Crítico", estatus: "Abierto", fecha: "17/06/2026 12:28", actualizacion: "17/06/2026 12:28", adjuntos: 1, titulo: "Faltante de producto en pedido", desc: "Llegó el pedido incompleto, faltan bases y toppings." },
  { folio: "FY-2026-000007", suc: "Mitras", franq: "Jorge Jaramillo", tipo: "Reporte operativo", area: "Operaciones", urgencia: "Normal", estatus: "Resuelto", fecha: "16/06/2026 19:27", actualizacion: "17/06/2026 12:33", adjuntos: 1, titulo: "Duda de operación", desc: "Consulta sobre el porcionamiento estándar." },
  { folio: "FY-2026-000006", suc: "Berneses", franq: "Jesús Medina", tipo: "Aclaración de pago o pedido", area: "Cobranza", urgencia: "Normal", estatus: "Abierto", fecha: "15/06/2026 12:41", actualizacion: "15/06/2026 12:41", adjuntos: 1, titulo: "Aclaración de regalías", desc: "No coincide el cobro de regalías de mayo." },
  { folio: "FY-2026-000005", suc: "Soriana Cadereyta", franq: "Hassel Mendoza", tipo: "Situación crítica", area: "Operaciones", urgencia: "Importante", estatus: "Abierto", fecha: "15/06/2026 12:22", actualizacion: "15/06/2026 12:22", adjuntos: 0, titulo: "Queja de cliente recurrente", desc: "Cliente reporta mala atención; solicito apoyo." },
  { folio: "FY-2026-000004", suc: "Escobedo Lineal", franq: "Marcela Alcocer", tipo: "Reporte operativo", area: "Marketing", urgencia: "Importante", estatus: "Abierto", fecha: "15/06/2026 11:03", actualizacion: "15/06/2026 11:03", adjuntos: 0, titulo: "Apoyo en campaña local", desc: "Solicito material para campaña de aniversario." },
  { folio: "FY-2026-000003", suc: "Juárez Centro", franq: "David Treviño", tipo: "Reporte operativo", area: "Suministro / Almacén", urgencia: "Importante", estatus: "En revisión", fecha: "11/06/2026 10:47", actualizacion: "11/06/2026 15:55", adjuntos: 0, titulo: "Retraso en pedido", desc: "El pedido semanal llegó con dos días de retraso." },
  { folio: "FY-2026-000002", suc: "Colón Centro", franq: "Irma Lara", tipo: "Reporte operativo", area: "Operaciones", urgencia: "Normal", estatus: "Abierto", fecha: "09/06/2026 17:08", actualizacion: "09/06/2026 17:44", adjuntos: 1, titulo: "Solicitud de capacitación", desc: "Personal nuevo requiere capacitación." },
  { folio: "FY-2026-000001", suc: "Estación Sendero 1", franq: "Andrés Garza", tipo: "Reporte operativo", area: "Contrato", urgencia: "Importante", estatus: "En revisión", fecha: "08/06/2026 14:14", actualizacion: "08/06/2026 14:34", adjuntos: 0, titulo: "Consulta de renovación", desc: "Pregunta sobre el proceso de renovación de contrato." },
];

function RelacionReportes() {
  const [reps, setReps] = useState(REPORTES_FQ);
  const [fu, setFu] = useState("Todas");
  const [fa, setFa] = useState("Todas");
  const [fe, setFe] = useState("Todos");
  const [abierto, setAbierto] = useState(null);

  const avanzar = (folio) => setReps((p) => p.map((r) => (r.folio === folio ? { ...r, estatus: r.estatus === "Abierto" ? "En revisión" : r.estatus === "En revisión" ? "Resuelto" : "Abierto", actualizacion: "hoy" } : r)));
  const lista = reps.filter((r) => (fu === "Todas" || r.urgencia === fu) && (fa === "Todas" || r.area === fa) && (fe === "Todos" || r.estatus === fe));
  const cnt = (e) => reps.filter((r) => r.estatus === e).length;
  const criticosSin = reps.filter((r) => r.urgencia === "Crítico" && r.estatus !== "Resuelto").length;

  return (
    <div>
      <div style={{ ...sx.h1row, marginBottom: 6 }}>
        <h1 style={sx.h1}>Relación y Reportes</h1>
        <a href={PORTAL_URL} target="_blank" rel="noreferrer" className="actbtn" style={{ ...sx.actbtn, fontSize: 11.5, padding: "7px 13px", background: "#fff", color: T.brand, border: `1px solid ${T.brand}`, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="ExternalLink" size={14} color={T.brand} />Portal de franquicias</a>
      </div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -2, marginBottom: 18 }}>Los reportes entran por el formulario del portal (canal único y oficial). Cada uno recibe un folio y se le da seguimiento aquí.</p>

      <div style={sx.cards4}>
        <Metric big={String(cnt("Abierto"))} label="Abiertos" sub="sin atender" accent={T.brand} alert={cnt("Abierto") > 0} />
        <Metric big={String(cnt("En revisión"))} label="En revisión" sub="en proceso" accent={T.warn} />
        <Metric big={String(cnt("Resuelto"))} label="Resueltos" sub="cerrados" accent={T.ok} />
        <Metric big={String(criticosSin)} label="Críticos sin atender" sub="prioridad máxima" accent={T.bad} alert={criticosSin > 0} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 18, marginBottom: 12 }}>
        <select className="sel" value={fu} onChange={(e) => setFu(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}><option value="Todas">Todas las urgencias</option>{Object.keys(REP_URG).map((u) => <option key={u}>{u}</option>)}</select>
        <select className="sel" value={fa} onChange={(e) => setFa(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}><option value="Todas">Todas las áreas</option>{REP_AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select className="sel" value={fe} onChange={(e) => setFe(e.target.value)} style={{ ...sx.sel, fontSize: 12, width: "auto" }}><option value="Todos">Todos los estatus</option>{Object.keys(REP_EST).map((s) => <option key={s}>{s}</option>)}</select>
        <span style={{ fontSize: 11.5, color: T.muted, marginLeft: "auto" }}>{lista.length} reporte{lista.length === 1 ? "" : "s"}</span>
      </div>

      <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 12, background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.paper, textAlign: "left" }}>
              {["Folio", "Sucursal", "Tipo", "Urgencia", "Estatus", "Fecha", "Adj.", "Última actualización", ""].map((h) => (
                <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: T.inkSoft, borderBottom: `1px solid ${T.line}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => (
              <Fragment key={r.folio}>
                <tr style={{ cursor: "pointer" }} onClick={() => setAbierto(abierto === r.folio ? null : r.folio)}>
                  <td style={{ padding: "9px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{r.folio}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}` }}>{r.suc}</td>
                  <td style={{ padding: "9px 12px", color: T.inkSoft, borderBottom: `1px solid ${T.lineSoft}` }}>{r.tipo}</td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10.5, fontWeight: 700, color: REP_URG[r.urgencia], background: REP_URGBG[r.urgencia], padding: "2px 8px", borderRadius: 99 }}>{r.urgencia}</span></td>
                  <td style={{ padding: "9px 12px", borderBottom: `1px solid ${T.lineSoft}` }}><span style={{ fontSize: 10.5, fontWeight: 700, color: REP_EST[r.estatus], background: REP_ESTBG[r.estatus], padding: "2px 8px", borderRadius: 99 }}>{r.estatus}</span></td>
                  <td style={{ padding: "9px 12px", color: T.muted, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{r.fecha}</td>
                  <td style={{ padding: "9px 12px", color: T.muted, textAlign: "center", borderBottom: `1px solid ${T.lineSoft}` }}>{r.adjuntos ? <Ico name="Paperclip" size={13} color={T.muted} /> : "—"}</td>
                  <td style={{ padding: "9px 12px", color: T.muted, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{r.actualizacion}</td>
                  <td style={{ padding: "9px 12px", color: T.brand, fontWeight: 600, borderBottom: `1px solid ${T.lineSoft}`, whiteSpace: "nowrap" }}>{abierto === r.folio ? "Ocultar" : "Ver detalle"}</td>
                </tr>
                {abierto === r.folio && (
                  <tr>
                    <td colSpan={9} style={{ padding: "0 12px 14px", borderBottom: `1px solid ${T.lineSoft}` }}>
                      <div style={{ background: T.paper, borderRadius: 10, padding: "14px 16px", display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700 }}>{r.titulo}</div>
                          <button className="actbtn" onClick={() => avanzar(r.folio)} style={{ ...sx.actbtn, fontSize: 11, padding: "5px 12px", background: r.estatus === "Resuelto" ? T.ok : T.ink }}>{r.estatus === "Abierto" ? "Pasar a En revisión" : r.estatus === "En revisión" ? "Marcar Resuelto" : "Reabrir"}</button>
                        </div>
                        <div style={{ fontSize: 12.5, color: T.inkSoft }}>{r.desc}</div>
                        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 11.5, color: T.muted, marginTop: 4 }}>
                          <span><strong style={{ color: T.inkSoft }}>Franquiciatario:</strong> {r.franq}</span>
                          <span><strong style={{ color: T.inkSoft }}>Área:</strong> {r.area}</span>
                          <span><strong style={{ color: T.inkSoft }}>Adjuntos:</strong> {r.adjuntos || "ninguno"}</span>
                          <span><strong style={{ color: T.inkSoft }}>Creado:</strong> {r.fecha}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 12, fontStyle: "italic" }}>Reportes de ejemplo. En el sistema real, el formulario del portal alimenta esta tabla automáticamente y cada envío genera su folio.</div>
    </div>
  );
}

/* ============================================================
   DEPARTAMENTO DE FRANQUICIAS
   ============================================================ */
function Franquicias() {
  const [franqs, setFranqs] = useState(FRANQUICIAS);
  const [sec, setSec] = useState(null);
  const secMeta = FRANQ_SECCIONES.find((s) => s.key === sec);
  const avanzar = (id) => setFranqs((prev) => prev.map((f) => (f.id === id ? { ...f, etapa: Math.min((f.etapa || 0) + 1, 7) } : f)));
  const registrarPago = (id, k) => setFranqs((prev) => prev.map((f) => (f.id === id ? { ...f, cobranza: { ...f.cobranza, [k]: { ...f.cobranza[k], e: "ok" } } } : f)));

  return (
    <>
      <header style={sx.header} className="noprint">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 15 }}>Franquicias</div>
            <div style={{ fontSize: 11, color: T.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>{secMeta ? secMeta.nombre : "Panel del departamento"}</div>
          </div>
        </div>
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {sec && <button onClick={() => setSec(null)} className="navbtn" style={{ ...sx.navbtn, background: "transparent", color: T.inkSoft }}>‹ Secciones</button>}
        </nav>
      </header>
      <main style={sx.main}>
        {!sec && <FranqHome franqs={franqs} onEnter={setSec} />}
        {sec === "red" && <RedFranquicias franqs={franqs} />}
        {sec === "renovaciones" && <Renovaciones franqs={franqs} avanzar={avanzar} />}
        {sec === "cobranza" && <Cobranza franqs={franqs} />}
        {sec === "relacion" && <RelacionReportes />}
        {sec === "encuestas" && <EncuestasSatisfaccion franqs={franqs} />}
        {sec === "reportes" && <ReportesSeccion config={FRANQ_REPORTES} titulo="Reportes de Franquicias" />}
        {secMeta && !secMeta.activa && <FranqPlaceholder sec={secMeta} />}
      </main>
    </>
  );
}

function FranqHome({ franqs, onEnter }) {
  const enProceso = franqs.filter((f) => f.venceMeses <= 12).length;
  const alertas = franqs.filter((f) => f.venceMeses < 6 && f.etapa < 6).length;
  const totalDuenos = new Set(franqs.map((f) => f.franq)).size;
  const cartera = franqs.reduce((a, f) => a + fqMontoVencido(f), 0);
  const conAlerta = franqs.filter((f) => fqVencidos(f).length >= 2).length;
  const repPend = FRANQ_REPORTES.entregas.filter((e) => e.estado !== "Entregado").length;
  const resumen = {
    red: `${franqs.length} sucursales · ${totalDuenos} franquiciatarios`,
    renovaciones: `${enProceso} en proceso · ${alertas} alerta${alertas === 1 ? "" : "s"}`,
    cobranza: `${money(cartera)} en cartera · ${conAlerta} en alerta`,
    reportes: `${repPend} por entregar · ${FRANQ_REPORTES.automaticos.length} automáticos`,
    encuestas: `${[...new Set(franqs.map((f) => f.franq))].length} franquiciatarios encuestados`,
    relacion: `${REPORTES_FQ.filter((r) => r.estatus !== "Resuelto").length} reportes abiertos`,
  };
  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Panel de Franquicias</h1>
        <span style={{ fontSize: 12, color: T.muted }}>4 de {FRANQ_SECCIONES.length} secciones activas</span>
      </div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -8, marginBottom: 22 }}>
        Cada sección refleja una función del Gerente de Franquicias. Hoy están listas la red, las renovaciones, la cobranza y los reportes; las demás se irán construyendo.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {FRANQ_SECCIONES.map((s) => (
          <button key={s.key} className={s.activa ? "rowbtn" : ""} onClick={() => s.activa && onEnter(s.key)} disabled={!s.activa}
            style={{ ...sx.areaCard, cursor: s.activa ? "pointer" : "default", opacity: s.activa ? 1 : 0.72 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ color: s.activa ? T.brand : T.muted, display: "flex" }}><Ico name={s.iconName} size={22} strokeWidth={1.8} /></span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.nombre}</div>
                  <div style={{ fontSize: 11, color: T.muted }}>{s.desc}</div>
                </div>
              </div>
              {!s.activa && <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, background: T.lineSoft, padding: "3px 8px", borderRadius: 99 }}>Por configurar</span>}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.lineSoft}`, fontSize: 12, fontWeight: 600, color: s.activa ? T.brand : T.muted }}>
              {s.activa ? (resumen[s.key] || "Abrir ›") : "Próximamente"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RedFranquicias({ franqs }) {
  const cat = (x) => franqs.filter((f) => fqCategoria(f) === x).length;
  const conAdeudo = franqs.filter((f) => fqMontoVencido(f) > 0).length;
  const totalDuenos = new Set(franqs.map((f) => f.franq)).size;
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Red de franquicias</h1><span style={{ fontSize: 12, color: T.muted }}>{franqs.length} sucursales · {totalDuenos} franquiciatarios</span></div>
      <div style={sx.cards4}>
        <Metric big={String(franqs.length)} label="Sucursales" sub="en la red" accent={T.brand} />
        <Metric big={String(cat("Verde"))} label="Al corriente" sub="sin adeudos" accent={T.ok} />
        <Metric big={String(cat("Amarillo") + cat("Rojo"))} label="Con observación" sub={`${cat("Rojo")} en rojo`} accent={T.warn} />
        <Metric big={String(conAdeudo)} label="Con adeudos" sub="cartera vencida" accent={conAdeudo ? T.bad : T.ok} alert={conAdeudo > 0} />
      </div>
      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Directorio por sucursal</div>
        <div style={sx.list}>
          {franqs.map((f) => {
            const categoria = fqCategoria(f);
            return (
              <div key={f.id} style={{ ...sx.sucRow, cursor: "default" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <span style={{ ...sx.sucBadge, background: catMeta[categoria].color }}>{f.calif}</span>
                  <div style={{ textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.suc}</div>
                    <div style={{ fontSize: 11.5, color: T.muted }}>{f.franq}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {fqMontoVencido(f) > 0 && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.bad, background: T.badSoft, padding: "3px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>{money(fqMontoVencido(f))}</span>}
                  <Chip color={catMeta[categoria].color} soft="#fff" text={categoria} outline />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Renovaciones({ franqs, avanzar }) {
  const [filtro, setFiltro] = useState("Todas");
  const enVentana = franqs.filter((f) => f.venceMeses <= 12);
  const alertas = enVentana.filter((f) => f.venceMeses < 6 && f.etapa < 6).length;
  const c = (x) => enVentana.filter((f) => fqCategoria(f) === x).length;
  const lista = enVentana.filter((f) => filtro === "Todas" || fqCategoria(f) === filtro).sort((a, b) => a.venceMeses - b.venceMeses);
  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Contratos y renovaciones</h1><span style={{ fontSize: 12, color: T.muted }}>{enVentana.length} en ventana de 12 meses</span></div>
      <div style={sx.cards4}>
        <Metric big={String(enVentana.length)} label="En proceso" sub="vencen en ≤ 12 meses" accent={T.brand} />
        <Metric big={String(c("Verde"))} label="Verde" sub="renovación prioritaria" accent={T.ok} />
        <Metric big={String(c("Amarillo"))} label="Amarillo" sub="renovación condicionada" accent={T.warn} />
        <Metric big={String(alertas)} label="Alertas" sub="vencen en < 6 meses" accent={T.bad} alert={alertas > 0} />
      </div>

      <p style={{ fontSize: 11, color: T.muted, marginTop: 14, fontStyle: "italic" }}>Nota: las fechas de vencimiento y la categoría son ilustrativas; el Excel de conciliación no incluye datos de contrato.</p>

      <div style={{ display: "flex", gap: 6, marginTop: 14, marginBottom: 14, flexWrap: "wrap" }}>
        {["Todas", "Verde", "Amarillo", "Rojo"].map((x) => (
          <button key={x} className="roletab" onClick={() => setFiltro(x)}
            style={{ ...sx.roletab, background: filtro === x ? T.ink : "#fff", color: filtro === x ? "#fff" : T.inkSoft, borderColor: filtro === x ? T.ink : T.line }}>{x}</button>
        ))}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {lista.map((f) => <RenovCard key={f.id} f={f} avanzar={avanzar} />)}
      </div>
    </div>
  );
}

function RenovCard({ f, avanzar }) {
  const categoria = fqCategoria(f);
  const urgente = f.venceMeses < 6 && f.etapa < 6;
  const cur = f.etapa;
  const nombreEtapa = cur >= 1 ? FRANQ_ETAPAS[cur - 1] : "Sin iniciar";
  const info = cur >= 1 ? FRANQ_ETAPA_INFO[cur - 1] : "El proceso aún no inicia. Debe arrancar 12 meses antes del vencimiento.";
  return (
    <div style={{ ...sx.repCard, borderLeft: urgente ? `3px solid ${T.bad}` : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{f.suc}</span>
            <Chip color={catMeta[categoria].color} soft="#fff" text={categoria} outline />
            {urgente && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: T.bad, padding: "2px 7px", borderRadius: 99 }}>ALERTA</span>}
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>{f.franq} · calif. {f.calif}% · vence en {f.venceMeses} meses</div>
        </div>
      </div>

      <div style={sx.stepper}>
        {FRANQ_ETAPAS.map((e, i) => {
          const done = (i + 1) < cur;
          const active = (i + 1) === cur;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i === FRANQ_ETAPAS.length - 1 ? "0 0 auto" : 1, minWidth: 0 }}>
              <span style={{ width: 13, height: 13, borderRadius: 99, background: done ? T.brand : active ? "#fff" : T.lineSoft, border: active ? `3px solid ${T.brand}` : `1px solid ${done ? T.brand : T.line}` }} />
              {i < FRANQ_ETAPAS.length - 1 && <div style={{ flex: 1, height: 2, background: (i + 1) < cur ? T.brand : T.line, margin: "0 4px" }} />}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: cur === 7 ? T.ok : T.brand }}>{cur >= 1 ? `Etapa ${cur} de 7 · ${nombreEtapa}` : nombreEtapa}</span>
        <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>{info}</div>
      </div>

      <div style={{ marginTop: 10 }}>
        {cur < 7
          ? <button className="actbtn" style={{ ...sx.actbtn, background: cur === 0 && urgente ? T.bad : T.ink }} onClick={() => avanzar(f.id)}>
              {cur === 0 ? "Iniciar proceso de renovación" : `Avanzar a: ${FRANQ_ETAPAS[cur]}`}
            </button>
          : <span style={{ fontSize: 11.5, color: T.ok, fontWeight: 600 }}>Renovación formalizada · en seguimiento</span>}
      </div>
    </div>
  );
}

const COB_LABEL = { regalias: "Regalías", renta: "Renta", financiamiento: "Financiamiento", nacionSalud: "Nación Salud", publicidad: "Publicidad", compras: "Compras" };

function cobAplica(f, c, m) {
  if (m) return true;
  if (c === "regalias" || c === "publicidad") return true;
  if (c === "renta") return f.renta > 0;
  if (c === "financiamiento") return f.fin > 0;
  if (c === "nacionSalud") return f.ns;
  return false;
}
function cobMonto(f, c, m) {
  if (c === "regalias") return m && m.venta != null ? Math.round(m.venta * f.pct) : null;
  if (m && m.monto != null) return m.monto;
  if (c === "renta") return f.renta;
  if (c === "financiamiento") return f.fin;
  if (c === "nacionSalud") return NS_MONTO;
  if (c === "publicidad") return PUB_MONTO;
  return m ? m.monto : null;
}
function cobEstado(c, mi, m) {
  if (m && m.pagado) return "pagado";
  if (c === "regalias" && (!m || m.venta == null)) return "sincap";
  if (c === "compras" && (!m || m.monto == null)) return "sincap";
  return mi < COB_ACTUAL ? "vencido" : "pendiente";
}
const COB_COLOR = { pagado: T.ok, vencido: T.bad, pendiente: T.warn, sincap: T.muted };

function Cobranza({ franqs }) {
  const [mov, setMov] = useState(() => seedMovimientos(franqs));
  const [mes, setMes] = useState(4); // Mayo por defecto
  const [abierto, setAbierto] = useState(null);
  const esPasado = mes < COB_ACTUAL;
  const key = (id, c) => `${id}|${mes}|${c}`;

  const togglePago = (id, c) => setMov((p) => { const k = key(id, c); const m = p[k] || {}; return { ...p, [k]: { ...m, pagado: !m.pagado, fecha: !m.pagado ? "hoy" : null } }; });
  const setVenta = (id, v) => setMov((p) => { const k = key(id, "regalias"); return { ...p, [k]: { ...(p[k] || {}), venta: v === "" ? null : Number(v) } }; });
  const setCompra = (id, v) => setMov((p) => { const k = key(id, "compras"); return { ...p, [k]: { ...(p[k] || {}), monto: v === "" ? null : Number(v) } }; });

  // métricas del mes
  let cobrado = 0, porCobrar = 0, bloqueos = 0, dosOmas = 0;
  franqs.forEach((f) => {
    let sinPagar = 0;
    CONCEPTOS.forEach(([c]) => {
      const m = mov[key(f.id, c)];
      if (!cobAplica(f, c, m)) return;
      const est = cobEstado(c, mes, m);
      const mt = cobMonto(f, c, m) || 0;
      if (est === "pagado") cobrado += mt;
      else if (est === "vencido" || est === "pendiente") { porCobrar += mt; sinPagar++; if (c === "compras") bloqueos++; }
    });
    if (sinPagar >= 2) dosOmas++;
  });

  return (
    <div>
      <div style={sx.h1row}><h1 style={sx.h1}>Cobranza y finanzas</h1><span style={{ fontSize: 12, color: T.muted }}>captura mes por mes</span></div>

      {/* selector de mes */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {MESES_COB.map(([id, nom], i) => (
          <button key={id} className="roletab" onClick={() => { setMes(i); setAbierto(null); }}
            style={{ ...sx.roletab, background: mes === i ? T.ink : "#fff", color: mes === i ? "#fff" : T.inkSoft, borderColor: mes === i ? T.ink : T.line }}>
            {nom}{i === COB_ACTUAL ? " ·" : ""}
          </button>
        ))}
      </div>

      <div style={sx.cards4}>
        <Metric big={money(cobrado)} label="Cobrado del mes" sub="pagos registrados" accent={T.ok} />
        <Metric big={money(porCobrar)} label={esPasado ? "Cartera vencida" : "Pendiente del mes"} sub={esPasado ? "no pagado a tiempo" : "por cobrar (mes en curso)"} accent={esPasado ? T.bad : T.warn} alert={esPasado && porCobrar > 0} />
        <Metric big={String(dosOmas)} label="2+ conceptos sin pagar" sub="alerta financiera" accent={T.bad} alert={dosOmas > 0} />
        <Metric big={String(bloqueos)} label="Bloqueo 48 h" sub="compras sin pagar" accent={bloqueos ? T.crit : T.ok} alert={bloqueos > 0} />
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Conciliación de {MESES_COB[mes][1]} 2026</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 12 }}>
          Toca una sucursal para capturar. En regalías capturas la venta del mes y la plataforma calcula la regalía con el % de esa sucursal. {esPasado ? "Lo no pagado cuenta como vencido." : "Junio es el mes en curso."}
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {franqs.map((f) => (
            <CobranzaRow key={f.id} f={f} mes={mes} mov={mov} abierto={abierto === f.id}
              onToggle={() => setAbierto(abierto === f.id ? null : f.id)}
              togglePago={togglePago} setVenta={setVenta} setCompra={setCompra} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CobranzaRow({ f, mes, mov, abierto, onToggle, togglePago, setVenta, setCompra }) {
  const conceptos = CONCEPTOS.filter(([c]) => cobAplica(f, c, mov[`${f.id}|${mes}|${c}`]));
  const sinPagar = conceptos.filter(([c]) => { const e = cobEstado(c, mes, mov[`${f.id}|${mes}|${c}`]); return e === "vencido" || e === "pendiente"; }).length;
  const bloqueo = (() => { const m = mov[`${f.id}|${mes}|compras`]; return m && !m.pagado && m.monto != null; })();
  return (
    <div style={{ ...sx.repCard, borderLeft: sinPagar >= 2 ? `3px solid ${T.bad}` : undefined }}>
      <button onClick={onToggle} className="rowbtn" style={{ width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{f.suc}</span>
            <span style={{ fontSize: 11.5, color: T.muted, marginLeft: 8 }}>{f.franq}</span>
          </div>
          {bloqueo && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: T.crit, padding: "3px 9px", borderRadius: 99 }}>Bloqueo 48 h</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {conceptos.map(([c]) => {
            const m = mov[`${f.id}|${mes}|${c}`];
            const est = cobEstado(c, mes, m);
            const col = COB_COLOR[est];
            return (
              <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: col, background: est === "pagado" ? T.okSoft : est === "vencido" ? T.badSoft : est === "pendiente" ? T.warnSoft : T.lineSoft, border: `1px solid ${col}`, borderRadius: 99, padding: "4px 9px" }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: col }} />
                {COB_LABEL[c]}
              </span>
            );
          })}
        </div>
      </button>

      {abierto && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}`, display: "grid", gap: 10 }}>
          {conceptos.map(([c]) => {
            const m = mov[`${f.id}|${mes}|${c}`];
            const est = cobEstado(c, mes, m);
            const monto = cobMonto(f, c, m);
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ width: 110, fontSize: 12, fontWeight: 600 }}>{COB_LABEL[c]}</span>
                {c === "regalias" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: T.muted }}>Venta $</span>
                    <input type="number" className="sel" style={{ ...sx.sel, width: 120, fontSize: 12 }} value={m && m.venta != null ? m.venta : ""} onChange={(e) => setVenta(f.id, e.target.value)} placeholder="captura venta" />
                    <span style={{ color: T.inkSoft }}>× {(f.pct * 100).toFixed(1)}% = <strong>{monto != null ? money(monto) : "—"}</strong></span>
                  </span>
                ) : c === "compras" ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: T.muted }}>Monto $</span>
                    <input type="number" className="sel" style={{ ...sx.sel, width: 120, fontSize: 12 }} value={m && m.monto != null ? m.monto : ""} onChange={(e) => setCompra(f.id, e.target.value)} placeholder="nota de almacén" />
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: T.inkSoft }}>{money(monto)} <span style={{ color: T.muted }}>(fijo)</span></span>
                )}
                <button className="actbtn" onClick={() => togglePago(f.id, c)}
                  style={{ ...sx.actbtn, marginLeft: "auto", fontSize: 11.5, padding: "6px 12px", background: est === "pagado" ? T.ok : T.ink }}>
                  {est === "pagado" ? "Pagado ✓ — quitar" : "Marcar pagado"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FranqPlaceholder({ sec }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ textAlign: "center", padding: "48px 20px", background: T.card, border: `1px solid ${T.line}`, borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "center", color: T.brand }}><Ico name={sec.iconName} size={44} strokeWidth={1.6} /></div>
        <h1 style={{ ...sx.h1, fontSize: 22, marginTop: 10 }}>{sec.nombre}</h1>
        <p style={{ fontSize: 13.5, color: T.inkSoft, maxWidth: 420, margin: "12px auto 0", lineHeight: 1.55 }}>
          Esta sección está contemplada en la descripción del puesto y se construirá a detalle más adelante, igual que hicimos con las renovaciones de contrato.
        </p>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 12 }}>{sec.desc}</p>
      </div>
    </div>
  );
}

/* ---------------- TABLERO ---------------- */
function Tablero({ m, porSucursal, onOpen, areaNombre }) {
  const unSitio = porSucursal.length === 1;
  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>{areaNombre || "Estado de la red"}</h1>
        <span style={{ fontSize: 12, color: T.muted }}>
          {unSitio ? `${m.total} equipos` : `${porSucursal.length} ubicaciones · ${m.total} equipos`}
        </span>
      </div>

      {/* tarjetas métricas */}
      <div style={sx.cards4}>
        <Metric
          big={`${m.disp}%`}
          label="Disponibilidad"
          sub={`${m.oper} de ${m.total} operativos`}
          accent={m.disp >= 90 ? T.ok : m.disp >= 75 ? T.warn : T.bad}
        />
        <Metric
          big={String(m.fuera)}
          label="Fuera de servicio"
          sub={m.criticosCaidos > 0 ? `${m.criticosCaidos} crítico${m.criticosCaidos > 1 ? "s" : ""}` : "ninguno crítico"}
          accent={T.bad}
          alert={m.criticosCaidos > 0}
        />
        <Metric big={String(m.degr)} label="Degradados" sub="operan con falla parcial" accent={T.warn} />
        <Metric
          big={String(m.abiertos.length)}
          label="Reportes abiertos"
          sub={`${m.critCount} crítico · ${m.altoCount} alto`}
          accent={T.brand}
        />
      </div>

      {/* disponibilidad por sucursal */}
      <div style={{ marginTop: 28 }}>
        <div style={sx.sectionTitle}>{unSitio ? "Ubicación" : "Disponibilidad por ubicación"}</div>
        <div style={sx.list}>
          {porSucursal.map((p) => (
            <button key={p.s} className="rowbtn" style={sx.sucRow} onClick={() => onOpen(p.s)}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <span style={sx.sucBadge}>{siglas(p.s)}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.s}</div>
                  <div style={{ fontSize: 11.5, color: T.muted }}>
                    {p.eq.length} equipos · {p.ab.length} reporte{p.ab.length === 1 ? "" : "s"} abierto{p.ab.length === 1 ? "" : "s"}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                {/* tira de estado — cada cuadro es un equipo (firma del tablero) */}
                <div style={sx.strip}>
                  {p.eq.map((e) => (
                    <span
                      key={e.id}
                      title={`${e.nombre} · ${estadoMeta[e.estado].label}`}
                      style={{ ...sx.tile, background: estadoMeta[e.estado].color }}
                    />
                  ))}
                </div>
                <div style={{ textAlign: "right", width: 52 }}>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 18, color: p.disp >= 90 ? T.ok : p.disp >= 75 ? T.warn : T.bad }}>
                    {p.disp}%
                  </div>
                </div>
                <span style={{ color: T.muted, fontSize: 18 }}>›</span>
              </div>
            </button>
          ))}
        </div>

        {/* leyenda */}
        <div style={sx.legend}>
          {Object.entries(estadoMeta).map(([k, v]) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: v.color, display: "inline-block" }} />
              {v.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ big, label, sub, accent, alert }) {
  return (
    <div style={{ ...sx.metric, borderTop: `3px solid ${accent}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 34, letterSpacing: "-0.02em" }}>{big}</span>
        {alert && <span className="pulse" style={{ width: 8, height: 8, borderRadius: 99, background: T.bad }} />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

/* ---------------- DETALLE DE SUCURSAL ---------------- */
function Detalle({ data, reportes, onBack, acciones, rol }) {
  const abiertos = reportes.filter((r) => r.ciclo < 4);
  return (
    <div>
      <button className="link" style={sx.back} onClick={onBack}>‹ Volver al tablero</button>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>{data.s}</h1>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 22, color: data.disp >= 90 ? T.ok : data.disp >= 75 ? T.warn : T.bad }}>
          {data.disp}% disponible
        </span>
      </div>

      <div style={sx.sectionTitle}>Equipos ({data.eq.length})</div>
      <div style={sx.eqGrid}>
        {data.eq.map((e) => {
          const rep = abiertos.find((r) => r.equipoId === e.id);
          return (
            <div key={e.id} style={{ ...sx.eqCard, borderLeft: `3px solid ${estadoMeta[e.estado].color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.nombre}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.muted, marginTop: 2 }}>{e.id}</div>
                </div>
                <Chip color={estadoMeta[e.estado].color} soft={estadoMeta[e.estado].soft} text={estadoMeta[e.estado].label} />
              </div>
              {rep && (
                <div style={{ fontSize: 11.5, color: T.inkSoft, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.lineSoft}` }}>
                  {rep.falla} · <span style={{ color: critMeta[rep.crit].color, fontWeight: 600 }}>{rep.crit}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ ...sx.sectionTitle, marginTop: 26 }}>Reportes abiertos ({abiertos.length})</div>
      {abiertos.length === 0 ? (
        <div style={sx.empty}>Sin reportes abiertos. Todos los equipos de esta sucursal están en orden.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {abiertos.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------- LISTA DE REPORTES ---------------- */
function Reportes({ reportes, acciones, rol }) {
  const [verCerrados, setVerCerrados] = useState(false);
  const [verSeguimiento, setVerSeguimiento] = useState(true);
  const byCrit = (a, b) => critRank(b.crit) - critRank(a.crit) || a.creado - b.creado;
  const cerrados = reportes.filter((r) => r.ciclo === 4);

  // Vista del auditor / gerente: confirmar y dar seguimiento, sin métricas
  if (rol === "sucursal") {
    const porConfirmar = reportes.filter((r) => r.ciclo === 3).sort(byCrit);
    const enSeguimiento = reportes.filter((r) => r.ciclo >= 0 && r.ciclo <= 2).sort(byCrit);
    return (
      <div>
        <div style={sx.h1row}>
          <h1 style={sx.h1}>Mis reportes</h1>
          <span style={{ fontSize: 12, color: T.muted }}>{porConfirmar.length} por confirmar</span>
        </div>

        <div style={sx.sectionTitle}>Listos para tu confirmación ({porConfirmar.length})</div>
        {porConfirmar.length === 0 ? (
          <div style={sx.empty}>Nada por confirmar ahora. Cuando mantenimiento marque un equipo como resuelto, aparecerá aquí para que confirmes si de verdad quedó.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {porConfirmar.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} mostrarSuc />)}
          </div>
        )}

        <div style={{ marginTop: 24 }}>
          <button className="link" style={{ ...sx.back, marginBottom: 12 }} onClick={() => setVerSeguimiento((v) => !v)}>
            {verSeguimiento ? "▾" : "▸"} En seguimiento ({enSeguimiento.length})
          </button>
          {verSeguimiento && (
            enSeguimiento.length === 0 ? (
              <div style={sx.empty}>No tienes reportes en proceso.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {enSeguimiento.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} mostrarSuc />)}
              </div>
            )
          )}
        </div>

        {cerrados.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <button className="link" style={{ ...sx.back, marginBottom: 12 }} onClick={() => setVerCerrados((v) => !v)}>
              {verCerrados ? "▾" : "▸"} Cerrados ({cerrados.length})
            </button>
            {verCerrados && (
              <div style={{ display: "grid", gap: 12 }}>
                {cerrados.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} mostrarSuc />)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Vista de mantenimiento: todos los abiertos
  const abiertos = reportes.filter((r) => r.ciclo < 4).sort(byCrit);
  return (
    <div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Reportes</h1>
        <span style={{ fontSize: 12, color: T.muted }}>{abiertos.length} abiertos · {cerrados.length} cerrados</span>
      </div>

      {abiertos.length === 0 ? (
        <div style={sx.empty}>No hay reportes abiertos.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {abiertos.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} mostrarSuc />)}
        </div>
      )}

      {cerrados.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <button className="link" style={{ ...sx.back, marginBottom: 12 }} onClick={() => setVerCerrados((v) => !v)}>
            {verCerrados ? "▾" : "▸"} Historial cerrado ({cerrados.length})
          </button>
          {verCerrados && (
            <div style={{ display: "grid", gap: 12 }}>
              {cerrados.map((r) => <ReporteCard key={r.folio} r={r} acciones={acciones} rol={rol} mostrarSuc />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function critRank(c) {
  return { "Crítico": 4, "Alto": 3, "Medio": 2, "Bajo": 1 }[c];
}

function ReporteCard({ r, acciones, rol, mostrarSuc }) {
  const [verLog, setVerLog] = useState(false);
  const [evi, setEvi] = useState("");
  const [costo, setCosto] = useState("");
  const cerrado = r.ciclo === 4;

  // qué rol debe mover el siguiente paso
  const nextRol = { 0: "mantenimiento", 1: "mantenimiento", 2: "mantenimiento", 3: "sucursal" }[r.ciclo];
  const puede = rol === nextRol;
  const espera = nextRol === "mantenimiento"
    ? "Esperando a Mantenimiento"
    : `Esperando a que ${r.por} confirme`;

  return (
    <div style={{ ...sx.repCard, opacity: cerrado ? 0.65 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }}>{r.folio}</span>
            <Chip color={critMeta[r.crit].color} soft="#fff" text={r.crit} outline />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>
              {mostrarSuc && <span style={{ color: T.muted, fontWeight: 500 }}>{r.sucursal} · </span>}
              {r.equipoNombre}
            </span>
          </div>
          <div style={{ fontSize: 13, color: T.inkSoft, marginTop: 6 }}>{r.falla}</div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>
            Reportó {r.por} · {antiguedad(r.creado)}
            {r.proveedor && <> · Proveedor: <span style={{ color: T.inkSoft }}>{r.proveedor}</span></>}
          </div>
        </div>
      </div>

      {/* ciclo de vida */}
      <div style={sx.stepper}>
        {CICLO.map((paso, i) => {
          const done = i < r.ciclo;
          const active = i === r.ciclo;
          return (
            <div key={paso} style={{ display: "flex", alignItems: "center", flex: i === CICLO.length - 1 ? "0 0 auto" : 1, minWidth: 0 }}>
              <span style={{
                width: 13, height: 13, borderRadius: 99,
                background: done ? T.brand : active ? "#fff" : T.lineSoft,
                border: active ? `3px solid ${T.brand}` : `1px solid ${done ? T.brand : T.line}`,
              }} />
              {i < CICLO.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < r.ciclo ? T.brand : T.line, margin: "0 4px" }} />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: 11, color: cerrado ? T.ok : T.brand, fontWeight: 600 }}>{CICLO[r.ciclo]}</span>
      </div>

      {/* evidencia del trabajo (visible una vez resuelto) */}
      {r.evidencia && (
        <div style={sx.eviBox}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", color: T.muted, fontWeight: 700 }}>Trabajo realizado</span>
            {r.costo != null && (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: r.costo === 0 ? T.ok : T.ink }}>
                {r.costo === 0 ? "Sin costo (proveedor)" : `Costo: ${money(r.costo)}`}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.inkSoft, marginTop: 3 }}>{r.evidencia}</div>
        </div>
      )}

      {/* zona de acción según rol y paso */}
      {!cerrado && (
        <div style={{ marginTop: 12 }}>
          {/* pasos de mantenimiento simples */}
          {(r.ciclo === 0 || r.ciclo === 1) && (
            puede ? (
              <button className="actbtn" style={{ ...sx.actbtn, background: T.ink }} onClick={() => (r.ciclo === 0 ? acciones.asignar(r.folio) : acciones.iniciar(r.folio))}>
                {r.ciclo === 0 ? "Asignar proveedor" : "Iniciar atención"}
              </button>
            ) : <span style={sx.espera}>{espera}</span>
          )}

          {/* marcar resuelto: exige evidencia y costo */}
          {r.ciclo === 2 && (
            puede ? (
              <div>
                <textarea
                  className="sel"
                  style={{ ...sx.sel, minHeight: 54, resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13 }}
                  placeholder="¿Qué se hizo? (obligatorio para cerrar el paso)"
                  value={evi}
                  onChange={(e) => setEvi(e.target.value)}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: T.muted }}>Costo $</span>
                  <input
                    className="sel" type="number" min="0" inputMode="numeric"
                    style={{ ...sx.sel, width: 130, fontSize: 13 }}
                    placeholder="0 si es garantía"
                    value={costo}
                    onChange={(e) => setCosto(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: T.muted, border: `1px dashed ${T.line}`, borderRadius: 8, padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 6 }}><Ico name="Camera" size={14} /> Adjuntar foto</span>
                  <button
                    className="actbtn"
                    disabled={!evi.trim() || costo === ""}
                    onClick={() => acciones.resolver(r.folio, evi.trim(), Number(costo) || 0)}
                    style={{ ...sx.actbtn, background: (evi.trim() && costo !== "") ? T.ink : T.line, color: (evi.trim() && costo !== "") ? "#fff" : T.muted, cursor: (evi.trim() && costo !== "") ? "pointer" : "not-allowed" }}
                  >
                    Marcar como resuelto
                  </button>
                </div>
              </div>
            ) : <span style={sx.espera}>{espera}</span>
          )}

          {/* confirmar o rechazar: solo la sucursal */}
          {r.ciclo === 3 && (
            puede ? (
              <div>
                <div style={sx.confirmNote}>Lo cierra quien reportó: <strong>{r.por}</strong>. Confirma solo si el equipo de verdad volvió a operar.</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="actbtn" style={{ ...sx.actbtn, background: T.ok }} onClick={() => acciones.confirmar(r.folio)}>Confirmar y cerrar</button>
                  <button className="actbtn" style={{ ...sx.actbtn, background: "#fff", color: T.bad, border: `1px solid ${T.bad}` }} onClick={() => acciones.rechazar(r.folio)}>No quedó</button>
                </div>
              </div>
            ) : <span style={sx.espera}>{espera}</span>
          )}
        </div>
      )}
      {cerrado && <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>Confirmado por {r.por}</div>}

      {/* bitácora */}
      <button className="link" style={{ ...sx.back, marginTop: 12, marginBottom: 0, fontSize: 11.5 }} onClick={() => setVerLog((v) => !v)}>
        {verLog ? "▾" : "▸"} Bitácora ({(r.log || []).length})
      </button>
      {verLog && (
        <div style={{ marginTop: 8, borderLeft: `2px solid ${T.line}`, paddingLeft: 12, display: "grid", gap: 8 }}>
          {(r.log || []).map((l, i) => (
            <div key={i} style={{ fontSize: 11.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{l.estado}</span>
                <span style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>{fmtTs(l.ts)}</span>
              </div>
              <div style={{ color: T.muted }}>{l.actor}{l.detalle ? ` · ${l.detalle}` : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- INFORMES (semanal / mensual) ---------------- */
function getCerrado(r) {
  const c = (r.log || []).find((l) => l.estado === "Cerrado");
  return c ? new Date(c.ts) : null;
}
function fmtDia(d) {
  return new Date(d).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
function durTxt(h) {
  return h >= 24 ? `${(h / 24).toFixed(1)} d` : `${Math.round(h)} h`;
}
function money(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString("es-MX");
}

function Informes({ reportes, areaNombre }) {
  const [periodo, setPeriodo] = useState("semanal");
  const dias = periodo === "semanal" ? 7 : 30;
  const desde = new Date(Date.now() - dias * 86400000);
  const hoy = new Date();

  const levantados = reportes.filter((r) => new Date(r.creado) >= desde);
  const cerradosPeriodo = reportes.filter((r) => { const c = getCerrado(r); return c && c >= desde; });
  const abiertosHoy = reportes.filter((r) => r.ciclo < 4);

  const tiempos = cerradosPeriodo.map((r) => (getCerrado(r) - new Date(r.creado)) / 3600000);
  const promHrs = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;

  const porCrit = ["Crítico", "Alto", "Medio", "Bajo"].map((c) => ({ c, n: levantados.filter((r) => r.crit === c).length }));
  const maxCrit = Math.max(1, ...porCrit.map((x) => x.n));

  const cuenta = (key) => {
    const map = {};
    levantados.forEach((r) => { map[r[key]] = (map[r[key]] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const topEquipos = cuenta("tipo");
  const topSuc = cuenta("sucursal");

  const provMap = {};
  cerradosPeriodo.forEach((r) => {
    const p = r.proveedor || "—";
    if (!provMap[p]) provMap[p] = { n: 0, hrs: 0 };
    provMap[p].n += 1;
    provMap[p].hrs += (getCerrado(r) - new Date(r.creado)) / 3600000;
  });
  const provRows = Object.entries(provMap).map(([p, v]) => ({ p, n: v.n, prom: v.hrs / v.n })).sort((a, b) => b.n - a.n);

  // gasto de mantenimiento (reportes cerrados en el periodo)
  const gastoTotal = cerradosPeriodo.reduce((a, r) => a + (r.costo || 0), 0);
  const sumaPor = (key) => {
    const map = {};
    cerradosPeriodo.forEach((r) => { map[r[key]] = (map[r[key]] || 0) + (r.costo || 0); });
    return Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  const gastoSuc = sumaPor("sucursal");
  const gastoEquipo = sumaPor("tipo");

  return (
    <div id="informe">
      <PrintHeader titulo={`Informe ${periodo === "semanal" ? "Semanal" : "Mensual"}`} />
      <div className="noprint" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 30, width: "auto" }} />
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>Mantenimiento · {areaNombre || "Sucursales"}</span>
      </div>
      <div style={sx.h1row}>
        <h1 style={sx.h1}>Informe {periodo}</h1>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }} className="noprint">
          {[["semanal", "Semanal"], ["mensual", "Mensual"]].map(([k, label]) => (
            <button key={k} className="roletab" onClick={() => setPeriodo(k)}
              style={{ ...sx.roletab, background: periodo === k ? T.brand : "#fff", color: periodo === k ? "#fff" : T.inkSoft, borderColor: periodo === k ? T.brand : T.line }}>
              {label}
            </button>
          ))}
          <button className="actbtn" style={{ ...sx.actbtn, background: T.ink }} onClick={() => imprimirConTitulo(`Informe ${periodo === "semanal" ? "Semanal" : "Mensual"}`)}>Imprimir / PDF</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: -8, marginBottom: 20 }}>
        Periodo del {fmtDia(desde)} al {fmtDia(hoy)} · generado el {fmtDia(hoy)}
      </div>

      <div style={sx.cards4}>
        <Metric big={String(levantados.length)} label="Reportes levantados" sub="en el periodo" accent={T.brand} />
        <Metric big={String(cerradosPeriodo.length)} label="Resueltos y cerrados" sub="en el periodo" accent={T.ok} />
        <Metric big={tiempos.length ? durTxt(promHrs) : "—"} label="Tiempo promedio" sub="de resolución" accent={T.warn} />
        <Metric big={money(gastoTotal)} label="Gasto del periodo" sub="reparaciones cerradas" accent={T.ink} />
        <Metric big={String(abiertosHoy.length)} label="Abiertos hoy" sub="pendientes al corte" accent={abiertosHoy.length ? T.bad : T.ok} />
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Reportes por criticidad</div>
        <div style={{ display: "grid", gap: 8 }}>
          {porCrit.map((x) => (
            <div key={x.c} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 64, fontSize: 12.5, fontWeight: 600, color: critMeta[x.c].color }}>{x.c}</span>
              <div style={{ flex: 1, background: T.lineSoft, borderRadius: 6, height: 20, overflow: "hidden" }}>
                <div style={{ width: `${(x.n / maxCrit) * 100}%`, height: "100%", background: critMeta[x.c].color, opacity: 0.85 }} />
              </div>
              <span style={{ width: 24, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{x.n}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 22, marginTop: 26 }}>
        <div>
          <div style={sx.sectionTitle}>Equipos que más fallaron</div>
          <ListaTop rows={topEquipos} vacio="Sin reportes en el periodo" />
        </div>
        <div>
          <div style={sx.sectionTitle}>Sucursales con más reportes</div>
          <ListaTop rows={topSuc} vacio="Sin reportes en el periodo" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 22, marginTop: 26 }}>
        <div>
          <div style={sx.sectionTitle}>Gasto por ubicación</div>
          <ListaTop rows={gastoSuc} vacio="Sin gasto registrado en el periodo" fmt={money} />
        </div>
        <div>
          <div style={sx.sectionTitle}>Gasto por equipo</div>
          <ListaTop rows={gastoEquipo} vacio="Sin gasto registrado en el periodo" fmt={money} />
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={sx.sectionTitle}>Desempeño por proveedor (cerrados en el periodo)</div>
        {provRows.length === 0 ? (
          <div style={sx.empty}>No se cerraron reportes en este periodo.</div>
        ) : (
          <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
            {provRows.map((row, i) => (
              <div key={row.p} style={{ display: "flex", justifyContent: "space-between", padding: "11px 16px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{row.p}</span>
                <span style={{ fontSize: 12.5, color: T.muted }}>{row.n} cerrado{row.n === 1 ? "" : "s"} · {durTxt(row.prom)} prom.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: T.muted, marginTop: 24, fontStyle: "italic" }} className="noprint">
        En la plataforma real este informe se podría programar para llegar solo por correo cada semana o mes y exportarse a Excel o PDF.
      </div>
    </div>
  );
}

function ListaTop({ rows, vacio, fmt }) {
  if (!rows.length) return <div style={sx.empty}>{vacio}</div>;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const show = fmt || String;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {rows.map(([name, n]) => (
        <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ flex: 1, fontSize: 12.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
          <div style={{ width: 90, background: T.lineSoft, borderRadius: 6, height: 16, overflow: "hidden" }}>
            <div style={{ width: `${(n / max) * 100}%`, height: "100%", background: T.brand, borderRadius: 6, opacity: 0.85 }} />
          </div>
          <span style={{ minWidth: 44, textAlign: "right", fontSize: 12, fontWeight: 600 }}>{show(n)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- FORMULARIO ---------------- */
function Formulario({ equipos, onSubmit }) {
  const activeAreas = AREAS.filter((a) => a.activa);
  const [area, setArea] = useState("");
  const [site, setSite] = useState("");
  const [equipoId, setEquipoId] = useState("");
  const [falla, setFalla] = useState("");
  const [por, setPor] = useState("");
  const [nota, setNota] = useState("");

  const cfg = area ? AREA_DATA[area] : null;
  const multi = cfg ? cfg.multi : false;
  const siteReal = cfg ? (multi ? site : cfg.sites[0]) : "";
  const equiposDisp = useMemo(
    () => equipos.filter((e) => e.area === area && (!multi || e.sucursal === site)),
    [equipos, area, site, multi]
  );
  const equipo = equipos.find((e) => e.id === equipoId);
  const fallasDisp = equipo && cfg ? cfg.fallas[equipo.tipo] : [];
  const fallaMeta = fallasDisp.find((x) => x.f === falla);

  const sitioListo = multi ? !!site : !!area;
  const listo = area && sitioListo && equipoId && falla && por.trim();

  const resetDesdeArea = () => { setSite(""); setEquipoId(""); setFalla(""); };

  let step = 1;
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={sx.h1row}><h1 style={sx.h1}>Reportar falla</h1></div>
      <p style={{ fontSize: 13, color: T.muted, marginTop: -6, marginBottom: 22 }}>
        Elige el área, el equipo y la falla de la lista. La criticidad se asigna sola según la falla y el reporte entra al instante.
      </p>

      <Field label="Área" step={String(step++)}>
        <select className="sel" style={sx.sel} value={area} onChange={(e) => { setArea(e.target.value); resetDesdeArea(); }}>
          <option value="">Selecciona el área…</option>
          {activeAreas.map((a) => <option key={a.key} value={a.key}>{a.nombre}</option>)}
        </select>
      </Field>

      {multi && (
        <Field label="Ubicación" step={String(step++)} off={!area}>
          <select className="sel" style={sx.sel} value={site} disabled={!area} onChange={(e) => { setSite(e.target.value); setEquipoId(""); setFalla(""); }}>
            <option value="">{area ? "Selecciona la sucursal…" : "Primero elige área"}</option>
            {cfg && cfg.sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      )}

      <Field label="Equipo" step={String(step++)} off={!sitioListo}>
        <select className="sel" style={sx.sel} value={equipoId} disabled={!sitioListo} onChange={(e) => { setEquipoId(e.target.value); setFalla(""); }}>
          <option value="">{sitioListo ? "Selecciona el equipo…" : "Primero elige " + (multi ? "ubicación" : "área")}</option>
          {equiposDisp.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {e.id}</option>)}
        </select>
      </Field>

      <Field label="Falla detectada" step={String(step++)} off={!equipoId}>
        <select className="sel" style={sx.sel} value={falla} disabled={!equipoId} onChange={(e) => setFalla(e.target.value)}>
          <option value="">{equipoId ? "¿Qué está pasando?" : "Primero elige equipo"}</option>
          {fallasDisp.map((x) => <option key={x.f} value={x.f}>{x.f}</option>)}
        </select>
      </Field>

      {/* criticidad automática */}
      {fallaMeta && (
        <div style={sx.critBox}>
          <div>
            <div style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Criticidad asignada</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 20, color: critMeta[fallaMeta.crit].color }}>{fallaMeta.crit}</span>
              <span style={{ fontSize: 12, color: T.muted }}>→ el equipo quedará como <strong style={{ color: estadoMeta[fallaMeta.estado].color }}>{estadoMeta[fallaMeta.estado].label}</strong></span>
            </div>
          </div>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: critMeta[fallaMeta.crit].color, flexShrink: 0 }} />
        </div>
      )}

      <Field label="¿Quién reporta?" step={String(step++)}>
        <input className="sel" style={sx.sel} value={por} onChange={(e) => setPor(e.target.value)} placeholder="Nombre y rol (ej. Laura M. · Encargada)" />
      </Field>

      <Field label="Detalle (opcional)">
        <textarea className="sel" style={{ ...sx.sel, minHeight: 64, resize: "vertical", fontFamily: "'Plus Jakarta Sans', sans-serif" }} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Describe lo que observas…" />
      </Field>

      <div style={{ ...sx.photo, display: "flex", alignItems: "center", gap: 8 }}><Ico name="Camera" size={16} /> Adjuntar foto <span style={{ color: T.muted, fontWeight: 400 }}>(opcional — ayuda a llevar la refacción correcta)</span></div>

      <button
        className="actbtn"
        disabled={!listo}
        onClick={() => { if (equipo) onSubmit({ area, site: siteReal, equipoId, tipo: equipo.tipo, falla, por, nota }); }}
        style={{ ...sx.submit, background: listo ? T.brand : T.line, color: listo ? "#fff" : T.muted, cursor: listo ? "pointer" : "not-allowed" }}
      >
        Enviar reporte
      </button>
    </div>
  );
}

function Field({ label, step, off, children }) {
  return (
    <div style={{ marginBottom: 16, opacity: off ? 0.5 : 1, transition: "opacity .2s" }}>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        {step && <span style={sx.stepNum}>{step}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function Chip({ color, soft, text, outline }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
      color: outline ? color : color, background: outline ? "transparent" : soft,
      border: outline ? `1px solid ${color}` : "none", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

/* ---------------- estilos ---------------- */
const sx = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", background: T.card, borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, zIndex: 10 },
  mark: { width: 34, height: 34, borderRadius: 9, background: T.brand, color: "#fff", display: "grid", placeItems: "center", fontSize: 17 },
  navbtn: { border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" },
  badge: { fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 99, display: "grid", placeItems: "center", padding: "0 4px" },
  main: { maxWidth: 1400, margin: "0 auto", padding: "28px 36px 64px", width: "100%", boxSizing: "border-box" },
  h1row: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, flexWrap: "wrap", gap: 8 },
  h1: { fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 },
  cards4: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 },
  metric: { background: T.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${T.line}` },
  sectionTitle: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, marginBottom: 12 },
  list: { display: "grid", gap: 8 },
  sucRow: { display: "flex", justifyContent: "space-between", alignItems: "center", background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit" },
  sucBadge: { width: 38, height: 38, borderRadius: 9, background: T.ink, color: "#fff", display: "grid", placeItems: "center", fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 600, fontSize: 12, flexShrink: 0 },
  strip: { display: "flex", gap: 3, flexWrap: "wrap", maxWidth: 220, justifyContent: "flex-end" },
  tile: { width: 13, height: 13, borderRadius: 3, display: "inline-block" },
  legend: { display: "flex", gap: 18, marginTop: 14, fontSize: 11.5, color: T.muted },
  eqGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 },
  eqCard: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px" },
  back: { background: "none", border: "none", color: T.brand, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 10, fontFamily: "inherit" },
  empty: { background: T.card, border: `1px dashed ${T.line}`, borderRadius: 12, padding: "20px", fontSize: 13, color: T.muted, textAlign: "center" },
  repCard: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 18px" },
  stepper: { display: "flex", alignItems: "center", marginTop: 14, marginBottom: 2 },
  actbtn: { border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" },
  confirmNote: { marginTop: 10, fontSize: 11.5, color: T.brandDark, background: T.brandSoft, padding: "8px 10px", borderRadius: 8 },
  rolebar: { display: "flex", alignItems: "center", gap: 8, padding: "10px 28px", background: T.lineSoft, borderBottom: `1px solid ${T.line}`, flexWrap: "wrap" },
  roletab: { border: `1px solid ${T.line}`, borderRadius: 99, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  espera: { display: "inline-block", fontSize: 12, color: T.muted, background: T.lineSoft, padding: "7px 12px", borderRadius: 8, fontStyle: "italic" },
  eviBox: { marginTop: 10, background: T.okSoft, border: `1px solid ${T.ok}33`, borderRadius: 8, padding: "9px 11px" },
  areaCard: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "18px 18px", width: "100%", fontFamily: "inherit", display: "block" },
  sidebar: { width: 210, flexShrink: 0, background: T.ink, color: "#fff", padding: "20px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, alignSelf: "flex-start", height: "100vh", overflowY: "auto", boxSizing: "border-box" },
  deptoItem: { display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%" },
  proxTag: { fontSize: 8.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.2)", borderRadius: 99, padding: "2px 6px" },
  hero: { background: T.ink, borderRadius: 18, padding: "40px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" },
  deptoCard: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "20px 16px", textAlign: "center", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center" },
  sel: { width: "100%", padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, background: T.card, color: T.ink, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  stepNum: { width: 18, height: 18, borderRadius: 99, background: T.ink, color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center" },
  critBox: { display: "flex", justifyContent: "space-between", alignItems: "center", background: T.lineSoft, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16 },
  photo: { fontSize: 13, fontWeight: 600, color: T.inkSoft, border: `1px dashed ${T.line}`, borderRadius: 9, padding: "12px 14px", marginBottom: 18, cursor: "pointer" },
  submit: { width: "100%", border: "none", padding: "13px", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "inherit" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: T.ink, color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: "0 8px 30px rgba(0,0,0,.25)", zIndex: 50 },
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
* { box-sizing: border-box; }
.navbtn:hover { background: ${T.lineSoft} !important; }
.navbtn:hover[style*="${T.ink}"] { }
.rowbtn:hover { border-color: ${T.brand} !important; box-shadow: 0 2px 12px rgba(15,110,102,.08); transition: all .15s; }
.actbtn:hover { opacity: .88; }
.link:hover { text-decoration: underline; }
.sel:focus { border-color: ${T.brand} !important; box-shadow: 0 0 0 3px ${T.brandSoft}; }
.pulse { animation: pulse 1.4s infinite; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
.toast { animation: rise .3s ease; }
@keyframes rise { from { transform: translate(-50%, 12px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
.deptobtn:hover { filter: brightness(1.18); }
@keyframes celebraBig {
  0% { transform: translate(-50%, -50%) scale(.2) rotate(-8deg); opacity: 0; }
  9% { transform: translate(-50%, -54%) scale(1.12) rotate(4deg); opacity: 1; }
  15% { transform: translate(-50%, -50%) scale(1) rotate(0deg); }
  90% { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
  100% { transform: translate(-50%, -60%) scale(.8) rotate(0deg); opacity: 0; }
}
.celebra-big { animation: celebraBig 4.2s cubic-bezier(.34,1.56,.64,1) forwards; }
@keyframes fadeBg { 0% { opacity: 0; } 8% { opacity: 1; } 90% { opacity: 1; } 100% { opacity: 0; } }
.celebra-bg { animation: fadeBg 4.2s ease forwards; }
@keyframes confettiFall {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(110vh) rotate(720deg); opacity: 1; }
}
@keyframes sparkle { 0%,100% { transform: scale(0); opacity: 0; } 40% { transform: scale(1); opacity: 1; } }
.spark { animation: sparkle 1.2s ease infinite; }
/* mascota: toma aire (se echa atras y se comprime) y sopla (se estira al frente), 3 veces */
@keyframes mascBlow {
  0%, 16% { transform: scale(1,1) rotate(0deg); }
  22% { transform: scale(.95,1.05) rotate(-4deg); }
  30% { transform: scale(1.07,.95) rotate(5deg); }
  38% { transform: scale(1,1) rotate(0deg); }
  46% { transform: scale(.96,1.04) rotate(-3deg); }
  52% { transform: scale(1.06,.96) rotate(4deg); }
  60% { transform: scale(1,1) rotate(0deg); }
  68% { transform: scale(.97,1.03) rotate(-2deg); }
  74% { transform: scale(1.05,.97) rotate(3deg); }
  82%, 100% { transform: scale(1,1) rotate(0deg); }
}
.masc-blow { animation: mascBlow 4.2s ease forwards; transform-origin: bottom center; }
/* cornetita: se desenrolla en cada soplido */
@keyframes hornBlow {
  0%, 24% { width: 0px; }
  30% { width: 118px; }
  40% { width: 14px; }
  50% { width: 2px; }
  53% { width: 116px; }
  63% { width: 14px; }
  71% { width: 2px; }
  75% { width: 112px; }
  84% { width: 12px; }
  90%, 100% { width: 0px; }
}
.horn-paper { animation: hornBlow 4.2s ease forwards; }
@keyframes tootShake { 0%,100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
.toot { animation: tootShake .5s ease 3; transform-origin: bottom left; }
@keyframes celebra {
  0% { transform: translate(-50%, 40px) scale(.4); opacity: 0; }
  20% { transform: translate(-50%, -10px) scale(1.1); opacity: 1; }
  35% { transform: translate(-50%, 0) scale(1); }
  50% { transform: translate(-50%, -14px) scale(1.04); }
  65% { transform: translate(-50%, 0) scale(1); }
  85% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -20px) scale(.9); opacity: 0; }
}
.celebra-wrap { animation: celebra 1.5s cubic-bezier(.34,1.56,.64,1) forwards; }
@keyframes sparkle { 0%,100% { transform: scale(0); opacity: 0; } 40% { transform: scale(1); opacity: 1; } }
.spark { animation: sparkle 1.2s ease infinite; }
@media (max-width: 560px) {
  header { padding: 12px 16px !important; }
  main { padding: 20px 16px 48px !important; }
}
@media (max-width: 820px) {
  .calwrap { grid-template-columns: 1fr !important; }
}
@media print {
  .noprint { display: none !important; }
  main { padding: 0 !important; }
}
.print-header { display: none; }
@media print {
  .print-header {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    margin: 0 0 18px;
  }
  .print-header img { height: 44px; width: auto; }
  .print-header-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
}
`;
