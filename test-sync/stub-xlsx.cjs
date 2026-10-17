// Stub de 'xlsx' para compilar src/services/firestore.ts en los
// tests (FASE X). Solo se usa en importarExcel, que no se ejercita.
module.exports = {
  read: () => ({ SheetNames: [], Sheets: {} }),
  utils: {
    book_new: () => ({}),
    json_to_sheet: () => ({}),
    book_append_sheet: () => {},
  },
};
