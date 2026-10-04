// ═══════════════════════════════════════════════════════════
// 🏍️ DriverTrack — Tipos de eventos DOM (shim FASE A)
// ═══════════════════════════════════════════════════════════
// RiderTrack no usa @types/react (React 19 se infiere desde JS,
// ver nota en su App.tsx) → el namespace `React.ChangeEvent` no
// existe acá. Los handlers de subida de archivos solo necesitan
// .target.files y .target.value — este shim minimalista cubre
// ese uso sin tocar la configuración del proyecto anfitrión.
// En el APK standalone de DriverTrack (@types/react presente)
// el tipo es 100% compatible con ChangeEvent<HTMLInputElement>.
// ═══════════════════════════════════════════════════════════

export interface EvArchivo {
  target: {
    files: FileList | null;
    value: string;
  };
}
