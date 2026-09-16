import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        proxy: {
            "/api": "http://localhost:5050",
        },
    },
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg"],
            manifest: {
                name: "Grimoire",
                short_name: "Grimoire",
                theme_color: "#0b0b10",
                background_color: "#0b0b10",
                display: "standalone",
                icons: [
                    { src: "favicon.svg", sizes: "any", type: "image/svg+xml" }
                ]
            }
        })
    ]
});
