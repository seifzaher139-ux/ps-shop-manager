# Verification record

Validation date: 2026-11-26. Test data is synthetic; no real shop accounts or financial data are committed.

## Local checks

- `npm run typecheck`: passed strict TypeScript.
- `npm run lint`: passed ESLint.
- `npm run test`: 52 tests passed across pure billing/aggregation, backups/migrations, repository, command invariants, PBKDF2/recovery and the React recovery flow.
- `npm run build`: passed; generated Workbox precache includes HTML, all JavaScript chunks, CSS, both local font subsets and icons. ExcelJS has a large precached lazy chunk; Vite reports a bundle-size warning, not a build error.
- `npm run e2e`: passed Chromium at 390px. Creates admin and acknowledges recovery; opens a shift; starts a PS4 single session; reloads and verifies the running session; adds tea; ends with fixed discount and overpayment; adds an expense; closes/freezes the shift; downloads Excel and JSON; prints a sample PDF; reloads offline and verifies history; exports Excel offline; restores the downloaded backup offline and verifies the financial detail again. Captured page errors and external network requests are both zero.
- Manifest checked for Arabic RTL, standalone, relative start URL and 192/512 maskable icons. PNG dimensions and active/controlling service worker checked. Offline reload succeeded. Physical Android installation and browser install-menu UX have not been verified on hardware.
- `npm audit --omit=dev`: zero runtime vulnerabilities at validation. Four moderate development-tool advisories remain in the Workbox glob/minimatch build dependency chain; no high/critical advisories remain. This is a point-in-time audit, not a security guarantee.

## Visual evidence

`docs/screenshots/` includes the room board, checkout, expenses, reports and settings at 390px, plus an Arabic browser-printed sample report and rendered PNGs. Cairo is bundled and embedded by Chromium. PDF pages were rendered with Poppler and inspected for connected Arabic glyphs, RTL direction, aligned numeric columns and clipping. The revised reports use A4 portrait and readable session cards; empty sections are absent. Receipt rendering is also checked by the flow; physical printer/Android PDF UI is not verified.

Excel is generated with ExcelJS. The downloaded workbook is checked for RTL views, numeric monetary cells, header styles, sized columns and Arabic values. Visual appearance in a separately installed Microsoft Excel/Android spreadsheet app is not verified.

## Deployment

The owner authorized public source. Pages is active at https://seifzaher139-ux.github.io/ps-shop-manager/ and PAGES_ENABLED=true. The workflow runs the gates and publishes successful main commits. Shop records and accounts remain local to the browser.

## Platform limits

Actual Android/Windows native wrappers are deliberately outside scope and documented in CONVERSION.md. Browser storage persistence grants, uninstall data retention, download destinations and print dialogs depend on the browser/OS. Keep manual off-device backups. Long-lived load/performance with years of shop data and physical printer output are not hardware-tested.

## Three-report revision

- Six domain tests cover inclusive date ranges, exactly six ordered totals, five-column shift rows, hidden empty sections, provisional live sessions, and rendering existing frozen snapshots without mutation.
- Four React flow tests cover the three tabs, range selection/rejection, single-row daily shifts, current/historical detail selection, and selecting the exact closed shift across midnight.
- Browser smoke verifies current-shift details before payment, the automatic final report after closing, all three Excel exports (including numeric totals/shift columns), all three PDF layouts, no horizontal overflow in the compact mobile shift table, offline export and backup restoration.
- Current screenshots include totals, daily shifts, live detail and final detail at 390px. Sample PDFs cover totals, shift list and final detail. Poppler renders are inspected for Arabic shaping, RTL order, readable figures and clipping.
