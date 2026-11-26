import ExcelJS from 'exceljs';
import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { ar } from '../src/i18n/ar';
test('complete shop flow, export, and offline reload', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const external: string[] = [];
  page.on('request', (req) => {
    if (
      !req.url().startsWith('http://127.0.0.1:4173') &&
      !req.url().startsWith('data:')
    )
      external.push(req.url());
  });
  await page.goto('/');
  const manifest = await (
    await page.request.get('/manifest.webmanifest')
  ).json();
  expect(manifest).toMatchObject({
    dir: 'rtl',
    lang: 'ar',
    display: 'standalone',
    start_url: './',
  });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual([
    '192x192',
    '512x512',
  ]);
  const dimensions = await page.evaluate(async () => {
    const image = new Image();
    image.src = './icons/icon-512.png';
    await image.decode();
    return [image.naturalWidth, image.naturalHeight];
  });
  expect(dimensions).toEqual([512, 512]);
  await page.getByLabel(ar.username, { exact: true }).fill('Seif');
  await page.getByLabel(ar.password, { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: ar.setup, exact: true }).click();
  await expect(page.locator('output.recovery')).toHaveText(/[A-F0-9]{4}-/);
  await page.getByRole('button', { name: ar.continue, exact: true }).click();
  await page.getByRole('button', { name: ar.openShift, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.openShift, exact: true })
    .click();
  await page
    .getByRole('button')
    .filter({
      has: page.getByRole('heading', { name: 'PS4 روم 1', exact: true }),
    })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.start, exact: true })
    .click();
  await expect(page.locator('.occupied')).toHaveCount(1);
  await page.reload();
  await page.getByLabel(ar.username, { exact: true }).fill('Seif');
  await page.getByLabel(ar.password, { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: ar.login, exact: true }).click();
  await expect(page.locator('.occupied')).toHaveCount(1);
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({
    path: 'docs/screenshots/rooms-390.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 360, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.screenshot({
    path: 'docs/screenshots/rooms-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.occupied').click();
  await page.getByRole('button', { name: ar.addService, exact: true }).click();
  await expect(page.getByRole('dialog').getByText('شاي × 1')).toBeVisible();
  await page.getByRole('button', { name: ar.end, exact: true }).click();
  await page.getByLabel(ar.discount, { exact: true }).selectOption('fixed');
  await page.getByLabel(ar.amount, { exact: true }).fill('3');
  await page.getByLabel(ar.reason, { exact: true }).fill('خصم عميل');
  await page.getByLabel(ar.paid, { exact: true }).fill('30');
  await page.screenshot({
    path: 'docs/screenshots/checkout-390.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: ar.confirm, exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText(ar.receipt, { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: ar.close, exact: true }).click();
  await page.getByRole('link', { name: ar.expenses, exact: true }).click();
  await page.getByRole('button', { name: ar.addExpense, exact: true }).click();
  await page.getByLabel(ar.description, { exact: true }).fill('كهرباء');
  await page.getByLabel(ar.amount, { exact: true }).fill('5');
  await page.getByRole('button', { name: ar.save, exact: true }).click();
  await page.screenshot({
    path: 'docs/screenshots/expenses-390.png',
    fullPage: true,
  });
  await page.getByRole('link', { name: ar.home, exact: true }).click();
  await page.getByRole('button', { name: ar.closeShift, exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: ar.closeShift, exact: true })
    .click();
  if (await page.getByRole('dialog').isVisible())
    await page
      .getByRole('dialog')
      .getByRole('button', { name: ar.close, exact: true })
      .click();
  await expect(
    page.getByRole('heading', { name: ar.closingReport, exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/reports-390.png',
    fullPage: true,
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: ar.excel, exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  await download.saveAs('test-results/shift-report.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('test-results/shift-report.xlsx');
  const sheet = workbook.worksheets[0];
  expect(sheet.views[0].rightToLeft).toBe(true);
  expect(sheet.getCell('A1').font.bold).toBe(true);
  expect(sheet.getColumn(1).width).toBeGreaterThan(20);
  const exportedNumbers: number[] = [];
  sheet.eachRow((row) =>
    row.eachCell((cell) => {
      if (typeof cell.value === 'number') exportedNumbers.push(cell.value);
    }),
  );
  expect(exportedNumbers).toEqual(
    expect.arrayContaining([13, 10, 3, 5, 15, 20, 30]),
  );
  expect(sheet.getImages()).toHaveLength(1);
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: 'docs/screenshots/sample-report.pdf',
    format: 'A4',
    landscape: true,
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  await page.screenshot({
    path: 'docs/screenshots/settings-390.png',
    fullPage: true,
  });
  const backupPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: ar.backup, exact: true }).click();
  const backup = await backupPromise;
  await backup.saveAs('test-results/backup.json');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error('no active worker');
  });
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByLabel(ar.username, { exact: true }).fill('Seif');
  await page.getByLabel(ar.password, { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: ar.login, exact: true }).click();
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(
    page.getByRole('heading', { name: ar.dayReport, exact: true }),
  ).toBeVisible();
  await expect(page.locator('.report-paper')).toContainText('خصم عميل');
  await expect(page.locator('.report-paper')).toContainText('20');
  const offlineExport = page.waitForEvent('download');
  await page.getByRole('button', { name: ar.excel, exact: true }).click();
  expect((await offlineExport).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole('link', { name: ar.settings, exact: true }).click();
  await page
    .locator('input[type="file"][accept=".json,application/json"]')
    .setInputFiles('test-results/backup.json');
  await expect(page.getByRole('dialog')).toContainText(ar.restoreSummary);
  await page.getByRole('button', { name: ar.replace, exact: true }).click();
  await page.getByLabel(ar.username, { exact: true }).fill('Seif');
  await page.getByLabel(ar.password, { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: ar.login, exact: true }).click();
  await page.getByRole('link', { name: ar.reports, exact: true }).click();
  await expect(page.locator('.report-paper')).toContainText('خصم عميل');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
