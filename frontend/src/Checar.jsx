import { useState } from "react";

// Página pública para checar desde el celular (/checar). El empleado no inicia sesión: se identifica con
// la huella o el rostro de su celular (passkey). Debe estar en el Wi-Fi de su sucursal y en la sucursal.
const C = { ink: "#16161B", muted: "#8C8C97", line: "#E6E3DB", brand: "#0F6E66", brandSoft: "#E4F0EE", bad: "#D6453F", ok: "#2E9E5B" };

const b64uToBuf = (s) => { const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(s).length / 4) * 4, "=")); return Uint8Array.from(b, (c) => c.charCodeAt(0)).buffer; };
const bufToB64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function post(url, cuerpo) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo || {}) });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error(d?.error || "No se pudo completar"); e.datos = d; throw e; }
  return d;
}

const ubicacion = () => new Promise((resolve) => {
  if (!navigator.geolocation) return resolve(null);
  navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
});

const errorBonito = (e) => {
  if (e?.name === "NotAllowedError") return "Se canceló o se acabó el tiempo. Vuelve a intentarlo y acepta la huella o el rostro.";
  if (e?.name === "InvalidStateError") return "Este celular ya está registrado.";
  return e?.message || "No se pudo completar";
};

export default function Checar() {
  const [modo, setModo] = useState("checar"); // checar | registro
  const [codigo, setCodigo] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: "ok"|"error", texto, detalle }
  const soportado = typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;

  const checar = async () => {
    setMsg(null); setTrabajando(true);
    try {
      const pos = await ubicacion(); // se pide primero para que el celular muestre el permiso
      const o = await post("/api/checador/checar/opciones");
      const cred = await navigator.credentials.get({ publicKey: { challenge: b64uToBuf(o.challenge), rpId: o.rpId, userVerification: "required", timeout: o.timeout } });
      const r = cred.response;
      const res = await post("/api/checador/checar/verificar", {
        retoId: o.retoId, id: cred.id,
        clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData), signature: bufToB64u(r.signature),
        lat: pos?.lat, lng: pos?.lng, precision: pos?.precision,
      });
      setMsg({ tipo: "ok", texto: res.repetida ? `Ya checaste tu entrada a las ${res.hora}` : `${res.tipo === "entrada" ? "Entrada" : "Salida"} registrada a las ${res.hora}`, detalle: `${res.empleado} · ${res.sucursal}` });
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setTrabajando(false);
  };

  const registrar = async () => {
    setMsg(null); setTrabajando(true);
    try {
      const o = await post("/api/checador/registro/opciones", { codigo: codigo.trim() });
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: b64uToBuf(o.challenge), rp: o.rp, user: { id: b64uToBuf(o.user.id), name: o.user.name, displayName: o.user.displayName },
          pubKeyCredParams: o.pubKeyCredParams, authenticatorSelection: o.authenticatorSelection, attestation: "none", timeout: o.timeout,
        },
      });
      const r = cred.response;
      if (typeof r.getPublicKey !== "function") throw new Error("Este navegador no es compatible. Actualiza tu navegador o usa Chrome/Safari.");
      await post("/api/checador/registro/verificar", {
        retoId: o.retoId, id: cred.id, clientDataJSON: bufToB64u(r.clientDataJSON),
        publicKey: bufToB64u(r.getPublicKey()), alg: r.getPublicKeyAlgorithm(),
      });
      setCodigo(""); setModo("checar");
      setMsg({ tipo: "ok", texto: "Listo, tu celular quedó registrado", detalle: `${o.empleado}. Ya puedes checar con tu huella o rostro.` });
    } catch (e) { setMsg({ tipo: "error", texto: errorBonito(e) }); }
    setTrabajando(false);
  };

  const boton = (activo = true) => ({ width: "100%", border: "none", background: C.brand, color: "#fff", fontSize: 17, fontWeight: 700, padding: "18px 20px", borderRadius: 14, cursor: activo ? "pointer" : "default", opacity: activo ? 1 : 0.5, fontFamily: "inherit" });

  return (
    <div style={{ minHeight: "100vh", background: "#F1F3F2", display: "flex", justifyContent: "center", padding: "32px 18px", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: C.ink }}>
      <div style={{ width: "100%", maxWidth: 420, display: "grid", gap: 18, alignContent: "start" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 26, fontWeight: 700 }}>Checador</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Frutal Yogurt</div>
        </div>

        {!soportado && <div style={{ background: "#FBE7E5", color: C.bad, borderRadius: 12, padding: 14, fontSize: 13.5 }}>Este navegador no permite usar la huella o el rostro. Abre esta página en Chrome o Safari desde tu celular.</div>}

        {msg && (
          <div style={{ background: msg.tipo === "ok" ? "#E3F4EA" : "#FBE7E5", color: msg.tipo === "ok" ? C.ok : C.bad, borderRadius: 14, padding: 16, fontSize: 14.5, fontWeight: 600, textAlign: "center" }}>
            {msg.texto}
            {msg.detalle && <div style={{ fontSize: 12.5, fontWeight: 500, marginTop: 4, color: C.ink }}>{msg.detalle}</div>}
          </div>
        )}

        {modo === "checar" ? (
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, display: "grid", gap: 14 }}>
            <button onClick={checar} disabled={!soportado || trabajando} style={boton(soportado && !trabajando)}>{trabajando ? "Verificando…" : "Checar entrada / salida"}</button>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>Conéctate al Wi-Fi de tu sucursal, activa la ubicación del celular y confirma con tu huella o rostro.</div>
            <button onClick={() => { setModo("registro"); setMsg(null); }} style={{ background: "none", border: "none", color: C.brand, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Registrar mi celular (primera vez)</button>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, display: "grid", gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Registrar mi celular</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Pídele a tu sucursal o a Recursos Humanos tu código de 6 dígitos (dura 15 minutos). Después tu celular te pedirá crear tu acceso con huella o rostro.</div>
            <input value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código de 6 dígitos" style={{ padding: "14px 12px", borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 20, textAlign: "center", letterSpacing: "0.2em", fontFamily: "inherit", outline: "none" }} />
            <button onClick={registrar} disabled={!soportado || trabajando || codigo.length !== 6} style={boton(soportado && !trabajando && codigo.length === 6)}>{trabajando ? "Registrando…" : "Registrar"}</button>
            <button onClick={() => { setModo("checar"); setMsg(null); }} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>‹ Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}
