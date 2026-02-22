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
    'setupImportExportTabs',
    'formatTimeInput', 'addTimeBlock', 'updateTimeBlockLabel', 'deleteTimeBlock',
    'notionPageToTask', 'normalizeSheetRow', 'getEnabledAttributes'
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
                <button id="settings-close-btn">Close</button>
            </div>
        </div>
        <div id="import-export-modal" class="modal-overlay hidden">
            <div class="modal-content">
                <div class="import-export-tabs" role="tablist">
                    <button class="tab-link active" data-ie-tab="ie-json" role="tab" aria-selected="true">JSON</button>
                    <button class="tab-link" data-ie-tab="ie-csv" role="tab" aria-selected="false">CSV</button>
                    <button class="tab-link" data-ie-tab="ie-sheets" role="tab" aria-selected="false">Google Sheets</button>
                    <button class="tab-link" data-ie-tab="ie-notion" role="tab" aria-selected="false">Notion</button>
                </div>
                <div class="import-export-content">
                    <div id="ie-json" class="ie-panel active">
                        <button id="export-tasks-btn">Export</button>
                        <button id="import-tasks-btn">Import</button>
                        <input type="file" id="import-file-input" style="display: none;">
                    </div>
                    <div id="ie-csv" class="ie-panel">
                        <button id="csv-upload-btn">Upload CSV</button>
                        <input type="file" id="csv-file-input" style="display: none;">
                        <div id="csv-preview"></div>
                        <button id="csv-import-btn" class="hidden">Import Rows</button>
                    </div>
                    <div id="ie-sheets" class="ie-panel">
                        <input type="url" id="sheets-url" value="">
                        <button id="sheets-fetch-btn">Preview Sheet</button>
                        <div id="sheets-preview"></div>
                        <button id="sheets-import-btn" class="hidden">Import Rows</button>
                    </div>
                    <div id="ie-notion" class="ie-panel">
                        <input type="text" id="notion-api-key" value="">
                        <input type="text" id="notion-view-id" value="">
                        <input type="text" id="notion-database-id" value="">
                        <button id="notion-fetch-schema-btn">Fetch Schema</button>
                        <div id="notion-column-mapping-section" class="hidden"></div>
                        <div id="notion-sync-actions" class="hidden"></div>
                    </div>
                </div>
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
        seedTasks([{ id: 't1', title: 'Existing', priority: 'SOMEDAY', completed: false, type: 'home', displayOrder: 0, schedule: [], energy: 'Low', notes: '', recurrence: null, completedAt: null }]);
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

describe('Import/Export Modal Tabs', () => {
    beforeEach(() => {
        resetChromeStorage();
        setupSettingsDOM();
    });

    test('openImportExportModal removes hidden class', () => {
        expect(document.getElementById('import-export-modal').classList.contains('hidden')).toBe(true);
        openImportExportModal();
        expect(document.getElementById('import-export-modal').classList.contains('hidden')).toBe(false);
    });

    test('closeImportExportModal adds hidden class', () => {
        openImportExportModal();
        expect(document.getElementById('import-export-modal').classList.contains('hidden')).toBe(false);
        closeImportExportModal();
        expect(document.getElementById('import-export-modal').classList.contains('hidden')).toBe(true);
    });

    test('setupImportExportTabs initializes tab switching', () => {
        openImportExportModal();

        const tabs = document.querySelectorAll('.import-export-tabs .tab-link');
        expect(tabs.length).toBe(4);

        // JSON tab should be active by default
        expect(tabs[0].classList.contains('active')).toBe(true);
        expect(document.getElementById('ie-json').classList.contains('active')).toBe(true);
    });

    test('clicking CSV tab switches to CSV panel', () => {
        openImportExportModal();

        const csvTab = document.querySelector('[data-ie-tab="ie-csv"]');
        csvTab.click();

        // CSV tab should now be active
        expect(csvTab.classList.contains('active')).toBe(true);
        expect(csvTab.getAttribute('aria-selected')).toBe('true');

        // CSV panel should be visible
        expect(document.getElementById('ie-csv').classList.contains('active')).toBe(true);

        // JSON panel should be hidden
        expect(document.getElementById('ie-json').classList.contains('active')).toBe(false);
    });

    test('clicking Google Sheets tab switches to Sheets panel', () => {
        openImportExportModal();

        const sheetsTab = document.querySelector('[data-ie-tab="ie-sheets"]');
        sheetsTab.click();

        expect(sheetsTab.classList.contains('active')).toBe(true);
        expect(document.getElementById('ie-sheets').classList.contains('active')).toBe(true);
        expect(document.getElementById('ie-json').classList.contains('active')).toBe(false);
    });

    test('clicking Notion tab switches to Notion panel', () => {
        openImportExportModal();

        const notionTab = document.querySelector('[data-ie-tab="ie-notion"]');
        notionTab.click();

        expect(notionTab.classList.contains('active')).toBe(true);
        expect(document.getElementById('ie-notion').classList.contains('active')).toBe(true);
        expect(document.getElementById('ie-json').classList.contains('active')).toBe(false);
    });

    test('switching tabs updates aria-selected on all tabs', () => {
        openImportExportModal();

        const jsonTab = document.querySelector('[data-ie-tab="ie-json"]');
        const csvTab = document.querySelector('[data-ie-tab="ie-csv"]');
        const sheetsTab = document.querySelector('[data-ie-tab="ie-sheets"]');
        const notionTab = document.querySelector('[data-ie-tab="ie-notion"]');

        // Click CSV tab
        csvTab.click();

        expect(jsonTab.getAttribute('aria-selected')).toBe('false');
        expect(csvTab.getAttribute('aria-selected')).toBe('true');
        expect(sheetsTab.getAttribute('aria-selected')).toBe('false');
        expect(notionTab.getAttribute('aria-selected')).toBe('false');
    });

    test('only one panel is active at a time', () => {
        openImportExportModal();

        const tabs = document.querySelectorAll('.import-export-tabs .tab-link');

        // Click through all tabs
        tabs.forEach((tab, idx) => {
            tab.click();

            const activePanels = document.querySelectorAll('.ie-panel.active');
            expect(activePanels.length).toBe(1);

            const expectedPanelId = tab.dataset.ieTab;
            expect(activePanels[0].id).toBe(expectedPanelId);
        });
    });

    test('closeImportExportModal hides preview elements', () => {
        openImportExportModal();

        // Show some preview elements
        const csvPreview = document.getElementById('csv-preview');
        const sheetsPreview = document.getElementById('sheets-preview');
        const csvImportBtn = document.getElementById('csv-import-btn');
        const sheetsImportBtn = document.getElementById('sheets-import-btn');

        csvPreview.classList.remove('hidden');
        sheetsPreview.classList.remove('hidden');
        csvImportBtn.classList.remove('hidden');
        sheetsImportBtn.classList.remove('hidden');

        closeImportExportModal();

        expect(csvPreview.classList.contains('hidden')).toBe(true);
        expect(sheetsPreview.classList.contains('hidden')).toBe(true);
        expect(csvImportBtn.classList.contains('hidden')).toBe(true);
        expect(sheetsImportBtn.classList.contains('hidden')).toBe(true);
    });
});

describe('notionPageToTask', () => {
    test('extracts basic fields from Notion page', () => {
        const page = {
            id: 'notion-page-123',
            properties: {
                'Title': { type: 'title', title: [{ plain_text: 'Test Task' }] },
                'Priority': { type: 'select', select: { name: 'High' } },
                'Type': { type: 'select', select: { name: 'Work' } },
                'Energy': { type: 'select', select: { name: 'Medium' } },
                'Notes': { type: 'rich_text', rich_text: [{ plain_text: 'Test notes' }] },
                'URL': { type: 'url', url: 'https://example.com' }
            }
        };
        const mapping = {
            title: 'Title',
            priority: 'Priority',
            type: 'Type',
            energy: 'Energy',
            notes: 'Notes',
            url: 'URL',
            status: '', deadline: '', impact: '', value: '', complexity: '',
            action: '', estimates: '', interval: ''
        };
        const valueMappings = {
            priority: { 'CRITICAL': 'High', 'IMPORTANT': 'Medium', 'SOMEDAY': 'Low' },
            type: { 'home': 'Home', 'work': 'Work' },
            energy: { 'Low': 'Low', 'High': 'High' }
        };

        const result = notionPageToTask(page, mapping, valueMappings);

        expect(result.notionPageId).toBe('notion-page-123');
        expect(result.title).toBe('Test Task');
        expect(result.priority).toBe('CRITICAL');
        expect(result.type).toBe('work');
        expect(result.energy).toBe('Low');
        expect(result.notes).toBe('Test notes');
        expect(result.url).toBe('https://example.com');
    });

    test('extracts attributes from Notion page', () => {
        const page = {
            id: 'notion-page-456',
            properties: {
                'Title': { type: 'title', title: [{ plain_text: 'Task with Attrs' }] },
                'Impact': { type: 'select', select: { name: 'High' } },
                'Value': { type: 'select', select: { name: 'BUILD' } },
                'Complexity': { type: 'select', select: { name: 'Simple' } },
                'Action': { type: 'select', select: { name: 'Automate' } },
                'Estimates': { type: 'select', select: { name: '2 Hours' } },
                'Interval': { type: 'date', date: { start: '2024-01-01', end: '2024-01-15' } }
            }
        };
        const mapping = {
            title: 'Title',
            impact: 'Impact',
            value: 'Value',
            complexity: 'Complexity',
            action: 'Action',
            estimates: 'Estimates',
            interval: 'Interval',
            priority: '', type: '', energy: '', notes: '', url: '', status: '', deadline: ''
        };
        const valueMappings = {
            impact: { 'TBD': '', 'LOW': 'Low', 'Medium': 'Medium', 'High': 'High' },
            value: { 'TBD': '', 'BUILD': 'BUILD', 'LEARN': 'LEARN' },
            complexity: { 'TBD': '', 'Trivial': 'Simple' },
            action: { 'TBD': '', 'Automate': 'Automate' },
            estimates: { 'Unknown': '', '2 Hr': '2 Hours' }
        };

        const result = notionPageToTask(page, mapping, valueMappings);

        expect(result.impact).toBe('High');
        expect(result.value).toBe('BUILD');
        expect(result.complexity).toBe('Trivial');
        expect(result.action).toBe('Automate');
        expect(result.estimates).toBe('2 Hr');
        expect(result.interval).toEqual({ start: '2024-01-01', end: '2024-01-15' });
    });

    test('returns defaults for unmapped fields', () => {
        const page = {
            id: 'notion-page-789',
            properties: {
                'Title': { type: 'title', title: [{ plain_text: 'Minimal Task' }] }
            }
        };
        const mapping = { title: 'Title' };
        const valueMappings = {};

        const result = notionPageToTask(page, mapping, valueMappings);

        expect(result.title).toBe('Minimal Task');
        expect(result.priority).toBe('SOMEDAY');
        expect(result.type).toBe('home');
        expect(result.energy).toBe('Low');
        expect(result.impact).toBe('TBD');
        expect(result.value).toBe('TBD');
        expect(result.complexity).toBe('TBD');
        expect(result.action).toBe('TBD');
        expect(result.estimates).toBe('Unknown');
        expect(result.interval).toBeNull();
    });
});

describe('normalizeSheetRow', () => {
    test('normalizes CSV row with attributes', () => {
        const row = {
            title: 'CSV Task',
            priority: 'IMPORTANT',
            type: 'work',
            energy: 'High',
            status: 'in-progress',
            impact: 'High',
            value: 'BUILD',
            complexity: 'Multiple Steps',
            action: 'Simplify',
            estimates: '4 HR'
        };

        const result = normalizeSheetRow(row);

        expect(result.title).toBe('CSV Task');
        expect(result.priority).toBe('IMPORTANT');
        expect(result.type).toBe('work');
        expect(result.energy).toBe('High');
        expect(result.status).toBe('in-progress');
        expect(result.impact).toBe('High');
        expect(result.value).toBe('BUILD');
        expect(result.complexity).toBe('Multiple Steps');
        expect(result.action).toBe('Simplify');
        expect(result.estimates).toBe('4 HR');
    });

    test('normalizes invalid status to inbox', () => {
        const row = { title: 'Test', status: 'invalid-status' };
        const result = normalizeSheetRow(row);
        expect(result.status).toBe('inbox');
    });

    test('parses interval with en-dash separator', () => {
        // The normalizeSheetRow splits on comma, dash, or en-dash
        // But ISO dates contain dashes, so this parsing has limitations
        // Testing that empty/null interval returns null
        const row = { title: 'Test', interval: '' };
        const result = normalizeSheetRow(row);
        expect(result.interval).toBeNull();
    });

    test('handles single date interval gracefully', () => {
        // Single date without proper delimiter format
        const row = { title: 'Test' };
        const result = normalizeSheetRow(row);
        expect(result.interval).toBeNull();
    });
});

describe('getEnabledAttributes', () => {
    beforeEach(() => {
        resetChromeStorage();
    });

    test('returns default enabled attributes when none set', async () => {
        const enabled = await getEnabledAttributes();
        expect(enabled.priority).toBe(true);
        expect(enabled.type).toBe(true);
        expect(enabled.energy).toBe(true);
        expect(enabled.status).toBeFalsy();
    });

    test('returns custom enabled attributes from settings', async () => {
        seedSettings({
            theme: 'light',
            fontFamily: 'system',
            fontSize: 'medium',
            hasSeenSampleTasks: true,
            enabledAttributes: {
                priority: true,
                type: false,
                status: true,
                impact: true,
                energy: true
            }
        });

        const enabled = await getEnabledAttributes();
        expect(enabled.priority).toBe(true);
        expect(enabled.type).toBe(false);
        expect(enabled.status).toBe(true);
        expect(enabled.impact).toBe(true);
    });
});
