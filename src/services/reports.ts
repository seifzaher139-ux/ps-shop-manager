import { can } from '../core/logic';
import { currentUser } from './store';
import type { ReportDocument } from '../core/reports';
import { ar } from '../i18n/ar';
import { reportRows } from '../core/reports';
import { fileSaver, safeFilename } from './platform';
export async function exportExcel(report: ReportDocument) {
  if (!can(currentUser(), 'exportReports')) throw new Error('denied');
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  workbook.creator = report.settings.shopName;
  const sheet = workbook.addWorksheet(ar.reports, {
    views: [{ rightToLeft: true }],
  });
  const rows = reportRows(report);
  for (const row of rows) {
    const added = sheet.addRow(row.cells);
    added.alignment = {
      vertical: 'middle',
      horizontal: 'right',
      wrapText: true,
    };
    added.font = { name: 'Arial', size: 16 };
    if (row.style === 'heading' || row.style === 'header') {
      added.font = {
        name: 'Arial',
        size: 17,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      added.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF243558' },
      };
    }
    added.height = row.style === 'heading' ? 46 : 40;
    added.eachCell((cell, index) => {
      if (typeof cell.value === 'number')
        cell.numFmt = row.formats?.[index - 1] === 'money' ? '#,##0.00' : '0';
    });
  }
  const columnCount = Math.max(3, ...rows.map((row) => row.cells.length));
  sheet.columns = Array.from({ length: columnCount }, (_, i) => ({
    width: i === 0 ? 34 : i === 1 ? 44 : 26,
  }));
  sheet.pageSetup = {
    paperSize: 9,
    orientation: report.kind === 'shifts' ? 'landscape' : 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
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
