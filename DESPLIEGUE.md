# Cómo dejar la app disponible en internet (gratis)

Son 3 cuentas gratuitas y ningún dato de tarjeta. Cada una toma 2-3 minutos. Sigue el
orden — cada paso usa algo del anterior.

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

---

Cuando tengas la cuenta de Neon lista y el connection string a la mano, dímelo y seguimos con
el resto juntos — puedo ir revisando cada paso contigo.
