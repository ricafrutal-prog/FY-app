import { useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import Login from "./Login.jsx";
import { getToken, getUsername, clearSession } from "./auth";

function Root() {
  const [autenticado, setAutenticado] = useState(!!getToken());

  if (!autenticado) {
    return <Login onSuccess={() => setAutenticado(true)} />;
  }

  return (
    <div style={{ position: "relative", minHeight: "100%" }}>
      <div
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#16161B",
          color: "#fff",
          borderRadius: 99,
          padding: "6px 6px 6px 14px",
          fontSize: 11.5,
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          boxShadow: "0 6px 20px rgba(0,0,0,.2)",
        }}
        className="noprint"
      >
        <span style={{ opacity: 0.75 }}>{getUsername()}</span>
        <button
          onClick={() => { clearSession(); setAutenticado(false); }}
          style={{
            border: "none",
            background: "rgba(255,255,255,.12)",
            color: "#fff",
            borderRadius: 99,
            padding: "6px 12px",
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Salir
        </button>
      </div>
      <App />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<Root />);
