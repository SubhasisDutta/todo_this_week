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
    'createRecurringInstance'
]);

// Load settings.js
loadScript(path.join(__dirname, '..', 'settings.js'), [
    'FONT_FAMILY_MAP', 'FONT_SIZE_MAP',
    'applySettings', 'initSettings',
    'openSettingsModal', 'closeSettingsModal',
    'populateSettingsForm', 'saveSettingsFromForm',
    'renderTimeBlocksTable',
    'setupSettingsModalListeners'
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
                <input type="text" id="notion-api-key" value="">
                <input type="text" id="notion-database-id" value="">
                <input type="url" id="sheets-url" value="">
                <div id="notion-pages-list"></div>
                <button id="notion-import-btn" class="hidden"></button>
                <div id="sheets-preview"></div>
                <button id="sheets-import-btn" class="hidden"></button>
                <div id="time-blocks-table-container"></div>
                <button id="save-settings-btn">Save</button>
                <button id="settings-close-btn">Close</button>
                <button id="reset-time-blocks-btn">Reset</button>
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

    test('populates notion fields from settings', async () => {
        seedSettings({ theme: 'light', fontFamily: 'system', fontSize: 'medium', hasSeenSampleTasks: true, notionApiKey: 'my-key', notionDatabaseId: 'my-db', googleSheetsUrl: '' });
        await populateSettingsForm();
        expect(document.getElementById('notion-api-key').value).toBe('my-key');
        expect(document.getElementById('notion-database-id').value).toBe('my-db');
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
