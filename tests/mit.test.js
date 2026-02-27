// tests/mit.test.js — Tests for MIT (Most Important Thing) Star System

const path = require('path');
require('./mocks/chrome.storage.mock');

// Load task_utils first (mit.js depends on _lastSaveTimestamp)
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'Task', 'getTasks', 'saveTasks', 'getTasksAsync', 'saveTasksAsync',
    '_lastSaveTimestamp'
]);

// Load events.js (for getEventById in integration)
loadScript(path.join(__dirname, '..', 'events.js'), [
    'EventNote', 'getEvents', 'getEventsAsync', 'getEventById'
]);

// Load mit.js
loadScript(path.join(__dirname, '..', 'mit.js'), [
    'getMitHistory', 'saveMitHistory', 'setMitForDay', 'removeMitForDay',
    'getMitForDay', 'getUnresolvedMits', 'resolveMit',
    'calculateMitStreak', 'calculateMitCompletionRate', 'getMitWeeklyStatus'
]);

beforeEach(() => {
    resetChromeStorage();
});

// --- Basic CRUD ---
describe('MIT CRUD', () => {
    test('getMitHistory returns empty array by default', async () => {
        const history = await getMitHistory();
        expect(history).toEqual([]);
    });

    test('saveMitHistory and getMitHistory round-trip', async () => {
        const entries = [
            { date: '2026-02-25', itemId: 'task_1', itemType: 'task', completed: true, resolvedAt: '2026-02-25T18:00:00Z' }
        ];
        await saveMitHistory(entries);
        const loaded = await getMitHistory();
        expect(loaded).toHaveLength(1);
        expect(loaded[0].date).toBe('2026-02-25');
    });
});

// --- setMitForDay ---
describe('setMitForDay', () => {
    test('creates new MIT entry', async () => {
        await setMitForDay('2026-02-26', 'task_abc', 'task');
        const entry = await getMitForDay('2026-02-26');
        expect(entry).toBeTruthy();
        expect(entry.itemId).toBe('task_abc');
        expect(entry.itemType).toBe('task');
        expect(entry.completed).toBeNull();
        expect(entry.resolvedAt).toBeNull();
    });

    test('enforces exactly 1 MIT per day (replaces existing)', async () => {
        await setMitForDay('2026-02-26', 'task_1', 'task');
        await setMitForDay('2026-02-26', 'event_2', 'event');

        const history = await getMitHistory();
        const forDay = history.filter(m => m.date === '2026-02-26');
        expect(forDay).toHaveLength(1);
        expect(forDay[0].itemId).toBe('event_2');
        expect(forDay[0].itemType).toBe('event');
    });

    test('different days can each have their own MIT', async () => {
        await setMitForDay('2026-02-25', 'task_1', 'task');
        await setMitForDay('2026-02-26', 'task_2', 'task');

        const history = await getMitHistory();
        expect(history).toHaveLength(2);
    });
});

// --- removeMitForDay ---
describe('removeMitForDay', () => {
    test('removes MIT for a specific date', async () => {
        await setMitForDay('2026-02-26', 'task_1', 'task');
        await removeMitForDay('2026-02-26');

        const entry = await getMitForDay('2026-02-26');
        expect(entry).toBeNull();
    });

    test('does not affect other dates', async () => {
        await setMitForDay('2026-02-25', 'task_1', 'task');
        await setMitForDay('2026-02-26', 'task_2', 'task');
        await removeMitForDay('2026-02-25');

        const history = await getMitHistory();
        expect(history).toHaveLength(1);
        expect(history[0].date).toBe('2026-02-26');
    });
});

// --- getMitForDay ---
describe('getMitForDay', () => {
    test('returns entry for existing date', async () => {
        await setMitForDay('2026-02-26', 'task_x', 'task');
        const entry = await getMitForDay('2026-02-26');
        expect(entry).toBeTruthy();
        expect(entry.itemId).toBe('task_x');
    });

    test('returns null for date with no MIT', async () => {
        const entry = await getMitForDay('2026-02-26');
        expect(entry).toBeNull();
    });
});

// --- getUnresolvedMits ---
describe('getUnresolvedMits', () => {
    test('returns entries where completed is null and date is past', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const today = new Date().toISOString().split('T')[0];

        seedMitHistory([
            { date: yesterdayStr, itemId: 'task_1', itemType: 'task', completed: null, resolvedAt: null },
            { date: today, itemId: 'task_2', itemType: 'task', completed: null, resolvedAt: null },
            { date: '2026-01-01', itemId: 'task_3', itemType: 'task', completed: true, resolvedAt: '2026-01-01T18:00:00Z' }
        ]);

        const unresolved = await getUnresolvedMits();
        // Only yesterday's unresolved entry (not today, not resolved ones)
        expect(unresolved).toHaveLength(1);
        expect(unresolved[0].date).toBe(yesterdayStr);
    });

    test('returns empty array when all are resolved', async () => {
        seedMitHistory([
            { date: '2026-02-20', itemId: 'task_1', itemType: 'task', completed: true, resolvedAt: '2026-02-20T18:00:00Z' }
        ]);
        const unresolved = await getUnresolvedMits();
        expect(unresolved).toEqual([]);
    });

    test('returns empty array when no MIT history', async () => {
        const unresolved = await getUnresolvedMits();
        expect(unresolved).toEqual([]);
    });
});

// --- resolveMit ---
describe('resolveMit', () => {
    test('sets completed to true and resolvedAt', async () => {
        await setMitForDay('2026-02-25', 'task_1', 'task');
        const result = await resolveMit('2026-02-25', true);
        expect(result).toBe(true);

        const entry = await getMitForDay('2026-02-25');
        expect(entry.completed).toBe(true);
        expect(entry.resolvedAt).toBeTruthy();
    });

    test('sets completed to false for missed MIT', async () => {
        await setMitForDay('2026-02-25', 'task_1', 'task');
        const result = await resolveMit('2026-02-25', false);
        expect(result).toBe(true);

        const entry = await getMitForDay('2026-02-25');
        expect(entry.completed).toBe(false);
    });

    test('returns false for nonexistent date', async () => {
        const result = await resolveMit('2099-12-31', true);
        expect(result).toBe(false);
    });
});

// --- calculateMitStreak ---
describe('calculateMitStreak', () => {
    test('returns 0 for empty history', () => {
        expect(calculateMitStreak([])).toBe(0);
        expect(calculateMitStreak(null)).toBe(0);
    });

    test('counts consecutive completed days from yesterday', () => {
        const history = [];
        for (let i = 1; i <= 5; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            history.push({ date: d.toISOString().split('T')[0], completed: true });
        }
        expect(calculateMitStreak(history)).toBe(5);
    });

    test('breaks on missed day', () => {
        const d1 = new Date(); d1.setDate(d1.getDate() - 1);
        const d2 = new Date(); d2.setDate(d2.getDate() - 2);
        const d3 = new Date(); d3.setDate(d3.getDate() - 3);

        const history = [
            { date: d1.toISOString().split('T')[0], completed: true },
            { date: d2.toISOString().split('T')[0], completed: false }, // break
            { date: d3.toISOString().split('T')[0], completed: true }
        ];
        expect(calculateMitStreak(history)).toBe(1);
    });

    test('returns 0 when yesterday had no completed MIT', () => {
        const d2 = new Date(); d2.setDate(d2.getDate() - 2);
        const history = [
            { date: d2.toISOString().split('T')[0], completed: true }
        ];
        expect(calculateMitStreak(history)).toBe(0);
    });
});

// --- calculateMitCompletionRate ---
describe('calculateMitCompletionRate', () => {
    test('returns 0 for empty history', () => {
        expect(calculateMitCompletionRate([], 30)).toBe(0);
        expect(calculateMitCompletionRate(null, 30)).toBe(0);
    });

    test('returns 100 when all MITs completed', () => {
        const history = [];
        for (let i = 1; i <= 5; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            history.push({ date: d.toISOString().split('T')[0], completed: true });
        }
        expect(calculateMitCompletionRate(history, 30)).toBe(100);
    });

    test('returns 50 when half completed', () => {
        const d1 = new Date(); d1.setDate(d1.getDate() - 1);
        const d2 = new Date(); d2.setDate(d2.getDate() - 2);

        const history = [
            { date: d1.toISOString().split('T')[0], completed: true },
            { date: d2.toISOString().split('T')[0], completed: false }
        ];
        expect(calculateMitCompletionRate(history, 30)).toBe(50);
    });

    test('ignores unresolved entries (completed === null)', () => {
        const d1 = new Date(); d1.setDate(d1.getDate() - 1);
        const d2 = new Date(); d2.setDate(d2.getDate() - 2);

        const history = [
            { date: d1.toISOString().split('T')[0], completed: true },
            { date: d2.toISOString().split('T')[0], completed: null }
        ];
        expect(calculateMitCompletionRate(history, 30)).toBe(100);
    });

    test('respects date range cutoff', () => {
        const recent = new Date(); recent.setDate(recent.getDate() - 1);
        const old = new Date(); old.setDate(old.getDate() - 60);

        const history = [
            { date: recent.toISOString().split('T')[0], completed: true },
            { date: old.toISOString().split('T')[0], completed: false }
        ];
        expect(calculateMitCompletionRate(history, 30)).toBe(100);
    });
});

// --- getMitWeeklyStatus ---
describe('getMitWeeklyStatus', () => {
    test('returns empty array for no dayDates', () => {
        expect(getMitWeeklyStatus([], null)).toEqual([]);
        expect(getMitWeeklyStatus([], [])).toEqual([]);
    });

    test('returns none status for days without MIT', () => {
        const dayDates = [
            { day: 'monday', dateStr: '2026-02-23' },
            { day: 'tuesday', dateStr: '2026-02-24' }
        ];
        const result = getMitWeeklyStatus([], dayDates);
        expect(result).toHaveLength(2);
        expect(result[0].status).toBe('none');
        expect(result[1].status).toBe('none');
    });

    test('returns completed status for completed MITs', () => {
        const dayDates = [{ day: 'monday', dateStr: '2026-02-23' }];
        const history = [{ date: '2026-02-23', completed: true }];
        const result = getMitWeeklyStatus(history, dayDates);
        expect(result[0].status).toBe('completed');
    });

    test('returns missed status for failed MITs', () => {
        const dayDates = [{ day: 'monday', dateStr: '2026-02-23' }];
        const history = [{ date: '2026-02-23', completed: false }];
        const result = getMitWeeklyStatus(history, dayDates);
        expect(result[0].status).toBe('missed');
    });

    test('returns unresolved status for past unresolved MITs', () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][yesterday.getDay()];

        const dayDates = [{ day: dayName, dateStr: yStr }];
        const history = [{ date: yStr, completed: null }];
        const result = getMitWeeklyStatus(history, dayDates);
        expect(result[0].status).toBe('unresolved');
    });

    test('returns pending status for today unresolved MIT', () => {
        const today = new Date().toISOString().split('T')[0];
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()];

        const dayDates = [{ day: dayName, dateStr: today }];
        const history = [{ date: today, completed: null }];
        const result = getMitWeeklyStatus(history, dayDates);
        expect(result[0].status).toBe('pending');
    });
});

// --- Cross-tab sync timestamp ---
describe('Cross-tab sync', () => {
    test('saveMitHistory updates _lastSaveTimestamp', async () => {
        const before = _lastSaveTimestamp;
        await saveMitHistory([{ date: '2026-02-26', itemId: 'x', itemType: 'task', completed: null, resolvedAt: null }]);
        expect(_lastSaveTimestamp).toBeGreaterThanOrEqual(before);
    });
});

// --- Error Handling ---
describe('Error handling', () => {
    test('getMitHistory returns empty array on chrome error', async () => {
        chrome.runtime.lastError = { message: 'Test error' };
        const history = await getMitHistory();
        expect(history).toEqual([]);
        chrome.runtime.lastError = null;
    });
});
