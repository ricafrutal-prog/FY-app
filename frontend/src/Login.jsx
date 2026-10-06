import { useState } from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { login } from "./auth";

const T = {
  ink: "#16161B",
  muted: "#8C8C97",
  line: "#E6E3DB",
  paper: "#F1F3F2",
  // Verde de la marca (un tono más oscuro que el del logo para que el texto
  // blanco del botón se lea bien).
  brand: "#5E8A17",
  bad: "#D6453F",
  badSoft: "#FBE7E5",
  warn: "#9A6700",
  warnSoft: "#FFF4D6",
};

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [mayusActivas, setMayusActivas] = useState(false);
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

  const deshabilitado = cargando || !username || !password;
  const estiloInput = { padding: "11px 12px", borderRadius: 9, border: `1px solid ${T.line}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `${T.paper} url("/assets/login-fondo.jpg") center / cover no-repeat`,
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
          boxShadow: "0 16px 48px rgba(40,70,10,.18)",
        }}
      >
        {/* El nombre con la tipografía y el verde reales del logo (imagen con fondo transparente). */}
        <div style={{ display: "flex", justifyContent: "center", padding: "2px 0 4px" }}>
          <img src="/assets/logo-texto.png" alt="Frutal Yogurt" style={{ width: 130, height: "auto" }} />
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="login-usuario" style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Usuario</label>
          <input
            id="login-usuario"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={estiloInput}
          />
        </div>

        <div style={{ display: "grid", gap: 5 }}>
          <label htmlFor="login-password" style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>Contraseña</label>
          <div style={{ position: "relative" }}>
            <input
              id="login-password"
              name="password"
              autoComplete="current-password"
              type={verPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => setMayusActivas(e.getModifierState && e.getModifierState("CapsLock"))}
              onKeyUp={(e) => setMayusActivas(e.getModifierState && e.getModifierState("CapsLock"))}
              onBlur={() => setMayusActivas(false)}
              style={{ ...estiloInput, paddingRight: 42 }}
            />
            <button
              type="button"
              onClick={() => setVerPassword((v) => !v)}
              aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", cursor: "pointer", padding: 6, display: "flex", color: T.muted }}
            >
              {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mayusActivas && (
            <div style={{ fontSize: 11.5, color: T.warn, background: T.warnSoft, borderRadius: 7, padding: "5px 9px", display: "flex", alignItems: "center", gap: 6 }}>
              <TriangleAlert size={13} /> Tienes el Bloq Mayús activado
            </div>
          )}
        </div>

        {error && (
          <div role="alert" style={{ fontSize: 12.5, color: T.bad, background: T.badSoft, borderRadius: 8, padding: "8px 10px" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={deshabilitado}
          style={{
            marginTop: 4,
            border: "none",
            padding: "12px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: deshabilitado ? "default" : "pointer",
            background: T.brand,
            color: "#fff",
            opacity: deshabilitado ? 0.55 : 1,
          }}
        >
          {cargando ? "Entrando…" : "Entrar"}
        </button>

        <div style={{ fontSize: 11.5, color: T.muted, textAlign: "center", lineHeight: 1.4 }}>
          ¿Olvidaste tu contraseña? Pídesela a tu administrador.
        </div>
      </form>
    </div>
  );
}
