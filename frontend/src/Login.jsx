import { useState } from "react";
import { login } from "./auth";

const T = {
  ink: "#16161B",
  muted: "#8C8C97",
  line: "#E6E3DB",
  paper: "#F1F3F2",
  brand: "#0F6E66",
  bad: "#D6453F",
  badSoft: "#FBE7E5",
};

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.paper,
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={enviar}
        style={{
          background: "#fff",
          border: `1px solid ${T.line}`,
          borderRadius: 14,
          padding: "32px 28px",
          width: 340,
          maxWidth: "90vw",
          display: "grid",
          gap: 14,
          boxShadow: "0 12px 40px rgba(0,0,0,.06)",
        }}
      >
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: 18, color: T.ink }}>
            Frutal Yogurt
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>Plataforma operativa — inicia sesión</div>
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Usuario</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit", outline: "none" }}
          />
        </div>

        {error && (
          <div style={{ fontSize: 12.5, color: T.bad, background: T.badSoft, borderRadius: 8, padding: "8px 10px" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={cargando || !username || !password}
          style={{
            marginTop: 4,
            border: "none",
            padding: "12px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: cargando ? "default" : "pointer",
            background: T.brand,
            color: "#fff",
            opacity: cargando || !username || !password ? 0.6 : 1,
          }}
        >
          {cargando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
