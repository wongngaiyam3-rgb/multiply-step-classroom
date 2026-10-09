# 數學冒險島

四年級學生先選 4A–4C、1–25 號，再進入四個乘除法活動。包含中央鼓勵彈窗、數粒試商、手寫白板，以及需密碼登入的教師進度頁。

GitHub Pages frontend: `public/`. Shared records API: Worker + D1, managed separately. The teacher password is configured as a server secret; it is never committed or included in the frontend. Class and student number selection identifies a learner; it does not verify the learner's identity.

## Build and validation

`npm install`, `npm run build`, `node verify.mjs` (Node 24). Generated files: `dist/client` and `dist/server/index.js`. D1 migrations in `drizzle/`.

The division whiteboard is adapted from https://github.com/edu12346521-commits/division-whiteboard-practice and keeps its drawing, progressive hints and 5-question level structure. Its new progress records are saved to the integrated teacher dashboard. Historical records on the original deployment are not imported.

For GitHub Pages, publish the files in `public/` at the repository root, or use the Pages deployment workflow. The shared API must be available with the configured Pages origin in its CORS allowlist.
