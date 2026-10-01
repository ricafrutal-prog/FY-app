import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // App.jsx ya es un archivo muy grande (todo Gestión vive ahí) — el
    // minificador de producción se estaba quedando sin memoria en el plan
    // gratuito de Render ("JavaScript heap out of memory") al intentar
    // comprimirlo. Se desactiva el minificado para que el build no truene;
    // el archivo final pesa más, pero carga bien igual — no es una app
    // pública de alto tráfico donde ese peso importe.
    minify: false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
