import { can } from '../core/logic';
import { currentUser } from './store';
import type { ReportDocument } from '../core/reports';
import { reportRows, reportBill } from '../core/reports';
import { ar, dateTime } from '../i18n/ar';
import { fileSaver, safeFilename } from './platform';

export function excelDate(timestamp: number, timezone: string): Date {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(timestamp);
  const n = (type: string) =>
    Number(fields.find((f) => f.type === type)!.value);
  return new Date(
    Date.UTC(
      n('year'),
      n('month') - 1,
      n('day'),
      n('hour'),
      n('minute'),
      n('second'),
    ),
  );
}
export async function buildExcelWorkbook(report: ReportDocument) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  workbook.creator = report.settings.shopName;
  const sheet = workbook.addWorksheet(ar.reports, {
    views: [{ rightToLeft: true }],
  });
  let columnCount = 3;
  if (report.kind === 'shift') {
    columnCount = 12;
    const source = report.source;
    const shift = source.shifts[0];
    const summary: (string | number)[][] = [
      [ar.shop, report.settings.shopName],
      [ar.shift, report.period],
      [
        ar.period,
        shift
          ? `${dateTime(shift.start, report.settings.timezone)} — ${shift.end ? dateTime(shift.end, report.settings.timezone) : ar.running}`
          : report.period,
      ],
      [ar.play, source.totals.play / 100],
      [ar.services, source.totals.services / 100],
      [ar.discounts, source.totals.discounts / 100],
      [ar.expenses, source.totals.expenses / 100],
      [ar.net, source.totals.net / 100],
    ];
    for (const [index, row] of summary.entries()) {
      const added = sheet.addRow(row);
      sheet.mergeCells(added.number, 2, added.number, 4);
      added.height = 28;
      added.font = { name: 'Arial', size: 13 };
      added.alignment = {
        horizontal: 'right',
        vertical: 'middle',
        wrapText: true,
      };
      added.getCell(1).font = { name: 'Arial', size: 13, bold: true };
      if (index >= 3) added.getCell(2).numFmt = '#,##0.00';
    }
    sheet.addRow([]);
    if (source.sessions.some((s) => s.status === 'running')) {
      const note = sheet.addRow([ar.liveShiftHint]);
      sheet.mergeCells(note.number, 1, note.number, 12);
      note.height = 32;
      note.font = { name: 'Arial', size: 12 };
      note.alignment = { wrapText: true, horizontal: 'right' };
    }
    const header = sheet.lastRow!.number + 1;
    const labels = [
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
    ];
    const ordered = [...source.sessions].sort((a, b) => a.start - b.start);
    const raw = ordered.map((session, index) => {
      const bill = reportBill(session, source.generatedAt);
      const active =
        session.status === 'finished' || session.status === 'running';
      return [
        index + 1,
        active
          ? session.roomName
          : `${session.roomName} · ${ar[session.status]}`,
        ar[session.mode],
        excelDate(session.start, session.timezone),
        session.end ? excelDate(session.end, session.timezone) : ar.running,
        active ? bill.billedMinutes : 0,
        active ? bill.play / 100 : 0,
        active ? bill.services / 100 : 0,
        active ? bill.discount / 100 : 0,
        active ? bill.total / 100 : 0,
        session.status === 'finished' ? bill.paid / 100 : 0,
        session.status === 'finished' ? bill.change / 100 : 0,
      ];
    });
    sheet.addTable({
      name: 'Sessions',
      ref: `A${header}`,
      headerRow: true,
      totalsRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: labels.map((name, i) => ({
        name,
        filterButton: true,
        ...(i === 0
          ? { totalsRowLabel: ar.total }
          : i >= 5
            ? { totalsRowFunction: 'sum' as const }
            : {}),
      })),
      rows: raw,
    });
    const last = header + raw.length + 1;
    for (let i = header; i <= last; i++) {
      const row = sheet.getRow(i);
      row.height = i === header ? 48 : 30;
      row.font = { name: 'Arial', size: 12 };
      row.alignment = {
        horizontal: 'right',
        vertical: 'middle',
        wrapText: true,
      };
      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCCD6E5' } },
          bottom: { style: 'thin', color: { argb: 'FFCCD6E5' } },
          left: { style: 'thin', color: { argb: 'FFCCD6E5' } },
          right: { style: 'thin', color: { argb: 'FFCCD6E5' } },
        };
        cell.numFmt =
          c === 4 || c === 5 ? 'dd/mm/yyyy hh:mm' : c >= 7 ? '#,##0.00' : '0';
        if (i === header || i === last) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF243558' },
          };
          cell.font = {
            name: 'Arial',
            size: 12,
            bold: true,
            color: { argb: 'FFFFFFFF' },
          };
        }
      }
    }
    for (let c = 6; c <= 12; c++) {
      const key = (
        [
          'billedMinutes',
          'play',
          'services',
          'discount',
          'total',
          'paid',
          'change',
        ] as const
      )[c - 6];
      const total =
        ordered.reduce((sum, session) => {
          if (session.status !== 'finished' && session.status !== 'running')
            return sum;
          if (
            (key === 'paid' || key === 'change') &&
            session.status !== 'finished'
          )
            return sum;
          return sum + reportBill(session, source.generatedAt)[key];
        }, 0) / (c >= 7 ? 100 : 1);
      sheet.getRow(last).getCell(c).value = raw.length
        ? {
            formula: `SUBTOTAL(109,${String.fromCharCode(64 + c)}${header + 1}:${String.fromCharCode(64 + c)}${last - 1})`,
            result: total,
          }
        : 0;
    }
    sheet.columns = [6, 24, 14, 23, 23, 18, 19, 17, 17, 19, 17, 17].map(
      (width) => ({ width }),
    );
    sheet.views = [
      {
        rightToLeft: true,
        state: 'frozen',
        ySplit: header,
        topLeftCell: `A${header + 1}`,
      },
    ];
    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${header}:${header}`,
    };
  } else {
    const rows = reportRows(report);
    for (const row of rows) {
      const added = sheet.addRow(row.cells);
      added.height = row.style === 'heading' ? 42 : 32;
      added.font = { name: 'Arial', size: 14 };
      added.alignment = {
        horizontal: 'right',
        vertical: 'middle',
        wrapText: true,
      };
      if (row.style === 'heading' || row.style === 'header') {
        added.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF243558' },
        };
        added.font = {
          name: 'Arial',
          size: 14,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
      }
      added.eachCell((cell, index) => {
        if (typeof cell.value === 'number')
          cell.numFmt = row.formats?.[index - 1] === 'money' ? '#,##0.00' : '0';
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFD2DBE9' } },
        };
      });
    }
    columnCount = Math.max(3, ...rows.map((row) => row.cells.length));
    sheet.columns = Array.from({ length: columnCount }, (_, i) => ({
      width: i === 0 ? 34 : i === 1 ? 44 : 26,
    }));
    const header = rows.findIndex((row) => row.style === 'header');
    if (header >= 0)
      sheet.views = [
        { rightToLeft: true, state: 'frozen', ySplit: header + 1 },
      ];
    sheet.pageSetup = {
      paperSize: 9,
      orientation: report.kind === 'shifts' ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  return { workbook, sheet, columnCount };
}
export async function exportExcel(report: ReportDocument) {
  if (!can(currentUser(), 'exportReports')) throw new Error('denied');
  const { workbook, sheet, columnCount } = await buildExcelWorkbook(report);
  let reportLogo = report.settings.logo;
  if (!reportLogo) {
    const response = await fetch(
      new URL('icons/icon-192.png', document.baseURI),
    );
    if (response.ok) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      reportLogo =
        'data:image/png;base64,' +
        btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    }
  }
  if (reportLogo) {
    const extension = reportLogo.startsWith('data:image/png') ? 'png' : 'jpeg';
    const image = workbook.addImage({
      base64: reportLogo,
      extension,
    });
    sheet.addImage(image, {
      tl: { col: columnCount - 1, row: 0 },
      ext: { width: 60, height: 60 },
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  await fileSaver.saveFile(
    `${safeFilename(`${report.settings.shopName}-${report.title}-${report.period}-${report.settings.device}`)}.xlsx`,
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
}
export function printReport(name: string) {
  if (!can(currentUser(), 'exportReports')) throw new Error('denied');
  const old = document.title;
  document.title = safeFilename(name);
  window.print();
  document.title = old;
}
