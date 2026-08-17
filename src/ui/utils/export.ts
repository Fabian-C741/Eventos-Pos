import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { ReportResult } from '../../server/services/reports.service';

export function exportCSV(report: ReportResult) {
  const header = report.columns.map((c) => c.label);
  const rows = report.rows.map((r) => report.columns.map((c) => String(r[c.key] ?? '')));
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  download(blob, `${report.title}.csv`);
}

export function exportExcel(report: ReportResult) {
  const data = report.rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const c of report.columns) out[c.label] = r[c.key];
    return out;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
  XLSX.writeFile(wb, `${report.title}.xlsx`);
}

export function exportPDF(report: ReportResult) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(16);
  doc.text(report.title, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 23);
  const head = [report.columns.map((c) => c.label)];
  const body = report.rows.map((r) => report.columns.map((c) => String(r[c.key] ?? '')));
  autoTable(doc, {
    startY: 28,
    head,
    body,
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });
  doc.save(`${report.title}.pdf`);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}