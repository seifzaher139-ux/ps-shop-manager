# PS Shop Manager

Arabic RTL offline-first PlayStation room management. React 18, strict TypeScript, Vite, HashRouter, Zustand, Dexie, Workbox and ExcelJS. No backend, cloud accounts, telemetry or runtime CDN dependencies. Each installation is independent.

## Run and validate

Requires Node.js 24+ and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm run lint
npm run test
npm run build
npx playwright install chromium
npm run e2e
```

Preview the production PWA with `npm exec vite preview -- --host 127.0.0.1 --port 4173`. Development mode does not register the production service worker. `npm run icons` regenerates local icons and copies the licensed Cairo font; `npm run format` applies Prettier.

Features: timers, snapshotted rates, services, discounts, paid/change/unpaid, cancellation and voids, shifts, expenses, frozen closing reports, full history/day detail, RTL Excel, Arabic print/PDF, users/permissions, recovery, idle lock, local logo/settings and versioned backup/restore.

## Deployment

Actions runs typecheck, lint, tests, build and offline smoke and uploads the Pages artifact. Deployment requires repository variable `PAGES_ENABLED=true`. First enable Settings → Pages → GitHub Actions, then set that variable. Relative base and hash routes support repository subpaths.

**Current blocker:** GitHub refused Pages setup for this private repository (HTTP 422: account plan does not support it). The repository stays private and no URL is published. When eligible, the expected address is `https://seifzaher139-ux.github.io/ps-shop-manager/`; verify successful deployment before using it. Alternatively serve `dist` on another HTTPS static host. Private source does not necessarily mean private hosting.

## Documentation

- [Decisions and formulas](docs/ASSUMPTIONS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Windows/Android conversion](docs/CONVERSION.md)
- [Verification](docs/VALIDATION.md)
- [Mobile screenshots](docs/screenshots/)

## للمالك — طريقة الاستخدام

التطبيق بيحفظ الحسابات على نفس الجهاز. مفيش سيرفر أو مزامنة بين الموبايل واللابتوب.

1. بعد تفعيل النشر، افتح الرابط في Chrome على أندرويد واستنى «جاهز بدون إنترنت».
2. من قائمة Chrome اختار «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». على اللابتوب استخدم التثبيت في Chrome أو Edge. أول تحميل محتاج إنترنت وبعده التطبيق يشتغل من غيره.
3. أول مرة أنشئ حساب المدير بكلمة سر 8 حروف على الأقل. احفظ كود الاسترجاع اللي هيظهر مرة واحدة؛ تستخدمه من «نسيت كلمة السر؟» بدون إنترنت.
4. من الإعدادات عدّل اسم المحل والشعار واسم الجهاز والأسعار وعدد الرومز والخدمات. الافتراضي: PS4 فردي 25 وزوجي 50، PS5 فردي 60 وزوجي 80 جنيه للساعة.
5. افتح شفت واضغط روم متاحة. الروم الشغالة بتفتح تفاصيل الخدمات والإنهاء. المؤقت محفوظ حتى لو قفلت التطبيق أو أعدت تشغيل الجهاز.
6. عند الإنهاء راجع الخصم والمدفوع. التطبيق يبين الباقي للعميل ويحذرك لو فيه غير مدفوع. تقدر تطبع الفاتورة.
7. ضيف المصاريف أثناء الشفت. انهي أو الغي كل الجلسات قبل التقفيل. التقرير المقفول محفوظ ومش بيتعدل. تقارير اليوم والشفت والسجل في «التقارير».
8. «تصدير إكسل» بينزل الجدول. «طباعة / PDF» بيفتح الطباعة؛ اختار حفظ كـ PDF.
9. اعمل نسخة احتياطية بعد كل يوم. ملف JSON بينزل غالبا في مجلد التحميلات؛ التطبيق ما يقدرش يعرف المسار الكامل. ارفعه على جوجل درايف بنفسك واحتفظ بأكتر من نسخة. للاستعادة اختار الملف وراجع الملخص، نزّل نسخة أمان لو محتاج ثم أكد الاستبدال. الاستعادة بتبدّل البيانات ومش بتدمج جهازين.
10. حذف بيانات الموقع أو ملفات تعريف الارتباط، إزالة التطبيق حسب الجهاز، أو تغيير الموبايل ممكن يضيع الحسابات. مسح الصور والملفات المؤقتة فقط ما يمسحش الحسابات. النسخ هي وسيلة النقل والحماية. مفيش حذف تلقائي للسجل.
11. لما تظهر «تحديث جديد متاح»، خلّص اللي بتكتبه واضغط «تحديث دلوقتي». الجلسات محفوظة لكن إعادة التحميل بتطلب دخول تاني. خُد نسخة احتياطية قبل تحديث مهم.

الحماية محلية للاستخدام العادي؛ الوصول الكامل لبيانات المتصفح يسمح بتعديلها. اقفل الجهاز واحفظ النسخ وكود الاسترجاع في مكان خاص.
