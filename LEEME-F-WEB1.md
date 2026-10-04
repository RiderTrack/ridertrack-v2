# LEEME — F-WEB1: Versión web en GitHub Pages

## ¿Qué se hizo?

RiderTrack V2 ahora tiene **versión web completa** publicada en GitHub Pages,
construida desde el mismo código fuente que el APK Android (React + Vite +
Capacitor). Se reemplazó la página vieja de `docs/` por la build real de la app.

## URL de acceso

- **Versión web:** https://ridertrack.github.io/ridertrack-v2/
- **APK Android:** sigue siendo el canal principal (workflow build-apk.yml)

## El cambio técnico (parche quirúrgico)

Un solo cambio en `vite.config.ts`:

```ts
base: './'
```

Esto hace que la build use **rutas relativas** en vez de absolutas, con dos
beneficios concretos:

1. Funciona servida en la subruta de GitHub Pages (`/ridertrack-v2/`)
2. Va a funcionar también en el dominio propio (`trackverse.cloud`) cuando se
   conecte, **sin recompilar**

## Qué incluye la versión web

- Pantalla de login (email/contraseña + Google) con Firebase Auth
- Todos los módulos de la app: Dashboard, Pedidos, Rutas, Mapas, WhatsApp,
  Medios, Caja, Clientes, Broadcast, Backups y Temas
- Avatares, iconos y estilos completos (60+ assets)

## Verificación realizada

- Build exitosa (`npm run build`, 14.9 s, sin errores)
- Servidor local de prueba: HTTP 200 en HTML y assets
- Verificación visual con navegador headless: login renderizado completo,
  cero errores de JavaScript en consola

## Limitaciones conocidas de la web (vs APK)

- Funciones 100% nativas del teléfono (cámara con flash, GPS en segundo
  plano, notificaciones locales) pueden comportarse distinto o degradarse
- La sincronización con Firestore funciona igual que en el APK (misma
  configuración de Firebase embebida)

## Cómo rehacer la build en el futuro

```bash
npm install          # usa .npmrc (legacy-peer-deps)
npm run build        # genera dist/
# copiar dist/* → docs/  y commitear
git add docs && git commit -m "F-WEBx: nueva build web" && git push
```

GitHub Pages se reconstruye automáticamente al pushear cambios en `docs/`.

## Pendiente (no hacer todavía, decisión del dueño)

- Conectar el dominio propio `trackverse.cloud` (requiere registros DNS)
- Restringir acceso / cuentas / qué se sincroniza cuando pase a producción

## Cambios en archivos

| Archivo | Cambio |
|---------|--------|
| `vite.config.ts` | + `base: './'` (1 línea, F-WEB1) |
| `docs/` | Reemplazado: página vieja → build real (47 archivos) |

— F-WEB1, registrado también en el worklog del asistente.
