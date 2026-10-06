import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Login from "./Login.jsx";
import SucursalApp from "./SucursalApp.jsx";
import { getToken, getRole, clearSession } from "./auth";
import GuardiaInactividad, { descartarSesionSiInactiva, marcarActividad, limpiarActividad } from "./inactividad.jsx";
import { getPrefsLocal, applyPrefs, loadPrefsDesdeServidor, limpiarPrefsLocal } from "./preferences";

function Root() {
  // Si la sesión guardada lleva más de 10 min sin actividad, no se reutiliza.
  const [autenticado, setAutenticado] = useState(() => { descartarSesionSiInactiva(); return !!getToken(); });
  const [avisoInactividad, setAvisoInactividad] = useState(false);

  // Aplica lo último guardado en cuanto hay sesión (index.html ya puso lo
  // que había en caché para el primer dibujo; aquí se refresca por si se
  // cambió algo desde otro dispositivo) — nunca truena la pantalla si falla.
  useEffect(() => {
    if (!autenticado) return;
    applyPrefs(getPrefsLocal());
    loadPrefsDesdeServidor().catch(() => {});
  }, [autenticado]);

  const cerrarSesion = () => { clearSession(); limpiarActividad(); limpiarPrefsLocal(); setAutenticado(false); };
  const cerrarPorInactividad = useCallback(() => {
    clearSession(); limpiarActividad(); limpiarPrefsLocal();
    setAvisoInactividad(true);
    setAutenticado(false);
  }, []);

  if (!autenticado) {
    return (
      <Login
        avisoInactividad={avisoInactividad}
        onSuccess={() => { marcarActividad(); setAvisoInactividad(false); setAutenticado(true); }}
      />
    );
  }

  // Un usuario tipo "sucursal" solo ve su propia pantalla — nada del menú
  // completo. El backend además bloquea del lado del servidor que toque
  // cualquier otra cosa, aunque abriera las herramientas del navegador.
  return (
    <>
      {getRole() === "sucursal" ? <SucursalApp /> : <App onCerrarSesion={cerrarSesion} />}
      <GuardiaInactividad activo={autenticado} onExpira={cerrarPorInactividad} />
    </>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
