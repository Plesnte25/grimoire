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
            workbox: {
                globIgnores: ["**/noto-sans-*.woff2"],
                runtimeCaching: [
                    {
                        urlPattern: /\/assets\/noto-sans-.*\.woff2$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "grimoire-script-fonts",
                            expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        urlPattern: /\/assets\/[a-z]{2}-[A-Za-z0-9_-]+\.svg$/,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "grimoire-country-flags",
                            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
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
