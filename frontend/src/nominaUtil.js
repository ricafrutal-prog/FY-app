// Nóminas — semana de viernes a jueves y cálculo del sueldo.
//
// Un documento por semana (colección "nominas_semanas"):
//   { id: "nomsem-AAAA-MM-DD" (viernes), semana, finalizado, filas: [{ nombre, sucursal, puesto, tipo,
//     sueldoSemanal, bonoFijo, horasDia, horas: [7 textos], conceptos: { clave: texto } }], creadoPor, creadoEn }
//
// Cálculo (pago por hora):
//   horas trabajadas = suma de los 7 días (viernes … jueves)
//   descanso pagado  = horas trabajadas ÷ 6
//   valor de la hora = sueldo semanal ÷ (7 × horas de su jornada)   → con la semana completa paga justo el sueldo semanal
//   sueldo base      = (horas + descanso) × valor de la hora
//   sueldo final     = sueldo base + bono fijo + percepciones − deducciones
import { sumarDias, diaDeSemana, fechaLocalISO, horasEsperadas } from "./asistenciaUtil";
import { tesNum } from "./tesoreriaUtil";

export const DIAS_NOMINA = ["Viernes", "Sábado", "Domingo", "Lunes", "Martes", "Miércoles", "Jueves"];
// Personal que no es de sucursal se da de alta en un área: Oficina, Almacén o Producción. Se guarda en
// la misma lista de empleados, con el nombre del área en lugar de la sucursal. ("Fuera de sucursal" es
// el nombre que se usó antes; se sigue reconociendo para quien ya se dio de alta así.)
export const SUCURSAL_FUERA = "Fuera de sucursal";
export const AREAS_PERSONAL = [
  { tipo: "oficina", nombre: "Oficina", icono: "Briefcase", desc: "Personal administrativo y de oficina." },
  { tipo: "almacen", nombre: "Almacén", icono: "Warehouse", desc: "Personal de almacén y distribución." },
  { tipo: "produccion", nombre: "Producción", icono: "Factory", desc: "Personal de producción." },
];
export const esAreaFuera = (s) => s === SUCURSAL_FUERA || AREAS_PERSONAL.some((a) => a.nombre === s);
// Orden de los grupos en Nóminas: primero las sucursales, luego Oficina, Almacén, Producción.
export const ordenGrupo = (s) => (esAreaFuera(s) ? 100 + Math.max(0, AREAS_PERSONAL.findIndex((a) => a.nombre === s)) + (s === SUCURSAL_FUERA ? 50 : 0) : 0);
// Horas de jornada = horas entre la entrada y la salida menos 1 hora de descanso (comida).
export const DESCANSO_JORNADA_H = 1;
export const jornadaNeta = (horario) => (horario ? Math.max(0, horasEsperadas(horario) - DESCANSO_JORNADA_H) : 0);
export const HORAS_DIA_DEFECTO = 8; // si el empleado no tiene horario, se asume una jornada de 8 horas

// Días de la semana que trabaja cada persona (se marcan en Alta de personal, de lunes a domingo).
// Se guardan como números de getDay(): 0 = domingo … 6 = sábado. Sin marcar = lunes a sábado.
export const DIAS_SEMANA_LMD = [{ n: 1, corto: "Lun" }, { n: 2, corto: "Mar" }, { n: 3, corto: "Mié" }, { n: 4, corto: "Jue" }, { n: 5, corto: "Vie" }, { n: 6, corto: "Sáb" }, { n: 0, corto: "Dom" }];
export const DIAS_LABORALES_DEFECTO = [1, 2, 3, 4, 5, 6];
export const DIAS_GETDAY_NOMINA = [5, 6, 0, 1, 2, 3, 4]; // Vie, Sáb, Dom, Lun, Mar, Mié, Jue
export const diasLaborales = (e) => (Array.isArray(e?.diasLaborales) && e.diasLaborales.length ? e.diasLaborales : DIAS_LABORALES_DEFECTO);
export const textoDias = (dias) => DIAS_SEMANA_LMD.filter((d) => (dias || []).includes(d.n)).map((d) => d.corto).join(" ");

// Conceptos que se capturan en el "+" de cada empleado. tipo: "suma" (percepción) o "resta" (deducción).
export const CONCEPTOS_NOMINA = [
  { key: "productividad", nombre: "Productividad", tipo: "suma" },
  { key: "asistenciaPuntualidad", nombre: "Asistencia y puntualidad", tipo: "suma" },
  { key: "incentivo", nombre: "Incentivo", tipo: "suma" },
  { key: "apoyoExtras", nombre: "Apoyo actividades extras", tipo: "suma" },
  { key: "incapacidad", nombre: "Incapacidad", tipo: "suma" },
  { key: "vacaciones", nombre: "Vacaciones", tipo: "suma" },
  { key: "primaVacacional", nombre: "Prima vacacional", tipo: "suma" },
  { key: "abonoPrestamo", nombre: "Abono a préstamo", tipo: "resta" },
  { key: "adelantoSueldo", nombre: "Adelanto de sueldo", tipo: "resta" },
  { key: "descuentos", nombre: "Descuentos", tipo: "resta" },
  { key: "abonoUniforme", nombre: "Abono uniforme", tipo: "resta" },
  { key: "apoyoFunerarios", nombre: "Apoyo funerarios", tipo: "suma" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MESES_CORTOS[m - 1]}`; };

// Viernes que abre la semana a la que pertenece una fecha.
export function viernesDe(iso) {
  const atras = (diaDeSemana(iso) - 5 + 7) % 7; // diaDeSemana: 0 = domingo … 5 = viernes
  return sumarDias(iso, -atras);
}
export const juevesDe = (viernes) => sumarDias(viernes, 6);
export const etiquetaSemana = (viernes) => `Vie ${corta(viernes)} – Jue ${corta(juevesDe(viernes))} ${juevesDe(viernes).slice(0, 4)}`;
export const idSemana = (viernes) => `nomsem-${viernes}`;

// Las últimas n semanas (la actual primero).
export function semanasRecientes(n = 12) {
  const actual = viernesDe(fechaLocalISO());
  return Array.from({ length: n }, (_, i) => sumarDias(actual, -7 * i));
}
// Semana más reciente que ya terminó (su jueves ya pasó).
export const ultimaSemanaCompleta = () => sumarDias(viernesDe(fechaLocalISO()), -7);

const redondear = (n) => Math.round(n * 100) / 100;
const horaNum = (v) => Math.min(24, tesNum(v));

export function calcularFila(f) {
  const horas = (f.horas || []).map(horaNum);
  const trabajadas = redondear(horas.reduce((s, h) => s + h, 0));
  const descanso = redondear(trabajadas / 6); // suma de horas ÷ 6: cada falta baja el descanso
  const hd = Number(f.horasDia) > 0 ? Number(f.horasDia) : HORAS_DIA_DEFECTO;
  const sueldo = tesNum(f.sueldoSemanal);
  const valorHora = sueldo / (7 * hd);
  const base = redondear((trabajadas + descanso) * valorHora);
  const bono = tesNum(f.bonoFijo);
  const c = f.conceptos || {};
  const percepciones = redondear(CONCEPTOS_NOMINA.filter((x) => x.tipo === "suma").reduce((s, x) => s + tesNum(c[x.key]), 0));
  const deducciones = redondear(CONCEPTOS_NOMINA.filter((x) => x.tipo === "resta").reduce((s, x) => s + tesNum(c[x.key]), 0));
  return { trabajadas, descanso, valorHora, base, bono, percepciones, deducciones, final: redondear(base + bono + percepciones - deducciones) };
}

export const filaDeEmpleado = (e, horasEsperadasDia) => ({
  nombre: e.nombre, sucursal: e.sucursal, puesto: e.puesto || "", tipo: esAreaFuera(e.sucursal) ? "fuera" : "sucursal",
  sueldoSemanal: tesNum(e.sueldoSemanal), bonoFijo: tesNum(e.bonoFijo), horasDia: horasEsperadasDia > 0 ? horasEsperadasDia : HORAS_DIA_DEFECTO,
  sinHorario: !(horasEsperadasDia > 0),
  diasLab: DIAS_GETDAY_NOMINA.map((g) => diasLaborales(e).includes(g)),
  horas: ["", "", "", "", "", "", ""], conceptos: {},
});
// "Autocompletar": jornada completa en cada día que la persona trabaja (marcados en Alta de personal).
export const autocompletarHoras = (f) => {
  const dl = f.diasLab || DIAS_GETDAY_NOMINA.map((g) => DIAS_LABORALES_DEFECTO.includes(g));
  const h = Number(f.horasDia) > 0 ? Number(f.horasDia) : HORAS_DIA_DEFECTO;
  return { ...f, horas: dl.map((on) => (on ? String(h) : "")) };
};
export const claveFila = (f) => `${f.sucursal}|${f.nombre}`;

export const totalNomina = (filas) => redondear(filas.reduce((s, f) => s + calcularFila(f).final, 0));
