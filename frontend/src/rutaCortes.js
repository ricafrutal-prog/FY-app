// Ruta semanal del chofer que recoge los cortes de las sucursales.
// Cada elemento: { nombre, alias: [otros nombres con que aparece en Cortes], dias: { "1": 4, "4": 3 } }
// donde la llave es el día de la semana (1 = lunes … 5 = viernes) y el número es
// cuántos cortes se esperan ese día. Se guarda en la lista "ruta_cortes" y la editan
// administrador_ricardo y jesus_segura desde el menú de Cuenta; esto es solo lo
// que trae de inicio (la ruta que se pasó el 20 de octubre de 2026).
export const DIAS_RUTA = [[1, "Lun"], [2, "Mar"], [3, "Mié"], [4, "Jue"], [5, "Vie"]];

const e = (nombre, dias, ...alias) => ({ nombre, alias, dias });
export const RUTA_POR_DEFECTO = [
  e("Parque Lineal", { 1: 4, 4: 3 }, "Escobedo Lineal"),
  e("Estación Sendero – Poniente", { 1: 4, 4: 3 }, "Estación Sendero 1", "Sendero Poniente"),
  e("Estación Sendero – Oriente", { 1: 4, 4: 3 }, "Estación Sendero 2", "Sendero Oriente"),
  e("Las Puentes", { 1: 4, 4: 3 }),
  e("Nueva República", { 1: 4, 4: 3 }, "República Mexicana"),
  e("Sendero Apodaca 02", { 2: 4, 5: 3 }, "S. Apodaca 2", "Apodaca 2", "Apodaca 02"),
  e("Sendero Apodaca 03", { 2: 4, 5: 3 }, "S. Apodaca 3", "Apodaca 3", "Apodaca 03"),
  e("Walmart San Sebastián", { 2: 4, 5: 3 }),
  e("Mitras", { 3: 7 }),
  e("La Estancia", { 3: 7 }, "Estancia"),
  e("Cadereyta", { 3: 7 }, "Soriana Cadereyta"),
  e("Pinos", { 3: 7 }),
  e("Estación San Nicolás", { 3: 7 }),
  e("Montes Berneses", { 4: 7 }, "Berneses"),
  e("San Miguel", { 5: 7 }),
];

export const rutaNorm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// ¿El nombre `n` (de Cortes o del catálogo) es esta sucursal de la ruta?
export const rutaCoincide = (item, n) => {
  const x = rutaNorm(n);
  return x === rutaNorm(item.nombre) || (item.alias || []).some((a) => rutaNorm(a) === x);
};

// Convierte la lista guardada en lo que usa Conciliación:
//   porDia: { 1: [{ nombre, alias, cortes }], … }   entradas: una por sucursal   visitas: { nombre: [días] }
export function construirRuta(lista) {
  const porDia = {}, visitas = {}, entradas = [];
  (Array.isArray(lista) ? lista : []).forEach((it) => {
    if (!it || !it.nombre || it.oculta) return;
    const dias = Object.keys(it.dias || {}).map(Number).filter((d) => d >= 1 && d <= 5).sort();
    if (!dias.length) return;
    entradas.push({ nombre: it.nombre, alias: it.alias || [] });
    visitas[it.nombre] = dias;
    dias.forEach((d) => { (porDia[d] = porDia[d] || []).push({ nombre: it.nombre, alias: it.alias || [], cortes: Number(it.dias[d]) || 1 }); });
  });
  return { porDia, visitas, entradas };
}
