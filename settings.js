// settings.js — Settings management, theme/font application, Notion/Sheets import, time block management

// Font family map
const FONT_FAMILY_MAP = {
    'system': "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    'inter': "'Inter', 'Segoe UI', sans-serif",
    'georgia': "Georgia, 'Times New Roman', serif",
    'courier': "'Courier New', Courier, monospace",
    'roboto-mono': "'Roboto Mono', 'Courier New', monospace"
};

const FONT_SIZE_MAP = {
    'small': '13px',
    'medium': '15px',
    'large': '17px'
};

// Apply settings to the current document
function applySettings(settings) {
    const root = document.documentElement;

    // Apply theme
    const theme = settings.theme || 'light';
    root.setAttribute('data-theme', theme);

    // Apply font family
    const fontKey = settings.fontFamily || 'system';
    const fontValue = FONT_FAMILY_MAP[fontKey] || FONT_FAMILY_MAP['system'];
    root.style.setProperty('--font-family', fontValue);

    // Apply font size
    const sizeKey = settings.fontSize || 'medium';
    const sizeValue = FONT_SIZE_MAP[sizeKey] || FONT_SIZE_MAP['medium'];
    root.style.setProperty('--font-size-base', sizeValue);
}

// Initialize settings on page load
async function initSettings() {
    const settings = await getSettings();
    applySettings(settings);

    // Seed sample tasks on very first run
    if (!settings.hasSeenSampleTasks) {
        const tasks = await getTasksAsync();
        if (tasks.length === 0) {
            await seedSampleTasks();
        } else {
            // Mark as seen even if tasks exist (e.g., imported from another device)
            settings.hasSeenSampleTasks = true;
            await saveSettings(settings);
        }
    }
}

// --- Settings Modal Functions ---

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.add('hidden');
}

// --- Import/Export Modal Functions ---

function openImportExportModal() {
    const modal = document.getElementById('import-export-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    // Populate saved values
    populateImportExportForm();
    // Setup tab switching
    setupImportExportTabs();
}

function closeImportExportModal() {
    const modal = document.getElementById('import-export-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    // Hide any sub-panels
    const sheetsPreview = document.getElementById('sheets-preview');
    const sheetsImportBtn = document.getElementById('sheets-import-btn');
    const csvPreview = document.getElementById('csv-preview');
    const csvImportBtn = document.getElementById('csv-import-btn');
    if (sheetsPreview) sheetsPreview.classList.add('hidden');
    if (sheetsImportBtn) sheetsImportBtn.classList.add('hidden');
    if (csvPreview) csvPreview.classList.add('hidden');
    if (csvImportBtn) csvImportBtn.classList.add('hidden');
}

function setupImportExportTabs() {
    const tabContainer = document.querySelector('.import-export-tabs');
    if (!tabContainer) return;

    const tabs = tabContainer.querySelectorAll('.tab-link[data-ie-tab]');
    const panels = document.querySelectorAll('.ie-panel');

    tabs.forEach(tab => {
        // Remove existing listeners by cloning
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);

        newTab.addEventListener('click', () => {
            const targetId = newTab.dataset.ieTab;

            // Update tab states
            tabContainer.querySelectorAll('.tab-link').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            newTab.classList.add('active');
            newTab.setAttribute('aria-selected', 'true');

            // Update panel visibility
            panels.forEach(panel => {
                panel.classList.remove('active');
            });
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

async function populateImportExportForm() {
    const settings = await getSettings();
    const notionApiKey = document.getElementById('notion-api-key');
    const notionDbId = document.getElementById('notion-database-id');
    const notionViewId = document.getElementById('notion-view-id');
    const sheetsUrl = document.getElementById('sheets-url');

    if (notionApiKey) notionApiKey.value = settings.notionApiKey || '';
    if (notionDbId) notionDbId.value = settings.notionDatabaseId || '';
    if (notionViewId) notionViewId.value = settings.notionViewId || settings.notionDatabaseId || '';
    if (sheetsUrl) sheetsUrl.value = settings.googleSheetsUrl || '';
}

// --- Time Blocks Modal Functions ---

function openTimeBlocksModal() {
    const modal = document.getElementById('time-blocks-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.removeAttribute('hidden');
    // Render time blocks table
    populateTimeBlocksModal();
}

function closeTimeBlocksModal() {
    const modal = document.getElementById('time-blocks-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    const addBlockForm = document.getElementById('add-time-block-form');
    if (addBlockForm) addBlockForm.classList.add('hidden');
}

async function populateTimeBlocksModal() {
    const blocks = await getTimeBlocks();
    renderTimeBlocksTable(blocks);
}

// --- CSV File Import ---

let _csvParsedRows = [];

function showCsvPreview(rows) {
    const container = document.getElementById('csv-preview');
    const importBtn = document.getElementById('csv-import-btn');
    if (!container) return;

    if (rows.length === 0) {
        container.innerHTML = '<p>No valid rows found. Ensure the CSV has a "title" column header.</p>';
        container.classList.remove('hidden');
        return;
    }

    const previewRows = rows.slice(0, 10);
    container.innerHTML = `
        <p style="margin:0 0 8px; font-size:0.85em; color:var(--text-muted)">Preview (first ${previewRows.length} of ${rows.length} rows):</p>
        <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>Title</th><th>Priority</th><th>Type</th><th>Energy</th><th>Status</th><th>Impact</th></tr></thead>
                <tbody>
                    ${previewRows.map(r => `
                        <tr>
                            <td>${r.title}</td>
                            <td>${r.priority}</td>
                            <td>${r.type}</td>
                            <td>${r.energy}</td>
                            <td>${r.status || 'inbox'}</td>
                            <td>${r.impact || 'TBD'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${rows.length > 10 ? `<p style="font-size:0.8em; color:var(--text-muted)">...and ${rows.length - 10} more rows</p>` : ''}
    `;
    container.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
}

async function importCsvTasks(rows) {
    let count = 0;
    for (const row of rows) {
        if (!row.title) continue;
        // Pass extra attributes via the extraAttrs parameter
        const extraAttrs = {
            status: row.status,
            impact: row.impact,
            value: row.value,
            complexity: row.complexity,
            action: row.action,
            estimates: row.estimates,
            interval: row.interval
        };
        await addNewTask(row.title, row.url, row.priority, row.deadline || null, row.type, row.energy, row.notes, row.recurrence, extraAttrs);
        count++;
    }
    return count;
}

async function populateSettingsForm() {
    const settings = await getSettings();

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');

    if (darkModeToggle) darkModeToggle.checked = settings.theme === 'dark';
    if (fontFamilySelect) fontFamilySelect.value = settings.fontFamily || 'system';
    if (fontSizeSelect) fontSizeSelect.value = settings.fontSize || 'medium';

    // Populate attribute toggles
    populateAttributeToggles(settings);
}

// All toggleable attributes including priority and type (which can now be disabled)
const ALL_TOGGLEABLE_ATTRS = ['priority', 'type', 'status', 'impact', 'value', 'complexity', 'energy', 'action', 'estimates', 'interval'];

// Populate attribute toggle checkboxes from settings
function populateAttributeToggles(settings) {
    const enabledAttrs = settings.enabledAttributes || { priority: true, type: true, energy: true };

    ALL_TOGGLEABLE_ATTRS.forEach(attr => {
        const checkbox = document.getElementById(`attr-${attr}`);
        if (checkbox) {
            // Default to true for priority, type, and energy if not explicitly set
            const defaultEnabled = ['priority', 'type', 'energy'].includes(attr);
            checkbox.checked = enabledAttrs[attr] !== undefined ? enabledAttrs[attr] : defaultEnabled;
        }
    });
}

// Setup attribute toggle listeners for auto-save
function setupAttributeToggleListeners(renderCallback) {
    ALL_TOGGLEABLE_ATTRS.forEach(attr => {
        const checkbox = document.getElementById(`attr-${attr}`);
        if (checkbox) {
            checkbox.addEventListener('change', async () => {
                await saveAttributeToggles();
                showInfoMessage('Attribute settings saved!', 'success');
                // Re-render the page to update forms and Groups tab
                if (renderCallback) renderCallback();
            });
        }
    });
}

// Save attribute toggles to settings
async function saveAttributeToggles() {
    const settings = await getSettings();

    if (!settings.enabledAttributes) {
        settings.enabledAttributes = { priority: true, type: true, energy: true };
    }

    ALL_TOGGLEABLE_ATTRS.forEach(attr => {
        const checkbox = document.getElementById(`attr-${attr}`);
        if (checkbox) {
            settings.enabledAttributes[attr] = checkbox.checked;
        }
    });

    await saveSettings(settings);
}

// Get enabled attributes (helper for other modules)
async function getEnabledAttributes() {
    const settings = await getSettings();
    return settings.enabledAttributes || { priority: true, type: true, energy: true };
}

async function saveSettingsFromForm() {
    const settings = await getSettings();

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');

    if (darkModeToggle) settings.theme = darkModeToggle.checked ? 'dark' : 'light';
    if (fontFamilySelect) settings.fontFamily = fontFamilySelect.value;
    if (fontSizeSelect) settings.fontSize = fontSizeSelect.value;

    await saveSettings(settings);
    applySettings(settings);
}

// --- Time Blocks Management ---

function renderTimeBlocksTable(blocks) {
    const container = document.getElementById('time-blocks-table-container');
    if (!container) return;

    if (!blocks || blocks.length === 0) {
        container.innerHTML = '<p>No time blocks configured.</p>';
        return;
    }

    const limitLabel = { '0': 'Blocked', '1': 'Single', 'multiple': 'Multiple' };

    const tableHtml = `
        <table class="time-blocks-table">
            <thead>
                <tr>
                    <th>Label</th>
                    <th>Time</th>
                    <th>Limit</th>
                    <th>Color</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                ${blocks.map((block, idx) => `
                    <tr>
                        <td>
                            <input type="text" class="neumorphic-input edit-block-label"
                                   value="${block.label.replace(/"/g, '&quot;')}"
                                   data-block-id="${block.id}">
                        </td>
                        <td>${block.time}</td>
                        <td>${limitLabel[block.limit] || block.limit}</td>
                        <td><span class="color-swatch ${block.colorClass || ''}">${block.colorClass || 'none'}</span></td>
                        <td>
                            <button class="neumorphic-btn delete-block-btn" data-block-id="${block.id}" style="font-size:0.75em; padding:3px 8px;">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;

    // Attach delete listeners
    container.querySelectorAll('.delete-block-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const blockId = btn.dataset.blockId;
            await deleteTimeBlock(blockId);
        });
    });

    // Attach label edit listeners
    container.querySelectorAll('.edit-block-label').forEach(input => {
        input.addEventListener('change', async () => {
            const blockId = input.dataset.blockId;
            const newLabel = input.value.trim();
            if (newLabel) {
                await updateTimeBlockLabel(blockId, newLabel);
                showInfoMessage('Time block label updated.', 'success');
            } else {
                showInfoMessage('Label cannot be empty.', 'error');
                const blocks = await getTimeBlocks();
                const block = blocks.find(b => b.id === blockId);
                if (block) input.value = block.label;
            }
        });
    });
}

// Convert 24-hour time input (e.g., "13:00") to display format (e.g., "1PM")
function formatTimeInput(time24) {
    const [hours] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return `${hour12}${period}`;
}

async function addTimeBlock(label, startTime, endTime, limit, colorClass) {
    const blocks = await getTimeBlocks();
    const id = 'custom-' + label.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    // Convert time inputs to display format
    const formattedStart = formatTimeInput(startTime);
    const formattedEnd = formatTimeInput(endTime);
    const timeStr = `[${formattedStart}-${formattedEnd}]`;

    // Validate overlap
    const newBlock = { id, label, time: timeStr, limit, colorClass: colorClass || '' };
    const validation = validateTimeBlockOverlap(newBlock, blocks);
    if (!validation.valid) {
        showInfoMessage(validation.error, 'error');
        return null;
    }

    blocks.push(newBlock);
    await saveTimeBlocks(blocks);
    renderTimeBlocksTable(blocks);
    return blocks;
}

async function deleteTimeBlock(blockId) {
    const blocks = await getTimeBlocks();
    const filtered = blocks.filter(b => b.id !== blockId);
    await saveTimeBlocks(filtered);
    renderTimeBlocksTable(filtered);
    return filtered;
}

async function updateTimeBlockLabel(blockId, newLabel) {
    const blocks = await getTimeBlocks();
    const blockIndex = blocks.findIndex(b => b.id === blockId);
    if (blockIndex > -1) {
        blocks[blockIndex].label = newLabel.trim();
        await saveTimeBlocks(blocks);
        return true;
    }
    return false;
}

async function resetTimeBlocksToDefaults() {
    await saveTimeBlocks([...DEFAULT_TIME_BLOCKS]);
    renderTimeBlocksTable([...DEFAULT_TIME_BLOCKS]);
}

// --- Notion Sync Module ---

// Cache for fetched schema and pages
let _notionDatabaseSchema = null;
let _notionFetchedPages = [];

/**
 * Fetch Notion database schema to get property names and types
 */
async function fetchNotionDatabaseSchema(apiKey, viewId) {
    const url = `https://api.notion.com/v1/databases/${viewId}`;
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2022-06-28'
        }
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Notion API error: ${err.message || response.status}`);
    }

    const data = await response.json();
    _notionDatabaseSchema = data;
    return data;
}

/**
 * Extract property definitions from schema for mapping UI
 */
function extractPropertiesFromSchema(schema) {
    const properties = {};
    let titleProperty = null;

    Object.entries(schema.properties || {}).forEach(([name, prop]) => {
        properties[name] = {
            name,
            type: prop.type,
            options: null
        };

        // Auto-detect title property
        if (prop.type === 'title') {
            titleProperty = name;
        }

        // Extract options for select/multi_select/status types
        if (prop.type === 'select' && prop.select?.options) {
            properties[name].options = prop.select.options.map(o => o.name);
        } else if (prop.type === 'multi_select' && prop.multi_select?.options) {
            properties[name].options = prop.multi_select.options.map(o => o.name);
        } else if (prop.type === 'status' && prop.status?.options) {
            properties[name].options = prop.status.options.map(o => o.name);
        }
    });

    return { properties, titleProperty };
}

/**
 * Render column mapping dropdowns based on fetched schema
 */
function renderColumnMappingUI(schema, savedMapping = null) {
    const { properties, titleProperty } = extractPropertiesFromSchema(schema);

    // Show title property
    const titleEl = document.getElementById('notion-title-property');
    if (titleEl) {
        titleEl.textContent = titleProperty || 'Not found';
    }

    // Property type compatibility map
    const typeFilters = {
        priority: ['select', 'status'],
        status: ['select', 'status', 'checkbox'],
        type: ['select'],
        energy: ['select'],
        deadline: ['date'],
        notes: ['rich_text', 'text'],
        url: ['url', 'rich_text'],
        // Additional attributes
        impact: ['select', 'status'],
        value: ['select'],
        complexity: ['select'],
        action: ['select'],
        estimates: ['select'],
        interval: ['date']
    };

    // Populate each mapping dropdown
    Object.keys(typeFilters).forEach(field => {
        const select = document.getElementById(`notion-map-${field}`);
        if (!select) return;

        // Clear existing options (keep first "Not mapped" option)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add compatible properties
        Object.entries(properties).forEach(([propName, propDef]) => {
            if (typeFilters[field].includes(propDef.type)) {
                const option = document.createElement('option');
                option.value = propName;
                option.textContent = `${propName} (${propDef.type})`;
                select.appendChild(option);
            }
        });

        // Restore saved mapping if available
        if (savedMapping?.notionColumnMapping?.[field]) {
            select.value = savedMapping.notionColumnMapping[field];
            // Trigger value mapping UI if applicable
            if (properties[select.value]?.options) {
                renderValueMappingUI(field, properties[select.value].options,
                    savedMapping.notionValueMappings?.[field]);
            }
        }
    });

    // Show the column mapping section
    document.getElementById('notion-column-mapping-section')?.classList.remove('hidden');
}

/**
 * Render value mapping UI for select/status properties
 */
function renderValueMappingUI(field, notionOptions, savedMappings = null) {
    const container = document.getElementById(`notion-${field}-values`);
    if (!container) return;

    const localValues = {
        priority: ['CRITICAL', 'IMPORTANT', 'SOMEDAY'],
        type: ['home', 'work'],
        energy: ['TBD', 'Low', 'Medium', 'High'],
        status: ['completed', 'incomplete'],
        impact: ['TBD', 'LOW', 'Medium', 'High'],
        value: ['TBD', 'BUILD', 'LEARN'],
        complexity: ['TBD', 'JUST DO IT', 'Trivial', 'Simple & Clear', 'Multiple Steps', 'Dependent/Risk', 'Unknown/Broad'],
        action: ['TBD', 'Question', 'Mandate', 'Delete', 'Simplify', 'Accelerate', 'Automate'],
        estimates: ['Unknown', '0 HR', '1 Hr', '2 Hr', '4 HR', '8 Hr - 1 Day', '16 Hr - 2 Day', '24 Hr - 3 Day', '40 Hr - 5 Day', '56 Hr - 1 Week', '112 Hr - 2 Week', '224 Hr - 1 Month']
    };

    const values = localValues[field];
    if (!values) return;

    container.innerHTML = values.map(val => `
        <div class="value-mapping-row">
            <label>${val}</label>
            <select class="neumorphic-input" id="notion-value-${field}-${val}">
                <option value="">-- Select --</option>
                ${notionOptions.map(opt => `
                    <option value="${opt}" ${savedMappings?.[val] === opt ? 'selected' : ''}>
                        ${opt}
                    </option>
                `).join('')}
            </select>
        </div>
    `).join('');

    container.classList.remove('hidden');
}

/**
 * Collect column mapping configuration from UI
 */
function collectColumnMappingConfig() {
    const fields = ['priority', 'status', 'type', 'energy', 'deadline', 'notes', 'url',
                    'impact', 'value', 'complexity', 'action', 'estimates', 'interval'];
    const columnMapping = {};
    const valueMappings = {};

    fields.forEach(field => {
        const select = document.getElementById(`notion-map-${field}`);
        columnMapping[field] = select?.value || '';

        // Collect value mappings for select fields
        if (['priority', 'type', 'energy', 'status', 'impact', 'value', 'complexity', 'action', 'estimates'].includes(field)) {
            const localValues = {
                priority: ['CRITICAL', 'IMPORTANT', 'SOMEDAY'],
                type: ['home', 'work'],
                energy: ['Low', 'High'],
                status: ['completed', 'incomplete'],
                impact: ['TBD', 'LOW', 'Medium', 'High'],
                value: ['TBD', 'BUILD', 'LEARN'],
                complexity: ['TBD', 'JUST DO IT', 'Trivial', 'Simple & Clear', 'Multiple Steps', 'Dependent/Risk', 'Unknown/Broad'],
                action: ['TBD', 'Question', 'Mandate', 'Delete', 'Simplify', 'Accelerate', 'Automate'],
                estimates: ['Unknown', '0 HR', '1 Hr', '2 Hr', '4 HR', '8 Hr - 1 Day', '16 Hr - 2 Day', '24 Hr - 3 Day', '40 Hr - 5 Day', '56 Hr - 1 Week', '112 Hr - 2 Week', '224 Hr - 1 Month']
            };

            valueMappings[field] = {};
            localValues[field]?.forEach(val => {
                const valueSelect = document.getElementById(`notion-value-${field}-${val}`);
                valueMappings[field][val] = valueSelect?.value || '';
            });
        }
    });

    // Add title property (auto-detected)
    const titleEl = document.getElementById('notion-title-property');
    columnMapping.title = titleEl?.textContent || '';

    return { columnMapping, valueMappings };
}

/**
 * Save Notion configuration to settings
 */
async function saveNotionConfiguration() {
    const apiKey = document.getElementById('notion-api-key')?.value.trim();
    const viewId = document.getElementById('notion-view-id')?.value.trim();
    const { columnMapping, valueMappings } = collectColumnMappingConfig();

    const settings = await getSettings();
    settings.notionApiKey = apiKey;
    settings.notionViewId = viewId;
    settings.notionDatabaseId = viewId; // backward compat
    settings.notionColumnMapping = columnMapping;
    settings.notionValueMappings = valueMappings;
    settings.notionSyncEnabled = !!(apiKey && viewId && columnMapping.title && columnMapping.title !== 'Not found');

    await saveSettings(settings);
    showInfoMessage('Notion configuration saved!', 'success');

    // Show sync actions section
    document.getElementById('notion-sync-actions')?.classList.remove('hidden');
}

/**
 * Extract value from Notion property (handles select, status, checkbox, etc.)
 */
function extractPropertyValue(prop) {
    if (prop.type === 'select') return prop.select?.name || '';
    if (prop.type === 'status') return prop.status?.name || '';
    if (prop.type === 'multi_select') return prop.multi_select?.[0]?.name || '';
    if (prop.type === 'checkbox') return prop.checkbox ? 'true' : 'false';
    return '';
}

/**
 * Reverse map Notion value to local value
 */
function reverseMapValue(notionValue, mappingObj) {
    if (!mappingObj || !notionValue) return null;
    for (const [localVal, notionVal] of Object.entries(mappingObj)) {
        if (notionVal === notionValue) return localVal;
    }
    return null;
}

/**
 * Convert Notion page to local task using column mapping
 */
function notionPageToTask(page, mapping, valueMappings) {
    const props = page.properties || {};

    // Extract title
    const titleProp = props[mapping.title];
    const title = titleProp?.title?.map(t => t.plain_text).join('') || '(Untitled)';

    // Extract priority
    let priority = 'SOMEDAY';
    if (mapping.priority && props[mapping.priority]) {
        const propVal = extractPropertyValue(props[mapping.priority]);
        priority = reverseMapValue(propVal, valueMappings.priority) || 'SOMEDAY';
    }

    // Extract type
    let type = 'home';
    if (mapping.type && props[mapping.type]) {
        const propVal = extractPropertyValue(props[mapping.type]);
        type = reverseMapValue(propVal, valueMappings.type) || 'home';
    }

    // Extract energy
    let energy = 'TBD';
    if (mapping.energy && props[mapping.energy]) {
        const propVal = extractPropertyValue(props[mapping.energy]);
        energy = reverseMapValue(propVal, valueMappings.energy) || 'TBD';
    }

    // Extract completed status
    let completed = false;
    if (mapping.status && props[mapping.status]) {
        const prop = props[mapping.status];
        if (prop.type === 'checkbox') {
            completed = prop.checkbox === true;
        } else {
            const propVal = extractPropertyValue(prop);
            completed = reverseMapValue(propVal, valueMappings.status) === 'completed';
        }
    }

    // Extract deadline
    let deadline = null;
    if (mapping.deadline && props[mapping.deadline]) {
        const dateProp = props[mapping.deadline];
        deadline = dateProp.date?.start || null;
    }

    // Extract notes
    let notes = '';
    if (mapping.notes && props[mapping.notes]) {
        const notesProp = props[mapping.notes];
        if (notesProp.type === 'rich_text') {
            notes = notesProp.rich_text?.map(t => t.plain_text).join('') || '';
        }
    }

    // Extract URL
    let url = '';
    if (mapping.url && props[mapping.url]) {
        const urlProp = props[mapping.url];
        if (urlProp.type === 'url') {
            url = urlProp.url || '';
        } else if (urlProp.type === 'rich_text') {
            url = urlProp.rich_text?.map(t => t.plain_text).join('') || '';
        }
    }

    // Extract new attributes
    let impact = 'TBD';
    if (mapping.impact && props[mapping.impact]) {
        const propVal = extractPropertyValue(props[mapping.impact]);
        impact = reverseMapValue(propVal, valueMappings.impact) || 'TBD';
    }

    let value = 'TBD';
    if (mapping.value && props[mapping.value]) {
        const propVal = extractPropertyValue(props[mapping.value]);
        value = reverseMapValue(propVal, valueMappings.value) || 'TBD';
    }

    let complexity = 'TBD';
    if (mapping.complexity && props[mapping.complexity]) {
        const propVal = extractPropertyValue(props[mapping.complexity]);
        complexity = reverseMapValue(propVal, valueMappings.complexity) || 'TBD';
    }

    let action = 'TBD';
    if (mapping.action && props[mapping.action]) {
        const propVal = extractPropertyValue(props[mapping.action]);
        action = reverseMapValue(propVal, valueMappings.action) || 'TBD';
    }

    let estimates = 'Unknown';
    if (mapping.estimates && props[mapping.estimates]) {
        const propVal = extractPropertyValue(props[mapping.estimates]);
        estimates = reverseMapValue(propVal, valueMappings.estimates) || 'Unknown';
    }

    let interval = null;
    if (mapping.interval && props[mapping.interval]) {
        const intervalProp = props[mapping.interval];
        if (intervalProp.date) {
            interval = {
                start: intervalProp.date.start || null,
                end: intervalProp.date.end || null
            };
        }
    }

    return {
        notionPageId: page.id,
        title,
        url,
        priority,
        completed,
        deadline,
        type,
        energy,
        notes,
        completedAt: completed ? new Date().toISOString() : null,
        // Additional attributes
        impact,
        value,
        complexity,
        action,
        estimates,
        interval
    };
}

/**
 * Convert local task to Notion properties for update
 */
function taskToNotionProperties(task, mapping, valueMappings) {
    const properties = {};

    // Title
    if (mapping.title) {
        properties[mapping.title] = {
            title: [{ text: { content: task.title } }]
        };
    }

    // Status/Completed
    if (mapping.status) {
        const statusName = task.completed
            ? valueMappings.status?.completed
            : valueMappings.status?.incomplete;
        if (statusName) {
            // Determine property type from schema
            const propDef = _notionDatabaseSchema?.properties?.[mapping.status];
            if (propDef?.type === 'checkbox') {
                properties[mapping.status] = { checkbox: task.completed };
            } else if (propDef?.type === 'status') {
                properties[mapping.status] = { status: { name: statusName } };
            } else {
                properties[mapping.status] = { select: { name: statusName } };
            }
        }
    }

    // Priority
    if (mapping.priority && valueMappings.priority?.[task.priority]) {
        const propDef = _notionDatabaseSchema?.properties?.[mapping.priority];
        if (propDef?.type === 'status') {
            properties[mapping.priority] = { status: { name: valueMappings.priority[task.priority] } };
        } else {
            properties[mapping.priority] = { select: { name: valueMappings.priority[task.priority] } };
        }
    }

    // Type
    if (mapping.type && valueMappings.type?.[task.type]) {
        properties[mapping.type] = {
            select: { name: valueMappings.type[task.type] }
        };
    }

    // Energy
    if (mapping.energy && valueMappings.energy?.[task.energy]) {
        properties[mapping.energy] = {
            select: { name: valueMappings.energy[task.energy] }
        };
    }

    // Deadline
    if (mapping.deadline && task.deadline) {
        properties[mapping.deadline] = {
            date: { start: task.deadline }
        };
    }

    // Notes
    if (mapping.notes && task.notes) {
        properties[mapping.notes] = {
            rich_text: [{ text: { content: task.notes } }]
        };
    }

    // URL
    if (mapping.url && task.url) {
        const propDef = _notionDatabaseSchema?.properties?.[mapping.url];
        if (propDef?.type === 'url') {
            properties[mapping.url] = { url: task.url };
        } else {
            properties[mapping.url] = {
                rich_text: [{ text: { content: task.url } }]
            };
        }
    }

    // New attributes - Impact
    if (mapping.impact && valueMappings.impact?.[task.impact]) {
        const propDef = _notionDatabaseSchema?.properties?.[mapping.impact];
        if (propDef?.type === 'status') {
            properties[mapping.impact] = { status: { name: valueMappings.impact[task.impact] } };
        } else {
            properties[mapping.impact] = { select: { name: valueMappings.impact[task.impact] } };
        }
    }

    // Value
    if (mapping.value && valueMappings.value?.[task.value]) {
        properties[mapping.value] = {
            select: { name: valueMappings.value[task.value] }
        };
    }

    // Complexity
    if (mapping.complexity && valueMappings.complexity?.[task.complexity]) {
        properties[mapping.complexity] = {
            select: { name: valueMappings.complexity[task.complexity] }
        };
    }

    // Action
    if (mapping.action && valueMappings.action?.[task.action]) {
        properties[mapping.action] = {
            select: { name: valueMappings.action[task.action] }
        };
    }

    // Estimates
    if (mapping.estimates && valueMappings.estimates?.[task.estimates]) {
        properties[mapping.estimates] = {
            select: { name: valueMappings.estimates[task.estimates] }
        };
    }

    // Interval (date range)
    if (mapping.interval && task.interval) {
        properties[mapping.interval] = {
            date: {
                start: task.interval.start || null,
                end: task.interval.end || null
            }
        };
    }

    return properties;
}

/**
 * Update a Notion page with local task data
 */
async function updateNotionPage(apiKey, pageId, properties) {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Notion update error: ${err.message || response.status}`);
    }

    return await response.json();
}

/**
 * Fetch all pages from Notion database/view with pagination
 */
async function fetchAllNotionPages(apiKey, viewId) {
    const allPages = [];
    let cursor = undefined;

    do {
        const body = { page_size: 100 };
        if (cursor) body.start_cursor = cursor;

        const response = await fetch(
            `https://api.notion.com/v1/databases/${viewId}/query`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Notion-Version': '2022-06-28',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Notion API error: ${err.message || response.status}`);
        }

        const data = await response.json();
        allPages.push(...data.results);
        cursor = data.has_more ? data.next_cursor : undefined;
    } while (cursor);

    return allPages;
}

/**
 * Main bidirectional sync function
 */
async function performNotionSync(renderPageCallback) {
    const settings = await getSettings();
    if (!settings.notionSyncEnabled) {
        showInfoMessage('Notion sync is not configured.', 'error');
        return { success: false, error: 'Not configured' };
    }

    const { notionApiKey, notionViewId, notionColumnMapping, notionValueMappings } = settings;

    // Update UI to show syncing
    const statusEl = document.getElementById('notion-sync-status');
    if (statusEl) {
        statusEl.textContent = 'Syncing...';
        statusEl.className = 'syncing';
    }

    try {
        // Fetch schema if not cached
        if (!_notionDatabaseSchema) {
            await fetchNotionDatabaseSchema(notionApiKey, notionViewId);
        }

        // Fetch all Notion pages
        const notionPages = await fetchAllNotionPages(notionApiKey, notionViewId);

        // Get local tasks
        const localTasks = await getTasksAsync();

        // Build maps for quick lookup
        const notionPageMap = new Map(); // notionPageId -> page
        const localTaskByNotionId = new Map(); // notionPageId -> task

        notionPages.forEach(page => {
            notionPageMap.set(page.id, page);
        });

        localTasks.forEach(task => {
            if (task.notionPageId) {
                localTaskByNotionId.set(task.notionPageId, task);
            }
        });

        const syncActions = [];
        let tasksModified = false;

        // --- Step 1: Process Notion pages (Remote -> Local) ---
        for (const page of notionPages) {
            const localTask = localTaskByNotionId.get(page.id);
            const notionData = notionPageToTask(page, notionColumnMapping, notionValueMappings);

            if (localTask) {
                // Task exists locally - check for changes
                const notionCompleted = notionData.completed;
                const localCompleted = localTask.completed;

                if (notionCompleted !== localCompleted) {
                    // Conflict: Notion wins for completion status
                    syncActions.push({
                        type: 'update-local',
                        taskId: localTask.id,
                        field: 'completed',
                        from: localCompleted,
                        to: notionCompleted,
                        title: localTask.title
                    });
                    localTask.completed = notionCompleted;
                    localTask.completedAt = notionCompleted ? new Date().toISOString() : null;
                    tasksModified = true;
                }
            } else {
                // New page from Notion - create local task
                syncActions.push({
                    type: 'create-local',
                    notionPageId: page.id,
                    title: notionData.title
                });

                const newTask = new Task(
                    null, // auto-generate ID
                    notionData.title,
                    notionData.url,
                    notionData.priority,
                    notionData.completed,
                    notionData.deadline,
                    notionData.type,
                    localTasks.length, // displayOrder
                    [], // empty schedule
                    notionData.energy,
                    notionData.notes,
                    notionData.completedAt,
                    null, // no recurrence
                    page.id, // notionPageId
                    null, // lastModified (auto-set)
                    null, // colorCode
                    // Attributes from Notion
                    'inbox', // status - Notion doesn't map to internal status
                    notionData.impact || 'TBD',
                    notionData.value || 'TBD',
                    notionData.complexity || 'TBD',
                    notionData.action || 'TBD',
                    notionData.estimates || 'Unknown',
                    notionData.interval || null
                );
                localTasks.push(newTask);
                tasksModified = true;
            }
        }

        // --- Step 2: Push local completed status to Notion ---
        for (const task of localTasks) {
            if (!task.notionPageId) continue;

            const page = notionPageMap.get(task.notionPageId);
            if (!page) {
                // Page no longer exists in Notion - clear the link
                task.notionPageId = null;
                tasksModified = true;
                continue;
            }

            const notionData = notionPageToTask(page, notionColumnMapping, notionValueMappings);

            // If local was marked complete but Notion isn't
            if (task.completed && !notionData.completed) {
                syncActions.push({
                    type: 'update-notion',
                    taskId: task.id,
                    notionPageId: task.notionPageId,
                    field: 'completed',
                    from: false,
                    to: true,
                    title: task.title
                });

                const properties = taskToNotionProperties(
                    task,
                    notionColumnMapping,
                    notionValueMappings
                );
                await updateNotionPage(notionApiKey, task.notionPageId, properties);
            }
        }

        // --- Step 3: Save local changes ---
        if (tasksModified) {
            await saveTasksAsync(localTasks);
        }

        // Update last synced timestamp
        settings.notionLastSyncedAt = new Date().toISOString();
        await saveSettings(settings);

        // Update UI
        if (statusEl) {
            statusEl.textContent = 'Synced successfully';
            statusEl.className = 'synced';
        }
        const lastSyncedEl = document.getElementById('notion-last-synced');
        if (lastSyncedEl) {
            lastSyncedEl.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
        }

        showInfoMessage(`Sync complete: ${syncActions.length} action(s) performed.`, 'success');

        if (renderPageCallback) await renderPageCallback();

        return { success: true, actions: syncActions };

    } catch (err) {
        if (statusEl) {
            statusEl.textContent = 'Sync failed';
            statusEl.className = 'error';
        }
        showInfoMessage(`Sync error: ${err.message}`, 'error');
        return { success: false, error: err.message };
    }
}

/**
 * Import only new tasks from Notion (no bidirectional sync)
 */
async function importNewNotionTasks(renderPageCallback) {
    const settings = await getSettings();
    const { notionApiKey, notionViewId, notionColumnMapping, notionValueMappings } = settings;

    if (!notionApiKey || !notionViewId) {
        showInfoMessage('Notion is not configured.', 'error');
        return;
    }

    try {
        if (!_notionDatabaseSchema) {
            await fetchNotionDatabaseSchema(notionApiKey, notionViewId);
        }

        const notionPages = await fetchAllNotionPages(notionApiKey, notionViewId);
        const localTasks = await getTasksAsync();

        // Find existing Notion page IDs
        const existingNotionIds = new Set(
            localTasks.filter(t => t.notionPageId).map(t => t.notionPageId)
        );

        let importCount = 0;
        for (const page of notionPages) {
            if (existingNotionIds.has(page.id)) continue;

            const notionData = notionPageToTask(page, notionColumnMapping, notionValueMappings);

            const newTask = new Task(
                null,
                notionData.title,
                notionData.url,
                notionData.priority,
                notionData.completed,
                notionData.deadline,
                notionData.type,
                localTasks.length + importCount,
                [],
                notionData.energy,
                notionData.notes,
                notionData.completedAt,
                null, // recurrence
                page.id, // notionPageId
                null, // lastModified (auto-set)
                null, // colorCode
                // Attributes from Notion
                'inbox', // status
                notionData.impact || 'TBD',
                notionData.value || 'TBD',
                notionData.complexity || 'TBD',
                notionData.action || 'TBD',
                notionData.estimates || 'Unknown',
                notionData.interval || null
            );
            localTasks.push(newTask);
            importCount++;
        }

        if (importCount > 0) {
            await saveTasksAsync(localTasks);
            showInfoMessage(`Imported ${importCount} new task(s) from Notion.`, 'success');
            if (renderPageCallback) await renderPageCallback();
        } else {
            showInfoMessage('No new tasks to import.', 'info');
        }

    } catch (err) {
        showInfoMessage(`Import error: ${err.message}`, 'error');
    }
}

/**
 * Setup Notion sync event listeners
 */
async function setupNotionSyncListeners(renderPageCallback) {
    // Fetch Schema button
    const fetchSchemaBtn = document.getElementById('notion-fetch-schema-btn');
    if (fetchSchemaBtn) {
        fetchSchemaBtn.addEventListener('click', async () => {
            const apiKey = document.getElementById('notion-api-key')?.value.trim();
            const viewId = document.getElementById('notion-view-id')?.value.trim();

            if (!apiKey || !viewId) {
                showInfoMessage('Please enter API key and View ID.', 'error');
                return;
            }

            fetchSchemaBtn.textContent = 'Fetching...';
            fetchSchemaBtn.disabled = true;

            try {
                const schema = await fetchNotionDatabaseSchema(apiKey, viewId);
                const settings = await getSettings();
                renderColumnMappingUI(schema, settings);
                showInfoMessage('Schema fetched! Configure column mapping below.', 'success');
            } catch (err) {
                showInfoMessage(`Error: ${err.message}`, 'error');
            } finally {
                fetchSchemaBtn.textContent = 'Fetch Database Schema';
                fetchSchemaBtn.disabled = false;
            }
        });
    }

    // Property select change handlers (show value mapping when select property chosen)
    ['priority', 'status', 'type', 'energy', 'impact', 'value', 'complexity', 'action', 'estimates'].forEach(field => {
        const select = document.getElementById(`notion-map-${field}`);
        if (select) {
            select.addEventListener('change', () => {
                const propName = select.value;
                const container = document.getElementById(`notion-${field}-values`);

                if (!propName || !_notionDatabaseSchema) {
                    container?.classList.add('hidden');
                    return;
                }

                const propDef = _notionDatabaseSchema.properties?.[propName];
                const options = propDef?.select?.options?.map(o => o.name) ||
                               propDef?.status?.options?.map(o => o.name) ||
                               [];

                if (options.length > 0) {
                    renderValueMappingUI(field, options);
                } else {
                    container?.classList.add('hidden');
                }
            });
        }
    });

    // Save mapping button
    const saveMappingBtn = document.getElementById('notion-save-mapping-btn');
    if (saveMappingBtn) {
        saveMappingBtn.addEventListener('click', saveNotionConfiguration);
    }

    // Sync Now button
    const syncNowBtn = document.getElementById('notion-sync-now-btn');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', async () => {
            syncNowBtn.textContent = 'Syncing...';
            syncNowBtn.disabled = true;
            try {
                await performNotionSync(renderPageCallback);
            } finally {
                syncNowBtn.textContent = 'Sync Now';
                syncNowBtn.disabled = false;
            }
        });
    }

    // Import New Only button
    const importNewBtn = document.getElementById('notion-import-new-btn');
    if (importNewBtn) {
        importNewBtn.addEventListener('click', async () => {
            importNewBtn.textContent = 'Importing...';
            importNewBtn.disabled = true;
            try {
                await importNewNotionTasks(renderPageCallback);
            } finally {
                importNewBtn.textContent = 'Import New Only';
                importNewBtn.disabled = false;
            }
        });
    }

    // Reconfigure button
    const reconfigureBtn = document.getElementById('notion-reconfigure-btn');
    if (reconfigureBtn) {
        reconfigureBtn.addEventListener('click', () => {
            document.getElementById('notion-sync-actions')?.classList.add('hidden');
            document.getElementById('notion-column-mapping-section')?.classList.remove('hidden');
        });
    }

    // Initialize: check if already configured
    const settings = await getSettings();
    if (settings.notionSyncEnabled) {
        // Pre-populate form
        const apiKeyEl = document.getElementById('notion-api-key');
        const viewIdEl = document.getElementById('notion-view-id');
        if (apiKeyEl) apiKeyEl.value = settings.notionApiKey || '';
        if (viewIdEl) viewIdEl.value = settings.notionViewId || settings.notionDatabaseId || '';

        // Show sync actions directly
        document.getElementById('notion-sync-actions')?.classList.remove('hidden');

        // Show last synced time
        if (settings.notionLastSyncedAt) {
            const lastSyncedEl = document.getElementById('notion-last-synced');
            if (lastSyncedEl) {
                lastSyncedEl.textContent = `Last synced: ${new Date(settings.notionLastSyncedAt).toLocaleString()}`;
            }
        }
    }
}

// Legacy function for backward compatibility with existing import flow
async function fetchNotionPages(apiKey, databaseId) {
    const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ page_size: 100 })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Notion API error: ${err.message || response.status}`);
    }

    const data = await response.json();
    const pages = (data.results || []).map(page => {
        const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
        const title = titleProp?.title?.map(t => t.plain_text).join('') || '(Untitled)';

        let priority = 'SOMEDAY';
        const priorityProp = Object.entries(page.properties || {}).find(([k]) => k.toLowerCase() === 'priority');
        if (priorityProp) {
            const val = priorityProp[1];
            if (val.type === 'select' && val.select?.name) {
                const pName = val.select.name.toUpperCase();
                if (pName === 'CRITICAL' || pName === 'HIGH') priority = 'CRITICAL';
                else if (pName === 'IMPORTANT' || pName === 'MEDIUM') priority = 'IMPORTANT';
            }
        }

        return { id: page.id, title, priority };
    });

    _notionFetchedPages = pages;
    return pages;
}

function renderNotionPagesList(pages) {
    const container = document.getElementById('notion-pages-list');
    const importBtn = document.getElementById('notion-import-btn');
    if (!container) return;

    if (pages.length === 0) {
        container.innerHTML = '<p>No pages found in this database.</p>';
        container.classList.remove('hidden');
        return;
    }

    container.innerHTML = `
        <p style="margin:0 0 8px; font-size:0.85em; color:var(--text-muted)">Select pages to import as tasks:</p>
        <label class="notion-page-item" style="font-weight:bold; margin-bottom:6px;">
            <input type="checkbox" id="notion-select-all"> Select All
        </label>
        ${pages.map(p => `
            <label class="notion-page-item">
                <input type="checkbox" class="notion-page-checkbox" value="${p.id}" data-title="${p.title.replace(/"/g, '&quot;')}" data-priority="${p.priority}">
                <span>${p.title}</span>
                <span class="priority-badge priority-${p.priority}" style="font-size:0.7em; margin-left:auto;">${p.priority}</span>
            </label>
        `).join('')}
    `;
    container.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');

    const selectAll = container.querySelector('#notion-select-all');
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            container.querySelectorAll('.notion-page-checkbox').forEach(cb => cb.checked = selectAll.checked);
        });
    }
}

async function importNotionTasks(selectedPages) {
    let count = 0;
    for (const page of selectedPages) {
        await addNewTask(page.title, '', page.priority, null, 'work', 'low', '', null);
        count++;
    }
    return count;
}

// --- Google Sheets Import ---

let _sheetsParsedRows = [];

// Simple CSV parser that handles quoted fields
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];

    function parseLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch === ',' && !inQuotes) {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        fields.push(current);
        return fields;
    }

    const headers = parseLine(lines[0]).map(h => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = (values[idx] || '').trim();
        });
        rows.push(row);
    }
    return rows;
}

function normalizeSheetRow(row) {
    const priority = (['CRITICAL','IMPORTANT','SOMEDAY'].includes((row.priority || '').toUpperCase()))
        ? row.priority.toUpperCase() : 'SOMEDAY';
    const type = (['home','work'].includes((row.type || '').toLowerCase()))
        ? row.type.toLowerCase() : 'home';

    // Energy now supports TBD, Low, Medium, High (case-insensitive match)
    let energy = 'TBD';
    const energyInput = (row.energy || '').toLowerCase();
    if (['low', 'medium', 'high'].includes(energyInput)) {
        energy = energyInput.charAt(0).toUpperCase() + energyInput.slice(1); // Capitalize
    } else if (energyInput === 'tbd' || energyInput === '') {
        energy = 'TBD';
    }

    const recurrence = (['daily','weekly','monthly'].includes((row.recurrence || '').toLowerCase()))
        ? row.recurrence.toLowerCase() : null;

    // Normalize status (validate against known options)
    const validStatuses = ['inbox', 'breakdown', 'stretch', 'ready', 'next-action', 'blocked',
                           'in-progress', 'influence', 'monitor', 'delegate', 'done', 'archive'];
    const statusInput = (row.status || '').toLowerCase().replace(/\s+/g, '-');
    const status = validStatuses.includes(statusInput) ? statusInput : 'inbox';

    // Normalize impact
    const validImpact = ['TBD', 'LOW', 'Medium', 'High'];
    const impactInput = row.impact || '';
    const impact = validImpact.find(v => v.toLowerCase() === impactInput.toLowerCase()) || 'TBD';

    // Normalize value
    const validValue = ['TBD', 'BUILD', 'LEARN'];
    const valueInput = row.value || '';
    const value = validValue.find(v => v.toLowerCase() === valueInput.toLowerCase()) || 'TBD';

    // Normalize complexity
    const validComplexity = ['TBD', 'JUST DO IT', 'Trivial', 'Simple & Clear', 'Multiple Steps', 'Dependent/Risk', 'Unknown/Broad'];
    const complexityInput = row.complexity || '';
    const complexity = validComplexity.find(v => v.toLowerCase() === complexityInput.toLowerCase()) || 'TBD';

    // Normalize action
    const validAction = ['TBD', 'Question', 'Mandate', 'Delete', 'Simplify', 'Accelerate', 'Automate'];
    const actionInput = row.action || '';
    const action = validAction.find(v => v.toLowerCase() === actionInput.toLowerCase()) || 'TBD';

    // Normalize estimates
    const validEstimates = ['Unknown', '0 HR', '1 Hr', '2 Hr', '4 HR', '8 Hr - 1 Day', '16 Hr - 2 Day',
                           '24 Hr - 3 Day', '40 Hr - 5 Day', '56 Hr - 1 Week', '112 Hr - 2 Week', '224 Hr - 1 Month'];
    const estimatesInput = row.estimates || row.estimate || '';
    const estimates = validEstimates.find(v => v.toLowerCase() === estimatesInput.toLowerCase()) || 'Unknown';

    // Parse interval (expects "start,end" or "start - end" format with ISO dates)
    let interval = null;
    const intervalInput = row.interval || '';
    if (intervalInput) {
        const parts = intervalInput.split(/[,\-–]/).map(s => s.trim()).filter(Boolean);
        if (parts.length === 2) {
            interval = { start: parts[0], end: parts[1] };
        }
    }

    return {
        title: row.title || row.name || '',
        url: row.url || row.link || '',
        priority,
        type,
        energy,
        deadline: row.deadline || null,
        notes: row.notes || row.description || '',
        recurrence,
        // Additional attributes
        status,
        impact,
        value,
        complexity,
        action,
        estimates,
        interval
    };
}

async function fetchGoogleSheetsTasks(sheetUrl) {
    const response = await fetch(sheetUrl);
    if (!response.ok) throw new Error(`Failed to fetch sheet: ${response.status}`);
    const text = await response.text();
    const rows = parseCSV(text);
    const normalized = rows.map(normalizeSheetRow).filter(r => r.title);
    _sheetsParsedRows = normalized;
    return normalized;
}

function showSheetsPreview(rows) {
    const container = document.getElementById('sheets-preview');
    const importBtn = document.getElementById('sheets-import-btn');
    if (!container) return;

    if (rows.length === 0) {
        container.innerHTML = '<p>No valid rows found. Ensure the sheet has a "title" column header.</p>';
        container.classList.remove('hidden');
        return;
    }

    const previewRows = rows.slice(0, 10);
    container.innerHTML = `
        <p style="margin:0 0 8px; font-size:0.85em; color:var(--text-muted)">Preview (first ${previewRows.length} of ${rows.length} rows):</p>
        <div style="overflow-x:auto;">
            <table>
                <thead><tr><th>Title</th><th>Priority</th><th>Type</th><th>Energy</th><th>Status</th><th>Impact</th></tr></thead>
                <tbody>
                    ${previewRows.map(r => `
                        <tr>
                            <td>${r.title}</td>
                            <td>${r.priority}</td>
                            <td>${r.type}</td>
                            <td>${r.energy}</td>
                            <td>${r.status || 'inbox'}</td>
                            <td>${r.impact || 'TBD'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${rows.length > 10 ? `<p style="font-size:0.8em; color:var(--text-muted)">...and ${rows.length - 10} more rows</p>` : ''}
    `;
    container.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
}

async function importSheetsTasks(rows) {
    let count = 0;
    for (const row of rows) {
        if (!row.title) continue;
        // Pass extra attributes via the extraAttrs parameter
        const extraAttrs = {
            status: row.status,
            impact: row.impact,
            value: row.value,
            complexity: row.complexity,
            action: row.action,
            estimates: row.estimates,
            interval: row.interval
        };
        await addNewTask(row.title, row.url, row.priority, row.deadline || null, row.type, row.energy, row.notes, row.recurrence, extraAttrs);
        count++;
    }
    return count;
}

// --- Settings Listeners Setup (called from manager.js) ---
// This function is called by manager.js after DOM is ready
async function setupSettingsModalListeners(renderPageCallback) {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const fontFamilySelect = document.getElementById('font-family-select');
    const fontSizeSelect = document.getElementById('font-size-select');

    if (settingsBtn) {
        settingsBtn.addEventListener('click', async () => {
            await populateSettingsForm();
            openSettingsModal();
        });
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', closeSettingsModal);
    }

    // Close on overlay click
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeSettingsModal();
        });
    }

    // Auto-save on theme toggle change
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', async () => {
            const theme = darkModeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            await saveSettingsFromForm();
            showInfoMessage('Settings saved!', 'success');
        });
    }

    // Auto-save on font family change
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', async () => {
            const fontValue = FONT_FAMILY_MAP[fontFamilySelect.value] || FONT_FAMILY_MAP['system'];
            document.documentElement.style.setProperty('--font-family', fontValue);
            await saveSettingsFromForm();
            showInfoMessage('Settings saved!', 'success');
        });
    }

    // Auto-save on font size change
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', async () => {
            const sizeValue = FONT_SIZE_MAP[fontSizeSelect.value] || FONT_SIZE_MAP['medium'];
            document.documentElement.style.setProperty('--font-size-base', sizeValue);
            await saveSettingsFromForm();
            showInfoMessage('Settings saved!', 'success');
        });
    }

    // Setup attribute toggle listeners for auto-save
    setupAttributeToggleListeners(renderPageCallback);
}

// --- Import/Export Modal Listeners Setup ---
async function setupImportExportModalListeners(renderPageCallback) {
    const importExportBtn = document.getElementById('import-export-btn');
    const importExportCloseBtn = document.getElementById('import-export-close-btn');
    const importExportModal = document.getElementById('import-export-modal');

    if (importExportBtn) {
        importExportBtn.addEventListener('click', () => {
            openImportExportModal();
        });
    }

    if (importExportCloseBtn) {
        importExportCloseBtn.addEventListener('click', closeImportExportModal);
    }

    if (importExportModal) {
        importExportModal.addEventListener('click', (e) => {
            if (e.target === importExportModal) closeImportExportModal();
        });
    }

    // JSON Export
    const exportBtn = document.getElementById('export-tasks-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const tasks = await getTasksAsync();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadAnchorNode.setAttribute("download", `tasks-${timestamp}.json`);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showInfoMessage("Tasks exported successfully!", "success");
        });
    }

    // JSON Import
    const importBtn = document.getElementById('import-tasks-btn');
    const fileInput = document.getElementById('import-file-input');

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) { showInfoMessage("No file selected.", "error"); return; }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedTasks = JSON.parse(e.target.result);
                    if (!Array.isArray(importedTasks)) {
                        throw new Error("Invalid format: JSON file should contain an array of tasks.");
                    }

                    const existingTasks = await getTasksAsync();
                    const existingTaskIds = new Set(existingTasks.map(t => t.id));
                    const tasksToCreate = [];
                    const tasksToUpdate = [];

                    for (const importedTask of importedTasks) {
                        if (!importedTask.id || !importedTask.title) {
                            console.warn("Skipping invalid task object:", importedTask);
                            continue;
                        }
                        if (existingTaskIds.has(importedTask.id)) {
                            tasksToUpdate.push(importedTask);
                        } else {
                            tasksToCreate.push(importedTask);
                        }
                    }

                    const updatedTasks = existingTasks.map(existingTask => {
                        const taskToUpdate = tasksToUpdate.find(t => t.id === existingTask.id);
                        return taskToUpdate ? taskToUpdate : existingTask;
                    });

                    const finalTasks = [...updatedTasks, ...tasksToCreate];
                    await saveTasksAsync(finalTasks);
                    closeImportExportModal();
                    if (renderPageCallback) await renderPageCallback();
                    showInfoMessage("Tasks imported successfully!", "success");
                } catch (error) {
                    showInfoMessage(`Error importing tasks: ${error.message}`, "error");
                } finally {
                    fileInput.value = '';
                }
            };
            reader.onerror = () => { showInfoMessage("Error reading file.", "error"); fileInput.value = ''; };
            reader.readAsText(file);
        });
    }

    // CSV File Upload
    const csvUploadBtn = document.getElementById('csv-upload-btn');
    const csvFileInput = document.getElementById('csv-file-input');

    if (csvUploadBtn && csvFileInput) {
        csvUploadBtn.addEventListener('click', () => csvFileInput.click());

        csvFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) { showInfoMessage("No file selected.", "error"); return; }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    const rows = parseCSV(text);
                    const normalized = rows.map(normalizeSheetRow).filter(r => r.title);
                    _csvParsedRows = normalized;
                    showCsvPreview(normalized);
                } catch (error) {
                    showInfoMessage(`Error parsing CSV: ${error.message}`, "error");
                } finally {
                    csvFileInput.value = '';
                }
            };
            reader.onerror = () => { showInfoMessage("Error reading file.", "error"); csvFileInput.value = ''; };
            reader.readAsText(file);
        });
    }

    const csvImportBtn = document.getElementById('csv-import-btn');
    if (csvImportBtn) {
        csvImportBtn.addEventListener('click', async () => {
            if (_csvParsedRows.length === 0) {
                showInfoMessage('No rows to import. Please upload a CSV file first.', 'error');
                return;
            }
            csvImportBtn.textContent = 'Importing...';
            csvImportBtn.disabled = true;
            try {
                const count = await importCsvTasks(_csvParsedRows);
                showInfoMessage(`Imported ${count} task(s) from CSV!`, 'success');
                closeImportExportModal();
                if (renderPageCallback) await renderPageCallback();
            } catch (err) {
                showInfoMessage(`Import failed: ${err.message}`, 'error');
            } finally {
                csvImportBtn.textContent = '✅ Import Rows';
                csvImportBtn.disabled = false;
            }
        });
    }

    // Google Sheets import
    const sheetsFetchBtn = document.getElementById('sheets-fetch-btn');
    if (sheetsFetchBtn) {
        sheetsFetchBtn.addEventListener('click', async () => {
            const sheetUrl = document.getElementById('sheets-url')?.value.trim();
            if (!sheetUrl) {
                showInfoMessage('Please enter a Google Sheets CSV URL.', 'error');
                return;
            }
            sheetsFetchBtn.textContent = 'Loading...';
            sheetsFetchBtn.disabled = true;
            try {
                const rows = await fetchGoogleSheetsTasks(sheetUrl);
                showSheetsPreview(rows);
                // Save URL to settings
                const settings = await getSettings();
                settings.googleSheetsUrl = sheetUrl;
                await saveSettings(settings);
            } catch (err) {
                showInfoMessage(`Sheets error: ${err.message}`, 'error');
            } finally {
                sheetsFetchBtn.textContent = 'Preview Sheet';
                sheetsFetchBtn.disabled = false;
            }
        });
    }

    const sheetsImportBtn = document.getElementById('sheets-import-btn');
    if (sheetsImportBtn) {
        sheetsImportBtn.addEventListener('click', async () => {
            if (_sheetsParsedRows.length === 0) {
                showInfoMessage('No rows to import. Please preview the sheet first.', 'error');
                return;
            }
            sheetsImportBtn.textContent = 'Importing...';
            sheetsImportBtn.disabled = true;
            try {
                const count = await importSheetsTasks(_sheetsParsedRows);
                showInfoMessage(`Imported ${count} task(s) from Google Sheets!`, 'success');
                closeImportExportModal();
                if (renderPageCallback) await renderPageCallback();
            } catch (err) {
                showInfoMessage(`Import failed: ${err.message}`, 'error');
            } finally {
                sheetsImportBtn.textContent = '✅ Import Rows';
                sheetsImportBtn.disabled = false;
            }
        });
    }

    // Notion import
    const notionFetchBtn = document.getElementById('notion-fetch-btn');
    if (notionFetchBtn) {
        notionFetchBtn.addEventListener('click', async () => {
            const apiKey = document.getElementById('notion-api-key')?.value.trim();
            const dbId = document.getElementById('notion-database-id')?.value.trim();
            if (!apiKey || !dbId) {
                showInfoMessage('Please enter your Notion API Key and Database ID.', 'error');
                return;
            }
            notionFetchBtn.textContent = 'Fetching...';
            notionFetchBtn.disabled = true;
            try {
                const pages = await fetchNotionPages(apiKey, dbId);
                renderNotionPagesList(pages);
                // Save credentials to settings
                const settings = await getSettings();
                settings.notionApiKey = apiKey;
                settings.notionDatabaseId = dbId;
                await saveSettings(settings);
            } catch (err) {
                showInfoMessage(`Notion error: ${err.message}`, 'error');
            } finally {
                notionFetchBtn.textContent = 'Fetch Notion Pages';
                notionFetchBtn.disabled = false;
            }
        });
    }

    const notionImportBtn = document.getElementById('notion-import-btn');
    if (notionImportBtn) {
        notionImportBtn.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.notion-page-checkbox:checked');
            if (checkboxes.length === 0) {
                showInfoMessage('Please select at least one page.', 'error');
                return;
            }
            const selected = Array.from(checkboxes).map(cb => ({
                id: cb.value,
                title: cb.dataset.title,
                priority: cb.dataset.priority
            }));
            notionImportBtn.textContent = 'Importing...';
            notionImportBtn.disabled = true;
            try {
                const count = await importNotionTasks(selected);
                showInfoMessage(`Imported ${count} task(s) from Notion!`, 'success');
                closeImportExportModal();
                if (renderPageCallback) await renderPageCallback();
            } catch (err) {
                showInfoMessage(`Import failed: ${err.message}`, 'error');
            } finally {
                notionImportBtn.textContent = 'Import Selected';
                notionImportBtn.disabled = false;
            }
        });
    }

    // Setup Notion sync listeners (new bidirectional sync feature)
    await setupNotionSyncListeners(renderPageCallback);
}

// --- Time Blocks Modal Listeners Setup ---
async function setupTimeBlocksModalListeners(renderPageCallback) {
    const timeBlocksBtn = document.getElementById('time-blocks-btn');
    const timeBlocksCloseBtn = document.getElementById('time-blocks-close-btn');
    const timeBlocksModal = document.getElementById('time-blocks-modal');

    if (timeBlocksBtn) {
        timeBlocksBtn.addEventListener('click', () => {
            openTimeBlocksModal();
        });
    }

    if (timeBlocksCloseBtn) {
        timeBlocksCloseBtn.addEventListener('click', closeTimeBlocksModal);
    }

    if (timeBlocksModal) {
        timeBlocksModal.addEventListener('click', (e) => {
            if (e.target === timeBlocksModal) closeTimeBlocksModal();
        });
    }

    // Time blocks management
    const resetBlocksBtn = document.getElementById('reset-time-blocks-btn');
    if (resetBlocksBtn) {
        resetBlocksBtn.addEventListener('click', async () => {
            if (confirm('Reset all time blocks to defaults? This cannot be undone.')) {
                await resetTimeBlocksToDefaults();
                showInfoMessage('Time blocks reset to defaults.', 'success');
                closeTimeBlocksModal();
                if (renderPageCallback) await renderPageCallback();
            }
        });
    }

    const addBlockBtn = document.getElementById('add-time-block-btn');
    const addBlockForm = document.getElementById('add-time-block-form');
    if (addBlockBtn && addBlockForm) {
        addBlockBtn.addEventListener('click', () => {
            addBlockForm.classList.toggle('hidden');
        });
    }

    const cancelNewBlockBtn = document.getElementById('cancel-new-block-btn');
    if (cancelNewBlockBtn && addBlockForm) {
        cancelNewBlockBtn.addEventListener('click', () => {
            addBlockForm.classList.add('hidden');
        });
    }

    const saveNewBlockBtn = document.getElementById('save-new-block-btn');
    if (saveNewBlockBtn) {
        saveNewBlockBtn.addEventListener('click', async () => {
            const label = document.getElementById('new-block-label')?.value.trim();
            const startTime = document.getElementById('new-block-start')?.value;
            const endTime = document.getElementById('new-block-end')?.value;
            const limit = document.getElementById('new-block-limit')?.value;
            const colorClass = document.getElementById('new-block-color')?.value || '';

            if (!label || !startTime || !endTime) {
                showInfoMessage('Label, start time, and end time are required.', 'error');
                return;
            }

            const result = await addTimeBlock(label, startTime, endTime, limit, colorClass);
            if (result === null) {
                // Validation failed (overlap detected), error already shown
                return;
            }

            if (addBlockForm) addBlockForm.classList.add('hidden');
            // Clear form
            document.getElementById('new-block-label').value = '';
            document.getElementById('new-block-start').value = '';
            document.getElementById('new-block-end').value = '';
            document.getElementById('new-block-limit').value = 'multiple';
            document.getElementById('new-block-color').value = '';
            showInfoMessage('Time block added!', 'success');
            closeTimeBlocksModal();
            if (renderPageCallback) await renderPageCallback();
        });
    }
}
