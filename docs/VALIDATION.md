# Verification record — Firebase edition 2.0.0

Date: 2026-11-26. All automated account/financial fixtures use the demo Auth and Firestore emulators. No real owner password, Firebase token, service-account key or production financial test record is committed.

## Passed local gates

- TypeScript strict typecheck and ESLint.
- 59 unit/React tests: original money/rounding/net/permissions, backups/migrations, command invariants, new cloud-account screens and recovery action, session-tap details, and Excel workbook structure/formats/totals.
- 8 real Firestore emulator integration tests: fresh-client load, two-owner/unsigned denial, spoofed ownership and shop-list denial, known-table/financial-delete restrictions, concurrent updates without loss, concurrent busy-room prevention, preserved array order and atomic restore generations, oversized Arabic/emoji chunks, and rejection of writes that skip the revision protocol.
- 3 browser scenarios: signup and automatic manager creation; existing-account login in another browser; live session/payment synchronization; service/discount/change/expenses; current and frozen reports; expense column position; session detail modal; one-table Excel with typed dates, money formats, frozen header, borders and cached totals; backup/restore; fresh empty-browser login retaining history; offline writes rejected; separate shop isolation including account switching in the same browser; staff roles; owner password change/email-reset request; and explicit old-Dexie-data migration with the old manager password.
- Production build and production Firebase-target guard. PWA precache includes bundled SDK code, Cairo, icons and Excel chunk. The large-chunk warning is informational.
- Full self-managed `npm run e2e` successfully starts Java 21 Auth/Firestore emulators, runs the 8 integration tests plus 3 browser stories, and shuts down the emulators. The browser bundle goes to dist-e2e; production dist remains separate.
- `npm audit --omit=dev`: zero runtime vulnerabilities. Fifteen moderate development-tool advisories remain at validation; no high/critical advisories remain after the grpc-js override.

## Visual/export QA

Current cloud screenshots show the room board, create/use-shop start screen, clean closing list, tapped session details, totals and six-column shift list at 390px. Browser-generated Arabic PDFs are rendered with Poppler and checked for connected glyphs, RTL order, legible figures and clipping. The PDF contains full details even when the on-screen session list is collapsed.

The downloaded shift workbook is reopened with ExcelJS: exactly one session table, 12 ordered columns, dark header, totals row, borders, sized columns, frozen header and real Date/numeric cells. Summary shows shop/shift/time/play/services/discounts/expenses/net. Excel dates are checked against Cairo wall time. Visual appearance in a separately installed desktop/Android Excel app and a physical printer is not verified.

## Production setup boundary

The public Firebase config endpoint was checked successfully and matched the supplied project. At that check, authorized domains contained localhost and the default Firebase domains, but not seifzaher139-ux.github.io. The owner must enable/verify Email/Password, create the default Firestore database if absent, publish firestore.rules and add that hostname. Exact steps are in FIREBASE_SETUP.md.

Tests do not publish production rules or enable Firebase providers. Those administrator actions cannot be performed using the public client key. Production account CRUD and real-shop financial writes are not claimed as verified before the owner completes Console setup. The static Pages app and its real project config are deployed through the existing workflow after the gates pass.

## Remaining platform limits

No native wrappers are implemented. Real Android install menus, hardware printing, years-long load/performance and production billing/quota behavior have not been hardware-tested. Firebase account sharing with local staff roles is documented: staff permissions are application-level within the owner's authenticated shop, not a separate server-side membership model. Backups remain optional safety copies; cloud transactions require internet.
