# Cómo dejar la app disponible en internet (gratis)

Son 3 cuentas gratuitas y ningún dato de tarjeta. Cada una toma 2-3 minutos. Sigue el
orden — cada paso usa algo del anterior.

**Los pasos 1-4 ya están hechos** (Neon, GitHub y Render ya están conectados y la app ya
está publicada). Los dejo aquí de referencia. Si necesitas agregar más adelante otro
servicio o repetir el proceso en otra cuenta, sirven igual. Lo nuevo es el **paso 5**, para
que la app pida usuario y contraseña.

---

## 1. Base de datos — Neon (Postgres gratis)

1. Ve a **neon.tech** → **Sign up** (puedes entrar con tu cuenta de Google, es lo más rápido).
2. Te va a pedir crear un proyecto — dale el nombre que quieras, ej. "frutal-yogurt". Acepta
   la región por default.
3. En el dashboard del proyecto, busca **"Connection string"** (a veces dice "Connection
   Details"). Asegúrate de que diga **"Pooled connection"**. Cópialo — se ve algo así:
   `postgresql://usuario:contraseña@ep-xxxxx-pooler.neon.tech/neondb?sslmode=require`
4. Guarda ese texto, lo vas a usar dos veces (pasos 4 y 6 más abajo).

## 2. Probarlo en tu computadora con la base de datos real

1. Dentro de la carpeta `app/backend`, copia el archivo `.env.example` y renómbralo a `.env`.
2. Ábrelo (con TextEdit) y reemplaza la línea `DATABASE_URL=...` pegando el connection string
   que copiaste de Neon.
3. En Terminal, dentro de `app/backend`, corre `npm install` una vez (para instalar el nuevo
   conector de Postgres).
4. Corre `npm run dev` (o `npm run dev` desde `app/` como ya hacías) y prueba la app en
   `http://localhost:5173` — ahora ya está guardando en la nube, no en tu computadora.

## 3. Subir el código a GitHub

1. Ve a **github.com** → **Sign up** si no tienes cuenta.
2. Arriba a la derecha, el botón **+** → **New repository**. Nómbralo `frutal-yogurt-app`,
   déjalo **Private**, no marques ninguna casilla de "Add README" (ya tenemos uno). **Create
   repository**.
3. GitHub te va a mostrar unos comandos — no los uses, usa estos (ya vienen ajustados). Abre
   Terminal, entra a la carpeta `app` (igual que antes: `cd ` + arrastrar la carpeta), y corre,
   uno por uno:
   ```bash
   git remote add origin https://github.com/TU-USUARIO/frutal-yogurt-app.git
   git branch -M main
   git push -u origin main
   ```
   (Cambia `TU-USUARIO` por tu usuario real de GitHub — aparece en la URL que te mostró en el
   paso 2). La primera vez te va a pedir iniciar sesión — sigue las instrucciones en pantalla.

   Si algo marca *"Unable to create .git/index.lock"*, corre esto una vez y repite el `git push`:
   ```bash
   rm -f .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock
   ```

## 4. Hosting — Render (gratis)

1. Ve a **render.com** → **Sign up** (puedes usar tu cuenta de GitHub, así ya queda conectado).
2. **New +** → **Blueprint**.
3. Elige el repositorio `frutal-yogurt-app` que acabas de subir. Render va a detectar solo el
   archivo `render.yaml` que ya te dejé listo, con el nombre y los comandos correctos.
4. Te va a pedir el valor de **DATABASE_URL** — pega ahí el mismo connection string de Neon
   (paso 1.3).
5. Dale **Apply** / **Create**. Va a tardar unos minutos compilando. Cuando termine, Render te
   da una URL pública (algo como `https://frutal-yogurt-plataforma.onrender.com`) — esa es la
   que le compartes a quien necesite entrar.

**Nota sobre velocidad**: en el plan gratis, si nadie usa la app por 15 minutos, el servidor se
"duerme" y el siguiente que entre espera unos 30-50 segundos en cargar la primera vez. Después
de eso va normal. Es una limitación del plan gratis — si en algún momento estorba, se quita
pasando a un plan pagado (~$7 USD/mes).

## 5. Login — usuario y contraseña

Ahora toda la plataforma pide iniciar sesión antes de mostrar nada. Sin cuenta, nadie entra ni
ve datos, aunque tenga el link.

### Instalar lo nuevo y crear tu primer usuario

1. Terminal → `cd ` + arrastra la carpeta `app/backend` → Enter.
2. `npm install` (instala las piezas nuevas de login).
3. Crea tu usuario — cambia `ricardo` y la contraseña por lo que quieras usar (mínimo 6
   caracteres):
   ```bash
   npm run create-user -- ricardo unaContraseñaSegura123
   ```
   Repite este comando (con otro nombre de usuario) por cada persona que necesite entrar.
   Como la base de datos es la misma (Neon) tanto en tu compu como en la app publicada, con
   crear el usuario una vez ya sirve para las dos.
4. Prueba en `http://localhost:5173` (con `npm run dev` corriendo) — ahora debe pedirte
   usuario y contraseña antes de dejarte entrar.

### Publicar el cambio

5. Desde la carpeta `app`, en Terminal:
   ```bash
   git add -A
   git commit -m "Agregar login"
   git push
   ```
6. Render va a volver a compilar solo (unos minutos). Cuando termine, la URL pública también
   va a pedir usuario y contraseña.
7. Si después de unos minutos la URL pública **no** pide login todavía, entra al dashboard de
   Render → tu servicio → **Manual Deploy** → **Deploy latest commit**, para forzar que tome
   los cambios.

Nadie más puede crear su propio usuario desde la pantalla de login (a propósito, para que no
se registre cualquiera) — los usuarios solo se crean con el comando `npm run create-user` de
arriba, que solo tú puedes correr.
