// ─────────────────────────────────────────────────────────────
// 🧪 STUB de ./services/syncDT — para compilar el storage.ts REAL
// en los tests (FASE BA). El sync de verdad importa firebase; para
// probar normalizarConfig/cargarConfig alcanza con contar cuántas
// veces avisaría un cambio (autocura incluida).
// ─────────────────────────────────────────────────────────────
let avisados = 0;
module.exports = {
  avisarCambioDT: () => {
    avisados++;
  },
  __avisados: () => avisados,
};
