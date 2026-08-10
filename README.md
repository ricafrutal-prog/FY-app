# Plataforma Operativa — versión funcional (Auditoría Interna)

Esto convierte el módulo **Auditoría Interna** del prototipo (`plataforma-operativa.jsx`) en
una app real: los datos que captures (recepciones de cortes, conteos, entregas de efectivo,
sucursales, nombres) se guardan de verdad en una base de datos y siguen ahí aunque cierres
el navegador o se reinicie el servidor.

El resto de la plataforma (Tareas, Finanzas, Remodelaciones, Capital Humano, etc.) **no se
tocó** — sigue funcionando exactamente igual que en el prototipo original, con datos de
ejemplo. Cuando quieras que otro módulo sea real, se agrega igual que este.

## Cómo está armado

- `backend/` — servidor Node + Express. Guarda todo en una base de datos **Postgres en la nube
  (Neon, gratis)** — no depende de que ninguna computadora en particular esté prendida.
- `frontend/` — la misma interfaz del prototipo (React), ahora compilada con Vite en vez de
  cargarse "al vuelo" en el navegador. Es el mismo archivo `plataforma-operativa.jsx` que ya
  tenías, copiado a `frontend/src/App.jsx`, con un cambio mínimo: donde Auditoría Interna
  guardaba todo con `useState` (en memoria), ahora usa un par de funciones
  (`usePersistedCollection` / `usePersistedList`, en `frontend/src/hooks/persistence.js`) que
  cargan y guardan esos mismos datos contra el servidor. La lógica de flujo, validaciones,
  teclado, cálculos — todo lo que ya tenías funcionando — sigue intacta, no se reescribió nada
  de eso.

### Diseño de la base de datos

Postgres real (no una simulación), con dos tablas:

- `collection_items`: guarda cada recepción / conteo / borrador / entrega como una fila
  (id + los datos en JSON). Es un diseño simple a propósito, para no tener que adivinar y
  fijar de antemano cada campo posible del formulario — si mañana agregas un campo nuevo a
  algún formulario, no hay que tocar la base de datos.
- `config_lists`: guarda las listas editables (sucursales, nombres de quien entrega/recibe).

Si más adelante quieres reportes cruzados más pesados directo en SQL (no solo lo que ya
calculan las pantallas), puedo normalizar esto a columnas reales — pero para el uso actual
(2-3 personas capturando) esto es más que suficiente y mucho más simple de mantener.

## Cómo correrlo en tu computadora

Necesitas Node.js instalado (ya lo tienes) y una base de datos de Neon ya creada — ver
`DESPLIEGUE.md` para eso. Desde la carpeta `app/`:

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

## Ponerlo disponible para varias personas

Ya que quedó decidido usar hosting en internet (gratis), toda la guía paso a paso —crear la
base de datos, subir el código a GitHub, publicarlo en Render— está en **`DESPLIEGUE.md`**,
en esta misma carpeta. Una vez publicado, cualquiera con el link puede entrar desde cualquier
lugar, sin depender de que tu computadora esté prendida.

## Qué falta / próximos pasos posibles

- Probar el flujo completo tú mismo (Recepción → Conteo → Entrega) y confirmar que el
  comportamiento coincide con `auditoria-interna-detalle.md`.
- Si quieres, migrar otro módulo (Finanzas, Tareas, etc.) al mismo patrón de base de datos real.
- Un sistema de usuarios/permisos real (hoy la "contraseña" de Editar sigue siendo el `9191`
  fijo del prototipo, tal como estaba documentado).
