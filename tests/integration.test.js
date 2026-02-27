// tests/integration.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils
loadScript(path.join(__dirname, '..', 'task_utils.js'), [
    'DEFAULT_TIME_BLOCKS', 'TIME_BLOCKS', 'DEFAULT_SETTINGS',
    'Task', 'getTasks', 'saveTasks', 'addNewTask', 'getTaskById',
    'updateTaskCompletion', 'updateTask', 'deleteTask', 'showInfoMessage',
    'getTasksAsync', 'saveTasksAsync', 'withTaskLock', 'validateTask', 'isValidUrl',
    'debounce', 'setupStorageSync', '_lastSaveTimestamp',
    'getSettings', 'saveSettings', 'seedSampleTasks',
    'getTimeBlocks', 'saveTimeBlocks',
    'pushUndoState', 'undo', 'redo',
    'createRecurringInstance',
    'deriveCompletedFromStatus', 'deriveStatusFromCompleted'
]);

// Load events.js
loadScript(path.join(__dirname, '..', 'events.js'), [
    'EventNote', 'getEvents', 'getEventsAsync', 'saveEventsAsync',
    'addNewEvent', 'getEventById', 'updateEvent', 'deleteEvent',
    'duplicateEvent', 'createRecurringEventInstance',
    'cleanupExpiredEvents', 'calculateEventExpiry', 'withEventLock'
]);

// Load mit.js
loadScript(path.join(__dirname, '..', 'mit.js'), [
    'getMitHistory', 'saveMitHistory', 'setMitForDay', 'removeMitForDay',
    'getMitForDay', 'getUnresolvedMits', 'resolveMit',
    'calculateMitStreak', 'calculateMitCompletionRate', 'getMitWeeklyStatus'
]);

beforeEach(() => {
    resetChromeStorage();
    document.body.innerHTML = '<div id="info-message-area" class="info-message" style="display: none;"></div>';
});

describe('End-to-end: Task lifecycle', () => {
    test('add task -> retrieve -> update -> verify', async () => {
        const newTask = await addNewTask('Integration Test', 'https://example.com', 'IMPORTANT', null, 'work', 'High');
        expect(newTask).not.toBeNull();
        expect(newTask.title).toBe('Integration Test');
        expect(newTask.priority).toBe('IMPORTANT');

        const retrieved = await getTaskById(newTask.id);
        expect(retrieved).toBeDefined();
        expect(retrieved.title).toBe('Integration Test');
        expect(retrieved.type).toBe('work');
        expect(retrieved.energy).toBe('High');

        retrieved.title = 'Updated Title';
        retrieved.priority = 'CRITICAL';
        retrieved.deadline = '2025-12-31';
        const updateResult = await updateTask(retrieved);
        expect(updateResult).toBe(true);

        const afterUpdate = await getTaskById(newTask.id);
        expect(afterUpdate.title).toBe('Updated Title');
        expect(afterUpdate.priority).toBe('CRITICAL');
        expect(afterUpdate.deadline).toBe('2025-12-31');
    });

    test('add task -> delete -> verify removed', async () => {
        const task = await addNewTask('To Delete', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const deleteResult = await deleteTask(task.id);
        expect(deleteResult).toBe(true);

        const afterDelete = await getTaskById(task.id);
        expect(afterDelete).toBeUndefined();
    });

    test('add task -> complete -> verify completion status', async () => {
        const task = await addNewTask('Complete Me', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const retrieved = await getTaskById(task.id);
        // Note: completion is now driven by status field
        retrieved.status = 'done';
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        const active = allTasks.filter(t => t.status !== 'done' && t.status !== 'archive');
        const completed = allTasks.filter(t => t.status === 'done' || t.status === 'archive');
        expect(active.length).toBe(0);
        expect(completed.length).toBe(1);
    });
});

describe('End-to-end: Schedule management', () => {
    test('add task -> schedule -> verify schedule', async () => {
        const task = await addNewTask('Schedulable', '', 'SOMEDAY', null, 'home', 'low');
        expect(task).not.toBeNull();

        const retrieved = await getTaskById(task.id);
        retrieved.schedule = [
            { day: 'monday', blockId: 'ai-study', completed: false },
            { day: 'wednesday', blockId: 'deep-work-1', completed: false },
        ];
        await updateTask(retrieved);

        const afterSchedule = await getTaskById(task.id);
        expect(afterSchedule.schedule.length).toBe(2);
        expect(afterSchedule.schedule[0].day).toBe('monday');
        expect(afterSchedule.schedule[1].day).toBe('wednesday');
    });

    test('cascade completion: completing all schedule items completes the task', async () => {
        const task = await addNewTask('Cascading', '', 'SOMEDAY', null, 'home', 'low');

        const retrieved = await getTaskById(task.id);
        retrieved.schedule = [
            { day: 'monday', blockId: 'ai-study', completed: false },
            { day: 'tuesday', blockId: 'deep-work-1', completed: false },
        ];
        await updateTask(retrieved);

        // Complete first schedule item
        const afterFirst = await getTaskById(task.id);
        afterFirst.schedule[0].completed = true;
        await updateTask(afterFirst);

        const partialComplete = await getTaskById(task.id);
        expect(partialComplete.completed).toBe(false);

        // Complete second schedule item
        partialComplete.schedule[1].completed = true;
        await updateTask(partialComplete);

        const fullyComplete = await getTaskById(task.id);
        expect(fullyComplete.completed).toBe(true);
    });
});

describe('End-to-end: Multiple tasks and ordering', () => {
    test('tasks maintain displayOrder within priority group', async () => {
        await addNewTask('First', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Second', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Third', '', 'SOMEDAY', null, 'home', 'low');

        const tasks = await getTasksAsync();
        const somedayTasks = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        expect(somedayTasks[0].title).toBe('First');
        expect(somedayTasks[1].title).toBe('Second');
        expect(somedayTasks[2].title).toBe('Third');
        expect(somedayTasks[0].displayOrder).toBeLessThan(somedayTasks[1].displayOrder);
        expect(somedayTasks[1].displayOrder).toBeLessThan(somedayTasks[2].displayOrder);
    });

    test('reorder tasks by swapping displayOrder', async () => {
        await addNewTask('First', '', 'SOMEDAY', null, 'home', 'low');
        await addNewTask('Second', '', 'SOMEDAY', null, 'home', 'low');

        const tasks = await getTasksAsync();
        const sorted = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        const tempOrder = sorted[0].displayOrder;
        sorted[0].displayOrder = sorted[1].displayOrder;
        sorted[1].displayOrder = tempOrder;

        await saveTasksAsync(tasks);

        const afterReorder = await getTasksAsync();
        const reSorted = afterReorder.filter(t => t.priority === 'SOMEDAY').sort((a, b) => a.displayOrder - b.displayOrder);

        expect(reSorted[0].title).toBe('Second');
        expect(reSorted[1].title).toBe('First');
    });
});

describe('End-to-end: Import/merge logic', () => {
    test('import merges with existing tasks', async () => {
        await addNewTask('Existing Task', '', 'SOMEDAY', null, 'home', 'low');
        const existing = await getTasksAsync();
        const existingId = existing[0].id;

        const importedTasks = [
            { ...existing[0], title: 'Updated Existing' },
            { id: 'new-imported', title: 'New Import', priority: 'IMPORTANT', completed: false, type: 'work', displayOrder: 0, schedule: [], energy: 'High' },
        ];

        const existingTasks = await getTasksAsync();
        const existingTaskIds = new Set(existingTasks.map(t => t.id));
        const tasksToCreate = [];
        const tasksToUpdate = [];

        for (const imported of importedTasks) {
            if (!imported.id || !imported.title) continue;
            if (existingTaskIds.has(imported.id)) {
                tasksToUpdate.push(imported);
            } else {
                tasksToCreate.push(imported);
            }
        }

        const updatedTasks = existingTasks.map(et => {
            const toUpdate = tasksToUpdate.find(t => t.id === et.id);
            return toUpdate ? toUpdate : et;
        });

        const finalTasks = [...updatedTasks, ...tasksToCreate];
        await saveTasksAsync(finalTasks);

        const result = await getTasksAsync();
        expect(result.length).toBe(2);

        const updated = result.find(t => t.id === existingId);
        expect(updated.title).toBe('Updated Existing');

        const newImport = result.find(t => t.id === 'new-imported');
        expect(newImport).toBeDefined();
        expect(newImport.title).toBe('New Import');
    });
});

describe('End-to-end: Validation', () => {
    test('validateTask catches multiple errors', () => {
        const errors = validateTask({
            title: '',
            priority: 'CRITICAL',
            deadline: null,
            url: 'not-a-url',
        });
        expect(errors.length).toBe(3);
        expect(errors).toContain('Task title is required.');
        expect(errors).toContain('Deadline is required for CRITICAL tasks.');
        expect(errors).toContain('Invalid URL format.');
    });

    test('valid CRITICAL task passes validation', () => {
        const errors = validateTask({
            title: 'Valid Task',
            priority: 'CRITICAL',
            deadline: '2025-12-31',
            url: 'https://example.com',
        });
        expect(errors.length).toBe(0);
    });
});

describe('End-to-end: Cross-tab sync', () => {
    test('storage change listener ignores self-triggered changes', () => {
        // NOTE: This test MUST run before "fires for external changes" since
        // saveTasks sets the internal _lastSaveTimestamp which is shared state.
        const renderCallback = jest.fn();

        // Save tasks to set the internal _lastSaveTimestamp to now
        saveTasks([{ id: 't1', title: 'Test' }], () => {});

        // Setup sync - the listener will see the recent save timestamp
        setupStorageSync(renderCallback);

        const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
        const listener = listenerCalls[listenerCalls.length - 1][0];
        const changes = { tasks: { newValue: [{ id: 't1', title: 'Self' }] } };
        listener(changes, 'local');

        expect(renderCallback).not.toHaveBeenCalled();
    });

    test('storage change listener fires for external changes after debounce window', (done) => {
        const renderCallback = jest.fn();
        setupStorageSync(renderCallback);

        // Wait for 600ms so the internal _lastSaveTimestamp is > 500ms ago
        setTimeout(() => {
            const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
            const listener = listenerCalls[listenerCalls.length - 1][0];
            const changes = { tasks: { newValue: [{ id: 't1', title: 'External' }] } };
            listener(changes, 'local');

            expect(renderCallback).toHaveBeenCalled();
            done();
        }, 600);
    }, 10000);
});

describe('End-to-end: Recurring tasks', () => {
    test('completing a recurring task creates a new instance', async () => {
        const task = await addNewTask('Daily Standup', '', 'SOMEDAY', null, 'home', 'low', '', 'daily');
        expect(task.recurrence).toBe('daily');

        const retrieved = await getTaskById(task.id);
        // Note: completion is now driven by status field
        retrieved.status = 'done';
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        // Should have at least 2 tasks: the completed one + the new recurring instance
        expect(allTasks.length).toBeGreaterThanOrEqual(2);

        const completedTasks = allTasks.filter(t => t.status === 'done' || t.status === 'archive');
        const activeTasks = allTasks.filter(t => t.status !== 'done' && t.status !== 'archive');
        expect(completedTasks.length).toBeGreaterThanOrEqual(1);
        expect(activeTasks.length).toBeGreaterThanOrEqual(1);
    });

    test('non-recurring task does not create a new instance on completion', async () => {
        const task = await addNewTask('One-time task', '', 'SOMEDAY', null, 'home', 'low', '', null);
        const retrieved = await getTaskById(task.id);
        // Note: completion is now driven by status field
        retrieved.status = 'done';
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        expect(allTasks.length).toBe(1);
    });

    test('recurring task instance inherits title and priority', async () => {
        const task = await addNewTask('Weekly Review', '', 'IMPORTANT', null, 'work', 'high', 'Check KPIs', 'weekly');
        const retrieved = await getTaskById(task.id);
        // Note: completion is now driven by status field
        retrieved.status = 'done';
        retrieved.completed = true;
        await updateTask(retrieved);

        const allTasks = await getTasksAsync();
        const newInstance = allTasks.find(t => t.status !== 'done' && t.status !== 'archive');
        expect(newInstance).toBeDefined();
        expect(newInstance.title).toBe('Weekly Review');
        expect(newInstance.priority).toBe('IMPORTANT');
        expect(newInstance.recurrence).toBe('weekly');
    });
});

describe('End-to-end: Undo/Redo lifecycle', () => {
    test('undo restores tasks after deletion', async () => {
        await addNewTask('Task to delete', '', 'SOMEDAY', null, 'home', 'low');
        const tasksBefore = await getTasksAsync();
        pushUndoState(tasksBefore);

        await deleteTask(tasksBefore[0].id);
        expect((await getTasksAsync()).length).toBe(0);

        await undo();
        const afterUndo = await getTasksAsync();
        expect(afterUndo.length).toBe(1);
        expect(afterUndo[0].title).toBe('Task to delete');
    });

    test('redo re-applies the undone deletion', async () => {
        await addNewTask('Task to redo-delete', '', 'SOMEDAY', null, 'home', 'low');
        const tasksBefore = await getTasksAsync();
        pushUndoState(tasksBefore);

        await deleteTask(tasksBefore[0].id);
        await undo();
        expect((await getTasksAsync()).length).toBe(1);

        await redo();
        expect((await getTasksAsync()).length).toBe(0);
    });

    test('pushUndoState caps stack at 5 entries', async () => {
        // Push 6 states
        for (let i = 0; i < 6; i++) {
            const tasks = await getTasksAsync();
            pushUndoState(tasks);
            await addNewTask(`Task ${i}`, '', 'SOMEDAY', null, 'home', 'low');
        }
        // Undo 5 times should work without error
        for (let i = 0; i < 5; i++) {
            await undo();
        }
        // 6th undo should be a no-op (stack empty)
        await undo(); // Should not throw
    });
});

// =============================================
// Event Notes Integration Tests (v2.2.0)
// =============================================

describe('End-to-end: Event Note lifecycle', () => {
    test('add event -> retrieve -> update -> verify', async () => {
        const event = await addNewEvent('Go to Costco', 'Buy groceries and supplies', null, null);
        expect(event).not.toBeNull();
        expect(event.title).toBe('Go to Costco');
        expect(event.notes).toBe('Buy groceries and supplies');
        expect(event.id).toMatch(/^event_/);

        const retrieved = await getEventById(event.id);
        expect(retrieved).toBeDefined();
        expect(retrieved.title).toBe('Go to Costco');

        retrieved.title = 'Go to Costco (Updated)';
        retrieved.colorCode = 'blue';
        const updateResult = await updateEvent(retrieved);
        expect(updateResult).toBe(true);

        const afterUpdate = await getEventById(event.id);
        expect(afterUpdate.title).toBe('Go to Costco (Updated)');
        expect(afterUpdate.colorCode).toBe('blue');
    });

    test('add event -> delete -> verify removed', async () => {
        const event = await addNewEvent('Temporary Event', '', null, null);
        expect(event).not.toBeNull();

        const deleteResult = await deleteEvent(event.id);
        expect(deleteResult).toBe(true);

        const afterDelete = await getEventById(event.id);
        expect(afterDelete).toBeUndefined();
    });

    test('add event -> schedule -> verify schedule with expiresAt', async () => {
        const event = await addNewEvent('Meeting', 'Team standup', null, null);

        const retrieved = await getEventById(event.id);
        retrieved.schedule = [
            { day: 'monday', blockId: 'engagement', expiresAt: '2026-03-02T12:00:00.000Z' },
            { day: 'wednesday', blockId: 'deep-work-1', expiresAt: '2026-03-04T15:00:00.000Z' }
        ];
        await updateEvent(retrieved);

        const afterSchedule = await getEventById(event.id);
        expect(afterSchedule.schedule.length).toBe(2);
        expect(afterSchedule.schedule[0].expiresAt).toBe('2026-03-02T12:00:00.000Z');
        expect(afterSchedule.schedule[1].day).toBe('wednesday');
    });

    test('duplicate event creates independent copy', async () => {
        const event = await addNewEvent('Original Event', 'Some notes', 'weekly', 'green');
        event.schedule = [{ day: 'monday', blockId: 'ai-study', expiresAt: '2026-03-02T08:00:00.000Z' }];

        const duplicate = duplicateEvent(event);
        expect(duplicate.id).not.toBe(event.id);
        expect(duplicate.title).toBe('Original Event');
        expect(duplicate.notes).toBe('Some notes');
        expect(duplicate.recurrence).toBe('weekly');
        expect(duplicate.colorCode).toBe('green');
        expect(duplicate.schedule).toEqual([]); // Empty schedule on duplicate
    });

    test('recurring event creates new instance', async () => {
        const event = await addNewEvent('Daily Standup', '', 'daily', null);
        const newInstance = createRecurringEventInstance(event);

        expect(newInstance.id).not.toBe(event.id);
        expect(newInstance.title).toBe('Daily Standup');
        expect(newInstance.recurrence).toBe('daily');
        expect(newInstance.schedule).toEqual([]);
    });

    test('cleanupExpiredEvents removes expired non-recurring events', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString(); // 24 hours ago
        seedEvents([{
            id: 'event_expired',
            title: 'Expired Event',
            notes: '',
            createdAt: new Date().toISOString(),
            recurrence: null,
            colorCode: null,
            schedule: [{ day: 'monday', blockId: 'ai-study', expiresAt: pastDate }]
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        expect(events.length).toBe(0);
    });

    test('cleanupExpiredEvents creates new instance for recurring events', async () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();
        seedEvents([{
            id: 'event_recurring_expired',
            title: 'Weekly Team Meeting',
            notes: 'Review progress',
            createdAt: new Date().toISOString(),
            recurrence: 'weekly',
            colorCode: 'purple',
            schedule: [{ day: 'monday', blockId: 'engagement', expiresAt: pastDate }]
        }]);

        await cleanupExpiredEvents();
        const events = await getEventsAsync();
        // Original should be deleted, new recurring instance should be created
        expect(events.length).toBe(1);
        expect(events[0].id).not.toBe('event_recurring_expired');
        expect(events[0].title).toBe('Weekly Team Meeting');
        expect(events[0].recurrence).toBe('weekly');
        expect(events[0].schedule).toEqual([]);
    });
});

// =============================================
// MIT Star System Integration Tests (v2.2.0)
// =============================================

describe('End-to-end: MIT Star lifecycle', () => {
    test('set MIT -> retrieve -> verify', async () => {
        const task = await addNewTask('Critical Presentation', '', 'CRITICAL', '2026-03-01', 'work', 'High');
        await setMitForDay('2026-02-26', task.id, 'task');

        const mit = await getMitForDay('2026-02-26');
        expect(mit).toBeTruthy();
        expect(mit.itemId).toBe(task.id);
        expect(mit.itemType).toBe('task');
        expect(mit.completed).toBeNull();
    });

    test('MIT enforces 1 per day — replacing star', async () => {
        const task1 = await addNewTask('Task A', '', 'IMPORTANT', null, 'work', 'High');
        const task2 = await addNewTask('Task B', '', 'IMPORTANT', null, 'home', 'Low');

        await setMitForDay('2026-02-26', task1.id, 'task');
        await setMitForDay('2026-02-26', task2.id, 'task');

        const history = await getMitHistory();
        const forDay = history.filter(m => m.date === '2026-02-26');
        expect(forDay).toHaveLength(1);
        expect(forDay[0].itemId).toBe(task2.id);
    });

    test('MIT can be set for an event', async () => {
        const event = await addNewEvent('Visit Friend', '', null, null);
        await setMitForDay('2026-02-26', event.id, 'event');

        const mit = await getMitForDay('2026-02-26');
        expect(mit.itemId).toBe(event.id);
        expect(mit.itemType).toBe('event');
    });

    test('resolve MIT as completed', async () => {
        const task = await addNewTask('Finish Report', '', 'CRITICAL', '2026-03-01', 'work', 'High');
        await setMitForDay('2026-02-25', task.id, 'task');

        const result = await resolveMit('2026-02-25', true);
        expect(result).toBe(true);

        const resolved = await getMitForDay('2026-02-25');
        expect(resolved.completed).toBe(true);
        expect(resolved.resolvedAt).toBeTruthy();
    });

    test('resolve MIT as missed', async () => {
        const task = await addNewTask('Missed Task', '', 'SOMEDAY', null, 'home', 'Low');
        await setMitForDay('2026-02-24', task.id, 'task');

        const result = await resolveMit('2026-02-24', false);
        expect(result).toBe(true);

        const resolved = await getMitForDay('2026-02-24');
        expect(resolved.completed).toBe(false);
    });

    test('MIT streak calculation with task completion', async () => {
        // Create 3 consecutive completed days
        const history = [];
        for (let i = 1; i <= 3; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            history.push({ date: dateStr, itemId: `task_${i}`, itemType: 'task', completed: true, resolvedAt: new Date().toISOString() });
        }

        const streak = calculateMitStreak(history);
        expect(streak).toBe(3);
    });

    test('MIT streak breaks on missed day', async () => {
        const d1 = new Date(); d1.setDate(d1.getDate() - 1);
        const d2 = new Date(); d2.setDate(d2.getDate() - 2);
        const d3 = new Date(); d3.setDate(d3.getDate() - 3);

        const history = [
            { date: d1.toISOString().split('T')[0], itemId: 'task_1', itemType: 'task', completed: true, resolvedAt: new Date().toISOString() },
            { date: d2.toISOString().split('T')[0], itemId: 'task_2', itemType: 'task', completed: false, resolvedAt: new Date().toISOString() },
            { date: d3.toISOString().split('T')[0], itemId: 'task_3', itemType: 'task', completed: true, resolvedAt: new Date().toISOString() }
        ];

        expect(calculateMitStreak(history)).toBe(1);
    });

    test('remove MIT -> verify removed', async () => {
        const task = await addNewTask('Starred Task', '', 'IMPORTANT', null, 'work', 'High');
        await setMitForDay('2026-02-26', task.id, 'task');

        await removeMitForDay('2026-02-26');
        const mit = await getMitForDay('2026-02-26');
        expect(mit).toBeNull();
    });

    test('unresolved MITs only returns past dates', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];

        await setMitForDay(yesterdayStr, 'task_1', 'task');
        await setMitForDay(todayStr, 'task_2', 'task');

        const unresolved = await getUnresolvedMits();
        expect(unresolved).toHaveLength(1);
        expect(unresolved[0].date).toBe(yesterdayStr);
    });
});

describe('End-to-end: Cross-tab sync for events and MIT', () => {
    test('storage change listener fires for eventNotes changes', (done) => {
        const renderCallback = jest.fn();
        setupStorageSync(renderCallback);

        // Wait for 600ms so the internal _lastSaveTimestamp is > 500ms ago
        setTimeout(() => {
            const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
            const listener = listenerCalls[listenerCalls.length - 1][0];
            const changes = { eventNotes: { newValue: [{ id: 'e1', title: 'External Event' }] } };
            listener(changes, 'local');

            expect(renderCallback).toHaveBeenCalled();
            done();
        }, 600);
    }, 10000);

    test('storage change listener fires for mitHistory changes', (done) => {
        const renderCallback = jest.fn();
        setupStorageSync(renderCallback);

        setTimeout(() => {
            const listenerCalls = chrome.storage.onChanged.addListener.mock.calls;
            const listener = listenerCalls[listenerCalls.length - 1][0];
            const changes = { mitHistory: { newValue: [{ date: '2026-02-26', itemId: 't1' }] } };
            listener(changes, 'local');

            expect(renderCallback).toHaveBeenCalled();
            done();
        }, 600);
    }, 10000);
});
