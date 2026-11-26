# Verification record

Validation date: 2026-11-26. Test data is synthetic; no real shop accounts or financial data are committed.

## Local checks

- `npm run typecheck`: passed strict TypeScript.
- `npm run lint`: passed ESLint.
- `npm run test`: 42 tests passed across pure billing/aggregation, backups/migrations, repository, command invariants, PBKDF2/recovery and the React recovery flow.
- `npm run build`: passed; generated Workbox precache includes HTML, all JavaScript chunks, CSS, both local font subsets and icons. ExcelJS has a large precached lazy chunk; Vite reports a bundle-size warning, not a build error.
- `npm run e2e`: passed Chromium at 390px. Creates admin and acknowledges recovery; opens a shift; starts a PS4 single session; reloads and verifies the running session; adds tea; ends with fixed discount and overpayment; adds an expense; closes/freezes the shift; downloads Excel and JSON; prints a sample PDF; reloads offline and verifies history; exports Excel offline; restores the downloaded backup offline and verifies the financial detail again. Captured page errors and external network requests are both zero.
- Manifest checked for Arabic RTL, standalone, relative start URL and 192/512 maskable icons. PNG dimensions and active/controlling service worker checked. Offline reload succeeded. Physical Android installation and browser install-menu UX have not been verified on hardware.
- `npm audit --omit=dev`: zero runtime vulnerabilities at validation. Four moderate development-tool advisories remain in the Workbox glob/minimatch build dependency chain; no high/critical advisories remain. This is a point-in-time audit, not a security guarantee.

## Visual evidence

`docs/screenshots/` includes the room board, checkout, expenses, reports and settings at 390px, plus an Arabic browser-printed sample report and rendered PNGs. Cairo is bundled and embedded by Chromium. PDF pages were rendered with Poppler and inspected for connected Arabic glyphs, RTL direction, aligned numeric columns and clipping. Sections deliberately page-break on A4 landscape. Receipt rendering is also checked by the flow; physical printer/Android PDF UI is not verified.

Excel is generated with ExcelJS. The downloaded workbook is checked for RTL views, numeric monetary cells, header styles, sized columns and Arabic values. Visual appearance in a separately installed Microsoft Excel/Android spreadsheet app is not verified.

## Deployment

Repository is private and commits are pushed. The workflow runs local-equivalent gates and saves a deployable Pages artifact. Pages activation failed with GitHub HTTP 422: the account plan does not support Pages for this private repository. Deployment is gated on `PAGES_ENABLED=true` after enabling Pages on an eligible plan. No successful hosted deployment is claimed.

## Platform limits

Actual Android/Windows native wrappers are deliberately outside scope and documented in CONVERSION.md. Browser storage persistence grants, uninstall data retention, download destinations and print dialogs depend on the browser/OS. Keep manual off-device backups. Long-lived load/performance with years of shop data and physical printer output are not hardware-tested.
