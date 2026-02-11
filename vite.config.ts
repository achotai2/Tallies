import { defineConfig } from 'vite';

// We use a function so we can use "if" statements
export default defineConfig(({ command }) => {
  
  // 1. Define the basic config
  const config = {
    server: {
      port: 5173,
      open: false,
    },
    base: '/', // Default (for localhost)
  };

  // 2. Logic: If we are building for GitHub, change the base path
  if (command !== 'serve') {
    config.base = '/Tallies/';
  }

  // 3. Return the final config object
  return config;
});