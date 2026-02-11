import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },

  if (command === 'serve') {
    // DEV MODE (npm run dev)
    config.base = '/'
  } else {
    // BUILD MODE (npm run build)
    config.base = '/tallies-pwa/'
  }

  return config
});
