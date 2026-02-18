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
}

function closeImportExportModal() {
    const modal = document.getElementById('import-export-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    // Hide any sub-panels
    const notionList = document.getElementById('notion-pages-list');
    const notionImportBtn = document.getElementById('notion-import-btn');
    const sheetsPreview = document.getElementById('sheets-preview');
    const sheetsImportBtn = document.getElementById('sheets-import-btn');
    const csvPreview = document.getElementById('csv-preview');
    const csvImportBtn = document.getElementById('csv-import-btn');
    if (notionList) notionList.classList.add('hidden');
    if (notionImportBtn) notionImportBtn.classList.add('hidden');
    if (sheetsPreview) sheetsPreview.classList.add('hidden');
    if (sheetsImportBtn) sheetsImportBtn.classList.add('hidden');
    if (csvPreview) csvPreview.classList.add('hidden');
    if (csvImportBtn) csvImportBtn.classList.add('hidden');
}

async function populateImportExportForm() {
    const settings = await getSettings();
    const notionApiKey = document.getElementById('notion-api-key');
    const notionDbId = document.getElementById('notion-database-id');
    const sheetsUrl = document.getElementById('sheets-url');

    if (notionApiKey) notionApiKey.value = settings.notionApiKey || '';
    if (notionDbId) notionDbId.value = settings.notionDatabaseId || '';
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
        <table>
            <thead><tr><th>Title</th><th>Priority</th><th>Type</th><th>Energy</th></tr></thead>
            <tbody>
                ${previewRows.map(r => `
                    <tr>
                        <td>${r.title}</td>
                        <td>${r.priority}</td>
                        <td>${r.type}</td>
                        <td>${r.energy}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${rows.length > 10 ? `<p style="font-size:0.8em; color:var(--text-muted)">...and ${rows.length - 10} more rows</p>` : ''}
    `;
    container.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
}

async function importCsvTasks(rows) {
    let count = 0;
    for (const row of rows) {
        if (!row.title) continue;
        await addNewTask(row.title, row.url, row.priority, row.deadline || null, row.type, row.energy, row.notes, row.recurrence);
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

// --- Notion Import ---

// Stored pages for later import
let _notionFetchedPages = [];

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
        // Extract title from Name or Title property
        const titleProp = Object.values(page.properties || {}).find(p => p.type === 'title');
        const title = titleProp?.title?.map(t => t.plain_text).join('') || '(Untitled)';

        // Extract priority if present
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

    // Select all toggle
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
    const energy = (['low','high'].includes((row.energy || '').toLowerCase()))
        ? row.energy.toLowerCase() : 'low';
    const recurrence = (['daily','weekly','monthly'].includes((row.recurrence || '').toLowerCase()))
        ? row.recurrence.toLowerCase() : null;
    return {
        title: row.title || row.name || '',
        url: row.url || row.link || '',
        priority,
        type,
        energy,
        deadline: row.deadline || null,
        notes: row.notes || row.description || '',
        recurrence
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
        <table>
            <thead><tr><th>Title</th><th>Priority</th><th>Type</th><th>Energy</th></tr></thead>
            <tbody>
                ${previewRows.map(r => `
                    <tr>
                        <td>${r.title}</td>
                        <td>${r.priority}</td>
                        <td>${r.type}</td>
                        <td>${r.energy}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${rows.length > 10 ? `<p style="font-size:0.8em; color:var(--text-muted)">...and ${rows.length - 10} more rows</p>` : ''}
    `;
    container.classList.remove('hidden');
    if (importBtn) importBtn.classList.remove('hidden');
}

async function importSheetsTasks(rows) {
    let count = 0;
    for (const row of rows) {
        if (!row.title) continue;
        await addNewTask(row.title, row.url, row.priority, row.deadline || null, row.type, row.energy, row.notes, row.recurrence);
        count++;
    }
    return count;
}

// --- Settings Listeners Setup (called from manager.js) ---
// This function is called by manager.js after DOM is ready
async function setupSettingsModalListeners(renderPageCallback) {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');

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

    // Live theme preview on toggle change
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            const theme = darkModeToggle.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
        });
    }

    // Font family live preview
    const fontFamilySelect = document.getElementById('font-family-select');
    if (fontFamilySelect) {
        fontFamilySelect.addEventListener('change', () => {
            const fontValue = FONT_FAMILY_MAP[fontFamilySelect.value] || FONT_FAMILY_MAP['system'];
            document.documentElement.style.setProperty('--font-family', fontValue);
        });
    }

    // Font size live preview
    const fontSizeSelect = document.getElementById('font-size-select');
    if (fontSizeSelect) {
        fontSizeSelect.addEventListener('change', () => {
            const sizeValue = FONT_SIZE_MAP[fontSizeSelect.value] || FONT_SIZE_MAP['medium'];
            document.documentElement.style.setProperty('--font-size-base', sizeValue);
        });
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            await saveSettingsFromForm();
            showInfoMessage('Settings saved!', 'success');
        });
    }
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
                notionImportBtn.textContent = '✅ Import Selected';
                notionImportBtn.disabled = false;
            }
        });
    }
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
