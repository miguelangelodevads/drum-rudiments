import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon.svg"],
      manifest: {
        name: "Drum Studio Pro",
        short_name: "DrumPro",
        description: "Aplicação de treino de rudimentos para bateristas",
        theme_color: "#0f172a",
        background_color: "#020617",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "icon.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  base: "/drum-rudiments/",
});
