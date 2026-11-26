# PS Shop Manager

Arabic RTL PlayStation shop management with **Firebase Authentication (Email/Password) and Cloud Firestore**. Version 2 replaces browser-only financial storage. Each Firebase owner UID owns a separate shop; another browser/device loads the same records after sign-in. No backend server or service-account secret is shipped.

Live app: https://seifzaher139-ux.github.io/ps-shop-manager/

**Production prerequisite:** follow [Firebase console setup](docs/FIREBASE_SETUP.md). Enable Email/Password, create Firestore if needed, paste [firestore.rules](firestore.rules) into **Firestore → Rules → Publish**, and add `seifzaher139-ux.github.io` to Authentication authorized domains. Publishing the static site alone does not configure Firebase security/providers.

## Development and validation

Requires Node.js 24+, npm and Java 21+ for Firebase emulators.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npm run verify:production
npx playwright install chromium
npm run e2e
```

`npm run e2e` starts isolated Auth/Firestore emulators using the demo project, runs rule/repository integration tests plus the browser flows, then stops them. `npm run test:cloud` and `npm run test:browser` can be used while emulators are already running. The browser build is written to ignored `dist-e2e`, with emulator config; production stays in `dist`. A deployment guard rejects emulator configuration in the production artifact.

`npm run dev` uses the real configured project. For isolated development, start `npx firebase emulators:start --only auth,firestore --project demo-ps-shop-manager`, set `VITE_FIREBASE_EMULATORS=true` in the development shell, then run Vite. Never enable that flag in production. Use the Node 24 CI runtime if a developer-tool engine warns under a newer Node release.

Features: timed rooms, integer pricing, services/discounts/payments, expenses, shift closing, three reports, printable Arabic PDF, RTL Excel, owner cloud accounts, staff permissions/lock, logo/settings and optional JSON backup/restore. Firestore transactions prevent concurrent busy-room starts and lost writes. Firestore listeners keep active devices updated.

## Reports and Excel

- Totals: inclusive opening-date range; play, services, discounts, expenses, net, shift count.
- Daily shifts: one row each, with name, from, to, revenue, **expenses**, net.
- Live/final shift: totals plus a clean session list; tap a session for details. Closing freezes the report and opens it automatically. PDF prints full session detail.
- Shift Excel: small shop/shift/time/financial summary, then **one** 12-column session table (#, room, game type, from, to, minutes charged, play, services, discount, total, paid, change), totals row, dark header, borders, frozen header and typed number/date formats. Other report exports retain their summary/list purpose.

## Hosting

The public repository deploys successful main pushes to GitHub Pages through Actions. CI checks TypeScript, lint, unit/UI tests, production build, emulator/rules tests, browser flows and production Firebase target. `PAGES_ENABLED=true` enables the deployment job. HashRouter and a relative Vite base support the repository path. Shop records are not stored in the repository or Pages files.

## Documentation

- [Firebase setup and local-data migration](docs/FIREBASE_SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions/formulas](docs/ASSUMPTIONS.md)
- [Security](docs/SECURITY.md)
- [Verification](docs/VALIDATION.md)
- [Future native wrappers](docs/CONVERSION.md)
- [Screenshots](docs/screenshots/)

## للمالك — الاستخدام الجديد

1. فعّل Firebase ونشر القواعد باتباع [الخطوات](docs/FIREBASE_SETUP.md). افتح التطبيق واقبل «تحديث دلوقتي» لو ظهرت.
2. أول مرة اختار «إنشاء محل جديد» واكتب اسم المحل والبريد وكلمة السر. حساب المدير بيتكوّن تلقائيًا. بعد كده من أي جهاز اختار «استخدام محل موجود» وادخل **بنفس البريد وكلمة السر**؛ مش هتحتاج تعيد إنشاء المدير.
3. لو عندك حسابات قديمة على المتصفح، افتح من نفس المتصفح واختار «نقل البيانات القديمة إلى المحل الجديد» وأدخل كلمة سر المدير القديم أو كود الاسترجاع. انقلها قبل مسح بيانات المتصفح. تقدر كمان تستعيد ملف JSON من الإعدادات بعد الدخول للمحل.
4. البيانات محفوظة في السحابة، ومسح بيانات المتصفح ما يمسحش المحل. الحفظ محتاج إنترنت؛ التطبيق مش هيقول إن معاملة اتحفظت وهي موجودة على جهاز واحد بس. المؤقت يفضل ظاهر أثناء انقطاع الاتصال، لكن إنهاء/بدء الجلسات ينتظر رجوعه.
5. افتح شفت وابدأ الرومز، وضيف الخدمات والمصاريف. عند الإنهاء راجع الخصم والمدفوع والباقي. قفل الشفت بيحفظ تقريره النهائي. التقرير التفصيلي متاح قبل القفل كمان؛ اضغط أي جلسة لعرض تفاصيلها.
6. مستخدمو الشفت وصلاحياتهم موجودين من الإعدادات. «تبديل مستخدم الشفت» بيغيّر المستخدم الداخلي تحت جلسة حساب المحل. «تسجيل الخروج» بيخرج حساب المحل من الجهاز. استرجاع كلمة سر حساب المحل بيكون بالبريد الإلكتروني.
7. نسخة JSON إضافية مفيدة للأمان، وغالبًا بتنزل في مجلد التحميلات. الاستعادة بتستبدل بيانات المحل على السحابة **لكل الأجهزة**، فلازم تراجع الملف والحساب وتاخد نسخة أمان الأول.
8. من قائمة Chrome اختار تثبيت التطبيق/إضافة إلى الشاشة الرئيسية. ملفات الواجهة تتخزن للتشغيل، لكن ده مش بديل عن الاتصال المطلوب لحفظ الحسابات في السحابة.
