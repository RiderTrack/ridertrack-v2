// Stub de 'firebase/storage' para compilar src/services/firestore.ts
// en los tests (FASE X). Las funciones solo se usan al subir fotos,
// que los tests no ejercitan.
exports.ref = (...args) => ({ __ref: 'storage' });
exports.uploadBytes = async () => ({});
exports.getDownloadURL = async () => '';
