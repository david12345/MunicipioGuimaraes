import { defineConfig } from "vite";

// GitHub Pages serve o site a partir de /<repo>/, não da raiz do domínio.
// `BASE_URL` permite publicar noutro sítio sem editar isto.
const base = process.env.BASE_URL ?? "/MunicipioGuimaraes/";

export default defineConfig({
  base,
  build: {
    outDir: "dist",
    // Cada secção é um chunk próprio: o telemóvel só descarrega o que abre.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/d3")) return "d3";
        },
      },
    },
  },
});
