import type {Report} from '../core/model';
import {ar} from '../i18n/ar';
import {reportRows} from '../core/reports';
export {reportRows,reportBill} from '../core/reports';
import {fileSaver,safeFilename} from './platform';
export async function exportExcel(report: Report) {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  workbook.creator = report.settings.shopName;
  const sheet = workbook.addWorksheet(ar.reports, {
    views: [{ rightToLeft: true }],
  });
  const rows = reportRows(report);
  for (const row of rows) {
    const added = sheet.addRow(row);
    added.alignment = {
      vertical: 'middle',
      horizontal: 'right',
      wrapText: true,
    };
    if (
      row.length === 1 ||
      row[0] === ar.room ||
      row[0] === ar.description ||
      row[0] === ar.category ||
      row[0] === ar.name
    ) {
      added.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      added.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF243558' },
      };
    }
    added.height = 30;
    added.eachCell((cell) => {
      if (typeof cell.value === 'number') cell.numFmt = '0.00';
    });
  }
  sheet.columns = Array.from({ length: 12 }, (_, i) => ({
    width: i === 0 ? 30 : i === 2 || i === 3 ? 28 : 18,
  }));
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  if (report.settings.logo) {
    const extension = report.settings.logo.startsWith('data:image/png')
      ? 'png'
      : 'jpeg';
    const image = workbook.addImage({
      base64: report.settings.logo,
      extension,
    });
    sheet.addImage(image, {
      tl: { col: 10, row: 0 },
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
  const old = document.title;
  document.title = safeFilename(name);
  window.print();
  document.title = old;
}
