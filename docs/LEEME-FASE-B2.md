# 🖼️ FASE B2 — Avisos con imagen + "Llegando en X minutos" (v0.8.0)

Lo que pediste: que los avisos de inDrive salgan **igual que los del trabajo** —
con una imagen bonita que podés cambiar vos desde la app, y el aviso de
"estoy llegando en tantos minutos".

## 🆕 Qué hay de nuevo

### 1. ⏱️ "Llegando en X minutos" (en el menú 🤖 de cada viaje)
Nuevo botón en el menú del robot: tocás **"Llegando en…"**, elegís
**5 / 10 / 15 / 20 min** (o escribís los que quieras) y el robot le manda
al cliente:

> ⏱️ ¡Carlos, estoy llegando! 🛵
> Estoy a **10 minutos** de Av. Prueba 123 — salí ya para que no te espera el tránsito 🙌
> — Rudy · tu conductor inDrive 🛵

### 2. 🖼️ Imágenes del robot (Ajustes → nueva sección)
Igual que la galería del trabajo, pero para tus avisos de inDrive. Una imagen
por cada mensaje:

| Aviso | Botón que la usa |
|---|---|
| 🛣️ Voy en camino | 🤖 → Voy en camino |
| ⏱️ Llegando en X minutos | 🤖 → Llegando en X min |
| 🏁 Ya llegué | 🤖 → Ya llegué |
| ✅ Entregado · gracias | 🤖 → Entregado |
| 📍 Pedir ubicación | 🤖 → Pedirle su ubicación |

- Subís la imagen → queda en la nube → **el siguiente aviso ya sale con ella**
  (no reiniciás nada).
- La cambiás o la quitás cuando quieras → aplica al toque.
- Sin imagen → el aviso sale en texto pelado (como hasta ahora).
- El 💜 **Cobrar** sigue usando tu QR de Yape (de "Mi QR Yape/Plin").
- Son SOLO para inDrive: las imágenes del trabajo (imagenes_bot) no se tocan
  y viceversa.

## 🔧 Instalación (una vez, en Termux)

1. **APK nuevo**: descargá la v0.8.0 de GitHub Actions (se compila sola al
   hacer push) e instalala encima.
2. Pasá el zip `robot-drivertrack-faseb2.zip` a la carpeta del bot y descomprimilo
   (reemplaza los archivos viejos).
3. `node actualizar_reglas.js` — **este paso es OBLIGATORIO**: agrega la
   colección `imagenes_dt` a las reglas vivas (si ya corriste la versión
   anterior, esta solo agrega lo que falta — es idempotente).
4. `node instalar_drivertrack.js` — actualiza el parche a v1.1 (si ya estaba
   instalado, te avisa y no toca nada; el parche nuevo se toma igual al
   reiniciar).
5. `pm2 restart rudy-bot`
6. En consola tiene que decir:
   `🏍️ [DT] Parche activo (drivertrack_bot.js v1.1 (FASE B2 — avisos con imagen))`

## ✅ Cómo probarlo

1. App → inDrive → Ajustes → **🖼️ Imágenes del robot** → subí una imagen
   para "⏱️ Llegando en X minutos".
2. Creá un viaje de prueba (con tu propio celular como cliente).
3. Menú 🤖 → **Llegando en…** → 10 min.
4. Te tiene que llegar a tu WhatsApp el mensaje **CON la imagen** arriba y
   el texto abajo.

## 🧠 Cómo funciona (por si te interesa)

```
[bOtón 🤖] → Firestore acciones_dt (texto + imagenUrl + minutos)
                    ↓ 1-2 seg
[rudy-bot parche v1.1] → baja la imagen de la nube (máx 10 seg)
                    ↓
[WhatsApp del cliente: IMAGEN + texto abajo]
```

- Si la imagen no baja (internet malo, URL vieja) → manda **solo el texto**:
  el aviso NUNCA se pierde.
- Las imágenes viven en Firebase Storage (`campanas/imagenes_dt/…`) y el
  registro en Firestore (`imagenes_dt/{tipo}`) — mismo patrón que el trabajo,
  colecciones separadas para no mezclar.

## ⚠️ Nota sobre los permisos

Si en la consola del navegador ves `Missing or insufficient permissions`
para `imagenes_dt`, falta correr `node actualizar_reglas.js` en Termux (paso 3).
La app no se rompe: la galería queda vacía y los avisos salen sin imagen.
