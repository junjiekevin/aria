import type { SupabaseClient } from '@supabase/supabase-js';
import { GoogleCalendarAdapter } from './google-calendar-adapter.js';

type CreateGoogleAdapterForUserInput = {
  userId: string;
  serviceClient: SupabaseClient;
  webhookUrl?: string;
  webhookToken?: string;
};

export function createGoogleCalendarAdapterForUser(input: CreateGoogleAdapterForUserInput): GoogleCalendarAdapter {
  return new GoogleCalendarAdapter(async (accountId: string) => {
    const { data, error } = await input.serviceClient
      .from('calendar_accounts')
      .select('encrypted_token_metadata')
      .eq('provider', 'google')
      .eq('provider_account_id', accountId)
      .eq('user_id', input.userId)
      .maybeSingle();

    if (error || !data?.encrypted_token_metadata) {
      throw new Error('GOOGLE_TOKEN_METADATA_MISSING');
    }

    const metadata = JSON.parse(data.encrypted_token_metadata) as { access_token?: string };
    if (!metadata.access_token) {
      throw new Error('GOOGLE_ACCESS_TOKEN_MISSING');
    }

    return { accessToken: metadata.access_token };
  }, input.webhookUrl ? {
    webhookUrl: input.webhookUrl,
    webhookToken: input.webhookToken,
  } : undefined);
}
