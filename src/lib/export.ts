// src/lib/export.ts
// Export utilities for schedule data (iCal, PDF)

import type { Schedule } from './api/schedules';
import type { ScheduleEntry } from './api/schedule-entries';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Format date to iCal format (YYYYMMDDTHHMMSS)
 */
function formatICalDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * Generate a unique ID for iCal events
 */
function generateUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}@aria`;
}

/**
 * Parse recurrence rule to iCal RRULE format
 */
function convertToICalRRule(rule: string): string | null {
  if (!rule) return null;

  // Already in a compatible format, just need to clean it up
  // Our format: FREQ=WEEKLY;BYDAY=MO or FREQ=WEEKLY;INTERVAL=2;BYDAY=TU
  return rule;
}

/**
 * Export schedule entries to iCal (.ics) format
 */
export function exportToICS(schedule: Schedule, entries: ScheduleEntry[]): void {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aria Scheduling//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${schedule.label}`,
  ];

  for (const entry of entries) {
    const startDate = new Date(entry.start_time);
    const endDate = new Date(entry.end_time);
    const rrule = convertToICalRRule(entry.recurrence_rule);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${generateUID()}`);
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push(`DTSTART:${formatICalDate(startDate)}`);
    lines.push(`DTEND:${formatICalDate(endDate)}`);
    lines.push(`SUMMARY:${entry.student_name}`);

    if (rrule) {
      lines.push(`RRULE:${rrule}`);
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  const content = lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${schedule.label.replace(/[^a-z0-9]/gi, '_')}_schedule.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format time for display (e.g., "9:00 AM")
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Get entries for a specific day and hour
 */
function getEntriesForSlot(
  entries: ScheduleEntry[],
  dayIndex: number,
  hour: number
): ScheduleEntry[] {
  return entries.filter(entry => {
    const startDate = new Date(entry.start_time);
    return startDate.getDay() === dayIndex && startDate.getHours() === hour;
  });
}

/**
 * Export schedule to PDF via print dialog
 * Opens a new window with a print-friendly layout
 */
export function exportToPDF(
  schedule: Schedule,
  entries: ScheduleEntry[],
  weekStart: Date
): void {
  const startHour = schedule.working_hours_start ?? 8;
  const endHour = schedule.working_hours_end ?? 21;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => i + startHour);

  // Generate HTML for print
  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour} ${period}`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate week dates
  const weekDates = DAYS.map((_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  // Build the timetable grid
  let tableRows = '';
  for (const hour of hours) {
    let cells = `<td class="time-cell">${formatHour(hour)}</td>`;

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayEntries = getEntriesForSlot(entries, dayIndex, hour);

      if (dayEntries.length > 0) {
        const entryContent = dayEntries.map(e => {
          const start = new Date(e.start_time);
          const end = new Date(e.end_time);
          return `<div class="entry"><strong>${e.student_name}</strong><br><span class="entry-time">${formatTime(start)} - ${formatTime(end)}</span></div>`;
        }).join('');
        cells += `<td class="slot has-entry">${entryContent}</td>`;
      } else {
        cells += `<td class="slot"></td>`;
      }
    }

    tableRows += `<tr>${cells}</tr>`;
  }

  const formatDateRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  };

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${schedule.label} - Aria Schedule</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
    
    @page {
      size: landscape;
      margin: 0.5in;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Outfit', -apple-system, sans-serif;
      padding: 20px;
      color: #111827;
      background-color: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    .page-header {
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #f97316;
      padding-bottom: 15px;
    }
    .brand-section h1 {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }
    .date-section {
      text-align: right;
    }
    .date-range {
      font-size: 14px;
      font-weight: 600;
      color: #ea580c;
    }
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      overflow: hidden;
      table-layout: fixed;
    }
    th {
      background-color: #fff7ed;
      padding: 10px 5px;
      text-align: center;
      border-bottom: 2px solid #fdba74;
      border-right: 1px solid #fed7aa;
      font-weight: 700;
    }
    th:last-child {
      border-right: none;
    }
    th .day-name {
      display: block;
      font-size: 11px;
      color: #9a3412;
      font-weight: 800;
    }
    th .day-date {
      display: block;
      font-size: 9px;
      color: #c2410c;
      font-weight: 600;
      margin-top: 2px;
    }
    td {
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #e5e7eb;
      padding: 4px;
      vertical-align: top;
      height: 45px;
      overflow: hidden;
    }
    td:last-child {
      border-right: none;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .time-cell {
      width: 60px;
      text-align: right;
      padding-right: 10px;
      font-weight: 700;
      color: #334155;
      background-color: #f1f5f9;
      font-size: 9px;
      border-right: 2.5px solid #cbd5e1;
    }
    .slot {
      background-color: white;
    }
    .has-entry {
      background-color: #fffaf5;
    }
    .entry {
      background-color: #f97316;
      color: white;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 9px;
      margin-bottom: 2px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
      border-left: 2.5px solid #ea580c;
    }
    .entry strong {
      display: block;
      font-size: 9px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .entry-time {
      font-size: 8.5px;
      font-weight: 600;
      opacity: 1;
    }
    .page-footer {
      margin-top: 20px;
      padding-top: 10px;
      display: flex;
      justify-content: flex-end;
      font-size: 9px;
      color: #6b7280;
    }
    .footer-brand {
      font-weight: 700;
      color: #4b5563;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      table { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <div class="brand-section">
      <h1>${schedule.label}</h1>
    </div>
    <div class="date-section">
      <div class="date-range">${formatDateRange(weekStart)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 60px; background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; border-right: 2px solid #e2e8f0;"></th>
        ${DAYS.map((day, i) => `
          <th>
            <span class="day-name">${day}</span>
            <span class="day-date">${formatDate(weekDates[i])}</span>
          </th>
        `).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="page-footer">
    <div class="footer-brand">Aria Scheduling Assistant • aria.app</div>
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
