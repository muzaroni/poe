import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  devToolbar: { enabled: false },
  site: 'https://muzaroni.github.io',
  base: '/poe',
  output: 'static',
  integrations: [react()],
  vite: {
    cacheDir: process.argv.includes('dev') ? 'node_modules/.vite-dev' : 'node_modules/.vite-build',
    plugins: [tailwindcss(), {
      name: 'refresh-guide-library',
      configureServer(server) {
        const refresh = (file) => {
          if (!file.replaceAll('\\', '/').includes('/src/content/builds/') || !file.endsWith('.json')) return;
          // New guide files must also refresh the eager content glob.
          server.moduleGraph.invalidateAll();
          server.ws.send({ type: 'full-reload' });
        };
        server.watcher.on('add', refresh);
        server.watcher.on('unlink', refresh);
        server.httpServer?.once('close', () => {
          server.watcher.off('add', refresh);
          server.watcher.off('unlink', refresh);
        });
      },
    }],
  },
});
