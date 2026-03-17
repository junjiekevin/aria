import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeFunction } from '../../lib/functions';
import { fetchWorkspaceEvents } from '../../lib/api/calendar-workspace';
import { createPlan } from '../../lib/api/schedule-plans';
import { getFormResponses } from '../../lib/api/form-responses';

vi.mock('../../lib/api/calendar-workspace', () => ({
  fetchWorkspaceEvents: vi.fn(),
  createWorkspaceEvent: vi.fn(),
  updateWorkspaceEvent: vi.fn(),
  deleteWorkspaceEvent: vi.fn(),
}));

vi.mock('../../lib/api/schedule-plans', () => ({
  createPlan: vi.fn(),
  getPlan: vi.fn(),
  commitPlan: vi.fn(),
}));

vi.mock('../../lib/api/calendar-chat', () => ({
  createCalendarEventFromLegacyArgs: vi.fn(),
  deleteCalendarEventById: vi.fn(),
  getCalendarEventSummary: vi.fn(),
  searchCalendarEvents: vi.fn(),
  swapCalendarEventsById: vi.fn(),
  updateCalendarEventFromLegacyArgs: vi.fn(),
}));

vi.mock('../../lib/api/form-responses', () => ({
  getFormResponses: vi.fn(),
  getFormResponseById: vi.fn(),
  updateFormResponseAssigned: vi.fn(),
  getPreferredTimings: vi.fn(),
}));

const fetchWorkspaceEventsMock = vi.mocked(fetchWorkspaceEvents);
const createPlanMock = vi.mocked(createPlan);
const getFormResponsesMock = vi.mocked(getFormResponses);

describe('executeFunction legacy seam guardrails', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('supports listSchedules via canonical workspace calendars', async () => {
    fetchWorkspaceEventsMock.mockResolvedValue({
      calendars: [
        {
          providerCalendarId: 'primary-calendar',
          name: 'Primary',
          color: '#ffffff',
          timezone: 'UTC',
          selectedForSync: true,
          isPrimaryWrite: true,
        },
      ],
      events: [],
    });

    const result = await executeFunction('listSchedules', {});

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        id: 'primary-calendar',
        calendar_id: 'primary-calendar',
        label: 'Primary',
        selected_for_sync: true,
        is_primary_write: true,
      }),
    ]);
  });

  it('accepts proposeScheduleChanges without schedule_id', async () => {
    fetchWorkspaceEventsMock.mockResolvedValue({ calendars: [], events: [] });
    createPlanMock.mockResolvedValue({
      id: 'plan-1',
      user_id: 'user-1',
      schedule_id: '',
      status: 'pending',
      changes: [],
      conflicts: [],
      summary: 'Plan summary',
      expires_at: '2026-03-18T00:00:00.000Z',
      created_at: '2026-03-17T00:00:00.000Z',
    });

    const result = await executeFunction('proposeScheduleChanges', {
      changes: [
        {
          action: 'add',
          target: 'Alex',
          description: 'Add Alex on Monday at 10:00',
          after: {
            day: 'Monday',
            start_time: '10:00',
            end_time: '11:00',
            student_name: 'Alex',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(createPlanMock).toHaveBeenCalledWith('', expect.any(Array), expect.any(Array), expect.any(String));
  });

  it('accepts proposeScheduleChanges calendar_id alias', async () => {
    fetchWorkspaceEventsMock.mockResolvedValue({ calendars: [], events: [] });
    createPlanMock.mockResolvedValue({
      id: 'plan-2',
      user_id: 'user-1',
      schedule_id: 'primary-calendar',
      status: 'pending',
      changes: [],
      conflicts: [],
      summary: 'Plan summary',
      expires_at: '2026-03-18T00:00:00.000Z',
      created_at: '2026-03-17T00:00:00.000Z',
    });

    const result = await executeFunction('proposeScheduleChanges', {
      calendar_id: 'primary-calendar',
      changes: [
        {
          action: 'add',
          target: 'Alex',
          description: 'Add Alex on Monday at 10:00',
          after: {
            day: 'Monday',
            start_time: '10:00',
            end_time: '11:00',
            student_name: 'Alex',
          },
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(createPlanMock).toHaveBeenCalledWith('primary-calendar', expect.any(Array), expect.any(Array), expect.any(String));
  });

  it('rejects provider calendar id for participant lookup legacy schedule domain', async () => {
    fetchWorkspaceEventsMock.mockResolvedValue({
      calendars: [
        {
          providerCalendarId: 'primary-calendar',
          name: 'Primary',
          color: '#ffffff',
          timezone: 'UTC',
          selectedForSync: true,
          isPrimaryWrite: true,
        },
      ],
      events: [],
    });

    const result = await executeFunction('listUnassignedParticipants', {
      legacy_schedule_id: 'primary-calendar',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/legacy_schedule_id/i);
    expect(getFormResponsesMock).not.toHaveBeenCalled();
  });
});
