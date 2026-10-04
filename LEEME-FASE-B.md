# LEEME — FASE B: El robot de WhatsApp para inDrive 🏍️🤖

## ¿Qué se hizo?

El **rudy-bot** ahora también manda los mensajes de la sección **inDrive (Libre)**
de RiderTrack V2 — con BOTONES, como pediste. Apretás y el cliente lo recibe,
sin abrir WhatsApp:

| Botón en la app | Qué le llega al cliente |
|---|---|
| 💜 **Cobrar** (🤖) | Mensaje de cobro **CON tu QR de Yape de imagen** + monto + nombre |
| 🛣️ **Voy en camino** | "Voy en camino, salgo hacia {dirección}, llego en unos minutos" |
| 🏁 **Ya llegué** | "Ya llegué, estoy afuera en {dirección}" |
| ✅ **Entregado** | "Gracias por tu viaje… calificame con 5⭐" |
| 📍 **Pedir ubicación** | Le pide que te mande su ubicación en tiempo real por el chat 📡 |
| 🧪 **Mandarme prueba** (Ajustes) | Mensaje de prueba a TU WhatsApp para verificar el circuito |

**NADA de respuestas automáticas** — esas siguen desactivadas como siempre.
Cada mensaje lo disparás VOS apretando un botón. El bot solo obedece.

## Dónde están los botones

- **Viajes de hoy** (pestaña Viajes): cada viaje tiene el botón ⌄ violeta al
  lado del de cobro → abre el menú del robot con los 5 avisos
- **Formulario**: el botón 🤖 Cobrar de siempre (ahora va por la nube)
- **Ajustes → 🤖 Robot WhatsApp**: interruptor + "Mandarme prueba" + estado
  de tu sesión

## Cómo funciona (lo importante)

```
apretás el botón → RiderTrack escribe en Firestore (acciones_dt,
cola PROPIA de inDrive) → el rudy-bot lo levanta en 1-2 segundos
→ le llega al cliente por WhatsApp
```

- **Va por la nube, no por localhost**: si el bot se reinicia o Termux se
  muere, el mensaje queda ENCOLADO y sale apenas revive — un cobro nunca
  se pierde (el viejo puente localhost:3001 quedaba trancado en ese caso).
- **Cola separada del trabajo**: las acciones inDrive van en `acciones_dt`,
  las del trabajo siguen en `acciones_bot`. El bot no puede confundirlas —
  el flujo de MATE queda 100% intacto.
- **Seguridad heredada**: todo lo que manda este parche pasa por el freno
  de pánico y el guardián de pagos del bot (los candados globales).
- Ya no hay URL ni token que configurar — la prueba de Ajustes manda un
  mensaje REAL a tu WhatsApp.

## 📲 INSTALACIÓN DEL PARCHE (3 pasos, una sola vez, ~3 minutos)

El zip `robot-drivertrack-faseb.zip` trae 4 archivos. En Termux:

```bash
# 1) Descomprimí el zip adentro de la carpeta del bot
cd ~/bot-whatsapp
unzip -o /sdcard/Download/robot-drivertrack-faseb.zip

# 2) Publicá la regla nueva de Firestore (colección acciones_dt)
#    — usa el serviceAccount del propio bot, agrega SOLO ese bloque
node actualizar_reglas.js

# 3) Instalá el parche en el index.js y reiniciá
node instalar_drivertrack.js
pm2 restart rudy-bot
pm2 logs rudy-bot --lines 20
#   → tenés que ver: 🏍️ [DT] Parche activo — escuchando acciones_dt (inDrive)
```

> ⚠️ El paso 2 es OBLIGATORIO: probamos contra tu Firebase real y la
> colección `acciones_dt` está BLOQUEADA por las reglas vivas (que solo
> conocen `acciones_bot`). Sin ese paso, la app encola y recibe
> "permiso denegado". Si el script no puede (por permisos de la consola),
> él mismo te imprime los pasos manuales (2 minutos en la consola).

**Prueba final (desde el teléfono):** RiderTrack V2 → inDrive (Libre) →
Ajustes → 🤖 Robot WhatsApp → **"Mandarme prueba"** → te tiene que llegar
el mensaje a tu WhatsApp en 1-2 segundos. Si llegó, todo el circuito anda.

**Para desinstalar:** `cp index.js.bak-drivertrack index.js && pm2 restart rudy-bot`

## Qué archivos trae el zip

| Archivo | Qué es |
|---|---|
| `drivertrack_bot.js` | El parche: escucha `acciones_dt`, manda por WhatsApp (texto o QR+caption), marca resultado. Patrón de grupo_mate.js/acciones_extra.js |
| `instalar_drivertrack.js` | Instalador: respaldo → anclas exactas → `node --check` → si falla restaura solo. Idempotente (correrlo 2 veces no duplica) |
| `actualizar_reglas.js` | Publica la regla de `acciones_dt` en tu Firebase usando el serviceAccount del bot (inserción quirúrgica: baja las reglas vivas, agrega SOLO el bloque, publica, verifica). Si no puede → pasos manuales |
| `test_drivertrack_bot.js` | Suite de pruebas con mocks (9/9 pasan): envío texto, QR+caption, normalización 51…, anti-reenvío, docs viejos, tipos del trabajo ignorados, celular inválido, respaldo JID |

## Reglas de Firestore

`firestore.rules` del repo ahora incluye `acciones_dt/{userId}` con los mismos
permisos que `acciones_bot` (solo el dueño). **Si las reglas de tu consola de
Firebase no se actualizan solas, hay que copiar el archivo nuevo en**
Firebase Console → Firestore → Reglas → Publicar. (Revisalo la primera vez
que pruebes — si la prueba falla con "permiso denegado", es eso.)

## Cambios en la app (ridertrack-v2)

| Archivo | Cambio |
|---|---|
| `src/drivertrack/services/robotBot.ts` | NUEVO — encola en `acciones_dt` + plantillas de los avisos (la app arma el texto; el bot solo envía) |
| `src/drivertrack/DriverTrackView.tsx` | mandarCobro va por Firestore (antes localhost que nunca funcionó); + mandarAviso + pedirUbicacion con fallback wa.me |
| `src/drivertrack/components/RobotMenu.tsx` | NUEVO — el menú de avisos (patrón NavegarMenu) |
| `src/drivertrack/components/ViajeList.tsx` | Botón ⌄ violeta por viaje → abre el RobotMenu |
| `src/drivertrack/components/AjustesView.tsx` | Sección robot nueva: "Mandarme prueba" real + estado de sesión; sin URL/token (jubilados) |
| `firestore.rules` | + acciones_dt (mismos permisos que acciones_bot) |
| `tsconfig.json` | exclude parche-bot/ (los .js del parche son CommonJS de Termux) |
| `parche-bot/` | Los 3 archivos del zip, versionados en el repo |

La config vieja (`robotUrl`, `robotToken`) se conserva en los backups por
compatibilidad, pero ya no se usan ni se editan.

## Verificación realizada

- Suite del parche: **9/9** (envíos, QR, JIDs, anti-reenvío, vencidos, tipos
  ajenos, errores, respaldos)
- Instalador probado contra el **index.js REAL del bot** (el de Termux del
  04/09): anclas encontradas, sintaxis OK, idempotente
- `tsc --noEmit` y `npm run build` limpios

— FASE B, registrado en el worklog del asistente.
