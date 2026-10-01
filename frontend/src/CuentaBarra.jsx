import AccountMenu from "./AccountMenu.jsx";

// Franja fija arriba del contenido (no de toda la ventana — deja el menú
// lateral fuera), con la cuenta anclada a la derecha. Va DENTRO del flujo
// normal de la página (sticky, no fixed) para que empuje el resto del
// contenido hacia abajo en vez de quedar flotando encima y tapando botones.
// La usan tanto Gestión (App.jsx) como Sucursales (SucursalApp.jsx) — por
// default se ve como una franja blanca propia (fondo blanco + línea abajo),
// pero App.jsx la usa "fondo" y "borde" apagados para que no se note como
// una segunda franja encima del fondo de la página, que ya es casi blanco.
export default function CuentaBarra({ onCerrarSesion, fondo = "#fff", borde = "1px solid #E6E3DB" }) {
  return (
    <div
      className="noprint"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        padding: "10px 20px",
        background: fondo,
        borderBottom: borde,
        flexShrink: 0,
      }}
    >
      <AccountMenu onCerrarSesion={onCerrarSesion} />
    </div>
  );
}
