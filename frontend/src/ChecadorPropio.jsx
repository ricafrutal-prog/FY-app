import { useCallback, useEffect, useState } from "react";
import { apiFetch, getUsername } from "./auth";

// Checador del personal con cuenta propia (oficina). Cada persona entra con su cuenta, registra su huella o
// rostro una sola vez y después checa entrada/salida confirmando con huella o rostro.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", brand: "#0F6E66", bad: "#D6453F", ok: "#2E9E5B" };
const b64uToBuf = (s) => { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const b = atob(t.padEnd(Math.ceil(t.length / 4) * 4, "=")); return Uint8Array.from(b, (c) => c.charCodeAt(0)).buffer; };
const bufToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function llamar(metodo, url, cuerpo) {
  const r = await apiFetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || "No se pudo completar la acción");
  return d;
}
const ubicacion = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }), () => resolve(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
});
const errorBonito = (e) => {
  if (e?.name === "NotAllowedError") return "Se canceló o se acabó el tiempo. Vuelve a intentarlo y confirma con tu huella o rostro.";
  if (e?.name === "InvalidStateError") return "Esa huella o rostro ya está registrada en este equipo.";
  return e?.message || "No se pudo completar";
};

export default function ChecadorPropio({ lugar = "oficina", titulo = "Checador de oficina" }) {
  const base = `/api/checador/propio/${lugar}`;
  const [datos, setDatos] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const soportado = !!window.PublicKeyCredential && !!navigator.credentials;

  const cargar = useCallback(async () => {
    try { setDatos(await llamar("GET", base)); } catch (e) { setMsg({ tipo: "error", texto: e.message }); }
  }, [base]);
  useEffect(() => { cargar(); }, [cargar]);

  const registrar = async () => {
    setMsg(null); setOcupado(true);
    try {
      const o = await llamar("POST", `${base}/registro/opciones`);
      const cred = await navigator.credentials.create({ publicKey: { challenge: b64uToBuf(o.challenge), rp: o.rp, user: { id: b64uToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName }, pubKeyCredParams: o.pubKeyCredParams, authenticatorSelection: o.authenticatorSelection, attestation: "none", timeout: o.timeout } });
      const r = cred.response;
      if (typeof r.getPublicKey !== "function") throw new Error("Este navegador no es compatible. Usa Chrome o Safari actualizado.");
      await llamar("POST", `${base}/registro/verificar`, { retoId: o.retoId, id: cred.id, clientDataJSON: bufToB64u(r.clientDataJSON), publicKey: bufToB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm() });
      setMsg({ tipo: "ok", texto: "Tu huella o rostro quedó registrado" });
      await cargar();
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setOcupado(false);
  };

  const checar = async (tipo) => {
    setMsg(null); setOcupado(true);
    try {
      const pos = await ubicacion();
      const o = await llamar("POST", `${base}/checar/opciones`, { tipo });
      const cred = await navigator.credentials.get({ publicKey: { challenge: b64uToBuf(o.challenge), rpId: o.rpId, userVerification: "required", timeout: o.timeout, allowCredentials: o.credenciales.map((id) => ({ type: "public-key", id: b64uToBuf(id) })) } });
      const r = cred.response;
      const res = await llamar("POST", `${base}/checar/verificar`, { retoId: o.retoId, id: cred.id, clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData), signature: bufToB64u(r.signature), lat: pos?.lat, lng: pos?.lng, precision: pos?.precision });
      setMsg({ tipo: "ok", texto: `${res.tipo === "entrada" ? "Entrada" : "Salida"} registrada a las ${res.hora}` });
      await cargar();
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setOcupado(false);
  };

  const tarjeta = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 };
  const grande = (fondo, activo) => ({ flex: 1, minWidth: 160, border: "none", background: fondo, color: "#fff", fontSize: 16, fontWeight: 700, padding: "18px 16px", borderRadius: 12, cursor: activo ? "pointer" : "default", opacity: activo ? 1 : 0.5, fontFamily: "inherit" });
  const puedeEntrada = datos?.registrado && !datos.entrada && !ocupado;
  const puedeSalida = datos?.registrado && datos.entrada && !datos.salida && !ocupado;

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px", color: C.ink }}>{titulo}</h1>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16 }}>Checa con tu huella o rostro, conectado al Wi-Fi y estando en el lugar de trabajo.</div>

      {!soportado && <div style={{ background: "#FBE7E5", color: C.bad, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>Este navegador no permite usar la huella o el rostro. Usa Chrome o Safari actualizado.</div>}
      {msg && <div style={{ background: msg.tipo === "ok" ? "#E3F4EA" : "#FBE7E5", color: msg.tipo === "ok" ? C.ok : C.bad, borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{msg.texto}</div>}
      {!datos && !msg && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}

      {datos && !datos.registrado && (
        <div style={tarjeta}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Registra tu huella o rostro</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 12 }}>Es un paso de una sola vez. Tu equipo te pedirá tu huella o tu rostro; aquí no se guarda ninguno de los dos. Después solo tú podrás checar con esta cuenta.</div>
          <button disabled={ocupado || !soportado} onClick={registrar} style={{ border: "none", background: C.brand, color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 22px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", opacity: ocupado ? 0.5 : 1 }}>{ocupado ? "Esperando…" : "Registrar huella o rostro"}</button>
        </div>
      )}

      {datos && (
        <div style={tarjeta}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Hola, {getUsername?.() || datos.usuario}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={!puedeEntrada || !soportado} onClick={() => checar("entrada")} style={grande(C.brand, puedeEntrada && soportado)}>{ocupado ? "Verificando…" : "Registrar entrada"}</button>
            <button disabled={!puedeSalida || !soportado} onClick={() => checar("salida")} style={grande(C.ink, puedeSalida && soportado)}>{ocupado ? "Verificando…" : "Registrar salida"}</button>
          </div>
          {!datos.configurado && <div style={{ fontSize: 12, color: C.bad, marginTop: 10 }}>Todavía no está configurada la red del lugar de trabajo. Pídele a un administrador que la registre en Configuración de cuenta → Checador.</div>}
        </div>
      )}

      {datos && (
        <div style={tarjeta}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>Hoy · {datos.fecha}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{datos.entrada ? `Entrada ${datos.entrada}` : "Sin entrada"}{datos.entrada ? (datos.salida ? ` · Salida ${datos.salida}` : " · sin salida") : ""}</div>
        </div>
      )}
    </div>
  );
}
