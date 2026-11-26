import ExcelJS from 'exceljs';
import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { pbkdf2Sync } from 'node:crypto';
import { ar } from '../src/i18n/ar';
import { defaults } from '../src/core/model';
import { reconcileRooms } from '../src/core/logic';
const password = 'test-cloud-password-123';
async function createShop(page: Page, email: string, name: string) {
  await page.goto('/');
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: 'docs/screenshots/start-cloud-390.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: ar.createShop, exact: true }).click();
  await page.getByLabel(ar.email, { exact: true }).fill(email);
  await page.getByLabel(ar.shop, { exact: true }).fill(name);
  await page.getByLabel(ar.password, { exact: true }).fill(password);
  await page.getByRole('button', { name: ar.createShop, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.home, exact: true }),
  ).toBeVisible();
}
async function login(page: Page, email: string, secret = password) {
  await page.goto('/');
  await page.getByRole('button', { name: ar.useShop, exact: true }).click();
  await page.getByLabel(ar.email, { exact: true }).fill(email);
  await page.getByLabel(ar.password, { exact: true }).fill(secret);
  await page.getByRole('button', { name: ar.login, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.home, exact: true }),
  ).toBeVisible();
}
async function startShift(page: Page) {
  await page.getByRole('button', { name: ar.openShift, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.openShift, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function startSession(page: Page) {
  await page.locator('.room-card').first().click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.start, exact: true })
    .click();
  await expect(page.locator('.occupied')).toHaveCount(1);
}

test('cloud shop, live sync across devices, payment, reports, Excel, restore and clean browser sign-in', async ({
  page,
  context,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `shop-${Date.now()}@example.com`;
  await mkdir('docs/screenshots', { recursive: true });
  await createShop(page, email, 'بلايستيشن التجربة');
  await startShift(page);
  await startSession(page);
  const second = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
  });
  const other = await second.newPage();
  await login(other, email);
  await expect(other.locator('.occupied')).toHaveCount(1);
  await page.screenshot({
    path: 'docs/screenshots/rooms-390.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab', { name: ar.closingReport, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.liveShiftReport, exact: true }),
  ).toBeVisible();
  await page.locator('.session-report-trigger').click();
  await expect(page.getByRole('dialog')).toContainText(ar.billedMinutesLabel);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.close, exact: true })
    .click();
  await page.getByRole('link', { name: ar.home, exact: true }).click();
  await page.locator('.occupied').click();
  await page.getByRole('button', { name: ar.addService, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('شاي × 1');
  await page.getByRole('button', { name: ar.end, exact: true }).click();
  await page.getByLabel(ar.discount, { exact: true }).selectOption('fixed');
  await page.getByLabel(ar.amount, { exact: true }).fill('3');
  await page.getByLabel(ar.reason, { exact: true }).fill('خصم عميل');
  await page.getByLabel(ar.paid, { exact: true }).fill('30');
  await page.getByRole('button', { name: ar.confirm, exact: true }).click();
  await expect(page.locator('.receipt')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.close, exact: true })
    .click();
  await expect(other.locator('.occupied')).toHaveCount(0);
  await page.getByRole('link', { name: ar.expenses, exact: true }).click();
  await page.getByRole('button', { name: ar.addExpense, exact: true }).click();
  await page.getByLabel(ar.description, { exact: true }).fill('كهرباء');
  await page.getByLabel(ar.amount, { exact: true }).fill('5');
  await page.getByRole('button', { name: ar.save, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: ar.home, exact: true }).click();
  await page.getByRole('button', { name: ar.closeShift, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.closeShift, exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: ar.closingReport, exact: true }),
  ).toBeVisible();
  if (await page.getByRole('dialog').count())
    await page
      .getByRole('dialog')
      .getByRole('button', { name: ar.close, exact: true })
      .click();
  await page.locator('.session-report-trigger').click();
  await expect(page.getByRole('dialog')).toContainText('خصم عميل');
  await expect(page.getByRole('dialog')).toContainText(ar.change);
  await page.screenshot({
    path: 'docs/screenshots/session-details-390.png',
    fullPage: true,
  });
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.close, exact: true })
    .click();
  await page.screenshot({
    path: 'docs/screenshots/reports-390.png',
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: ar.excel, exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs('test-results/shift-report.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('test-results/shift-report.xlsx');
  const sheet = workbook.worksheets[0];
  expect(sheet.views[0].rightToLeft).toBe(true);
  expect(sheet.views[0].state).toBe('frozen');
  expect(sheet.getTables()).toHaveLength(1);
  let header = 0;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === ar.excelIndex) header = row.number;
  });
  expect(header).toBeGreaterThan(0);
  expect(sheet.getRow(header).values).toEqual([
    undefined,
    ar.excelIndex,
    ar.room,
    ar.mode,
    ar.from,
    ar.to,
    ar.billedMinutesLabel,
    ar.play,
    ar.services,
    ar.discount,
    ar.total,
    ar.paid,
    ar.change,
  ]);
  expect(sheet.getRow(header + 1).getCell(4).value).toBeInstanceOf(Date);
  expect(sheet.getRow(header + 1).getCell(4).numFmt).toContain('hh:mm');
  expect(sheet.getRow(header + 1).getCell(10).value).toBe(20);
  expect(sheet.getRow(header + 1).getCell(12).value).toBe(10);
  expect(sheet.getRow(header + 1).getCell(10).border.bottom?.style).toBe(
    'thin',
  );
  expect(sheet.getRow(header + 2).getCell(10).value).toMatchObject({
    result: 20,
  });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: 'docs/screenshots/sample-report.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.getByRole('tab', { name: ar.shiftsReport, exact: true }).click();
  await expect(page.getByRole('columnheader')).toHaveCount(6);
  expect(await page.getByRole('columnheader').allTextContents()).toEqual([
    ar.name,
    ar.from,
    ar.to,
    ar.revenue,
    ar.expenses,
    ar.net,
  ]);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('5');
  await page
    .locator('.report-paper')
    .screenshot({ path: 'docs/screenshots/report-shifts-390.png' });
  await page.pdf({
    path: 'docs/screenshots/sample-shifts.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.getByRole('tab', { name: ar.totalsReport, exact: true }).click();
  await expect(page.locator('[data-metric]')).toHaveCount(6);
  await expect(page.locator(`[data-metric="${ar.net}"]`)).toContainText('15');
  await page
    .locator('.report-paper')
    .screenshot({ path: 'docs/screenshots/report-totals-390.png' });
  await page.pdf({
    path: 'docs/screenshots/sample-totals.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  const backupDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: ar.backup, exact: true }).click();
  await (await backupDownload).saveAs('test-results/backup.json');
  await page
    .locator('input[type=file][accept=".json,application/json"]')
    .setInputFiles('test-results/backup.json');
  await page.getByRole('button', { name: ar.replace, exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const fresh = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const cleared = await fresh.newPage();
  await login(cleared, email);
  await cleared.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(cleared.locator(`[data-metric="${ar.net}"]`)).toContainText(
    '15',
  );
  await cleared
    .getByRole('tab', { name: ar.closingReport, exact: true })
    .click();
  await expect(cleared.locator('.session-report-trigger')).toHaveCount(1);
  await page.getByRole('link', { name: ar.home, exact: true }).click();
  await context.setOffline(true);
  await page.getByRole('button', { name: ar.openShift, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.openShift, exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText(ar.cloudOffline);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.close, exact: true })
    .click();
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: ar.home, exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await fresh.close();
  await second.close();
});

test('separate accounts never inherit another shop and worker permissions remain available', async ({
  page,
  browser,
}) => {
  await createShop(page, `separate-${Date.now()}@example.com`, 'محل مستقل');
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(page.locator(`[data-metric="${ar.shiftCount}"]`)).toContainText(
    '0',
  );
  await expect(page.locator(`[data-metric="${ar.net}"]`)).toContainText('0');
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  await page.getByRole('button', { name: ar.addUser, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByLabel(ar.username, { exact: true })
    .fill('Worker');
  await page
    .getByRole('dialog')
    .getByLabel(ar.newPassword, { exact: true })
    .fill('worker-password-123');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.save, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: ar.switchUser, exact: true }).click();
  await page
    .getByLabel(ar.username, { exact: true })
    .selectOption({ label: 'Worker' });
  await page
    .getByLabel(ar.password, { exact: true })
    .fill('worker-password-123');
  await page.getByRole('button', { name: ar.unlock, exact: true }).click();
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(page.getByText(ar.noPermission)).toBeVisible();
  const another = await browser.newContext();
  const other = await another.newPage();
  const otherEmail = `other-${Date.now()}@example.com`;
  await createShop(other, otherEmail, 'محل آخر');
  await expect(other.locator('.topbar')).toContainText('محل آخر');
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  await page.getByRole('button', { name: ar.logout, exact: true }).click();
  await expect(
    page.getByRole('button', { name: ar.useShop, exact: true }),
  ).toBeVisible();
  await login(page, otherEmail);
  await expect(page.locator('.topbar')).toContainText('محل آخر');
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(page.locator(`[data-metric="${ar.shiftCount}"]`)).toContainText(
    '0',
  );
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  await page
    .getByRole('button', { name: ar.changePassword, exact: true })
    .click();
  await page
    .getByRole('dialog')
    .getByLabel(ar.currentPassword, { exact: true })
    .fill(password);
  await page
    .getByRole('dialog')
    .getByLabel(ar.newPassword, { exact: true })
    .fill('changed-cloud-password-123');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.save, exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: ar.logout, exact: true }).click();
  await expect(
    page.getByRole('button', { name: ar.useShop, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: ar.useShop, exact: true }).click();
  await page.getByRole('button', { name: ar.recover, exact: true }).click();
  await page.getByLabel(ar.email, { exact: true }).fill(otherEmail);
  await page.getByRole('button', { name: ar.resetEmail, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(ar.resetSent);
  await page
    .getByLabel(ar.password, { exact: true })
    .fill('changed-cloud-password-123');
  await page.getByRole('button', { name: ar.login, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.home, exact: true }),
  ).toBeVisible();
  await another.close();
});

test('old browser data migrates only with explicit selection and the old manager password', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  const old = defaults();
  const salt = '11'.repeat(16);
  old.users = [
    {
      id: 'legacy-admin',
      username: 'Old manager',
      admin: true,
      active: true,
      permissions: [],
      password: `pbkdf2:210000:${salt}:${pbkdf2Sync('legacy-password', Buffer.from(salt, 'hex'), 210000, 32, 'sha256').toString('hex')}`,
    },
  ];
  old.settings.types[0].single = 3300;
  old.rooms = reconcileRooms(old);
  await page.evaluate(async (data) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('ps-shop-manager');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('snapshots', 'readwrite');
        tx.objectStore('snapshots').put({ ...data, id: 'main' });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  }, old);
  await page.reload();
  await page.getByRole('button', { name: ar.createShop, exact: true }).click();
  await expect(page.getByText(ar.legacyFound)).toBeVisible();
  const email = `migrated-${Date.now()}@example.com`;
  await page.getByLabel(ar.email, { exact: true }).fill(email);
  await page.getByLabel(ar.shop, { exact: true }).fill('المحل المنقول');
  await page.getByLabel(ar.password, { exact: true }).fill(password);
  await page.getByLabel(ar.importLegacy, { exact: true }).check();
  await page
    .getByLabel(ar.legacyPassword, { exact: true })
    .fill('legacy-password');
  await page.getByRole('button', { name: ar.createShop, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.home, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.room-card').first()).toContainText('33');
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await login(other, email);
  await expect(other.locator('.room-card').first()).toContainText('33');
  await fresh.close();
});
