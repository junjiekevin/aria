import type {
  CalendarAccountRepository,
  ProviderCalendarRepository,
  CalendarProviderAdapter,
} from '@aria/domain';

export interface ConnectGoogleCalendarCommand {
  userId: string;
  providerAccountId: string;
}

export async function connectGoogleCalendarAccount(
  deps: {
    accounts: CalendarAccountRepository;
    calendars: ProviderCalendarRepository;
    adapter: CalendarProviderAdapter;
  },
  command: ConnectGoogleCalendarCommand,
): Promise<void> {
  const account = await deps.accounts.upsert({
    id: command.providerAccountId,
    userId: command.userId,
    provider: 'google',
    providerAccountId: command.providerAccountId,
    encryptedTokenMetadata: null,
    scopeMetadata: null,
    connectionStatus: 'connected',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const providerCalendars = await deps.adapter.listCalendars(account.providerAccountId);
  await deps.calendars.replaceSelection(account.id, providerCalendars);
}
