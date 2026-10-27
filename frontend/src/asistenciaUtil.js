// Piezas compartidas entre el Registro de asistencia (Sucursales) y Nómina
// sucursales (Gestión). Un "día de asistencia" es un documento por sucursal y
// fecha: { id, sucursal, fecha, registros: [{ empleado, puesto, estatus, entrada, salida }] }.

export const ESTATUS = ["Asistió", "Retardo", "Falta", "Descanso", "Permiso", "Vacaciones"];
export const ESTATUS_CON_HORAS = new Set(["Asistió", "Retardo"]);

// Colores como en la hoja de Excel (verde = asistió, amarillo = retardo, rojo = falta…).
export const ESTATUS_COLOR = {
  "Asistió": { color: "#1E7B43", fondo: "#C9EBD3" },
  "Retardo": { color: "#8A5A00", fondo: "#FBE08A" },
  "Falta": { color: "#B3261E", fondo: "#F8C9C9" },
  "Descanso": { color: "#41414C", fondo: "#E6E3DB" },
  "Vacaciones": { color: "#1F5FA8", fondo: "#CFE2F7" },
  "Permiso": { color: "#6A2FA0", fondo: "#E6D7F5" },
  "Pendiente": { color: "#6B6B76", fondo: "#EEEDF0" },
};

export const idAsistencia = (sucursal, fecha) => `asist|${sucursal}|${fecha}`;

// Fecha local (no UTC) en formato AAAA-MM-DD.
export function fechaLocalISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function sumarDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return fechaLocalISO(new Date(y, m - 1, d + n));
}
export function diaDeSemana(iso) { // 0 = domingo … 5 = viernes
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}
export const NOMBRES_DIA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const fechaDDMMAAAA = (iso) => { const [y, m, d] = (iso || "").split("-"); return y ? `${d}/${m}/${y}` : ""; };

// Horas trabajadas entre dos horas "HH:MM". Si la salida es menor que la
// entrada se entiende que cruzó la medianoche. Regresa horas con 2 decimales.
export function horasEntre(entrada, salida) {
  if (!entrada || !salida) return 0;
  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = salida.split(":").map(Number);
  let min = h2 * 60 + m2 - (h1 * 60 + m1);
  if (min < 0) min += 24 * 60;
  return Math.round((min / 60) * 100) / 100;
}
export const horasDeRegistro = (r) => (ESTATUS_CON_HORAS.has(r.estatus) ? horasEntre(r.entrada, r.salida) : 0);
export const fmtHoras = (n) => (Number(n) || 0).toFixed(2);

// ---- Horario que le toca a cada persona (lo ponen RH/admin en Nómina) ----
// horario = { entrada: "HH:MM", salida: "HH:MM" } o null si no tiene.
export const TOLERANCIA_MIN = 10; // minutos de gracia antes de contar retardo
const aMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
export const horarioDe = (p) => (p && p.horaEntrada && p.horaSalida ? { entrada: p.horaEntrada, salida: p.horaSalida } : null);
export const horasEsperadas = (h) => (h ? horasEntre(h.entrada, h.salida) : 0);
// Minutos de retraso al llegar (negativo = llegó antes). Maneja cruce de medianoche.
export function minutosTarde(reg, h) {
  if (!h || !reg || !reg.entrada) return 0;
  let d = aMin(reg.entrada) - aMin(h.entrada);
  if (d > 720) d -= 1440; else if (d < -720) d += 1440;
  return d;
}
// Estatus real: si la sucursal puso "Asistió" pero llegó más tarde que el horario
// más la tolerancia, cuenta como Retardo.
export function estatusEfectivo(reg, h) {
  if (!reg) return "";
  if (reg.estatus === "Asistió" && h && minutosTarde(reg, h) > TOLERANCIA_MIN) return "Retardo";
  if (reg.estatus === "Asistió" && h && reg.salida) {
    let d = aMin(h.salida) - aMin(reg.salida);
    if (d > 720) d -= 1440; else if (d < -720) d += 1440;
    if (d > TOLERANCIA_MIN) return "Retardo"; // salió antes de su horario
  }
  return reg.estatus;
}
// Diferencia de horas contra lo esperado (negativa = trabajó menos). 0 si no aplica.
export function diferenciaHoras(reg, h) {
  if (!h || !reg || !ESTATUS_CON_HORAS.has(reg.estatus)) return 0;
  return Math.round((horasDeRegistro(reg) - horasEsperadas(h)) * 100) / 100;
}

// ---- Periodo de nómina ----
// Las semanas de sucursal van de viernes a jueves; la "Semana 1" de cada mes
// empieza en el primer viernes del mes (igual que la hoja de Excel). El resumen
// del mes cuenta desde ese viernes hasta el último día del mes.
export const UMBRAL_ALERTA = 3;   // faltas dentro de la ventana para marcar ALERTA
export const UMBRAL_BAJA = 4;     // faltas dentro de la ventana para marcar BAJA automática
export const VENTANA_ALERTA_DIAS = 30;

export const mesActual = () => fechaLocalISO().slice(0, 7);
export function finDeMes(ym) {
  const [y, m] = ym.split("-").map(Number);
  return fechaLocalISO(new Date(y, m, 0));
}
export function primerViernesDelMes(ym) {
  let f = `${ym}-01`;
  while (diaDeSemana(f) !== 5) f = sumarDias(f, 1);
  return f;
}
// Semanas del mes: [{ numero, dias: [7 fechas viernes→jueves] }]. Los días que
// caen después del fin de mes se marcan con `fuera` para no contarlos.
export function semanasDelMes(ym) {
  const fin = finDeMes(ym);
  const out = [];
  let ini = primerViernesDelMes(ym);
  let n = 1;
  while (ini <= fin) {
    out.push({ numero: n++, dias: Array.from({ length: 7 }, (_, i) => sumarDias(ini, i)) });
    ini = sumarDias(ini, 7);
  }
  return { semanas: out, inicio: primerViernesDelMes(ym), fin };
}

// Máximo de faltas dentro de cualquier ventana de VENTANA_ALERTA_DIAS días.
export function maxFaltasVentana(fechasFalta) {
  const f = [...fechasFalta].sort();
  let max = 0;
  for (let i = 0; i < f.length; i++) {
    const tope = sumarDias(f[i], VENTANA_ALERTA_DIAS - 1);
    let c = 0;
    for (let j = i; j < f.length && f[j] <= tope; j++) c++;
    if (c > max) max = c;
  }
  return max;
}

// Resumen de un empleado en un periodo, a partir de los documentos diarios.
// Los conteos (asistencias, faltas, horas…) son SOLO del periodo [inicio, fin];
// el estatus (ALERTA / BAJA) mira la ventana móvil de VENTANA_ALERTA_DIAS días
// sobre TODAS las faltas capturadas hasta `fin`, como en la hoja de Excel.
export function resumenEmpleado(docs, nombre, inicio, fin, horario = null) {
  const r = { pendientes: 0, horasFaltantes: 0, retardosAuto: 0, dias: 0, asistencias: 0, retardos: 0, faltas: 0, descansos: 0, permisos: 0, vacaciones: 0, horas: 0, maxFaltas: 0, faltasUltimos: 0 };
  const fechasFalta = [];
  docs.forEach((d) => {
    if (d.fecha > fin) return;
    const reg = d.registros.find((x) => x.empleado === nombre);
    if (!reg) return;
    if (reg.estatus === "Falta") fechasFalta.push(d.fecha);
    if (d.fecha < inicio) return;
    const est = estatusEfectivo(reg, horario);
    if (est === "Asistió") { r.asistencias++; r.dias++; }
    else if (est === "Pendiente") r.pendientes++;
    else if (est === "Retardo") { r.retardos++; r.dias++; if (reg.estatus === "Asistió") r.retardosAuto++; }
    else if (reg.estatus === "Falta") r.faltas++;
    else if (reg.estatus === "Descanso") r.descansos++;
    else if (reg.estatus === "Vacaciones") r.vacaciones++;
    else if (reg.estatus === "Permiso") r.permisos++;
    r.horas += horasDeRegistro(reg);
    const dif = diferenciaHoras(reg, horario);
    if (dif < 0) r.horasFaltantes += -dif;
  });
  r.horasFaltantes = Math.round(r.horasFaltantes * 100) / 100;
  r.horas = Math.round(r.horas * 100) / 100;
  r.maxFaltas = maxFaltasVentana(fechasFalta);
  // Faltas dentro de los últimos VENTANA_ALERTA_DIAS días que terminan en el cierre del periodo (o hoy, si aún no termina).
  const corte = fin < fechaLocalISO() ? fin : fechaLocalISO();
  const desde = sumarDias(corte, -(VENTANA_ALERTA_DIAS - 1));
  r.faltasUltimos = fechasFalta.filter((f) => f >= desde && f <= corte).length;
  r.baja = r.maxFaltas >= UMBRAL_BAJA;
  r.alerta = r.maxFaltas >= UMBRAL_ALERTA && r.maxFaltas < UMBRAL_BAJA;
  return r;
}

// Estatus que se muestra de una persona: ya dada de baja, BAJA por faltas
// (pendiente de confirmar), ALERTA o Activo.
export function estatusPersona(p, r) {
  if (p.fechaBaja) return "Baja";
  if (r.baja) return "BAJA";
  if (r.alerta) return "ALERTA";
  return "Activo";
}
export const MOTIVOS_BAJA = { faltas: "Faltas", renuncia: "Renuncia", otro: "Otro" };

// Rotación de personal de una sucursal en un mes (mes calendario completo).
//   Plantilla final   = personas vigentes al cierre del mes.
//   Plantilla inicial = final − altas del mes + bajas del mes.
//   Rotación %        = bajas totales ÷ promedio(plantilla inicial, plantilla final).
//   En alerta         = vigentes al cierre con 3 faltas en la ventana (sin llegar a la baja).
export function rotacionSucursal(personal, docs, ym) {
  const ini = `${ym}-01`, fin = finDeMes(ym);
  const out = { inicial: 0, altas: 0, bajasFaltas: 0, otras: 0, bajas: 0, final: 0, rotacion: 0, alertas: 0 };
  personal.filter((p) => p.activo).forEach((p) => {
    if (p.fechaAlta && p.fechaAlta >= ini && p.fechaAlta <= fin) out.altas++;
    if (p.fechaBaja && p.fechaBaja >= ini && p.fechaBaja <= fin) { if (p.motivoBaja === "faltas") out.bajasFaltas++; else out.otras++; }
    const vigente = (!p.fechaAlta || p.fechaAlta <= fin) && (!p.fechaBaja || p.fechaBaja > fin);
    if (vigente) { out.final++; if (resumenEmpleado(docs, p.nombre, ini, fin, horarioDe(p)).alerta) out.alertas++; }
  });
  out.bajas = out.bajasFaltas + out.otras;
  out.inicial = out.final - out.altas + out.bajas;
  const prom = (out.inicial + out.final) / 2;
  out.rotacion = prom ? (out.bajas / prom) * 100 : 0;
  return out;
}

// Personal de una sucursal: el que está dado de alta hoy + quien aparezca en
// capturas anteriores (por si lo quitaron de la lista pero tiene historial).
export function personalDeSucursal(empleados, docs, sucursal) {
  const mapa = new Map();
  empleados.filter((e) => e.sucursal === sucursal).forEach((e) => mapa.set(e.nombre, { nombre: e.nombre, puesto: e.puesto || "", activo: true, fechaAlta: e.fechaAlta || null, fechaBaja: e.fechaBaja || null, motivoBaja: e.motivoBaja || null, horaEntrada: e.horaEntrada || null, horaSalida: e.horaSalida || null }));
  [...docs].filter((d) => d.sucursal === sucursal).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach((d) => {
    d.registros.forEach((r) => { if (!mapa.has(r.empleado)) mapa.set(r.empleado, { nombre: r.empleado, puesto: r.puesto || "", activo: false }); });
  });
  return [...mapa.values()];
}

// Semanas (viernes→jueves) que cubren un rango de fechas; máximo `tope` semanas.
export function semanasEntre(desde, hasta, tope = 8) {
  let ini = desde;
  while (diaDeSemana(ini) !== 5) ini = sumarDias(ini, -1);
  const out = [];
  let n = 1;
  while (ini <= hasta && out.length < tope) {
    out.push({ numero: n++, dias: Array.from({ length: 7 }, (_, i) => sumarDias(ini, i)) });
    ini = sumarDias(ini, 7);
  }
  return { semanas: out, recortado: ini <= hasta };
}
