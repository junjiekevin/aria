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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${schedule.label} - Schedule</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      color: #111827;
    }
    .header {
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f97316;
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 5px;
    }
    .subtitle {
      font-size: 14px;
      color: #6b7280;
    }
    .week-info {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      background-color: #fff7ed;
      padding: 8px 4px;
      text-align: center;
      border: 1px solid #e5e7eb;
      font-weight: 600;
    }
    th .day-name {
      display: block;
      font-size: 12px;
    }
    th .day-date {
      display: block;
      font-size: 10px;
      color: #6b7280;
      font-weight: 400;
    }
    td {
      border: 1px solid #e5e7eb;
      padding: 4px;
      vertical-align: top;
      height: 40px;
    }
    .time-cell {
      width: 60px;
      text-align: right;
      padding-right: 8px;
      font-weight: 500;
      color: #6b7280;
      background-color: #f9fafb;
    }
    .slot {
      width: calc((100% - 60px) / 7);
    }
    .has-entry {
      background-color: #fff7ed;
    }
    .entry {
      background-color: #fb923c;
      color: white;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 10px;
      margin-bottom: 2px;
    }
    .entry strong {
      display: block;
      font-size: 11px;
    }
    .entry-time {
      font-size: 9px;
      opacity: 0.9;
    }
    .footer {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid #e5e7eb;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${schedule.label}</div>
    <div class="subtitle">${formatDate(new Date(schedule.start_date))} - ${formatDate(new Date(schedule.end_date))}</div>
    <div class="week-info">Week of ${formatDate(weekStart)}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th></th>
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

  <div class="footer">
    Generated by Aria Scheduling Assistant
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
