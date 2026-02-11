import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  // 1. SMART PATH LOGIC
  // If running "npm run build", use your repo name "/Tallies/"
  // If running "npm run dev", use "/"
  const basePath = command === 'serve' ? '/' : '/Tallies/';

  return {
    base: basePath,
    server: {
      port: 5173,
      open: false,
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        scope: basePath,
        base: basePath,
        
        // This makes sure the PWA works immediately even if offline
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          cleanupOutdatedCaches: true
        },

        // YOUR MANIFEST (Moved here for safety)
        manifest: {
          name: "Tally App",
          short_name: "Tally App",
          description: "Offline-first tree planting tally app",
          start_url: basePath, // <--- Auto-fixed to match your deployment!
          display: "standalone",
          background_color: "#f8fafc",
          theme_color: "#0f766e",
          icons: [
            {
              src: "icons/icon-192x192.png", // Note: No "./" needed, plugin handles it
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "icons/icon-1080x1080.png",
              sizes: "1080x1080",
              type: "image/png",
              purpose: "any maskable"
            }
          ]
        }
      })
    ],
  };
});