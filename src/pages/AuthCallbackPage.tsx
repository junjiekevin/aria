import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { finalizeGoogleAuth, fetchCalendarSetupStatus } from '../lib/api/calendar-setup';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/', { replace: true });
        return;
      }

      try {
        await finalizeGoogleAuth();
        const status = await fetchCalendarSetupStatus();
        navigate(status.setupComplete ? '/calendar' : '/calendar/setup', { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Authentication callback failed');
      }
    };

    void run();
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div>
        <h2>Finalizing your Google connection...</h2>
        {error ? <p style={{ color: '#dc2626' }}>{error}</p> : <p>Please wait.</p>}
      </div>
    </div>
  );
}
