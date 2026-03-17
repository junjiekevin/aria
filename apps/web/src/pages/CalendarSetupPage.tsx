import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchCalendarSetupStatus,
  registerCalendarWatches,
  runInitialCalendarSync,
  saveCalendarSelection,
  type SetupCalendar,
} from '../lib/api/calendar-setup';

type LocalCalendar = SetupCalendar & { selectedForSync: boolean; isPrimaryWrite: boolean };

export default function CalendarSetupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<LocalCalendar[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const status = await fetchCalendarSetupStatus();
        setCalendars(status.calendars);
        if (status.setupComplete) {
          navigate('/calendar', { replace: true });
          return;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load setup data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [navigate]);

  const selectedCalendars = useMemo(
    () => calendars.filter((calendar) => calendar.selectedForSync),
    [calendars],
  );

  const primaryWriteProviderCalendarId = useMemo(
    () => calendars.find((calendar) => calendar.isPrimaryWrite)?.providerCalendarId ?? '',
    [calendars],
  );

  const toggleSelected = (providerCalendarId: string) => {
    setCalendars((prev) => prev.map((calendar) => {
      if (calendar.providerCalendarId !== providerCalendarId) return calendar;
      const nextSelected = !calendar.selectedForSync;
      return {
        ...calendar,
        selectedForSync: nextSelected,
        isPrimaryWrite: nextSelected ? calendar.isPrimaryWrite : false,
      };
    }));
  };

  const setPrimary = (providerCalendarId: string) => {
    setCalendars((prev) => prev.map((calendar) => ({
      ...calendar,
      isPrimaryWrite: calendar.providerCalendarId === providerCalendarId,
      selectedForSync: calendar.providerCalendarId === providerCalendarId ? true : calendar.selectedForSync,
    })));
  };

  const submit = async () => {
    if (selectedCalendars.length === 0) {
      setError('Select at least one calendar to sync.');
      return;
    }

    if (!primaryWriteProviderCalendarId) {
      setError('Choose exactly one primary write calendar.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveCalendarSelection({
        calendars: calendars.map((calendar) => ({
          providerCalendarId: calendar.providerCalendarId,
          name: calendar.name,
          color: calendar.color,
          timezone: calendar.timezone,
          selectedForSync: calendar.selectedForSync,
        })),
        primaryWriteProviderCalendarId,
      });

      await runInitialCalendarSync();
      await registerCalendarWatches();

      navigate('/calendar', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save setup selection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading setup...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1>Connect Calendars</h1>
      <p>Select calendars to sync and choose your primary write calendar.</p>

      {error ? <p style={{ color: '#dc2626' }}>{error}</p> : null}

      <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
        {calendars.map((calendar) => (
          <div key={calendar.providerCalendarId} style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{calendar.name}</strong>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{calendar.timezone}</div>
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={calendar.selectedForSync}
                  onChange={() => toggleSelected(calendar.providerCalendarId)}
                />{' '}
                Sync
              </label>
            </div>

            <label style={{ display: 'block', marginTop: 8 }}>
              <input
                type="radio"
                name="primaryWrite"
                checked={calendar.isPrimaryWrite}
                onChange={() => setPrimary(calendar.providerCalendarId)}
                disabled={!calendar.selectedForSync}
              />{' '}
              Primary write calendar
            </label>
          </div>
        ))}
      </div>

      <button type="button" onClick={submit} disabled={saving} style={{ marginTop: '1rem', padding: '0.6rem 1rem' }}>
        {saving ? 'Saving...' : 'Finish setup'}
      </button>
    </div>
  );
}
