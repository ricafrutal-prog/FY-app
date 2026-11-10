import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { apiFetch } from "./auth";
import Checador from "./Checador.jsx";

// Checador del personal, desde el celular (o tableta) de la sucursal, con la sesión de la sucursal abierta.
// 1) Se registra la huella o el rostro de cada persona dada de alta (el celular lo pide y lo guarda ÉL, aquí
//    nunca se guarda ninguna huella). 2) Cada quien registra su entrada o su salida con su huella o rostro.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", lineSoft: "#F0EEE8", paper: "#F1F3F2", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", ok: "#2E9E5B", warn: "#B07A12" };

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
  if (e?.name === "InvalidStateError") return "Esa huella o rostro ya está registrada en este celular.";
  return e?.message || "No se pudo completar";
};

export default function ChecadorSucursal({ onVolver }) {
  const [datos, setDatos] = useState(null);
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [verConfig, setVerConfig] = useState(false);
  const soportado = !!window.PublicKeyCredential && !!navigator.credentials;

  const cargar = useCallback(async () => {
    try { setDatos(await llamar("GET", "/api/checador/kiosco")); } catch (e) { setMsg({ tipo: "error", texto: e.message }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const registrar = async (nombre) => {
    setMsg(null); setOcupado(true);
    try {
      const o = await llamar("POST", "/api/checador/kiosco/registro/opciones", { nombre });
      const cred = await navigator.credentials.create({ publicKey: { challenge: b64uToBuf(o.challenge), rp: o.rp, user: { id: b64uToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName }, pubKeyCredParams: o.pubKeyCredParams, authenticatorSelection: o.authenticatorSelection, attestation: "none", timeout: o.timeout } });
      const r = cred.response;
      if (typeof r.getPublicKey !== "function") throw new Error("Este navegador no es compatible. Usa Chrome o Safari actualizado.");
      await llamar("POST", "/api/checador/kiosco/registro/verificar", { retoId: o.retoId, id: cred.id, clientDataJSON: bufToB64u(r.clientDataJSON), publicKey: bufToB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm() });
      setMsg({ tipo: "ok", texto: `Huella o rostro de ${nombre} registrado` });
      await cargar();
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setOcupado(false);
  };

  const checar = async (tipo) => {
    setMsg(null); setOcupado(true);
    try {
      const pos = await ubicacion();
      const o = await llamar("POST", "/api/checador/kiosco/checar/opciones", { tipo });
      const cred = await navigator.credentials.get({ publicKey: { challenge: b64uToBuf(o.challenge), rpId: o.rpId, userVerification: "required", timeout: o.timeout, allowCredentials: o.credenciales.map((id) => ({ type: "public-key", id: b64uToBuf(id) })) } });
      const r = cred.response;
      const res = await llamar("POST", "/api/checador/kiosco/checar/verificar", { retoId: o.retoId, id: cred.id, clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData), signature: bufToB64u(r.signature), lat: pos?.lat, lng: pos?.lng, precision: pos?.precision });
      setMsg({ tipo: "ok", texto: `${res.empleado}: ${res.tipo === "entrada" ? "entrada" : "salida"} registrada a las ${res.hora}` });
      await cargar();
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setOcupado(false);
  };

  if (verConfig) {
    return (
      <div>
        <button onClick={() => setVerConfig(false)} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}><ChevronLeft size={14} /> Checador del personal</button>
        <Checador />
      </div>
    );
  }

  const pendientes = datos ? datos.personal.filter((p) => !p.registrado) : [];
  const hayRegistrados = datos ? datos.personal.some((p) => p.registrado) : false;
  const tarjeta = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 16px", marginBottom: 14 };
  const grande = (fondo, activo) => ({ flex: 1, minWidth: 160, border: "none", background: fondo, color: "#fff", fontSize: 16, fontWeight: 700, padding: "18px 16px", borderRadius: 12, cursor: activo ? "pointer" : "default", opacity: activo ? 1 : 0.5, fontFamily: "inherit" });

  return (
    <div>
      <button onClick={onVolver} style={{ background: "none", border: "none", color: C.brand, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}><ChevronLeft size={14} /> Registro asistencia</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: C.ink }}>Checador del personal</h1>
        <button onClick={() => setVerConfig(true)} style={{ border: `1px solid ${C.line}`, background: "#fff", color: C.ink, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Red y ubicación de la sucursal</button>
      </div>

      {!soportado && <div style={{ background: "#FBE7E5", color: C.bad, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, marginBottom: 14 }}>Este navegador no permite usar la huella o el rostro. Abre la plataforma en Chrome o Safari actualizado.</div>}
      {msg && <div style={{ background: msg.tipo === "ok" ? "#E3F4EA" : "#FBE7E5", color: msg.tipo === "ok" ? C.ok : C.bad, borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{msg.texto}</div>}
      {!datos && !msg && <div style={{ fontSize: 13, color: C.muted }}>Cargando…</div>}

      {datos && pendientes.length > 0 && (
        <div style={tarjeta}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Pendientes de registrar su huella o rostro</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>Cada persona debe estar presente. Al pulsar "Registrar", el celular le pedirá su huella o su rostro.</div>
          {pendientes.map((p) => (
            <div key={p.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${C.lineSoft}`, flexWrap: "wrap" }}>
              <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.nombre}</div>{p.puesto && <div style={{ fontSize: 11.5, color: C.muted }}>{p.puesto}</div>}</div>
              <button disabled={ocupado || !soportado} onClick={() => registrar(p.nombre)} style={{ border: "none", background: C.brand, color: "#fff", fontSize: 12.5, fontWeight: 600, padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", opacity: ocupado ? 0.5 : 1 }}>{ocupado ? "Esperando…" : "Registrar huella o rostro"}</button>
            </div>
          ))}
        </div>
      )}

      {datos && (
        <div style={tarjeta}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Checar ahora</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button disabled={ocupado || !soportado || !hayRegistrados} onClick={() => checar("entrada")} style={grande(C.brand, !ocupado && soportado && hayRegistrados)}>{ocupado ? "Verificando…" : "Registrar entrada"}</button>
            <button disabled={ocupado || !soportado || !hayRegistrados} onClick={() => checar("salida")} style={grande(C.ink, !ocupado && soportado && hayRegistrados)}>{ocupado ? "Verificando…" : "Registrar salida"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10 }}>Quien checa pulsa entrada o salida y confirma con su huella o rostro. Hace falta estar en el Wi-Fi de la sucursal con la ubicación activada.</div>
        </div>
      )}

      {datos && (
        <div style={tarjeta}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Hoy · {datos.fecha}</div>
          {datos.personal.length === 0 && <div style={{ fontSize: 12.5, color: C.muted }}>No hay personal dado de alta en esta sucursal.</div>}
          {datos.personal.map((p) => (
            <div key={p.nombre} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.lineSoft}`, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{p.nombre}</span>
              <span style={{ color: C.muted }}>{!p.registrado ? "Sin huella o rostro registrado" : p.entrada ? `Entrada ${p.entrada}${p.salida ? ` · Salida ${p.salida}` : " · sin salida"}` : "Sin entrada"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
