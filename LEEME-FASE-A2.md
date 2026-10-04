# LEEME — FASE A2: la fusión de verdad 🧩

Respuesta directa al feedback del APK v0.6.0: *"esto está pegado, no
fusionado"*. Esta fase elimina las duplicaciones entre el trabajo y
la sección inDrive para que se sienta UNA sola app.

## 1. Modo claro/oscuro: UN solo toggle 🌗

- ANTES: RiderTrack tenía su sol/luna en el header **y** inDrive
  tenía OTRO adentro — dos temas separados que se pisaban de vista.
- AHORA: inDrive **ya no tiene botón de tema**. Acompaña el modo
  claro/oscuro del TRABAJO (`useTema → modoEfectivo`): apretás el
  toggle del header UNA vez y toda la app (trabajo + inDrive) cambia
  junta. La paleta esmeralda/violeta de inDrive se conserva (es su
  identidad), solo hereda claro/oscuro del trabajo.
- La clave vieja `dt_tema_v1` queda sin uso (no molesta).

## 2. QR: UN solo lugar para todo 💜

- ANTES: el QR se configuraba en DOS lugares (Yape del trabajo + un
  "Mi QR" y billeteras dentro de inDrive) — duplicado.
- AHORA: **todo vive en la vista "Mi QR Yape/Plin" del menú**, que
  ahora tiene **3 pestañas**:
  - 💜 **Yape** y 🔷 **Plin** → las del TRABAJO (Firestore + sync con
    el bot, como siempre).
  - 🏍️ **inDrive** (nueva) → tu Yape/Plin **PERSONAL** para tus
    viajes libres. Se guarda en el teléfono (`dt_config_v1`, la misma
    clave de siempre → tus datos ya guardados aparecen solos).
- En inDrive → Ajustes quedó un **resumen** (número + si tenés QR
  subido) con un botón que te lleva directo a esa vista.
- El botón "Mi QR" del header de inDrive se eliminó (era el otro
  duplicado). El nombre/celular que usa el robot ahora se editan en
  inDrive → Ajustes → **👤 Mis datos (robot)**.
- La sección inDrive **recarga la config al volver** — si editaste
  tus billeteras en la vista Yape, el cambio aparece solo.

## 3. FIX: "el cuadradito se sale" en Pedidos 📦

En la vista **Pedidos**, la fila de filtros (Todos / Pendientes /
Entregados / **Fallidos**) + el botón de ordenar medía 445px en una
pantalla de 390px — los últimos botones quedaban FUERA de pantalla
(sin scroll visible). Ahora los chips hacen **wrap** (2 filas en
celular) y todo se ve. Mismo fix en los filtros del Dashboard.

## 4. ¿Dónde están los botones del robot? 🤖 (duda resuelta)

- Los botones de inDrive (**Cobrar** con QR + monto + nombre,
  🛣️ **Voy en camino**, 🏁 **Ya llegué**, ✅ **Entregado**, 📍 **Pedir
  ubicación**) viven **DENTRO de la sección "🏍️ inDrive (Libre)"**:
  el ⌄ violeta de cada viaje de la lista, y el botón Cobrar del
  formulario. Van por la cola propia `acciones_dt` y salen con TU
  Yape personal.
- La parte GENERAL de RiderTrack (Mi Ruta, Pedidos, Seguimiento)
  tiene SUS botones para los clientes del TRABAJO — van por
  `acciones_bot` con el Yape del trabajo. Cada lado usa los suyos:
  no hay que mezclar.

## Versiones

- DriverTrack dentro de RiderTrack: **v0.7.0** (Fase A2).
- Web (trackverse.cloud) y APK compilan solos al hacer push.
