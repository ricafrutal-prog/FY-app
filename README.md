# Plataforma Operativa — versión funcional (Auditoría Interna)

Esto convierte el módulo **Auditoría Interna** del prototipo (`plataforma-operativa.jsx`) en
una app real: los datos que captures (recepciones de cortes, conteos, entregas de efectivo,
sucursales, nombres) se guardan de verdad en una base de datos y siguen ahí aunque cierres
el navegador o se reinicie el servidor.

El resto de la plataforma (Tareas, Finanzas, Remodelaciones, Capital Humano, etc.) **no se
tocó** — sigue funcionando exactamente igual que en el prototipo original, con datos de
ejemplo. Cuando quieras que otro módulo sea real, se agrega igual que este.

## Cómo está armado

- `backend/` — servidor Node + Express. Guarda todo en un archivo SQLite (`backend/data.sqlite`),
  que se crea solo la primera vez que corres el servidor.
- `frontend/` — la misma interfaz del prototipo (React), ahora compilada con Vite en vez de
  cargarse "al vuelo" en el navegador. Es el mismo archivo `plataforma-operativa.jsx` que ya
  tenías, copiado a `frontend/src/App.jsx`, con un cambio mínimo: donde Auditoría Interna
  guardaba todo con `useState` (en memoria), ahora usa un par de funciones
  (`usePersistedCollection` / `usePersistedList`, en `frontend/src/hooks/persistence.js`) que
  cargan y guardan esos mismos datos contra el servidor. La lógica de flujo, validaciones,
  teclado, cálculos — todo lo que ya tenías funcionando — sigue intacta, no se reescribió nada
  de eso.

### Diseño de la base de datos

Es SQLite real (no una simulación), con dos tablas:

- `collection_items`: guarda cada recepción / conteo / borrador / entrega como una fila
  (id + los datos en JSON). Es un diseño simple a propósito, para no tener que adivinar y
  fijar de antemano cada campo posible del formulario — si mañana agregas un campo nuevo a
  algún formulario, no hay que tocar la base de datos.
- `config_lists`: guarda las listas editables (sucursales, nombres de quien entrega/recibe).

Si más adelante quieres reportes cruzados más pesados directo en SQL (no solo lo que ya
calculan las pantallas), puedo normalizar esto a columnas reales — pero para el uso actual
(2-3 personas capturando) esto es más que suficiente y mucho más simple de mantener.

## Cómo correrlo en tu computadora

Necesitas Node.js instalado (ya lo tienes, según lo que hemos platicado). Desde la carpeta `app/`:

```bash
npm run install:all   # instala las dependencias de backend y frontend (una sola vez)
npm run dev            # levanta backend (puerto 4000) y frontend (puerto 5173) juntos
```

Abre `http://localhost:5173` — ahí está la plataforma completa, con Auditoría Interna ya
guardando en la base de datos real.

**Importante:** no pude correr `npm install` yo mismo para probarlo de punta a punta —el
entorno donde trabajo tiene bloqueado el acceso al registro de npm por seguridad. El código
está escrito y revisado con cuidado, pero te pido que lo corras tú una vez con los comandos de
arriba y me digas si algo truena; lo reviso y lo corrijo de inmediato.

## Ponerlo disponible para 2-3 personas en la empresa

Con ese volumen de uso no hace falta nada complicado. Dos opciones:

1. **Una sola computadora hace de "servidor"** (por ejemplo tu equipo o uno dedicado en la
   oficina, conectado a la red de la empresa): corres `npm run build` y luego `npm start`
   desde `app/` — eso sirve la app completa (interfaz + datos) en un solo puerto (4000). Cualquiera
   en la misma red la abre en su navegador usando la IP de esa computadora, ej.
   `http://192.168.1.X:4000`. Mientras esa computadora esté prendida, la app está disponible.
2. **Hosting simple en internet** (Render, Railway, o similar): subes este mismo proyecto y
   queda accesible por una URL normal, sin depender de que una computadora específica esté
   prendida. Si quieres ir por aquí, te ayudo a dejarlo listo para ese hosting cuando llegue el
   momento.

Para tu escenario (1-2 personas capturando a la vez, rara vez 3) cualquiera de las dos
alcanza sin problema.

## Qué falta / próximos pasos posibles

- Probar el flujo completo tú mismo (Recepción → Conteo → Entrega) y confirmar que el
  comportamiento coincide con `auditoria-interna-detalle.md`.
- Si quieres, migrar otro módulo (Finanzas, Tareas, etc.) al mismo patrón de base de datos real.
- Un sistema de usuarios/permisos real (hoy la "contraseña" de Editar sigue siendo el `9191`
  fijo del prototipo, tal como estaba documentado).
