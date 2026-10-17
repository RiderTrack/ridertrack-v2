import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // ── FASE AB-3: arranque en paralelo ─────────────────────────────
      // El paquete base de AB-2 (1,553 KB en UN solo archivo) se parte en
      // trozos que el WebView descarga y compila EN PARALELO (streaming
      // compile por archivo). Mismos módulos, mismo momento de carga:
      // cero cambios de comportamiento — solo empaquetado.
      // Solo se agrupan librerías que YA van en el arranque hoy (eager);
      // recharts/leaflet/hls/exceljs/xlsx/qr quedan on-demand como en AB-2.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) return 'firebase';
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'icons';
            if (/[\\/]node_modules[\\/]@capacitor[\\/]/.test(id)) return 'capacitor';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
