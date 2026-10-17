import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://muzaroni.github.io',
  base: '/poe',
  output: 'static',
  integrations: [react()],
  vite: {
    cacheDir: process.argv.includes('dev') ? 'node_modules/.vite-dev' : 'node_modules/.vite-build',
    plugins: [tailwindcss()],
  },
});
