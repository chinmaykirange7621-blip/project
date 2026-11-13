export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'No fixed cap';
  if (value >= 100000) {
    const lakhs = value / 100000;
    const formatted = Number.isInteger(lakhs) ? lakhs.toString() : lakhs.toFixed(2).replace(/\.?0+$/, '');
    return `₹${value.toLocaleString('en-IN')} (${formatted} Lakh/yr)`;
  }
  return `₹${value.toLocaleString('en-IN')}/yr`;
}

export function exportToCSV(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>): void {
  const escapeCell = (cell: string | number | null | undefined) => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    const safe = str.replace(/"/g, '""');
    return `"${safe}"`;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printReportAsPDF(title: string, subtitle: string, sectionsHtml: string): void {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 32px; line-height: 1.5; }
    h1 { font-size: 22px; margin-bottom: 4px; color: #1e3a8a; }
    .subtitle { color: #475569; font-size: 13px; margin-bottom: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; }
    .card { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
    .verified { background: #dcfce7; color: #166534; }
    .sample { background: #fef3c7; color: #92400e; }
    .meta { font-size: 12px; color: #475569; margin: 6px 0; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="subtitle">${subtitle} · Generated on ${new Date().toLocaleDateString('en-IN')}</div>
  ${sectionsHtml}
  <div class="footer">ScholarAI – Your Future. Your Scholarship. One Intelligent Assistant. Final eligibility is decided by the provider.</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  } else {
    // Fallback download if popup blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function downloadCalendarICS(
  scholarshipName: string,
  reminderDate: string,
  officialUrl: string,
  note: string
): void {
  const dt = reminderDate.replace(/-/g, '');
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ScholarAI//Scholarship Reminder//EN',
    'BEGIN:VEVENT',
    `UID:scholarai-${dt}-${Math.random().toString(36).slice(2)}@scholarai.local`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `SUMMARY:Scholarship Reminder: ${scholarshipName}`,
    `DESCRIPTION:${note || 'Check documents and apply on official portal.'}\\nPortal: ${officialUrl}`,
    `URL:${officialUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scholarai-reminder-${dt}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
