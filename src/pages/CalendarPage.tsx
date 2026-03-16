import { useEffect, useMemo, useState } from 'react';
import {
  createWorkspaceEvent,
  deleteWorkspaceEvent,
  fetchWorkspaceEvents,
  updateWorkspaceEvent,
  type WorkspaceCalendar,
  type WorkspaceEvent,
} from '../lib/api/calendar-workspace';

type DraftEvent = {
  id?: string;
  providerCalendarId: string;
  title: string;
  startAt: string;
  endAt: string;
};

function toLocalDateTimeInput(value: string): string {
  const date = new Date(value);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${mm}`;
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<WorkspaceCalendar[]>([]);
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftEvent | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceEvents();
      setCalendars(data.calendars);
      setEvents(data.events);
      setVisibleCalendarIds(data.calendars.filter((c) => c.selectedForSync).map((c) => c.providerCalendarId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const primaryWrite = useMemo(
    () => calendars.find((calendar) => calendar.isPrimaryWrite),
    [calendars],
  );

  const visibleEvents = useMemo(
    () => events.filter((event) => visibleCalendarIds.includes(event.providerCalendarId)),
    [events, visibleCalendarIds],
  );

  const startCreate = () => {
    const now = new Date();
    const plusHour = new Date(now.getTime() + 60 * 60 * 1000);
    setDraft({
      providerCalendarId: primaryWrite?.providerCalendarId ?? calendars[0]?.providerCalendarId ?? '',
      title: '',
      startAt: toLocalDateTimeInput(now.toISOString()),
      endAt: toLocalDateTimeInput(plusHour.toISOString()),
    });
  };

  const startEdit = (event: WorkspaceEvent) => {
    setDraft({
      id: event.id,
      providerCalendarId: event.providerCalendarId,
      title: event.title,
      startAt: toLocalDateTimeInput(event.startAt),
      endAt: toLocalDateTimeInput(event.endAt),
    });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      setError('Event title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (draft.id) {
        await updateWorkspaceEvent(draft.id, {
          providerCalendarId: draft.providerCalendarId,
          title: draft.title,
          startAt: new Date(draft.startAt).toISOString(),
          endAt: new Date(draft.endAt).toISOString(),
          timezone: 'UTC',
        });
      } else {
        await createWorkspaceEvent({
          providerCalendarId: draft.providerCalendarId,
          title: draft.title,
          startAt: new Date(draft.startAt).toISOString(),
          endAt: new Date(draft.endAt).toISOString(),
          timezone: 'UTC',
        });
      }
      setDraft(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const removeEvent = async (eventId: string) => {
    setError(null);
    try {
      await deleteWorkspaceEvent(eventId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading calendar workspace...</div>;

  return (
    <div style={{ minHeight: '100vh', padding: '1.5rem 2rem', background: '#f8fafc' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Calendar Workspace</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#64748b' }}>
            Primary write calendar: <strong>{primaryWrite?.name ?? 'Not selected'}</strong>
          </p>
        </div>
        <button type="button" onClick={startCreate} style={{ padding: '0.55rem 0.9rem' }}>Create event</button>
      </header>

      <section style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {calendars.map((calendar) => (
          <label key={calendar.providerCalendarId} style={{ border: '1px solid #cbd5e1', borderRadius: 9999, padding: '0.35rem 0.75rem', background: '#fff' }}>
            <input
              type="checkbox"
              checked={visibleCalendarIds.includes(calendar.providerCalendarId)}
              onChange={(event) => {
                setVisibleCalendarIds((prev) => event.target.checked
                  ? [...prev, calendar.providerCalendarId]
                  : prev.filter((id) => id !== calendar.providerCalendarId));
              }}
            />{' '}
            <span style={{ color: calendar.color ?? '#0f172a' }}>{calendar.name}</span>
            {calendar.isPrimaryWrite ? ' (Primary)' : ''}
          </label>
        ))}
      </section>

      {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem' }}>Title</th>
              <th style={{ padding: '0.6rem' }}>Start</th>
              <th style={{ padding: '0.6rem' }}>End</th>
              <th style={{ padding: '0.6rem' }}>Source</th>
              <th style={{ padding: '0.6rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleEvents.map((event) => (
              <tr key={event.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.6rem' }}>{event.title || '(Untitled)'}</td>
                <td style={{ padding: '0.6rem' }}>{new Date(event.startAt).toLocaleString()}</td>
                <td style={{ padding: '0.6rem' }}>{new Date(event.endAt).toLocaleString()}</td>
                <td style={{ padding: '0.6rem' }}>
                  <span style={{ color: event.sourceCalendarColor ?? '#334155' }}>{event.sourceCalendarName}</span>
                </td>
                <td style={{ padding: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                  <button type="button" onClick={() => startEdit(event)}>Edit</button>
                  <button type="button" onClick={() => void removeEvent(event.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {draft ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: 10, padding: '1rem' }}>
            <h3>{draft.id ? 'Edit event' : 'Create event'}</h3>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              <input value={draft.title} onChange={(e) => setDraft((prev) => prev ? { ...prev, title: e.target.value } : prev)} placeholder="Event title" />
              <select value={draft.providerCalendarId} onChange={(e) => setDraft((prev) => prev ? { ...prev, providerCalendarId: e.target.value } : prev)}>
                {calendars.map((calendar) => (
                  <option key={calendar.providerCalendarId} value={calendar.providerCalendarId}>{calendar.name}</option>
                ))}
              </select>
              <input type="datetime-local" value={draft.startAt} onChange={(e) => setDraft((prev) => prev ? { ...prev, startAt: e.target.value } : prev)} />
              <input type="datetime-local" value={draft.endAt} onChange={(e) => setDraft((prev) => prev ? { ...prev, endAt: e.target.value } : prev)} />
            </div>
            <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button type="button" onClick={() => void saveDraft()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
