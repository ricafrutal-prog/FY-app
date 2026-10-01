import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Login from "./Login.jsx";
import SucursalApp from "./SucursalApp.jsx";
import { getToken, getRole, clearSession } from "./auth";
import { getPrefsLocal, applyPrefs, loadPrefsDesdeServidor, limpiarPrefsLocal } from "./preferences";

function Root() {
  const [autenticado, setAutenticado] = useState(!!getToken());

  // Aplica lo último guardado en cuanto hay sesión (index.html ya puso lo
  // que había en caché para el primer dibujo; aquí se refresca por si se
  // cambió algo desde otro dispositivo) — nunca truena la pantalla si falla.
  useEffect(() => {
    if (!autenticado) return;
    applyPrefs(getPrefsLocal());
    loadPrefsDesdeServidor().catch(() => {});
  }, [autenticado]);

  if (!autenticado) {
    return <Login onSuccess={() => setAutenticado(true)} />;
  }

  const cerrarSesion = () => { clearSession(); limpiarPrefsLocal(); setAutenticado(false); };

  // Un usuario tipo "sucursal" solo ve su propia pantalla — nada del menú
  // completo. El backend además bloquea del lado del servidor que toque
  // cualquier otra cosa, aunque abriera las herramientas del navegador.
  if (getRole() === "sucursal") {
    return <SucursalApp />;
  }

  return <App onCerrarSesion={cerrarSesion} />;
}

createRoot(document.getElementById("root")).render(<Root />);
