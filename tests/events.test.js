// tests/events.test.js — Tests for Event Notes module

const path = require('path');
require('./mocks/chrome.storage.mock');

// Load task_utils first (events.js depends on parseTimeRange, _lastSaveTimestamp)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'DEFAULT_TIME_BLOCKS', 'Task', 'getTasks', 'saveTasks', 'getTasksAsync', 'saveTasksAsync',
    'parseTimeRange', '_lastSaveTimestamp', 'getTimeBlocks', 'saveTimeBlocks'
]);

// Load events.js
loadScript(path.join(__dirname, '..', 'events.js'), [
    'EventNote', 'getEvents', 'getEventsAsync', 'saveEvents', 'saveEventsAsync',
    'addNewEvent', 'getEventById', 'updateEvent', 'deleteEvent',
    'duplicateEvent', 'createRecurringEventInstance',
    'cleanupExpiredEvents', 'calculateEventExpiry', 'withEventLock'
]);

beforeEach(() => {
    resetChromeStorage();
});

// --- EventNote Class ---
describe('EventNote class', () => {
    test('creates event with defaults', () => {
        const event = new EventNote(null, 'Test Event');
        expect(event.id).toMatch(/^event_\d+_[a-z0-9]+$/);
        expect(event.title).toBe('Test Event');
        expect(event.notes).toBe('');
        expect(event.createdAt).toBeTruthy();
        expect(event.recurrence).toBeNull();
        expect(event.colorCode).toBeNull();
        expect(event.schedule).toEqual([]);
    });

    test('creates event with all fields', () => {
        const event = new EventNote(
            'event_123', 'Meeting', 'Room 101',
            '2026-02-26T10:00:00Z', 'weekly', 'blue',
            [{ day: 'monday', blockId: 'engagement', expiresAt: '2026-02-26T12:00:00Z' }]
        );
        expect(event.id).toBe('event_123');
        expect(event.title).toBe('Meeting');
        expect(event.notes).toBe('Room 101');
        expect(event.createdAt).toBe('2026-02-26T10:00:00Z');
        expect(event.recurrence).toBe('weekly');
        expect(event.colorCode).toBe('blue');
        expect(event.schedule).toHaveLength(1);
    });

    test('auto-generates unique IDs', () => {
        const e1 = new EventNote(null, 'A');
        const e2 = new EventNote(null, 'B');
        expect(e1.id).not.toBe(e2.id);
    });

    test('preserves provided ID', () => {
        const event = new EventNote('custom_id', 'Test');
        expect(event.id).toBe('custom_id');
    });
});

// --- CRUD Operations ---
describe('Event CRUD', () => {
    test('getEvents returns empty array by default', async () => {
        const events = await getEventsAsync();
        expect(events).toEqual([]);
    });

    test('saveEvents and getEvents round-trip', async () => {
        const events = [new EventNote(null, 'Event A'), new EventNote(null, 'Event B')];
        await saveEventsAsync(events);
        const loaded = await getEventsAsync();
        expect(loaded).toHaveLength(2);
        expect(loaded[0].title).toBe('Event A');
        expect(loaded[1].title).toBe('Event B');
    });

    test('addNewEvent adds event to storage', async () => {
        const event = await addNewEvent('Groceries', 'Buy milk', 'weekly', 'green');
        expect(event.title).toBe('Groceries');
        expect(event.notes).toBe('Buy milk');
        expect(event.recurrence).toBe('weekly');
        expect(event.colorCode).toBe('green');

        const events = await getEventsAsync();
        expect(events).toHaveLength(1);
        expect(events[0].id).toBe(event.id);
    });

    test('addNewEvent with minimal fields', async () => {
        const event = await addNewEvent('Quick Note', '', null, null);
        expect(event.notes).toBe('');
        expect(event.recurrence).toBeNull();
        expect(event.colorCode).toBeNull();
    });

    test('getEventById returns event', async () => {
        const event = await addNewEvent('Find Me', '', null, null);
        const found = await getEventById(event.id);
        expect(found).toBeTruthy();
        expect(found.title).toBe('Find Me');
    });

    test('getEventById returns undefined for nonexistent ID', async () => {
        const found = await getEventById('nonexistent');
        expect(found).toBeUndefined();
    });

    test('updateEvent replaces event by ID', async () => {
        const event = await addNewEvent('Original', '', null, null);
        event.title = 'Updated';
        event.colorCode = 'red';
        const result = await updateEvent(event);
        expect(result).toBe(true);

        const found = await getEventById(event.id);
        expect(found.title).toBe('Updated');
        expect(found.colorCode).toBe('red');
    });

    test('updateEvent returns false for nonexistent ID', async () => {
        const fake = new EventNote('fake_id', 'No Match');
        const result = await updateEvent(fake);
        expect(result).toBe(false);
    });

    test('deleteEvent removes event', async () => {
        const event = await addNewEvent('Delete Me', '', null, null);
        const result = await deleteEvent(event.id);
        expect(result).toBe(true);

        const events = await getEventsAsync();
        expect(events).toHaveLength(0);
    });

    test('deleteEvent returns false for nonexistent ID', async () => {
        const result = await deleteEvent('nonexistent');
        expect(result).toBe(false);
    });

    test('multiple events can be stored', async () => {
        await addNewEvent('A', '', null, null);
        await addNewEvent('B', '', null, null);
        await addNewEvent('C', '', null, null);
        const events = await getEventsAsync();
        expect(events).toHaveLength(3);
    });
});

// --- Backfill ---
describe('Event backfill', () => {
    test('backfills missing fields on load', async () => {
        seedEvents([{ id: 'e1', title: 'Bare Event' }]);
        const events = await getEventsAsync();
        expect(events[0].notes).toBe('');
        expect(events[0].createdAt).toBeTruthy();
        expect(events[0].recurrence).toBeNull();
        expect(events[0].colorCode).toBeNull();
        expect(events[0].schedule).toEqual([]);
    });

    test('backfills missing expiresAt in schedule items', async () => {
        seedEvents([{
            id: 'e1', title: 'Scheduled',
            schedule: [{ day: 'monday', blockId: 'engagement' }]
        }]);
        const events = await getEventsAsync();
        expect(events[0].schedule[0].expiresAt).toBeNull();
    });
});

// --- Duplicate ---
describe('duplicateEvent', () => {
    test('creates copy with new ID and empty schedule', () => {
        const original = new EventNote('orig_123', 'Meeting', 'Room A', null, 'weekly', 'blue',
            [{ day: 'monday', blockId: 'engagement', expiresAt: '2026-02-26T12:00:00Z' }]
        );
        const copy = duplicateEvent(original);
        expect(copy.id).not.toBe(original.id);
        expect(copy.title).toBe('Meeting');
        expect(copy.notes).toBe('Room A');
        expect(copy.recurrence).toBe('weekly');
        expect(copy.colorCode).toBe('blue');
        expect(copy.schedule).toEqual([]);
    });
});

// --- Recurrence ---
describe('createRecurringEventInstance', () => {
    test('creates fresh instance with empty schedule', () => {
        const event = new EventNote('e_old', 'Weekly Standup', 'Team call', null, 'weekly', 'purple',
            [{ day: 'monday', blockId: 'engagement', expiresAt: '2026-02-26T12:00:00Z' }]
        );
        const next = createRecurringEventInstance(event);
        expect(next.id).not.toBe(event.id);
        expect(next.title).toBe('Weekly Standup');
        expect(next.notes).toBe('Team call');
        expect(next.recurrence).toBe('weekly');
        expect(next.colorCode).toBe('purple');
        expect(next.schedule).toEqual([]);
        expect(next.createdAt).toBeTruthy();
    });

    test('preserves null recurrence', () => {
        const event = new EventNote(null, 'One-off', '', null, null, null, []);
        const next = createRecurringEventInstance(event);
        expect(next.recurrence).toBeNull();
    });
});

// --- Operation Queue ---
describe('withEventLock', () => {
    test('executes operations sequentially', async () => {
        const order = [];
        await withEventLock(async () => { order.push(1); });
        await withEventLock(async () => { order.push(2); });
        expect(order).toEqual([1, 2]);
    });

    test('continues after error', async () => {
        await withEventLock(async () => { throw new Error('fail'); });
        const result = [];
        await withEventLock(async () => { result.push('ok'); });
        expect(result).toEqual(['ok']);
    });
});

// --- calculateEventExpiry ---
describe('calculateEventExpiry', () => {
    const timeBlocks = [
        { id: 'engagement', label: 'Engagement Block', time: '[9AM-12PM]', limit: 'multiple' },
        { id: 'deep-work-1', label: 'Deep Work 2', time: '[1PM-3PM]', limit: '1' },
        { id: 'late-night-read', label: 'Late Night', time: '[12AM-1AM]', limit: 'multiple' },
        { id: 'night-build', label: 'Night Block', time: '[10PM-12AM]', limit: '1' }
    ];

    const dayDates = {
        monday: new Date('2026-02-23T00:00:00'),
        tuesday: new Date('2026-02-24T00:00:00')
    };

    test('returns correct expiry for engagement block on Monday', () => {
        const expiry = calculateEventExpiry('monday', 'engagement', timeBlocks, dayDates);
        expect(expiry).toBeTruthy();
        const d = new Date(expiry);
        expect(d.getHours()).toBe(12);
        expect(d.getMinutes()).toBe(0);
    });

    test('returns correct expiry for deep-work-1 block', () => {
        const expiry = calculateEventExpiry('monday', 'deep-work-1', timeBlocks, dayDates);
        const d = new Date(expiry);
        expect(d.getHours()).toBe(15); // 3PM
    });

    test('handles midnight wraparound (end=12AM means 24:00)', () => {
        const expiry = calculateEventExpiry('monday', 'night-build', timeBlocks, dayDates);
        expect(expiry).toBeTruthy();
        // 12AM end = hour 0 → treated as 24, which is next day midnight
        const d = new Date(expiry);
        expect(d.getDate()).toBe(24); // Feb 24 midnight
    });

    test('returns null for unknown block ID', () => {
        const expiry = calculateEventExpiry('monday', 'nonexistent', timeBlocks, dayDates);
        expect(expiry).toBeNull();
    });

    test('returns null for unknown day', () => {
        const expiry = calculateEventExpiry('friday', 'engagement', timeBlocks, dayDates);
        expect(expiry).toBeNull();
    });

    test('returns null for empty time blocks', () => {
        const expiry = calculateEventExpiry('monday', 'engagement', [], dayDates);
        expect(expiry).toBeNull();
    });
});

// --- cleanupExpiredEvents ---
describe('cleanupExpiredEvents', () => {
    test('removes expired schedule entries from events', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // 1 day ago
        seedEvents([{
            id: 'e1', title: 'Past Event',
            schedule: [{ day: 'monday', blockId: 'engagement', expiresAt: pastDate }],
            recurrence: null
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        // Non-recurring event with all expired items should be deleted
        expect(events).toHaveLength(0);
    });

    test('keeps non-expired schedule entries', async () => {
        const futureDate = new Date(Date.now() + 86400000).toISOString(); // 1 day from now
        seedEvents([{
            id: 'e1', title: 'Future Event',
            schedule: [{ day: 'tuesday', blockId: 'engagement', expiresAt: futureDate }],
            recurrence: null
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        expect(events).toHaveLength(1);
        expect(events[0].schedule).toHaveLength(1);
    });

    test('creates recurring instance when recurring event fully expires', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        seedEvents([{
            id: 'e_recurring', title: 'Weekly Standup',
            schedule: [{ day: 'monday', blockId: 'engagement', expiresAt: pastDate }],
            recurrence: 'weekly', colorCode: 'blue', notes: 'Team call'
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        // Old event should be removed, new instance created
        expect(events).toHaveLength(1);
        expect(events[0].id).not.toBe('e_recurring');
        expect(events[0].title).toBe('Weekly Standup');
        expect(events[0].recurrence).toBe('weekly');
        expect(events[0].schedule).toEqual([]);
    });

    test('partially removes expired entries from multi-scheduled event', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        const futureDate = new Date(Date.now() + 86400000).toISOString();
        seedEvents([{
            id: 'e1', title: 'Multi Event',
            schedule: [
                { day: 'monday', blockId: 'engagement', expiresAt: pastDate },
                { day: 'wednesday', blockId: 'deep-work-1', expiresAt: futureDate }
            ],
            recurrence: null
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        expect(events).toHaveLength(1);
        expect(events[0].schedule).toHaveLength(1);
        expect(events[0].schedule[0].day).toBe('wednesday');
    });

    test('leaves unscheduled events alone', async () => {
        seedEvents([{
            id: 'e1', title: 'Unscheduled',
            schedule: [],
            recurrence: null
        }]);

        const modified = await cleanupExpiredEvents();
        const events = await getEventsAsync();
        expect(events).toHaveLength(1);
        expect(modified).toBe(false);
    });

    test('handles events with no expiresAt in schedule', async () => {
        seedEvents([{
            id: 'e1', title: 'No Expiry',
            schedule: [{ day: 'monday', blockId: 'engagement' }],
            recurrence: null
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        expect(events).toHaveLength(1);
        expect(events[0].schedule).toHaveLength(1);
    });

    test('returns false when nothing modified', async () => {
        seedEvents([{ id: 'e1', title: 'Safe', schedule: [] }]);
        const modified = await cleanupExpiredEvents();
        expect(modified).toBe(false);
    });
});

// --- Error Handling ---
describe('Error handling', () => {
    test('getEvents returns empty array on chrome error', async () => {
        chrome.runtime.lastError = { message: 'Test error' };
        const events = await getEventsAsync();
        expect(events).toEqual([]);
        chrome.runtime.lastError = null;
    });
});

// --- Cross-tab sync timestamp ---
describe('Cross-tab sync', () => {
    test('saveEvents updates _lastSaveTimestamp', async () => {
        const before = _lastSaveTimestamp;
        await saveEventsAsync([new EventNote(null, 'Test')]);
        expect(_lastSaveTimestamp).toBeGreaterThanOrEqual(before);
    });
});
