# LEEME — FASE A: DriverTrack integrado en RiderTrack V2

## ¿Qué se hizo?

**DriverTrack (la app de tus viajes libres de inDrive) ahora vive DENTRO de
RiderTrack V2 como una sección más del menú: "inDrive (Libre)"** — un solo
APK para el trabajo y para los viajes libres. El APK standalone de
DriverTrack sigue existiendo en su repo, pero ya no lo necesitás: todo lo
que hacías ahí está acá.

## Dónde queda en la app

Menú lateral (o hamburguesa en el celular) → **inDrive (Libre)** 🚕,
después de "Mi Perfil Rider". Adentro entran las 5 pestañas de siempre:
**Viajes · Caja · Mapa · Stats · Ajustes**, con TODO lo que ya conocés:

- Viaje rápido con escáner IA (Gemini + Claude de respaldo)
- 🤖 Cobro por robot y cobro con QR de Yape
- 📊 Stats (zonas de oro, horas de oro, precio piso S//km)
- 📍 Grabación GPS por viaje (km reales + ruta en el mapa)
- 💸 Gastos del día (recargas, gasolina…) y "En mano"
- 🎯 Meta diaria con confeti, modo claro/oscuro, backup JSON/CSV

## Lo más importante: TUS DATOS NO SE PIERDEN

DriverTrack guarda todo en `localStorage` con claves propias
(`dt_viajes_v1`, `dt_config_v1`, `dt_gastos_v1`, `dt_tema_v1`). Esas claves
son las MISMAS que usaba el APK standalone → **si ya tenías el APK de
DriverTrack instalado en este teléfono, tus viajes, gastos, tu QR de Yape
y tu configuración aparecen solos** la primera vez que abras la sección.
Cero migración, cero exportar/importar.

Y siguen SEPARADOS del trabajo: los pedidos de MATE viven en Firestore,
los viajes inDrive viven en el teléfono con sus claves dt_* — nunca se
mezclan.

## Cambios técnicos (para el futuro yo)

| Archivo | Cambio |
|---------|--------|
| `src/drivertrack/` | NUEVO — módulo completo (21 archivos): components, services, storage, theme, types, utils. Importado tal cual del repo drivertrack@v0.4.1, sin cambios de rutas |
| `src/drivertrack/DriverTrackView.tsx` | El App.tsx de DT convertido en vista: tema scopeado a `.dt-app` (no toca el `<html>`), prop `activa`, header sticky `top-16` (debajo del header de RT), resize event al volver (Leaflet recalibra) |
| `src/drivertrack/tipos.ts` | NUEVO — shim `EvArchivo` (RT no usa @types/react; React.ChangeEvent no existe acá) |
| `src/App.tsx` | Tab `drivertrack` en NavigationTab + **keep-alive**: la vista se monta UNA vez y se oculta con `hidden` al cambiar de sección (FUERA del VistaBoundary key={activeTab}, que remonta y mataría el GPS). Con `dtMontada` diferido (se monta en la primera visita) |
| `src/components/Sidebar.tsx` | Item "inDrive (Libre)" con ícono CarTaxiFront |
| `src/types.ts` | `'drivertrack'` en NavigationTab |
| `src/index.css` | Bloque `.dt-app`: paleta AUTOCONTENIDA (declara TODOS los colores Tailwind que usa DT con los valores default) + `.dt-app.light` (paleta clara propia F-ID2.3). Así el Theme Studio y el modo claro de RT NO pintan la sección inDrive. Confeti/pop renombrados `dt-*` sin colisión global |
| `package.json` | + `qrcode` y `@types/qrcode` (Mi QR de DT los usa) |
| `docs/` | Rebuild web con `--base=./` (mismo proceso F-WEB1), CNAME preservado — la web de trackverse.cloud también tiene inDrive |

### El keep-alive (por qué existe)

El VistaBoundary de RT usa `key={activeTab}` → al cambiar de pestaña
React DESMONTA la vista anterior. Si estabas grabando un viaje con GPS y
saltabas a "Mi Ruta" del trabajo, el `watchPosition` moría y perdías km.
La vista inDrive vive FUERA de ese boundary, en uno propio con key fija,
y se oculta con `display:none` (clase `hidden`). Resultado: **grabás un
viaje, atendés el trabajo, volvés a inDrive y la grabación siguió viva
todo el tiempo**. Verificado en navegador: estado, tema y viajes
sobreviven ocultar/mostrar.

### El tema scopeado (por qué `.dt-app`)

Ambas apps remapean las variables de color de Tailwind para el modo
claro, con paletas DISTINTAS, y RiderTrack además tiene Theme Studio que
recolorea todo el panel. Sin blindaje, la sección inDrive heredaría el
tema del trabajo. `.dt-app` declara su paleta completa (oscura default de
Tailwind) y `.dt-app.light` la suya clara → cada app cambia su propio
tema sin pisarse. El toggle de inDrive ya no toca el `<html>` ni la barra
del sistema.

## Verificación realizada (navegador headless)

- `tsc --noEmit` limpio y `npm run build` exitoso (mismo tamaño aprox. que antes)
- La app completa arranca sin errores de JS (login screen OK)
- Harness de prueba montando SOLO la vista integrada:
  - Viaje agregado: 12.50 con comisión 10% inDrive → meta S/ 11.25 ✓
  - Pestañas Caja/Mapa/Stats/Ajustes renderizan ✓
  - Tema claro: fondo del contenedor `#f1f5f9` (el de siempre) ✓
  - Keep-alive: ocultar → vista sigue montada + `dt_viajes_v1` persiste →
    mostrar → tema claro y meta S/ 11.25 intactos ✓
  - Ajustes muestra "DriverTrack v0.5.0 (Fase A — dentro de RiderTrack)" ✓
  - CERO errores de consola en toda la sesión
- Versión web (docs/) rebuild con inDrive verificado en el bundle

## Cómo probarlo vos

1. Descargá el APK nuevo del workflow (Actions → Build RiderTrack V2 APK →
   RiderTrackV2-APK) e instalalo ENCIMA (mismo keystore, no hay que
   desinstalar)
2. Entrá a la cuenta de siempre → menú → **inDrive (Libre)**
3. Si tenías el APK standalone de DriverTrack en ESTE teléfono, tus viajes
   y tu QR de Yape aparecen solos (mismas claves localStorage)
4. Probá: agregar un viaje, anotar un gasto, el tema claro/oscuro, y
   grabar un viaje con GPS mientras saltás a otra sección — la barra
   verde sigue viva al volver

## Qué NO cambió

- El bot (rudy-bot) no se tocó en esta fase — sigue igual para el trabajo
- El repo drivertrack standalone sigue como estaba (por si querés volver)
- Los flujos de Firestore del trabajo: cero cambios
- La sección inDrive usa el mismo flujo de cobro de siempre (robot por
  localhost:3001 con fallback a wa.me)

## Pendiente (Fase B — ya conversado)

El robot separando mensajes trabajo/inDrive con botones de envío directo
desde la sección inDrive (Enviar QR con imagen + monto + nombre, "voy en
camino", etc.) — el diseño ya está acordado, va sobre el bot real con
parche instalable en Termux (pm2 restart rudy-bot).

— FASE A, registrado en el worklog del asistente.
