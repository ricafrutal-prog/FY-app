// Pantalla para el personal de sucursal — a propósito NO importa nada de
// App.jsx (ni su menú real, ni sus otros apartados). Visualmente imita el
// mismo estilo de la plataforma completa (la misma barra lateral oscura,
// los mismos colores, la misma tarjeta de usuario abajo a la derecha), pero
// aquí adentro solo existe "Cortes" — no hay acceso a nada más, ni siquiera
// visualmente. El backend además hace cumplir esto de verdad del lado del
// servidor (ver server.js / checkCollectionRole), así que aunque alguien
// abriera las herramientas del navegador no podría tocar nada ajeno.
import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Receipt, UserMinus, Smartphone, ChevronLeft, Boxes, Plus, Trash2, Download, ChevronDown, Printer, FileText, Sheet, Check, X } from "lucide-react";
import * as XLSX from "xlsx";
import { usePersistedCollection, usePersistedList, agregarValorLista } from "./hooks/persistence";
import { getSucursal, clearSession, cerrarSesionServidor } from "./auth";
import CuentaBarra from "./CuentaBarra.jsx";
import { limpiarPrefsLocal } from "./preferences";

const LOGO = "/assets/logo.png";

// Mismos colores que usa el resto de la plataforma (T en App.jsx) — se
// repiten aquí porque este archivo vive a propósito separado y no importa
// nada de ahí.
const T = {
  ink: "#16161B",
  muted: "#8C8C97",
  line: "#E6E3DB",
  lineSoft: "#F0EEE8",
  paper: "#F1F3F2",
  card: "#FFFFFF",
  brand: "#0F6E66",
  ok: "#2E9E5B",
  okSoft: "#E7F4EC",
  bad: "#D6453F",
};

const hoyISO = () => new Date().toISOString().slice(0, 10);
const money = (n) => `$${(Number(n) || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cant = (n) => (Number(n) || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });

// Las cuatro salidas que existen en el modelo de datos — mismos nombres que
// usa Inventarios (Gestión) para calcular el teórico del día.
const CAMPOS_SALIDA = [
  { clave: "mermas", etiqueta: "Mermas" },
  { clave: "transferencias", etiqueta: "Transferencias" },
  { clave: "cortesias", etiqueta: "Cortesías" },
  { clave: "otras", etiqueta: "Otras salidas" },
];
// Pero sucursal, al capturar, solo elige entre estas dos — transferencias y
// cortesías se quitaron de esta pantalla a pedido.
const CAMPOS_SALIDA_CAPTURA = CAMPOS_SALIDA.filter((c) => c.clave === "mermas" || c.clave === "otras");
const etiquetaUnidad = (u) => (u === "kg" ? "KG" : "PZA");
// CSS de impresión — App.jsx trae la suya propia (inyectada solo cuando
// <App/> está montado), pero aquí adentro solo vive <SucursalApp/>, así que
// hace falta su propia copia mínima para que "Imprimir" y el encabezado con
// el logo se vean bien.
const CSS_IMPRESION = `
@media print {
  .noprint { display: none !important; }
  body { padding: 0 !important; }
}
.print-header { display: none; }
@media print {
  .print-header { display: flex !important; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; margin: 0 0 18px; }
  .print-header img { height: 44px; width: auto; }
  .print-header-title { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 18px; letter-spacing: -0.01em; }
}
`;

function slugArchivo(titulo) {
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
  XLSX.writeFile(wb, `${slugArchivo(titulo)}.xlsx`);
}
// Igual que en Gestión: tabla de verdad (encabezado, bordes, filas) para que
// el PDF descargado se vea igual que lo que sale al usar "Imprimir".
function exportarPdfConTitulo(titulo, columnas, filas) {
  const cargarScript = (src) => new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el generador de PDF"));
    document.body.appendChild(s);
  });
  const autoTableListo = () => !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && typeof window.jspdf.jsPDF.API.autoTable === "function");
  const cargarJsPDF = () => (window.jspdf ? Promise.resolve() : cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"));
  const cargarAutoTable = () => (autoTableListo() ? Promise.resolve() : cargarScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"));
  return cargarJsPDF().then(cargarAutoTable).then(() => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const logoW = 26, logoH = logoW / 1.575;
    doc.addImage(LOGO, "PNG", (pageWidth - logoW) / 2, 12, logoW, logoH);
    doc.setFontSize(13);
    doc.setFont(undefined, "bold");
    doc.text(titulo, pageWidth / 2, 12 + logoH + 8, { align: "center" });
    doc.autoTable({
      startY: 12 + logoH + 14,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [30, 30, 35], lineColor: [230, 227, 221], lineWidth: 0.2 },
      headStyles: { fillColor: [241, 243, 242], textColor: [30, 30, 35], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 248] },
      head: [columnas.map((c) => c.titulo)],
      body: filas.map((f) => columnas.map((c) => String(c.valor(f)))),
    });
    doc.save(`${slugArchivo(titulo)}.pdf`);
  });
}
// Encabezado con logo, oculto en pantalla y visible solo al imprimir.
function PrintHeader({ titulo }) {
  return (
    <div className="print-header">
      <img src={LOGO} alt="Frutal Yogurt" />
      <div className="print-header-title">{titulo}</div>
    </div>
  );
}
// Mismo menú "Exportar" (Imprimir / PDF / Excel) que usa el resto de la
// plataforma.
function ExportMenu({ titulo, columnas, filas }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const imprimir = () => { setAbierto(false); imprimirConTitulo(titulo); };
  const excel = () => { setAbierto(false); exportarExcelConTitulo(titulo, columnas, filas); };
  const pdf = () => { setAbierto(false); exportarPdfConTitulo(titulo, columnas, filas).catch(() => alert("No se pudo generar el PDF — revisa tu conexión.")); };

  const opcion = { width: "100%", textAlign: "left", background: "none", border: "none", padding: "9px 14px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", color: T.ink };

  return (
    <div ref={ref} style={{ position: "relative" }} className="noprint">
      <button
        onClick={() => setAbierto((a) => !a)}
        style={{ border: `1px solid ${T.line}`, color: T.ink, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: "#fff", display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <Download size={14} color={T.ink} />Exportar<ChevronDown size={13} color={T.muted} />
      </button>
      {abierto && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden", zIndex: 50, minWidth: 160 }}>
          <button onClick={imprimir} style={opcion}><Printer size={14} color={T.ink} />Imprimir</button>
          <button onClick={pdf} style={opcion}><FileText size={14} color={T.ink} />PDF</button>
          <button onClick={excel} style={opcion}><Sheet size={14} color={T.ink} />Excel</button>
        </div>
      )}
    </div>
  );
}

// Un registro de "movimiento" (mermas/transferencias/cortesías/otras) solo
// trae UNA de las cuatro en 0 distinto — esto encuentra cuál es, para
// mostrarla en el historial.
function tipoDeMovimiento(c) {
  const campo = CAMPOS_SALIDA.find((x) => Number(c[x.clave]) > 0);
  return campo ? { etiqueta: campo.etiqueta, valor: c[campo.clave] } : null;
}

const campo = { padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
const etiqueta = { fontSize: 12, fontWeight: 600, color: T.ink, display: "block", marginBottom: 5 };
const boton = (bg, color) => ({ border: "none", padding: "11px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: bg, color });

// Apps de venta disponibles al capturar — selector de una sola opción.
const APPS_VENTA = ["Didi", "Uber Eats", "Rappi"];

// Campo de monto con el signo "$" fijo a la izquierda.
function CampoMonto({ value, onChange, style }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: T.muted, pointerEvents: "none" }}>$</span>
      <input type="number" value={value} onChange={onChange} placeholder="0.00" style={{ ...campo, paddingLeft: 22, ...style }} />
    </div>
  );
}

// Los tres tipos de captura — cada uno con su ícono, título, subtítulo para
// su tarjeta, placeholder de descripción, y si necesita los campos extra de
// "responsable"/"detalle" (solo aplica a Gasto).
const TIPOS = {
  gasto: { titulo: "Gastos", subtitulo: "Compras y salidas de caja del día", icono: Receipt, placeholder: "Ej. Compra de fruta", conResponsable: true, positivo: false },
  descuento: { titulo: "Descuento empleado", subtitulo: "Descuentos aplicados en el día", icono: UserMinus, placeholder: "Ej. Juan Pérez", conResponsable: false, positivo: false },
  venta_app: { titulo: "Venta por app", subtitulo: "Ventas de Didi, Uber, etc.", icono: Smartphone, placeholder: "Ej. Didi, Uber", conResponsable: false, positivo: true },
};

// Vistas posibles, agrupadas por sección de la barra lateral:
//   Cortes:       cortes (listado, como "Recepción de Cortes") | cortes-captura (captura)
//   Inventarios:  inventarios (listado, como "Recepción de Cortes") | inventarios-conteo (captura)
const VISTAS_CORTES = ["cortes", "cortes-captura"];

export default function SucursalApp() {
  const sucursal = getSucursal();
  const [items, setItems, loadedCortes] = usePersistedCollection("gastos_descuentos_sucursal");
  const [productos, setProductos, loadedProductos] = usePersistedCollection("productos_inventario");
  const [conteos, setConteos, loadedConteos] = usePersistedCollection("conteos_diarios_inventario");
  const [responsablesAI, , setResponsablesLocal] = usePersistedList("responsables_sucursal", []);
  const [vista, setVista] = useState("cortes");

  // El personal de sucursal puede agregar su nombre al vuelo desde la
  // captura de Cortes (sin entrar a Gestión) — se guarda en el catálogo
  // compartido vía la ruta de solo-agregar, y se refleja en pantalla al
  // instante.
  const agregarResponsable = async (nombre) => {
    const lista = await agregarValorLista("responsables_sucursal", nombre);
    setResponsablesLocal(lista);
    return lista;
  };

  const enCortes = VISTAS_CORTES.includes(vista);
  const loaded = enCortes ? loadedCortes : loadedProductos && loadedConteos;

  return (
    <div id="fy-app-shell" style={{ minHeight: "100vh", display: "flex", color: T.ink, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS_IMPRESION }} />
      <Sidebar activa={vista} onIrACortes={() => setVista("cortes")} onIrAInventarios={() => setVista("inventarios")} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <CuentaBarra onCerrarSesion={() => { cerrarSesionServidor(); clearSession(); limpiarPrefsLocal(); window.location.reload(); }} />
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 36px 64px", width: "100%", boxSizing: "border-box" }}>
          {!loaded ? (
            <div style={{ fontSize: 13, color: T.muted, marginTop: 40 }}>Cargando…</div>
          ) : vista === "cortes" ? (
            <CortesRegistro sucursal={sucursal} items={items} onNuevo={() => setVista("cortes-captura")} />
          ) : vista === "cortes-captura" ? (
            <CortesCaptura sucursal={sucursal} items={items} setItems={setItems} responsablesAI={responsablesAI} onAgregarResponsable={agregarResponsable} onVolver={() => setVista("cortes")} />
          ) : vista === "inventarios" ? (
            <InventariosRegistro sucursal={sucursal} conteos={conteos} onNuevo={() => setVista("inventarios-conteo")} />
          ) : (
            <ConteoDiario sucursal={sucursal} productos={productos} setConteos={setConteos} onVolver={() => setVista("inventarios")} />
          )}
        </div>
      </div>
    </div>
  );
}

// Barra oscura con el logo, "Sucursales" y los dos apartados disponibles:
// "Cortes" e "Inventarios".
function Sidebar({ activa, onIrACortes, onIrAInventarios }) {
  const enCortes = VISTAS_CORTES.includes(activa);
  const enInventarios = !enCortes;
  return (
    <aside className="noprint" style={{ width: 210, flexShrink: 0, background: T.ink, color: "#fff", padding: "20px 14px", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh", overflowY: "auto", boxSizing: "border-box" }}>
      <div style={{ padding: "2px 8px 20px", display: "flex", alignItems: "center", gap: 8 }}>
        <img src={LOGO} alt="Frutal Yogurt" style={{ height: 36, width: "auto", display: "block" }} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: T.brand, background: "rgba(15,110,102,.22)", borderRadius: 99, padding: "3px 9px" }}>Sucursales</span>
      </div>
      <div style={{ display: "grid", gap: 3 }}>
        <button
          onClick={onIrACortes}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: "none", outline: "none", boxShadow: "none", cursor: "pointer", width: "100%", background: enCortes ? T.brand : "transparent", color: "#fff", fontWeight: 700, fontFamily: "inherit" }}
        >
          <span style={{ width: 22, display: "flex", justifyContent: "center" }}><ShieldCheck size={17} /></span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>Cortes</span>
        </button>
        <button
          onClick={onIrAInventarios}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", borderRadius: 9, border: "none", outline: "none", boxShadow: "none", cursor: "pointer", width: "100%", background: enInventarios ? T.brand : "transparent", color: "#fff", fontWeight: 700, fontFamily: "inherit" }}
        >
          <span style={{ width: 22, display: "flex", justifyContent: "center" }}><Boxes size={17} /></span>
          <span style={{ flex: 1, textAlign: "left", fontSize: 13 }}>Inventarios</span>
        </button>
      </div>
      <div style={{ marginTop: "auto", paddingTop: 18, fontSize: 10, color: "rgba(255,255,255,.4)", lineHeight: 1.5 }}>
        Acceso de sucursal<br />Frutal Yogurt
      </div>
    </aside>
  );
}

// Pantalla única de "Cortes" — mismo estilo visual y espaciado que
// "Recepción de Cortes" / Inventarios: listado por fecha con un botón
// "+ Nueva captura" arriba. Cada fecha puede traer gastos, descuentos y
// ventas por app juntos.
function CortesRegistro({ sucursal, items, onNuevo }) {
  const [verFecha, setVerFecha] = useState(null);

  const porFecha = {};
  items.forEach((it) => { (porFecha[it.fecha] = porFecha[it.fecha] || []).push(it); });
  const fechas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a));

  const columnasExport = [
    { titulo: "Fecha", valor: (f) => f.fecha },
    { titulo: "Tipo", valor: (f) => TIPOS[f.tipo]?.titulo || f.tipo },
    { titulo: "Descripción", valor: (f) => f.descripcion },
    { titulo: "Responsable", valor: (f) => f.responsable },
    { titulo: "Monto", valor: (f) => f.monto },
  ];
  const filasExport = [...items].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || a.id - b.id);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: T.ink }}>Cortes</h1>
        {!verFecha && (
          <button
            onClick={onNuevo}
            style={{ border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: T.brand, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} color="#fff" /> Nueva captura
          </button>
        )}
      </div>
      {!verFecha && <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 18 }}>Gastos de sucursal, descuentos de empleado y ventas por aplicación</div>}

      {verFecha ? (
        <CortesDetalle sucursal={sucursal} fecha={verFecha} items={porFecha[verFecha] || []} onCerrar={() => setVerFecha(null)} />
      ) : (
        <>
          <PrintHeader titulo="Cortes" />
          <div className="noprint" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <ExportMenu titulo="Cortes" columnas={columnasExport} filas={filasExport} />
          </div>

          {fechas.length === 0 ? (
            <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 12, padding: 20, fontSize: 13, color: T.muted, textAlign: "center" }}>
              Aún no hay capturas registradas.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {fechas.map((fecha) => {
                const registros = porFecha[fecha];
                return (
                  <div key={fecha} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ color: T.ink }}>{fecha}</strong>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: T.ok, background: T.okSoft }}>Capturado</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{registros.length} registro{registros.length === 1 ? "" : "s"} capturado{registros.length === 1 ? "" : "s"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setVerFecha(fecha)}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Pantalla de detalle de una fecha — mismo formato que "Detalle de la
// recepción": tarjeta blanca con su propio botón Exportar, una fila de
// datos generales y una tabla con lo capturado ese día.
function CortesDetalle({ sucursal, fecha, items, onCerrar }) {
  const filas = [...items].sort((a, b) => a.id - b.id);
  const capturadoPor = items.find((it) => it.capturadoPor)?.capturadoPor;
  const total = filas.reduce((s, it) => s + (TIPOS[it.tipo]?.positivo ? Number(it.monto) || 0 : -(Number(it.monto) || 0)), 0);

  const columnasExport = [
    { titulo: "Tipo", valor: (f) => TIPOS[f.tipo]?.titulo || f.tipo },
    { titulo: "Descripción", valor: (f) => f.descripcion },
    { titulo: "Responsable", valor: (f) => f.responsable },
    { titulo: "Detalle", valor: (f) => f.detalle },
    { titulo: "Monto", valor: (f) => f.monto },
  ];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 18px", display: "grid", gap: 16 }}>
      <PrintHeader titulo={`Corte ${fecha}`} />
      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>Detalle del corte</div>
        <ExportMenu titulo={`Corte ${fecha}`} columnas={columnasExport} filas={filas} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha</div><strong style={{ color: T.ink }}>{fecha}</strong></div>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Sucursal</div><strong style={{ color: T.ink }}>{sucursal}</strong></div>
        {capturadoPor && <div><div style={{ color: T.muted, fontSize: 11 }}>Capturado por</div><strong style={{ color: T.ink }}>{capturadoPor}</strong></div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: T.paper }}>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Tipo</th>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Descripción</th>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Responsable</th>
            <th style={{ padding: "7px 12px", textAlign: "right" }}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((it) => (
            <tr key={it.id}>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{TIPOS[it.tipo]?.titulo || it.tipo}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{it.descripcion || "—"}{it.detalle ? ` · ${it.detalle}` : ""}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{it.responsable || "—"}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "right", color: TIPOS[it.tipo]?.positivo ? T.brand : T.bad, fontWeight: 600 }}>
                {TIPOS[it.tipo]?.positivo ? "+" : "−"} {money(it.monto)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 13.5, fontWeight: 700, color: T.ink }}>
        Total: {money(total)}
      </div>
      <div className="noprint" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCerrar} style={{ border: "none", background: T.ink, color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cerrar</button>
      </div>
    </div>
  );
}

// Nueva captura: se elige la fecha y quién captura una sola vez, y de ahí
// se pueden agregar cuantos gastos, descuentos y ventas por app hagan
// falta — todo junto, en la misma pantalla.
function CortesCaptura({ sucursal, items, setItems, responsablesAI, onAgregarResponsable, onVolver }) {
  const [paso, setPaso] = useState("captura"); // captura | resumen
  const [fecha, setFecha] = useState(hoyISO());
  const [capturadoPor, setCapturadoPor] = useState("");
  const [gastos, setGastos] = useState([]);
  const [descuentos, setDescuentos] = useState([]);
  const [ventasApp, setVentasApp] = useState([]);

  const [agregandoNombre, setAgregandoNombre] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  const [errorNombre, setErrorNombre] = useState("");

  const hayResponsables = responsablesAI.length > 0;

  const confirmarNuevoNombre = async () => {
    const n = nuevoNombre.trim();
    if (!n || guardandoNombre) return;
    setGuardandoNombre(true);
    setErrorNombre("");
    try {
      await onAgregarResponsable(n);
      setCapturadoPor(n);
      setNuevoNombre("");
      setAgregandoNombre(false);
    } catch (err) {
      setErrorNombre(err.message || "No se pudo agregar");
    } finally {
      setGuardandoNombre(false);
    }
  };
  const cancelarNuevoNombre = () => {
    setAgregandoNombre(false);
    setNuevoNombre("");
    setErrorNombre("");
  };

  const agregarGasto = () => setGastos((prev) => [...prev, { id: Date.now() + Math.random(), monto: "", responsable: "", descripcion: "", detalle: "" }]);
  const actualizarGasto = (id, campo, val) => setGastos((prev) => prev.map((g) => (g.id === id ? { ...g, [campo]: val } : g)));
  const quitarGasto = (id) => setGastos((prev) => prev.filter((g) => g.id !== id));

  const agregarDescuento = () => setDescuentos((prev) => [...prev, { id: Date.now() + Math.random(), monto: "", responsable: "" }]);
  const actualizarDescuento = (id, campo, val) => setDescuentos((prev) => prev.map((d) => (d.id === id ? { ...d, [campo]: val } : d)));
  const quitarDescuento = (id) => setDescuentos((prev) => prev.filter((d) => d.id !== id));

  const agregarVenta = () => setVentasApp((prev) => [...prev, { id: Date.now() + Math.random(), monto: "", app: APPS_VENTA[0] }]);
  const actualizarVenta = (id, campo, val) => setVentasApp((prev) => prev.map((v) => (v.id === id ? { ...v, [campo]: val } : v)));
  const quitarVenta = (id) => setVentasApp((prev) => prev.filter((v) => v.id !== id));

  const hayAlgo = gastos.length > 0 || descuentos.length > 0 || ventasApp.length > 0;
  const listo = fecha && capturadoPor && hayAlgo;

  // Se usa tanto para armar la tabla de revisión como para lo que
  // realmente se guarda al Finalizar — así lo que ve el usuario en el
  // resumen es exactamente lo que se va a guardar.
  const construirNuevos = () => {
    const nuevos = [];
    gastos
      .filter((g) => g.monto !== "" && !isNaN(Number(g.monto)) && Number(g.monto) > 0)
      .forEach((g, i) => nuevos.push({
        id: `${Date.now()}-gasto-${i}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: "gasto", fecha, capturadoPor,
        monto: Number(g.monto), responsable: g.responsable,
        descripcion: g.descripcion.trim(), detalle: g.detalle.trim(),
      }));
    descuentos
      .filter((d) => d.monto !== "" && !isNaN(Number(d.monto)) && Number(d.monto) > 0)
      .forEach((d, i) => nuevos.push({
        id: `${Date.now()}-desc-${i}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: "descuento", fecha, capturadoPor,
        monto: Number(d.monto), responsable: d.responsable, descripcion: "", detalle: "",
      }));
    ventasApp
      .filter((v) => v.monto !== "" && !isNaN(Number(v.monto)) && Number(v.monto) > 0)
      .forEach((v, i) => nuevos.push({
        id: `${Date.now()}-venta-${i}-${Math.random().toString(36).slice(2, 7)}`,
        tipo: "venta_app", fecha, capturadoPor,
        monto: Number(v.monto), responsable: "", descripcion: v.app, detalle: "",
      }));
    return nuevos;
  };

  const irAResumen = () => { if (listo) setPaso("resumen"); };

  const finalizar = () => {
    const nuevos = construirNuevos();
    if (!nuevos.length) { setPaso("captura"); return; }
    if (!window.confirm(`¿Guardar esta captura del ${fecha}? Dale una segunda revisada antes de confirmar — después solo tu administrador puede corregirla.`)) return;
    setItems((prev) => [...prev, ...nuevos]);
    onVolver();
  };

  if (paso === "resumen") {
    return (
      <CortesResumenCaptura
        fecha={fecha}
        sucursal={sucursal}
        capturadoPor={capturadoPor}
        filas={construirNuevos()}
        onAtras={() => setPaso("captura")}
        onFinalizar={finalizar}
      />
    );
  }

  const seccion = (titulo, subtitulo, Icono, onAgregar) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: T.paper, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icono size={17} color={T.brand} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>{titulo}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 1 }}>{subtitulo}</div>
        </div>
      </div>
      <button onClick={onAgregar} style={{ background: "none", border: "none", color: T.brand, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>+ Agregar</button>
    </div>
  );

  return (
    <>
      <button onClick={onVolver} style={{ background: "none", border: "none", color: T.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <ChevronLeft size={14} /> Cortes
      </button>

      <div style={{ marginBottom: hayResponsables ? 22 : 6, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Cortes</div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 26, margin: 0, color: T.ink }}>Nueva captura</h1>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div>
            <label style={etiqueta}>Fecha</label>
            <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} style={{ ...campo, width: 170 }} />
          </div>
          <div>
            <label style={etiqueta}>Responsable de la captura</label>
            <select value={capturadoPor} onChange={(e) => setCapturadoPor(e.target.value)} style={{ ...campo, width: 200 }}>
              <option value="">Selecciona…</option>
              {responsablesAI.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            {!agregandoNombre ? (
              <button onClick={() => setAgregandoNombre(true)} style={{ background: "none", border: "none", color: T.brand, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, marginTop: 5, display: "block" }}>
                + agregar nombre
              </button>
            ) : (
              <div style={{ marginTop: 5 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    autoFocus
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmarNuevoNombre(); if (e.key === "Escape") cancelarNuevoNombre(); }}
                    placeholder="Ej: Juan Ramos"
                    disabled={guardandoNombre}
                    style={{ border: "none", borderBottom: `1px solid ${T.line}`, background: "transparent", fontSize: 12.5, color: T.ink, padding: "2px 1px", width: 130, outline: "none" }}
                  />
                  <button onClick={confirmarNuevoNombre} disabled={guardandoNombre || !nuevoNombre.trim()} style={{ background: "none", border: "none", color: T.brand, cursor: "pointer", padding: 0, display: "flex", opacity: guardandoNombre || !nuevoNombre.trim() ? 0.4 : 1 }}>
                    <Check size={15} />
                  </button>
                  <button onClick={cancelarNuevoNombre} disabled={guardandoNombre} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 0, display: "flex" }}>
                    <X size={15} />
                  </button>
                </div>
                {errorNombre && <div style={{ fontSize: 10.5, color: T.bad, marginTop: 3 }}>{errorNombre}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {!hayResponsables && (
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 22 }}>Todavía no hay responsables — pídele a tu administrador que los agregue desde Gestión › Cortes › Configuración.</div>
      )}

      <div style={{ display: "grid", gap: 24 }}>
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
          {seccion(TIPOS.gasto.titulo, TIPOS.gasto.subtitulo, TIPOS.gasto.icono, agregarGasto)}
          {gastos.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {gastos.map((g) => (
                <div key={g.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 1.2fr 1fr auto", gap: 8, alignItems: "center", background: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>
                  <CampoMonto value={g.monto} onChange={(e) => actualizarGasto(g.id, "monto", e.target.value)} style={{ background: "#fff" }} />
                  <select value={g.responsable} onChange={(e) => actualizarGasto(g.id, "responsable", e.target.value)} style={{ ...campo, background: "#fff" }}>
                    <option value="">Responsable…</option>
                    {responsablesAI.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input value={g.descripcion} onChange={(e) => actualizarGasto(g.id, "descripcion", e.target.value)} placeholder={TIPOS.gasto.placeholder} style={{ ...campo, background: "#fff" }} />
                  <input value={g.detalle} onChange={(e) => actualizarGasto(g.id, "detalle", e.target.value)} placeholder="Detalle" style={{ ...campo, background: "#fff" }} />
                  <button onClick={() => quitarGasto(g.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.bad, display: "flex" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
          {seccion(TIPOS.descuento.titulo, TIPOS.descuento.subtitulo, TIPOS.descuento.icono, agregarDescuento)}
          {descuentos.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {descuentos.map((d) => (
                <div key={d.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr auto", gap: 8, alignItems: "center", background: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>
                  <CampoMonto value={d.monto} onChange={(e) => actualizarDescuento(d.id, "monto", e.target.value)} style={{ background: "#fff" }} />
                  <select value={d.responsable} onChange={(e) => actualizarDescuento(d.id, "responsable", e.target.value)} style={{ ...campo, background: "#fff" }}>
                    <option value="">Empleado…</option>
                    {responsablesAI.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button onClick={() => quitarDescuento(d.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.bad, display: "flex" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
          {seccion(TIPOS.venta_app.titulo, TIPOS.venta_app.subtitulo, TIPOS.venta_app.icono, agregarVenta)}
          {ventasApp.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              {ventasApp.map((v) => (
                <div key={v.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr auto", gap: 8, alignItems: "center", background: T.paper, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>
                  <CampoMonto value={v.monto} onChange={(e) => actualizarVenta(v.id, "monto", e.target.value)} style={{ background: "#fff" }} />
                  <select value={v.app} onChange={(e) => actualizarVenta(v.id, "app", e.target.value)} style={{ ...campo, background: "#fff" }}>
                    {APPS_VENTA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button onClick={() => quitarVenta(v.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.bad, display: "flex" }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
        <button onClick={onVolver} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 13.5, fontWeight: 600, padding: "11px 28px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
          Cancelar
        </button>
        <button onClick={irAResumen} disabled={!listo} style={{ ...boton(T.brand, "#fff"), opacity: listo ? 1 : 0.5, cursor: listo ? "pointer" : "default", padding: "11px 28px" }}>
          Siguiente
        </button>
      </div>
    </>
  );
}

// Pantalla de revisión antes de guardar de verdad — mismo espíritu que
// "Revisión de la recepción" en Cortes (Gestión): una segunda checada a lo
// capturado antes de confirmar.
function CortesResumenCaptura({ fecha, sucursal, capturadoPor, filas, onAtras, onFinalizar }) {
  const total = filas.reduce((s, it) => s + (TIPOS[it.tipo]?.positivo ? Number(it.monto) || 0 : -(Number(it.monto) || 0)), 0);
  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Cortes</div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 26, margin: 0, color: T.ink }}>Revisión de la captura</h1>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 22, display: "grid", gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>Dale una segunda revisada antes de guardar</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha</div><strong style={{ color: T.ink }}>{fecha}</strong></div>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Sucursal</div><strong style={{ color: T.ink }}>{sucursal}</strong></div>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Responsable de la captura</div><strong style={{ color: T.ink }}>{capturadoPor}</strong></div>
        </div>

        {filas.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.muted }}>No hay nada que guardar — vuelve a "Atrás" y captura al menos un monto.</div>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.paper }}>
                  <th style={{ padding: "7px 12px", textAlign: "left" }}>Tipo</th>
                  <th style={{ padding: "7px 12px", textAlign: "left" }}>Descripción</th>
                  <th style={{ padding: "7px 12px", textAlign: "left" }}>Responsable</th>
                  <th style={{ padding: "7px 12px", textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{TIPOS[it.tipo]?.titulo || it.tipo}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{it.descripcion || "—"}{it.detalle ? ` · ${it.detalle}` : ""}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{it.responsable || "—"}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}`, textAlign: "right", color: TIPOS[it.tipo]?.positivo ? T.brand : T.bad, fontWeight: 600 }}>
                      {TIPOS[it.tipo]?.positivo ? "+" : "−"} {money(it.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 13.5, fontWeight: 700, color: T.ink }}>Total: {money(total)}</div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onAtras} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
            ‹ Atrás
          </button>
          <button onClick={onFinalizar} disabled={filas.length === 0} style={{ border: "none", background: T.ink, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 9, cursor: filas.length ? "pointer" : "default", opacity: filas.length ? 1 : 0.5, fontFamily: "inherit" }}>
            Finalizar
          </button>
        </div>
      </div>
    </>
  );
}

// Captura del día: para cada producto de la lista, físico contado + las
// cuatro salidas. Igual que gastos/descuentos, es "co" — se puede crear pero
// no editar/borrar; si algo se capturó mal lo corrige el administrador. La
// lista de productos ya no la maneja sucursal (es "ro" del lado del
// servidor) — la agrega y quita el administrador desde Gestión › Inventarios.
function ConteoDiario({ sucursal, productos, setConteos, onVolver }) {
  const [paso, setPaso] = useState("captura"); // captura | resumen
  const [fecha, setFecha] = useState(hoyISO());
  const [valoresFisico, setValoresFisico] = useState({}); // { nombreProducto: { cantidad, unidad } }
  const [movimientos, setMovimientos] = useState([]); // [{ id, tipo, producto, cantidad, unidad }]
  const inputRefs = useRef([]);
  const selectRefs = useRef([]);

  const ordenados = [...productos].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));

  const setCantidad = (nombre, val) => setValoresFisico((prev) => ({ ...prev, [nombre]: { unidad: "unidades", ...(prev[nombre] || {}), cantidad: val } }));
  const setUnidadFisico = (nombre, val) => setValoresFisico((prev) => ({ ...prev, [nombre]: { cantidad: "", ...(prev[nombre] || {}), unidad: val } }));

  const agregarMovimiento = () => {
    setMovimientos((prev) => [...prev, { id: Date.now() + Math.random(), tipo: "mermas", producto: ordenados[0]?.nombre || "", cantidad: "", unidad: "unidades" }]);
  };
  const actualizarMovimiento = (id, campo, val) => setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, [campo]: val } : m)));
  const quitarMovimiento = (id) => setMovimientos((prev) => prev.filter((m) => m.id !== id));

  // Se usa tanto para la tabla de revisión como para lo que realmente se
  // guarda al Finalizar — así lo que ve el usuario en el resumen es
  // exactamente lo que se va a guardar.
  const construirFilas = () => {
    const filasFisico = ordenados.map((p, i) => {
      const v = valoresFisico[p.nombre] || {};
      return {
        id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        fecha,
        producto: p.nombre,
        fisico: Number(v.cantidad) || 0,
        unidad: v.unidad || "unidades",
        mermas: 0, transferencias: 0, cortesias: 0, otras: 0,
      };
    });
    const filasMovimientos = movimientos
      .filter((m) => m.producto && m.cantidad !== "" && !isNaN(Number(m.cantidad)))
      .map((m, i) => ({
        id: `${Date.now()}-mov-${i}-${Math.random().toString(36).slice(2, 7)}`,
        fecha,
        producto: m.producto,
        fisico: null,
        unidad: m.unidad || "unidades",
        mermas: m.tipo === "mermas" ? Number(m.cantidad) : 0,
        transferencias: m.tipo === "transferencias" ? Number(m.cantidad) : 0,
        cortesias: m.tipo === "cortesias" ? Number(m.cantidad) : 0,
        otras: m.tipo === "otras" ? Number(m.cantidad) : 0,
      }));
    return [...filasFisico, ...filasMovimientos];
  };

  const irAResumen = () => { if (ordenados.length) setPaso("resumen"); };

  const finalizar = () => {
    const nuevas = construirFilas();
    if (!window.confirm(`¿Guardar este conteo del ${fecha}? Dale una segunda revisada antes de confirmar — después solo tu administrador puede corregirlo.`)) return;
    setConteos((prev) => [...prev, ...nuevas]);
    onVolver();
  };

  if (paso === "resumen") {
    return (
      <InventariosResumenConteo
        sucursal={sucursal}
        fecha={fecha}
        filas={construirFilas()}
        onAtras={() => setPaso("captura")}
        onFinalizar={finalizar}
      />
    );
  }

  return (
    <>
      <button onClick={onVolver} style={{ background: "none", border: "none", color: T.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        <ChevronLeft size={14} /> Inventarios
      </button>

      <div style={{ marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Inventarios</div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 26, margin: 0, color: T.ink }}>Conteo diario</h1>
        </div>
        <div>
          <label style={etiqueta}>Fecha</label>
          <input type="date" value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} style={{ ...campo, width: 170 }} />
        </div>
      </div>

      {ordenados.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 24, fontSize: 13, color: T.muted }}>
          Todavía no tienes productos para inventariar — pídele a tu administrador que los agregue desde Gestión › Inventarios.
        </div>
      ) : (
        <>
          <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 150px", gap: 12, padding: "12px 16px", background: T.paper, fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              <div>Producto</div><div>Cantidad</div><div>Unidad</div>
            </div>
            {ordenados.map((p, i) => {
              const v = valoresFisico[p.nombre] || {};
              return (
                <div key={p.nombre} style={{ display: "grid", gridTemplateColumns: "1fr 160px 150px", gap: 12, alignItems: "center", padding: "10px 16px", borderTop: `1px solid ${T.lineSoft}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{p.nombre}</div>
                  <input
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="number"
                    value={v.cantidad ?? ""}
                    onChange={(e) => setCantidad(p.nombre, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); selectRefs.current[i]?.focus(); } }}
                    placeholder="0"
                    style={campo}
                  />
                  <select
                    ref={(el) => (selectRefs.current[i] = el)}
                    value={v.unidad ?? "unidades"}
                    onChange={(e) => setUnidadFisico(p.nombre, e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); inputRefs.current[i + 1]?.focus(); } }}
                    style={campo}
                  >
                    <option value="unidades">PZA</option>
                    <option value="kg">KG</option>
                  </select>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 28 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: T.ink }}>Mermas, transferencias, cortesías u otras salidas</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Solo si hubo algo ese día — si no, déjalo vacío.</div>
              </div>
              <button onClick={agregarMovimiento} style={{ background: "none", border: "none", color: T.brand, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}>+ Agregar</button>
            </div>
            {movimientos.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {movimientos.map((m) => (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 100px 120px auto", gap: 8, alignItems: "center", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 10px" }}>
                    <select value={m.tipo} onChange={(e) => actualizarMovimiento(m.id, "tipo", e.target.value)} style={campo}>
                      {CAMPOS_SALIDA_CAPTURA.map((c) => <option key={c.clave} value={c.clave}>{c.etiqueta}</option>)}
                    </select>
                    <select value={m.producto} onChange={(e) => actualizarMovimiento(m.id, "producto", e.target.value)} style={campo}>
                      {ordenados.map((p) => <option key={p.nombre} value={p.nombre}>{p.nombre}</option>)}
                    </select>
                    <input type="number" value={m.cantidad} onChange={(e) => actualizarMovimiento(m.id, "cantidad", e.target.value)} placeholder="0" style={campo} />
                    <select value={m.unidad} onChange={(e) => actualizarMovimiento(m.id, "unidad", e.target.value)} style={campo}>
                      <option value="unidades">PZA</option>
                      <option value="kg">KG</option>
                    </select>
                    <button onClick={() => quitarMovimiento(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.bad, display: "flex" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
            <button onClick={onVolver} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 13.5, fontWeight: 600, padding: "11px 28px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
              Cancelar
            </button>
            <button onClick={irAResumen} style={{ ...boton(T.brand, "#fff"), padding: "11px 28px" }}>
              Siguiente
            </button>
          </div>
        </>
      )}
    </>
  );
}

// Pantalla de revisión antes de guardar de verdad — mismo espíritu que en
// Cortes: una segunda checada a lo capturado antes de confirmar.
function InventariosResumenConteo({ sucursal, fecha, filas, onAtras, onFinalizar }) {
  // En la revisión solo mostramos lo que realmente se capturó — un producto
  // en 0 (o que nunca se tocó, que aquí se guarda igual como 0) no aporta
  // nada a la revisión y solo hace más larga la tabla. Los movimientos
  // (mermas, transferencias, etc.) siempre tienen fisico null y ya vienen
  // filtrados desde construirFilas() para que solo existan si se capturó
  // algo, así que esos siempre se muestran.
  const filasCapturadas = filas.filter((f) => f.fisico == null || Number(f.fisico) !== 0);

  return (
    <>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 2 }}>Inventarios</div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 26, margin: 0, color: T.ink }}>Revisión del conteo</h1>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 22, display: "grid", gap: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>Dale una segunda revisada antes de guardar</div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha</div><strong style={{ color: T.ink }}>{fecha}</strong></div>
          <div><div style={{ color: T.muted, fontSize: 11 }}>Sucursal</div><strong style={{ color: T.ink }}>{sucursal}</strong></div>
        </div>

        {filasCapturadas.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T.muted }}>No hay nada que guardar.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.paper }}>
                <th style={{ padding: "7px 12px", textAlign: "left" }}>Producto</th>
                <th style={{ padding: "7px 12px", textAlign: "left" }}>Tipo</th>
                <th style={{ padding: "7px 12px", textAlign: "left" }}>Cantidad</th>
                <th style={{ padding: "7px 12px", textAlign: "left" }}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {filasCapturadas.map((f) => {
                const info = f.fisico != null ? { etiqueta: "Físico", valor: f.fisico } : tipoDeMovimiento(f);
                if (!info) return null;
                return (
                  <tr key={f.id}>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{f.producto}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{info.etiqueta}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{cant(info.valor)}</td>
                    <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{etiquetaUnidad(f.unidad)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onAtras} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.ink, fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
            ‹ Atrás
          </button>
          <button onClick={onFinalizar} style={{ border: "none", background: T.ink, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit" }}>
            Finalizar
          </button>
        </div>
      </div>
    </>
  );
}

// Pantalla única de "Inventarios" — copia el mismo estilo visual y
// espaciado de "Recepción de Cortes" (Gestión): listado por fecha con un
// botón "+ Nuevo conteo" arriba. Es de solo lectura — si algo se capturó
// mal, lo corrige el administrador (conteos_diarios_inventario es "co").
function InventariosRegistro({ sucursal, conteos, onNuevo }) {
  const [verFecha, setVerFecha] = useState(null);

  const porFecha = {};
  conteos.forEach((c) => { (porFecha[c.fecha] = porFecha[c.fecha] || []).push(c); });
  const fechas = Object.keys(porFecha).sort((a, b) => b.localeCompare(a));

  // Mismas columnas para las tres formas de exportar (Excel/PDF/Imprimir).
  const columnasExport = [
    { titulo: "Fecha", valor: (f) => f.fecha },
    { titulo: "Producto", valor: (f) => f.producto },
    { titulo: "Tipo", valor: (f) => f.tipo },
    { titulo: "Cantidad", valor: (f) => f.cantidad },
    { titulo: "Unidad", valor: (f) => f.unidad },
  ];
  const filasExport = [...conteos]
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.producto || "").localeCompare(b.producto || "", "es"))
    .map((c) => {
      if (c.fisico != null) return { fecha: c.fecha, producto: c.producto, tipo: "Físico", cantidad: c.fisico, unidad: etiquetaUnidad(c.unidad) };
      const info = tipoDeMovimiento(c);
      return { fecha: c.fecha, producto: c.producto, tipo: info ? info.etiqueta : "Movimiento", cantidad: info ? info.valor : 0, unidad: etiquetaUnidad(c.unidad) };
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: T.ink }}>Inventarios diarios</h1>
        {!verFecha && (
          <button
            onClick={onNuevo}
            style={{ border: "none", color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: T.brand, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Plus size={15} color="#fff" /> Nuevo conteo
          </button>
        )}
      </div>
      {!verFecha && <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 18 }}>Conteo físico de productos y salidas del día por sucursal</div>}

      {verFecha ? (
        <InventariosDetalle sucursal={sucursal} fecha={verFecha} items={porFecha[verFecha] || []} onCerrar={() => setVerFecha(null)} />
      ) : (
        <>
          <PrintHeader titulo="Inventarios" />
          <div className="noprint" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <ExportMenu titulo="Inventarios" columnas={columnasExport} filas={filasExport} />
          </div>

          {fechas.length === 0 ? (
            <div style={{ background: T.card, border: `1px dashed ${T.line}`, borderRadius: 12, padding: 20, fontSize: 13, color: T.muted, textAlign: "center" }}>
              Aún no hay conteos registrados.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {fechas.map((fecha) => {
                const items = porFecha[fecha];
                const productosDelDia = [...new Set(items.map((it) => it.producto))];
                return (
                  <div key={fecha} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong style={{ color: T.ink }}>{fecha}</strong>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, color: T.ok, background: T.okSoft }}>Capturado</span>
                        </div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{productosDelDia.length} producto{productosDelDia.length === 1 ? "" : "s"} capturado{productosDelDia.length === 1 ? "" : "s"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => setVerFecha(fecha)}
                          style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", background: "#fff", color: T.ink, border: `1px solid ${T.line}` }}
                        >
                          Ver
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Pantalla de detalle de un conteo — mismo formato que "Detalle de la
// recepción" en Cortes: tarjeta blanca con su propio botón Exportar, una
// fila de datos generales y una tabla con lo capturado ese día.
function InventariosDetalle({ sucursal, fecha, items, onCerrar }) {
  const productosDelDia = [...new Set(items.map((it) => it.producto))].sort((a, b) => (a || "").localeCompare(b || "", "es"));
  const filas = [];
  productosDelDia.forEach((nombreProd) => {
    const delProducto = items.filter((it) => it.producto === nombreProd);
    const filaFisico = delProducto.find((f) => f.fisico != null);
    // Igual que en la Revisión antes de guardar: un producto en 0 (o que
    // nunca se tocó, que se guarda igual como 0) no se muestra — solo lo
    // que de verdad se capturó.
    if (filaFisico && Number(filaFisico.fisico) !== 0) filas.push({ producto: nombreProd, tipo: "Físico", cantidad: filaFisico.fisico, unidad: etiquetaUnidad(filaFisico.unidad) });
    delProducto.filter((f) => f.fisico == null).forEach((m) => {
      const info = tipoDeMovimiento(m);
      if (info) filas.push({ producto: nombreProd, tipo: info.etiqueta, cantidad: info.valor, unidad: etiquetaUnidad(m.unidad) });
    });
  });
  const capturadoPor = items.find((it) => it.capturadoPor)?.capturadoPor;

  const columnasExport = [
    { titulo: "Producto", valor: (f) => f.producto },
    { titulo: "Tipo", valor: (f) => f.tipo },
    { titulo: "Cantidad", valor: (f) => f.cantidad },
    { titulo: "Unidad", valor: (f) => f.unidad },
  ];

  return (
    <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, padding: "16px 18px", display: "grid", gap: 16 }}>
      <PrintHeader titulo={`Conteo ${fecha}`} />
      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: T.ink }}>Detalle del conteo</div>
        <ExportMenu titulo={`Conteo ${fecha}`} columnas={columnasExport} filas={filas} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, fontSize: 13 }}>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Fecha</div><strong style={{ color: T.ink }}>{fecha}</strong></div>
        <div><div style={{ color: T.muted, fontSize: 11 }}>Sucursal</div><strong style={{ color: T.ink }}>{sucursal}</strong></div>
        {capturadoPor && <div><div style={{ color: T.muted, fontSize: 11 }}>Capturado por</div><strong style={{ color: T.ink }}>{capturadoPor}</strong></div>}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: T.paper }}>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Producto</th>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Tipo</th>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Cantidad</th>
            <th style={{ padding: "7px 12px", textAlign: "left" }}>Unidad</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{f.producto}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{f.tipo}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{cant(f.cantidad)}</td>
              <td style={{ padding: "7px 12px", borderBottom: `1px solid ${T.lineSoft}` }}>{f.unidad}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="noprint" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button onClick={onCerrar} style={{ border: "none", background: T.ink, color: "#fff", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cerrar</button>
      </div>
    </div>
  );
}
