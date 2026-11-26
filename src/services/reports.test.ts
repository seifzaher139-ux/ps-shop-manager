import { expect, it } from 'vitest';
import { defaults, type Session } from '../core/model';
import { buildReport, calculate } from '../core/logic';
import { buildReportDocument } from '../core/reports';
import { buildExcelWorkbook, excelDate } from './reports';
import { ar } from '../i18n/ar';
function report() {
  const state = defaults();
  state.users = [
    {
      id: 'u',
      username: 'Seif',
      admin: true,
      active: true,
      password: 'unused',
      permissions: [],
    },
  ];
  const start = Date.UTC(2026, 10, 26, 10);
  state.shifts = [
    {
      id: 's',
      date: '2026-11-26',
      start,
      end: start + 3600000,
      openedBy: 'u',
      closedBy: 'u',
      note: '',
    },
  ];
  const session: Session = {
    id: 'one',
    shiftId: 's',
    roomId: 'ps4-1',
    roomName: 'PS4 room 1',
    mode: 'single',
    rate: 2500,
    start,
    end: start + 3600000,
    status: 'finished',
    timezone: 'Africa/Cairo',
    note: '',
    createdBy: 'u',
    services: [{ id: 'tea', name: 'tea', price: 1000, quantity: 1 }],
    discount: { kind: 'fixed', value: 300, reason: '' },
    pricing: {
      roundTime: true,
      priceRound: 'pound',
      thresholds: { half: 35, quarter: 45 },
    },
  };
  session.bill = calculate(session, session.end!, 4000);
  state.sessions = [session];
  state.expenses = [
    {
      id: 'e',
      shiftId: 's',
      description: 'electricity',
      amount: 500,
      category: 'other',
      voided: false,
      createdBy: 'u',
    },
  ];
  return buildReportDocument(
    buildReport(state, ['s'], session.end!, '', '2026-11-26'),
    'shift',
  );
}
it('builds one RTL session table below the requested compact summary', async () => {
  const { workbook, sheet } = await buildExcelWorkbook(report());
  expect(sheet.getTables()).toHaveLength(1);
  expect(sheet.views[0]).toMatchObject({ rightToLeft: true, state: 'frozen' });
  expect(
    Array.from({ length: 8 }, (_, i) => sheet.getRow(i + 1).getCell(1).value),
  ).toEqual([
    ar.shop,
    ar.shift,
    ar.period,
    ar.play,
    ar.services,
    ar.discounts,
    ar.expenses,
    ar.net,
  ]);
  let header = 0;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === ar.excelIndex) header = row.number;
  });
  expect('ySplit' in sheet.views[0] ? sheet.views[0].ySplit : undefined).toBe(
    header,
  );
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
  const row = sheet.getRow(header + 1);
  expect(row.getCell(4).value).toBeInstanceOf(Date);
  expect(row.getCell(4).numFmt).toBe('dd/mm/yyyy hh:mm');
  expect(row.getCell(7).value).toBe(25);
  expect(row.getCell(10).value).toBe(32);
  expect(row.getCell(12).value).toBe(8);
  expect(row.getCell(10).numFmt).toBe('#,##0.00');
  expect(row.getCell(10).border.bottom?.style).toBe('thin');
  expect(sheet.getRow(header + 2).getCell(10).value).toMatchObject({
    result: 32,
  });
  expect(sheet.getRow(header + 2).getCell(12).value).toMatchObject({
    result: 8,
  });
  expect(sheet.getRow(header).getCell(1).font.color).toMatchObject({
    argb: 'FFFFFFFF',
  });
  expect(sheet.getColumn(2).width).toBeGreaterThan(20);
  const bytes = await workbook.xlsx.writeBuffer();
  expect(bytes.byteLength).toBeGreaterThan(1000);
});
it('uses shop wall-clock values in numeric Excel date cells', () => {
  const date = excelDate(Date.UTC(2026, 10, 26, 10, 45), 'Africa/Cairo');
  expect(date.getUTCHours()).toBe(12);
  expect(date.getUTCMinutes()).toBe(45);
});
it('handles an empty shift without circular total formulas', async () => {
  const doc = report();
  doc.source.sessions = [];
  const { sheet } = await buildExcelWorkbook(doc);
  let header = 0;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === ar.excelIndex) header = row.number;
  });
  expect(sheet.getRow(header + 1).getCell(10).value).toBe(0);
});
