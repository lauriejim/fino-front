// DEPRECATED — this module has been moved to the Strapi backend.
// The import flow is now driven by:
//   - POST /api/import/parse   (file content → ParsedImport)
//   - POST /api/import/preview (ParsedImport → PreviewResult)
//   - POST /api/import/commit  (ParsedImport → ImportSummary, transactional)
//
// See:
//   - strapi-app/src/api/import/services/import.ts    (service)
//   - strapi-app/src/api/import/controllers/import.ts (controller)
//   - fino/src/api/imports.ts                          (client API)
//   - fino/src/pages/ImportPage.tsx                    (UI)
//
// Keep this file empty so the build stays clean until we can delete it.
export {};
