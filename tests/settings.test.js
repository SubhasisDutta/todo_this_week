// tests/settings.test.js
require('./mocks/chrome.storage.mock');
const path = require('path');

// Load task_utils first (settings.js depends on it)
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
    'parseTimeRange', 'validateTimeBlockOverlap'
]);

// Load settings.js
loadScript(path.join(__dirname, '..', 'settings.js'), [
    'FONT_FAMILY_MAP', 'FONT_SIZE_MAP',
    'applySettings', 'initSettings',
    'openSettingsModal', 'closeSettingsModal',
    'openImportExportModal', 'closeImportExportModal',
    'openTimeBlocksModal', 'closeTimeBlocksModal',
    'populateSettingsForm', 'saveSettingsFromForm',
    'populateImportExportForm', 'populateTimeBlocksModal',
    'renderTimeBlocksTable',
    'setupSettingsModalListeners',
    'setupImportExportModalListeners',
    'setupTimeBlocksModalListeners',
    'formatTimeInput', 'addTimeBlock', 'updateTimeBlockLabel', 'deleteTimeBlock'
]);

// Minimal DOM setup for settings tests
function setupSettingsDOM() {
    document.body.innerHTML = `
        <div id="info-message-area" class="info-message" style="display: none;"></div>
        <div id="settings-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <input type="checkbox" id="dark-mode-toggle">
                <input type="checkbox" id="theme-toggle">
                <select id="font-family-select">
                    <option value="system">System</option>
                    <option value="inter">Inter</option>
                    <option value="georgia">Georgia</option>
                    <option value="courier">Courier</option>
                    <option value="roboto-mono">Roboto Mono</option>
                </select>
                <select id="font-size-select">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                </select>
                <button id="save-settings-btn">Save</button>
                <button id="settings-close-btn">Close</button>
            </div>
        </div>
        <div id="import-export-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <input type="text" id="notion-api-key" value="">
                <input type="text" id="notion-database-id" value="">
                <input type="url" id="sheets-url" value="">
                <div id="notion-pages-list"></div>
                <button id="notion-import-btn" class="hidden"></button>
                <div id="sheets-preview"></div>
                <button id="sheets-import-btn" class="hidden"></button>
                <div id="csv-preview"></div>
                <button id="csv-import-btn" class="hidden"></button>
                <button id="import-export-close-btn">Close</button>
            </div>
        </div>
        <div id="time-blocks-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <div id="time-blocks-table-container"></div>
                <button id="reset-time-blocks-btn">Reset</button>
                <button id="add-time-block-btn">Add</button>
                <button id="time-blocks-close-btn">Close</button>
            </div>
        </div>
    `;
}

beforeEach(() => {
    resetChromeStorage();
    setupSettingsDOM();
});

describe('applySettings', () => {
    test('sets data-theme to dark when theme is dark', () => {
        applySettings({ theme: 'dark', fontFamily: 'system', fontSize: 'medium' });
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('sets data-theme to light when theme is light', () => {
        applySettings({ theme: 'light', fontFamily: 'system', fontSize: 'medium' });
        expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    });

    test('sets --font-family CSS variable', () => {
        applySettings({ theme: 'light', fontFamily: 'georgia', fontSize: 'medium' });
        const fontValue = document.documentElement.style.getPropertyValue('--font-family');
        expect(fontValue).toContain('Georgia');
    });

    test('sets --font-size-base CSS variable for large', () => {
        applySettings({ theme: 'light', fontFamily: 'system', fontSize: 'large' });
        const sizeValue = document.documentElement.style.getPropertyValue('--font-size-base');
        expect(sizeValue).toBe('17px');
    });

    test('sets --font-size-base CSS variable for small', () => {
        applySettings({ theme: 'light', fontFamily: 'system', fontSize: 'small' });
        const sizeValue = document.documentElement.style.getPropertyValue('--font-size-base');
        expect(sizeValue).toBe('13px');
    });

    test('falls back to system font for unknown fontFamily', () => {
        applySettings({ theme: 'light', fontFamily: 'unknown-font', fontSize: 'medium' });
        const fontValue = document.documentElement.style.getPropertyValue('--font-family');
        expect(fontValue).toContain('Segoe UI');
    });

    test('falls back to medium size for unknown fontSize', () => {
        applySettings({ theme: 'light', fontFamily: 'system', fontSize: 'huge' });
        const sizeValue = document.documentElement.style.getPropertyValue('--font-size-base');
        expect(sizeValue).toBe('15px');
    });
});

describe('initSettings', () => {
    test('applies settings on init', async () => {
        seedSettings({ theme: 'dark', fontFamily: 'inter', fontSize: 'large', hasSeenSampleTasks: true, notionApiKey: '', notionDatabaseId: '', googleSheetsUrl: '' });
        await initSettings();
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    test('seeds sample tasks on first run with no existing tasks', async () => {
        // hasSeenSampleTasks defaults to false and no tasks
        await initSettings();
        const tasks = await getTasksAsync();
        expect(tasks.length).toBeGreaterThan(0);
    });

    test('does not seed sample tasks if hasSeenSampleTasks is true', async () => {
        seedSettings({ theme: 'light', fontFamily: 'system', fontSize: 'medium', hasSeenSampleTasks: true, notionApiKey: '', notionDatabaseId: '', googleSheetsUrl: '' });
        await initSettings();
        const tasks = await getTasksAsync();
        expect(tasks.length).toBe(0);
    });

    test('does not seed if tasks already exist (marks hasSeenSampleTasks=true)', async () => {
        seedTasks([{ id: 't1', title: 'Existing', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'low', notes: '', recurrence: null, completedAt: null }]);
        await initSettings();
        const tasks = await getTasksAsync();
        expect(tasks.length).toBe(1); // only existing task, no sample tasks added
    });
});

describe('populateSettingsForm', () => {
    test('fills form with stored settings', async () => {
        seedSettings({ theme: 'dark', fontFamily: 'inter', fontSize: 'large', hasSeenSampleTasks: true, notionApiKey: 'secret', notionDatabaseId: 'db123', googleSheetsUrl: 'https://docs.google.com/sheet' });
        await populateSettingsForm();
        expect(document.getElementById('font-family-select').value).toBe('inter');
        expect(document.getElementById('font-size-select').value).toBe('large');
    });
});

describe('populateImportExportForm', () => {
    test('populates notion and sheets fields from settings', async () => {
        seedSettings({ theme: 'light', fontFamily: 'system', fontSize: 'medium', hasSeenSampleTasks: true, notionApiKey: 'my-key', notionDatabaseId: 'my-db', googleSheetsUrl: 'https://example.com/sheet.csv' });
        await populateImportExportForm();
        expect(document.getElementById('notion-api-key').value).toBe('my-key');
        expect(document.getElementById('notion-database-id').value).toBe('my-db');
        expect(document.getElementById('sheets-url').value).toBe('https://example.com/sheet.csv');
    });
});

describe('openSettingsModal / closeSettingsModal', () => {
    test('openSettingsModal removes hidden class', () => {
        expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);
        openSettingsModal();
        expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);
    });

    test('closeSettingsModal adds hidden class', () => {
        openSettingsModal();
        expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);
        closeSettingsModal();
        expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);
    });
});

describe('FONT_FAMILY_MAP / FONT_SIZE_MAP constants', () => {
    test('FONT_FAMILY_MAP has all expected keys', () => {
        expect(FONT_FAMILY_MAP).toHaveProperty('system');
        expect(FONT_FAMILY_MAP).toHaveProperty('inter');
        expect(FONT_FAMILY_MAP).toHaveProperty('georgia');
        expect(FONT_FAMILY_MAP).toHaveProperty('courier');
        expect(FONT_FAMILY_MAP).toHaveProperty('roboto-mono');
    });

    test('FONT_SIZE_MAP has small/medium/large', () => {
        expect(FONT_SIZE_MAP).toHaveProperty('small');
        expect(FONT_SIZE_MAP).toHaveProperty('medium');
        expect(FONT_SIZE_MAP).toHaveProperty('large');
        expect(FONT_SIZE_MAP['medium']).toBe('15px');
    });
});

describe('formatTimeInput', () => {
    test('converts 13:00 to 1PM', () => {
        expect(formatTimeInput('13:00')).toBe('1PM');
    });

    test('converts 00:00 to 12AM', () => {
        expect(formatTimeInput('00:00')).toBe('12AM');
    });

    test('converts 12:00 to 12PM', () => {
        expect(formatTimeInput('12:00')).toBe('12PM');
    });

    test('converts 09:00 to 9AM', () => {
        expect(formatTimeInput('09:00')).toBe('9AM');
    });

    test('converts 23:00 to 11PM', () => {
        expect(formatTimeInput('23:00')).toBe('11PM');
    });
});

describe('updateTimeBlockLabel', () => {
    beforeEach(() => {
        resetChromeStorage();
    });

    test('updates label and saves', async () => {
        seedTimeBlocks([
            { id: 'test-block', label: 'Original', time: '[9AM-10AM]', limit: 'multiple', colorClass: '' }
        ]);

        const result = await updateTimeBlockLabel('test-block', 'New Label');
        expect(result).toBe(true);

        const blocks = await getTimeBlocks();
        expect(blocks[0].label).toBe('New Label');
    });

    test('returns false for non-existent block', async () => {
        seedTimeBlocks([
            { id: 'test-block', label: 'Original', time: '[9AM-10AM]', limit: 'multiple', colorClass: '' }
        ]);

        const result = await updateTimeBlockLabel('non-existent', 'New Label');
        expect(result).toBe(false);
    });
});

describe('addTimeBlock with overlap validation', () => {
    beforeEach(() => {
        resetChromeStorage();
        document.body.innerHTML += '<div id="info-message-area" class="info-message" style="display: none;"></div>';
    });

    test('adds non-overlapping time block', async () => {
        seedTimeBlocks([
            { id: 'existing', label: 'Existing', time: '[9AM-12PM]', limit: 'multiple', colorClass: '' }
        ]);
        document.body.innerHTML += '<div id="time-blocks-table-container"></div>';

        const result = await addTimeBlock('New Block', '13:00', '15:00', 'multiple', '');
        expect(result).not.toBeNull();

        const blocks = await getTimeBlocks();
        expect(blocks).toHaveLength(2);
        expect(blocks[1].label).toBe('New Block');
        expect(blocks[1].time).toBe('[1PM-3PM]');
    });

    test('rejects overlapping time block', async () => {
        seedTimeBlocks([
            { id: 'existing', label: 'Existing', time: '[9AM-12PM]', limit: 'multiple', colorClass: '' }
        ]);
        document.body.innerHTML += '<div id="time-blocks-table-container"></div>';

        const result = await addTimeBlock('Overlapping', '10:00', '14:00', 'multiple', '');
        expect(result).toBeNull();

        const blocks = await getTimeBlocks();
        expect(blocks).toHaveLength(1); // Only the original block
    });
});

describe('renderTimeBlocksTable', () => {
    beforeEach(() => {
        resetChromeStorage();
        document.body.innerHTML = `
            <div id="info-message-area" class="info-message" style="display: none;"></div>
            <div id="time-blocks-table-container"></div>
        `;
    });

    test('renders editable label inputs', () => {
        renderTimeBlocksTable([
            { id: 'test', label: 'Test Block', time: '[9AM-10AM]', limit: 'multiple', colorClass: '' }
        ]);

        const labelInput = document.querySelector('.edit-block-label');
        expect(labelInput).not.toBeNull();
        expect(labelInput.value).toBe('Test Block');
        expect(labelInput.dataset.blockId).toBe('test');
    });

    test('renders delete button for each block', () => {
        renderTimeBlocksTable([
            { id: 'test1', label: 'Block 1', time: '[9AM-10AM]', limit: 'multiple', colorClass: '' },
            { id: 'test2', label: 'Block 2', time: '[10AM-11AM]', limit: '1', colorClass: '' }
        ]);

        const deleteButtons = document.querySelectorAll('.delete-block-btn');
        expect(deleteButtons).toHaveLength(2);
    });

    test('shows message when no blocks configured', () => {
        renderTimeBlocksTable([]);
        const container = document.getElementById('time-blocks-table-container');
        expect(container.innerHTML).toContain('No time blocks configured');
    });
});
