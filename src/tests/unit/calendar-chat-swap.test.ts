import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceEvent } from '../../lib/api/calendar-workspace';
import { swapCalendarEventsById } from '../../lib/api/calendar-chat';
import { fetchWorkspaceEvents, updateWorkspaceEvent } from '../../lib/api/calendar-workspace';

vi.mock('../../lib/api/calendar-workspace', () => ({
  fetchWorkspaceEvents: vi.fn(),
  updateWorkspaceEvent: vi.fn(),
  createWorkspaceEvent: vi.fn(),
  deleteWorkspaceEvent: vi.fn(),
}));

const fetchWorkspaceEventsMock = vi.mocked(fetchWorkspaceEvents);
const updateWorkspaceEventMock = vi.mocked(updateWorkspaceEvent);

function makeEvent(id: string, startAt: string, endAt: string): WorkspaceEvent {
  return {
    id,
    providerCalendarId: 'primary',
    providerEventId: `provider-${id}`,
    title: `Event ${id}`,
    startAt,
    endAt,
    timezone: 'UTC',
    sourceCalendarName: 'Primary',
    sourceCalendarColor: '#000',
  };
}

describe('swapCalendarEventsById', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('swaps events when both updates succeed', async () => {
    const first = makeEvent('a', '2026-03-20T10:00:00.000Z', '2026-03-20T11:00:00.000Z');
    const second = makeEvent('b', '2026-03-20T12:00:00.000Z', '2026-03-20T13:00:00.000Z');

    fetchWorkspaceEventsMock
      .mockResolvedValueOnce({ calendars: [], events: [first, second] })
      .mockResolvedValueOnce({ calendars: [], events: [{ ...first, startAt: second.startAt, endAt: second.endAt }, { ...second, startAt: first.startAt, endAt: first.endAt }] });
    updateWorkspaceEventMock.mockResolvedValue(undefined);

    const result = await swapCalendarEventsById('a', 'b');

    expect(updateWorkspaceEventMock).toHaveBeenCalledTimes(2);
    expect(updateWorkspaceEventMock).toHaveBeenNthCalledWith(1, 'a', expect.objectContaining({
      startAt: second.startAt,
      endAt: second.endAt,
    }), 'floating_chat');
    expect(updateWorkspaceEventMock).toHaveBeenNthCalledWith(2, 'b', expect.objectContaining({
      startAt: first.startAt,
      endAt: first.endAt,
    }), 'floating_chat');
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });

  it('rolls back first update when second update fails', async () => {
    const first = makeEvent('a', '2026-03-20T10:00:00.000Z', '2026-03-20T11:00:00.000Z');
    const second = makeEvent('b', '2026-03-20T12:00:00.000Z', '2026-03-20T13:00:00.000Z');
    fetchWorkspaceEventsMock.mockResolvedValueOnce({ calendars: [], events: [first, second] });

    updateWorkspaceEventMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second update failed'))
      .mockResolvedValueOnce(undefined);

    await expect(swapCalendarEventsById('a', 'b')).rejects.toThrow('Swap failed; first event was rolled back');

    expect(updateWorkspaceEventMock).toHaveBeenCalledTimes(3);
    expect(updateWorkspaceEventMock).toHaveBeenNthCalledWith(3, 'a', expect.objectContaining({
      startAt: first.startAt,
      endAt: first.endAt,
    }), 'floating_chat');
  });

  it('surfaces rollback failure when compensation fails', async () => {
    const first = makeEvent('a', '2026-03-20T10:00:00.000Z', '2026-03-20T11:00:00.000Z');
    const second = makeEvent('b', '2026-03-20T12:00:00.000Z', '2026-03-20T13:00:00.000Z');
    fetchWorkspaceEventsMock.mockResolvedValueOnce({ calendars: [], events: [first, second] });

    updateWorkspaceEventMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second update failed'))
      .mockRejectedValueOnce(new Error('rollback failed'));

    await expect(swapCalendarEventsById('a', 'b')).rejects.toThrow('Swap failed and rollback failed');
  });
});
