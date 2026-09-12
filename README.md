# 🛡️ RiderTrack V2

**Sistema profesional de gestión para riders** — pedidos, clientes, rutas, WhatsApp, caja y medios en una sola app móvil (APK Android).

## 📱 ¿Qué es?

RiderTrack V2 es la nueva interfaz React del sistema RiderTrack: un panel completo para la gestión diaria del repartidor — desde la toma de pedidos hasta el cierre de caja, con mapas en vivo, integración de WhatsApp (oficial y personal), medios (Spotify, radio, podcasts, YouTube) y motorización GPS.

## ✨ Funcionalidades

| Módulo | Qué hace |
|--------|----------|
| 📊 Dashboard | KPIs del día, actividad y notificaciones |
| 📦 Pedidos | Alta, control de entrega, pagos y evidencia fotográfica |
| 🧭 Rutas | Optimización, cronómetro, odómetro GPS y modo moto |
| 🗺️ Mapas | Google Maps y Leaflet en vivo con seguimiento |
| 💬 WhatsApp | RiderChat (API oficial Meta) y WhatsApp personal (Baileys) |
| 🎵 Medios | Spotify, radio HLS, podcasts y YouTube con mini-reproductor |
| 💰 Caja | Resumen diario, historial y exportación a Excel |
| 👥 Clientes | Registro, autocompletado de direcciones, catálogo y galería |
| 📣 Broadcast | Campañas masivas y plantillas de mensajes |
| ☁️ Backups | Respaldos en Firestore y descargas |
| 🎨 Temas | Estudio de temas con sincronización en la nube |

## 🧱 Stack técnico

- **React 19 + TypeScript + Vite 6**
- **Tailwind CSS 4** + Lucide (íconos) + Motion (animaciones)
- **Capacitor 6** — empaqueta la web como APK Android
- **Firebase** — Auth (Google/contraseña) + Firestore + Storage
- **Google Maps Platform** — Maps JavaScript, Geocoding, Places y Directions
- **Recharts** (estadísticas) + ExcelJS (exportaciones)

## 📁 Estructura del proyecto

```
src/
├── App.tsx            # Orquestador principal (pestañas y overlays)
├── components/
│   ├── medios/        # Spotify, radio, podcasts, YouTube
│   ├── riderchat/     # Chat por WhatsApp API oficial (Meta)
│   ├── order/         # Centro de control del pedido
│   ├── navegacion/    # GPS y navegación
│   └── ui/            # Componentes base (botones, modales, KPIs)
├── services/          # Firebase, Google Maps, WhatsApp, Spotify...
├── hooks/             # useAuth, useClientes, useConfig...
├── theme/             # Motor de temas + sincronización remota
├── utils/             # Núcleos de negocio (caja, odómetro, resumen...)
└── data/              # Avatares y datos estáticos
```

## 🚀 Desarrollo local

**Requisitos:** Node.js 20 o superior.

```bash
# 1. Instalar dependencias
npm install --legacy-peer-deps

# 2. Servidor de desarrollo (http://localhost:3000)
npm run dev

# 3. Verificación de tipos
npm run lint

# 4. Build de producción (genera dist/)
npm run build
```

> ⚠️ El flag `--legacy-peer-deps` es necesario temporalmente: hay un
> conflicto de versiones entre Capacitor 6 y `@capacitor-community/text-to-speech`.

## 📦 Build del APK (automático)

Cada push a `main` dispara el workflow **Build RiderTrack V2 APK** en GitHub Actions:

1. Compila la web (`vite build`)
2. Genera el proyecto Android (`cap add android`)
3. Aplica ícono RiderTrack, splash, permisos y deep link de Spotify
4. Firma el APK con el keystore (secreto `KEYSTORE_BASE64`)
5. Publica el artefacto **RiderTrackV2-APK** (retención de 30 días)

También se puede lanzar manualmente: **Actions → Build RiderTrack V2 APK → Run workflow**.

## 🔐 Configuración

- `google-services.json` — configuración Firebase (incluida en el repo)
- `firestore.rules` — reglas de seguridad de Firestore (deploy: `firebase deploy --only firestore:rules`)
- API key de Google Maps — preconfigurada de fábrica, editable desde la app en **Configuración → Mapas y Rutas**

## 🗺️ Historial de fases

El desarrollo avanza por fases trazables en el historial de commits (F2.x – F5.1): mapas en vivo, chat Baileys, RiderChat, medios por chat personal, estudio de temas, modo moto, odómetro GPS y mantenimiento.
