// manager.js

// --- Google API/GIS Ready Flags ---
let gapiReady = false;
let gisReady = false;

// --- Global variables for Sheets Integration ---
let googleSheetId = null;
let USER_HAS_AUTHORIZED = false;
let currentAuthToken = null; // Store the token for revocation
let activeListSheetId = null;
let deletedSheetId = null;
let activeListHeaders = []; // Will be populated by ensureSheetsExist
let deletedListHeaders = [];  // Will be populated by ensureSheetsExist

// --- Callbacks for GAPI and GIS script loading ---
function gapiLoadedCallback() {
    console.log("GAPI script loaded.");
    gapiReady = true;
    checkGapiGisLoaded();
}

function gisLoadedCallback() {
    console.log("GIS script loaded.");
    gisReady = true;
    checkGapiGisLoaded();
}

function checkGapiGisLoaded() {
    if (gapiReady && gisReady) {
        console.log("Both GAPI and GIS are loaded.");
        // This is effectively window.onGapiGisLoad
        // Call the main initialization function if conditions are met
        // (e.g., user is already authorized and sheet ID is known)
        // The initializeGapiClientAndLoadSheetData function will handle these checks.
        if (USER_HAS_AUTHORIZED && googleSheetId) {
             initializeGapiClientAndLoadSheetData();
        } else {
            console.log("GAPI/GIS loaded, but user not authorized or sheet ID unknown. Waiting for user action.");
            // Optionally update UI to indicate GAPI/GIS are ready if needed
            const sheetStatus = document.getElementById('sheet-status');
            if (sheetStatus && sheetStatus.textContent === "Not Connected") {
                // sheetStatus.textContent = "Ready to connect to Google Sheets.";
                // sheetStatus.className = 'info-message'; // Neutral
            }
        }
    }
}

// --- Task to Sheet Row Mapping Functions (for manager.js) ---
// Adapted from sheets_utils.js for direct use in manager's sync functions.

/**
 * Maps a Task object to an array of values for a sheet row.
 * Handles different headers for Active vs. Deleted sheets.
 * @param {object} task - The task object.
 * @param {string[]} headers - The headers for the sheet (e.g., activeListHeaders or deletedListHeaders).
 * @returns {Array} An array of values corresponding to the headers.
 */
function _mapTaskToSheetRow(task, headers) {
    const now = new Date().toISOString();
    const rowMap = {
        "Task ID": task.id,
        "Title": task.title,
        "URL": task.url || "", // Ensure empty string if undefined/null
        "Priority": task.priority,
        "Deadline": task.deadline || "", // Ensure empty string
        "Type": task.type,
        "Completed": task.completed, // Boolean
        "Display Order": task.displayOrder !== undefined ? task.displayOrder : null,
        "Last Modified": now
    };

    // Add "Date Deleted" only if it's in the headers (i.e., for DELETED_LIST_HEADERS)
    if (headers.includes("Date Deleted")) {
        rowMap["Date Deleted"] = now;
    }

    return headers.map(header => rowMap[header]);
}

/**
 * Maps an array of values from a sheet row back to a Task-like object.
 * @param {Array} row - Array of values from the sheet.
 * @param {string[]} headers - The headers for the sheet.
 * @returns {object} A task-like object.
 */
function _mapSheetRowToTask(row, headers) {
    const taskData = {};
    headers.forEach((header, index) => {
        let key = header.replace(/ /g, ''); // "TaskID", "LastModified"
        if (key === 'TaskID') {
            key = 'id'; // map to Task object property
        } else {
            // Convert to camelCase (e.g., "Last Modified" -> "lastModified")
            key = key.charAt(0).toLowerCase() + key.slice(1);
        }

        let value = row[index];
        if (header === 'Completed') {
            value = String(value).toLowerCase() === 'true';
        } else if (header === 'Display Order' && value !== undefined && value !== null && value !== "") {
            value = parseInt(value, 10);
        } else if (value === undefined || value === null) {
            value = ""; // Default to empty string for undefined/null from sheet
        }
        // Add other type conversions if necessary (e.g., for dates)
        taskData[key] = value;
    });

    // Ensure all essential Task fields are present by merging with a new Task instance
    // This ensures that if a column is missing from the sheet, the property still exists on the object.
    const defaults = new Task(taskData.id || `temp_${Date.now()}`, taskData.title || 'Untitled');
    return { ...defaults, ...taskData };
}

// --- Google Sheet Sync Wrapper Functions ---

/**
 * Synchronizes a new task to the Google Sheet.
 * @param {object} task - The task object to add.
 */
async function syncNewTaskToSheet(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
        console.warn("Sheet sync: User not authorized or sheet/headers not configured. Skipping new task sync.", task);
        return;
    }
    if (!currentAuthToken) {
        console.warn("Sheet sync: No auth token available. Skipping new task sync.");
        return;
    }
    console.log("Syncing new task to sheet:", task);
    setToken(currentAuthToken); // Ensure GAPI client has the latest token

    const sheetRow = _mapTaskToSheetRow(task, activeListHeaders);
    appendRow(googleSheetId, ACTIVE_LIST_SHEET_NAME, sheetRow, (response, error) => {
        if (error) {
            console.error("Error syncing new task to sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (new task): ${error.message || 'Unknown error'}`, "error", 4000, document);
        } else {
            console.log("New task synced to sheet successfully:", response);
            showInfoMessage(`Task "${task.title.substring(0,20)}..." synced to sheet.`, "success", 3000, document);
        }
    });
}

/**
 * Synchronizes an updated task to the Google Sheet.
 * @param {object} task - The updated task object.
 */
async function syncUpdatedTaskToSheet(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
        console.warn("Sheet sync: User not authorized or sheet/headers not configured. Skipping updated task sync.", task);
        return;
    }
    if (!currentAuthToken) {
        console.warn("Sheet sync: No auth token available. Skipping updated task sync.");
        return;
    }
    console.log("Syncing updated task to sheet:", task);
    setToken(currentAuthToken);

    findRowIndexByTaskId(googleSheetId, ACTIVE_LIST_SHEET_NAME, task.id, activeListHeaders, (rowIndex, error) => {
        if (error) {
            console.error("Error finding task for update in sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (update find): ${error.message || 'Unknown error'}`, "error", 4000, document);
            return;
        }

        const sheetRow = _mapTaskToSheetRow(task, activeListHeaders);
        if (rowIndex > 0) {
            updateRow(googleSheetId, ACTIVE_LIST_SHEET_NAME, rowIndex, activeListHeaders.length, sheetRow, (response, error) => {
                if (error) {
                    console.error("Error syncing updated task to sheet:", error.message || error);
                    showInfoMessage(`Sheet sync error (update): ${error.message || 'Unknown error'}`, "error", 4000, document);
                } else {
                    console.log("Updated task synced to sheet successfully:", response);
                    showInfoMessage(`Task "${task.title.substring(0,20)}..." update synced.`, "success", 3000, document);
                }
            });
        } else {
            // Task not found, so append it as a new task instead
            console.warn(`Task ID ${task.id} not found in sheet for update. Appending as new.`);
            showInfoMessage(`Task "${task.title.substring(0,20)}..." not in sheet, adding new.`, "info", 3000, document);
            syncNewTaskToSheet(task); // This will call setToken again, which is okay.
        }
    });
}

/**
 * Synchronizes a deleted task to the Google Sheet.
 * (Appends to "Deleted" sheet, then removes from "Active List" sheet).
 * @param {object} task - The task object that was deleted locally.
 */
async function syncDeletedTaskToSheet(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !deletedSheetId || !deletedListHeaders || deletedListHeaders.length === 0 || !activeListHeaders || activeListHeaders.length === 0 ) {
        console.warn("Sheet sync: User not authorized or sheets/headers not configured. Skipping deleted task sync.", task);
        return;
    }
     if (!currentAuthToken) {
        console.warn("Sheet sync: No auth token available. Skipping deleted task sync.");
        return;
    }
    console.log("Syncing deleted task to sheet:", task);
    setToken(currentAuthToken);

    // Step 1: Append to "Deleted" sheet
    const deletedSheetRow = _mapTaskToSheetRow(task, deletedListHeaders); // mapTaskToSheetRow now includes Date Deleted
    appendRow(googleSheetId, DELETED_SHEET_NAME, deletedSheetRow, (response, error) => {
        if (error) {
            console.error("Error appending task to 'Deleted' sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (to Deleted sheet): ${error.message || 'Unknown error'}`, "error", 4000, document);
            // Don't return yet, still attempt to delete from active list
        } else {
            console.log("Task appended to 'Deleted' sheet successfully:", response);
            showInfoMessage(`Task "${task.title.substring(0,20)}..." moved to Deleted sheet.`, "success", 2000, document);
        }

        // Step 2: Delete from "Active List" sheet
        findRowIndexByTaskId(googleSheetId, ACTIVE_LIST_SHEET_NAME, task.id, activeListHeaders, (rowIndex, findError) => {
            if (findError) {
                console.error("Error finding task for deletion in 'Active List' sheet:", findError.message || findError);
                showInfoMessage(`Sheet sync error (delete find): ${findError.message || 'Unknown error'}`, "error", 4000, document);
                return;
            }

            if (rowIndex > 0 && activeListSheetId) {
                deleteRow(googleSheetId, activeListSheetId, rowIndex, (deleteResponse, deleteError) => {
                    if (deleteError) {
                        console.error("Error deleting task from 'Active List' sheet:", deleteError.message || deleteError);
                        showInfoMessage(`Sheet sync error (delete): ${deleteError.message || 'Unknown error'}`, "error", 4000, document);
                    } else {
                        console.log("Task deleted from 'Active List' sheet successfully:", deleteResponse);
                        showInfoMessage(`Task "${task.title.substring(0,20)}..." removed from Active sheet.`, "success", 3000, document);
                    }
                });
            } else if (rowIndex <= 0) {
                console.warn(`Task ID ${task.id} not found in 'Active List' sheet for deletion (might have been already removed or never synced).`);
                // Not necessarily an error to show to user, could be normal if sync was interrupted before
            }
        });
    });
}

// Expose sync functions to window object for task_utils.js to call
// Note: These are the versions called by task_utils.js for automatic background sync.
window.syncNewTaskToSheet = async function(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
        console.warn("Sheet sync (auto): User not authorized or sheet/headers not configured. Skipping new task sync.", task);
        return;
    }
    if (!currentAuthToken) {
        console.warn("Sheet sync (auto): No auth token available. Skipping new task sync.");
        return;
    }
    showLoadingState(true); // isSaving = true, no specific button
    console.log("Auto-syncing new task to sheet:", task);
    setToken(currentAuthToken);

    const sheetRow = _mapTaskToSheetRow(task, activeListHeaders);
    appendRow(googleSheetId, ACTIVE_LIST_SHEET_NAME, sheetRow, (response, error) => {
        if (error) {
            console.error("Error auto-syncing new task to sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (auto new): ${error.message || 'Unknown error'}`, "error", 4000, document);
        } else {
            console.log("New task auto-synced to sheet successfully:", response);
            showInfoMessage(`Task "${task.title.substring(0,15)}..." auto-synced.`, "success", 2000, document);
        }
        hideLoadingState();
    });
};

window.syncUpdatedTaskToSheet = async function(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
        console.warn("Sheet sync (auto): User not authorized or sheet/headers not configured. Skipping updated task sync.", task);
        return;
    }
    if (!currentAuthToken) {
        console.warn("Sheet sync (auto): No auth token available. Skipping updated task sync.");
        return;
    }
    showLoadingState(true);
    console.log("Auto-syncing updated task to sheet:", task);
    setToken(currentAuthToken);

    findRowIndexByTaskId(googleSheetId, ACTIVE_LIST_SHEET_NAME, task.id, activeListHeaders, (rowIndex, error) => {
        if (error) {
            console.error("Error finding task for auto-update in sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (auto update find): ${error.message || 'Unknown error'}`, "error", 4000, document);
            hideLoadingState();
            return;
        }

        const sheetRow = _mapTaskToSheetRow(task, activeListHeaders);
        if (rowIndex > 0) {
            // Corrected parameter order for updateRow: spreadsheetId, sheetName, rowIndex, numCols, rowValues, callback
            updateRow(googleSheetId, ACTIVE_LIST_SHEET_NAME, rowIndex, activeListHeaders.length, sheetRow, (response, updateError) => {
                if (updateError) {
                    console.error("Error auto-syncing updated task to sheet:", updateError.message || updateError);
                    showInfoMessage(`Sheet sync error (auto update): ${updateError.message || 'Unknown error'}`, "error", 4000, document);
                } else {
                    console.log("Updated task auto-synced to sheet successfully:", response);
                    showInfoMessage(`Task "${task.title.substring(0,15)}..." update auto-synced.`, "success", 2000, document);
                }
                hideLoadingState();
            });
        } else {
            console.warn(`Task ID ${task.id} not found in sheet for auto-update. Appending as new.`);
            showInfoMessage(`Task "${task.title.substring(0,15)}..." not in sheet, auto-adding.`, "info", 2000, document);
            hideLoadingState();
            window.syncNewTaskToSheet(task); // Calls the new window.syncNewTaskToSheet
        }
    });
};

window.syncDeletedTaskToSheet = async function(task) {
    if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !deletedSheetId || !deletedListHeaders || deletedListHeaders.length === 0 || !activeListHeaders || activeListHeaders.length === 0 ) {
        console.warn("Sheet sync (auto): User not authorized or sheets/headers not configured. Skipping deleted task sync.", task);
        return;
    }
     if (!currentAuthToken) {
        console.warn("Sheet sync (auto): No auth token available. Skipping deleted task sync.");
        return;
    }
    showLoadingState(true);
    console.log("Auto-syncing deleted task to sheet:", task);
    setToken(currentAuthToken);

    const deletedSheetRow = _mapTaskToSheetRow(task, deletedListHeaders);
    appendRow(googleSheetId, DELETED_SHEET_NAME, deletedSheetRow, (response, error) => {
        let opFailed = false;
        if (error) {
            console.error("Error auto-syncing task to 'Deleted' sheet:", error.message || error);
            showInfoMessage(`Sheet sync error (to Deleted): ${error.message || 'Unknown error'}`, "error", 4000, document);
            opFailed = true;
        } else {
            console.log("Task auto-synced to 'Deleted' sheet successfully:", response);
            showInfoMessage(`Task "${task.title.substring(0,15)}..." auto-moved to Deleted.`, "success", 2000, document);
        }

        findRowIndexByTaskId(googleSheetId, ACTIVE_LIST_SHEET_NAME, task.id, activeListHeaders, (rowIndex, findError) => {
            if (findError) {
                console.error("Error finding task for deletion in 'Active List' (auto-sync):", findError.message || findError);
                if (!opFailed) showInfoMessage(`Sheet sync error (delete find): ${findError.message || 'Unknown error'}`, "error", 4000, document);
                hideLoadingState();
                return;
            }

            if (rowIndex > 0 && activeListSheetId) {
                // Corrected parameter order for deleteRow: spreadsheetId, sheetId, rowIndex, callback
                deleteRow(googleSheetId, activeListSheetId, rowIndex, (deleteResponse, deleteError) => {
                    if (deleteError) {
                        console.error("Error deleting task from 'Active List' (auto-sync):", deleteError.message || deleteError);
                         if (!opFailed) showInfoMessage(`Sheet sync error (delete): ${deleteError.message || 'Unknown error'}`, "error", 4000, document);
                    } else {
                        console.log("Task deleted from 'Active List' (auto-sync) successfully:", deleteResponse);
                        if (!opFailed) showInfoMessage(`Task "${task.title.substring(0,15)}..." removed from Active (auto).`, "success", 2000, document);
                    }
                    hideLoadingState();
                });
            } else {
                console.warn(`Task ID ${task.id} not found in 'Active List' for deletion (auto-sync).`);
                hideLoadingState();
            }
        });
    });
};


// Function to extract Sheet ID from URL or use as is
function extractSheetId(urlOrId) {
    if (!urlOrId) return null;
    const match = urlOrId.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }
    // If no match, assume the input is the ID itself, but perform basic validation
    if (urlOrId.length > 20 && !urlOrId.includes('/') && !urlOrId.includes(':')) { // Basic check for likely ID
        return urlOrId;
    }
    // Advanced: if it's a full URL but not matching the common pattern, try to warn or handle
    // For now, if it's not a clear ID or common URL, it might be invalid.
    // This function can be expanded for more robust parsing.
    // If it's a short string, it's likely an ID.
    if (urlOrId.length < 100 && !urlOrId.startsWith('http') && !urlOrId.includes('/')) {
        return urlOrId;
    }
    // showInfoMessage("Invalid Google Sheet URL or ID format.", "error", 3000, document);
    return null; // Or consider returning urlOrId if we are more lenient
}

// Main function to initialize GAPI client and load sheet data
async function initializeGapiClientAndLoadSheetData() {
    console.log("initializeGapiClientAndLoadSheetData called.");
    if (!gapiReady || !gisReady) {
        console.warn("GAPI or GIS not loaded yet. Aborting GAPI client initialization.");
        showInfoMessage("Google libraries are still loading. Please wait...", "info", 3000, document);
        return;
    }

    if (!googleSheetId) {
        console.warn("No Google Sheet ID available. Aborting.");
        // This case should ideally be handled by UI, preventing call if no ID
        showInfoMessage("Sheet ID is missing. Cannot load data.", "warn", 3000, document);
        return;
    }
    if (!USER_HAS_AUTHORIZED || !currentAuthToken) {
        console.warn("User not authorized or token missing. Aborting.");
        // This case should be handled by UI, preventing call if not authorized
        showInfoMessage("Authorization required to load sheet data.", "warn", 3000, document);
        return;
    }

    const sheetStatus = document.getElementById('sheet-status');
    if (sheetStatus) {
        sheetStatus.textContent = `Initializing for Sheet: ${googleSheetId.substring(0, 10)}...`;
        sheetStatus.className = 'info-message info';
    }

    // Call the GAPI client initializer from sheets_utils.js
    // Pass the API key and Client ID placeholders.
    // The Client ID for extensions is primarily set in the manifest for chrome.identity,
    // but GAPI's initTokenClient might use it for verification or other GIS features.
    initializeGapiClient(async (success) => { // API_KEY and CLIENT_ID are constants in sheets_utils.js
        if (success) {
            console.log("GAPI client initialized successfully via sheets_utils.");
            showInfoMessage("Google API client initialized.", "success", 2000, document);

            // Set the token obtained from chrome.identity
            setToken(currentAuthToken); // from sheets_utils.js

            // Ensure "Active List" and "Deleted" sheets exist
            if (sheetStatus) {
                sheetStatus.textContent = `Checking for required sheets in ${googleSheetId.substring(0,10)}...`;
                sheetStatus.className = 'info-message info';
            }
            ensureSheetsExist(googleSheetId, (sheetInfo, error) => {
                if (error) {
                    console.error("Error ensuring sheets exist:", error.message);
                    showInfoMessage(`Error with sheet setup: ${error.message}`, "error", 5000, document);
                    if (sheetStatus) {
                        sheetStatus.textContent = `Error: ${error.message.substring(0, 50)}...`;
                        sheetStatus.className = 'info-message error';
                    }
                } else {
                    activeListSheetId = sheetInfo.activeListSheetId;
                    deletedSheetId = sheetInfo.deletedSheetId;
                    activeListHeaders = sheetInfo.activeListHeaders; // Store headers
                    deletedListHeaders = sheetInfo.deletedListHeaders; // Store headers
                    console.log("Sheet setup complete. Active List ID:", activeListSheetId, "Headers:", activeListHeaders);
                    console.log("Deleted List ID:", deletedSheetId, "Headers:", deletedListHeaders);
                    showInfoMessage("Sheet setup complete. Ready to sync.", "success", 3000, document);
                    if (sheetStatus) {
                        sheetStatus.textContent = `Ready. Active: ${sheetInfo.activeListTitle}, Deleted: ${sheetInfo.deletedTitle}. Headers loaded.`;
                        sheetStatus.className = 'info-message success';
                    }
                    // TODO: Next step would be to load tasks from the "Active List" sheet.
                    // loadTasksFromSheet();
                }
            });
        } else {
            console.error("Failed to initialize GAPI client via sheets_utils.");
            showInfoMessage("Failed to initialize Google API client.", "error", 5000, document);
            if (sheetStatus) {
                sheetStatus.textContent = "Error initializing Google API client.";
                sheetStatus.className = 'info-message error';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // --- Google Sheet Integration Elements ---
    const sheetUrlInput = document.getElementById('sheet-url');
    const connectSheetBtn = document.getElementById('connect-sheet-btn');
    const disconnectSheetBtn = document.getElementById('disconnect-sheet-btn');
    const sheetStatus = document.getElementById('sheet-status');
    const exportToSheetBtn = document.getElementById('export-to-sheet-btn');
    const importFromSheetBtn = document.getElementById('import-from-sheet-btn');
    const addTaskBtn = document.getElementById('add-task-btn');

    // Store original button texts
    const originalButtonTexts = {
        connect: connectSheetBtn ? connectSheetBtn.textContent : '',
        disconnect: disconnectSheetBtn ? disconnectSheetBtn.textContent : '',
        export: exportToSheetBtn ? exportToSheetBtn.textContent : '',
        import: importFromSheetBtn ? importFromSheetBtn.textContent : '',
        add: addTaskBtn ? addTaskBtn.textContent : ''
    };

    const allSheetActionButtons = [connectSheetBtn, disconnectSheetBtn, exportToSheetBtn, importFromSheetBtn].filter(btn => btn);
    const allUserActionButtons = [connectSheetBtn, disconnectSheetBtn, exportToSheetBtn, importFromSheetBtn, addTaskBtn].filter(btn => btn);


    // --- Loading State Helpers ---
    // actionButton is the button that initiated the current action, if any.
    function showLoadingState(isSavingOperation = false, actionButton = null) {
        allUserActionButtons.forEach(btn => { if(btn) btn.disabled = true; });

        if (actionButton) {
            if (actionButton === connectSheetBtn) connectSheetBtn.textContent = "Connecting...";
            else if (actionButton === exportToSheetBtn) exportToSheetBtn.textContent = "Exporting...";
            else if (actionButton === importFromSheetBtn) importFromSheetBtn.textContent = "Importing...";
            // Add Task button text is not changed during its own operation, only disabled.
        }

        // For automatic background syncs (isSavingOperation = true),
        // we don't change any specific button text to "Saving..."
        // but rely on showInfoMessage for feedback.
        // The main purpose here is to disable other interactions.
        if (isSavingOperation) {
            console.log("Loading state for background save/sync.");
        }
    }

    function hideLoadingState() {
        allUserActionButtons.forEach(btn => { if(btn) btn.disabled = false; });

        if (connectSheetBtn) connectSheetBtn.textContent = originalButtonTexts.connect;
        if (disconnectSheetBtn) disconnectSheetBtn.textContent = originalButtonTexts.disconnect;
        if (exportToSheetBtn) exportToSheetBtn.textContent = originalButtonTexts.export;
        if (importFromSheetBtn) importFromSheetBtn.textContent = originalButtonTexts.import;
        if (addTaskBtn) addTaskBtn.textContent = originalButtonTexts.add;
    }

    // --- Task Addition ---
    const taskTitleInput = document.getElementById('task-title');
    const taskUrlInput = document.getElementById('task-url');
    const taskPriorityInput = document.getElementById('task-priority');
    const taskDeadlineGroup = document.getElementById('task-deadline-group');
    const taskDeadlineInput = document.getElementById('task-deadline');
    const taskTypeInput = document.getElementById('task-type');

    if (taskPriorityInput) {
        taskPriorityInput.addEventListener('change', function() {
            if (taskDeadlineGroup) {
                taskDeadlineGroup.style.display = this.value === 'CRITICAL' ? 'block' : 'none';
                if (this.value !== 'CRITICAL' && taskDeadlineInput) {
                    taskDeadlineInput.value = '';
                }
            }
        });
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const title = taskTitleInput ? taskTitleInput.value.trim() : '';
            const url = taskUrlInput ? taskUrlInput.value.trim() : '';
            const priority = taskPriorityInput ? taskPriorityInput.value : 'SOMEDAY';
            const type = taskTypeInput ? taskTypeInput.value : 'home';
            let deadline = taskDeadlineInput ? taskDeadlineInput.value : '';

            if (!title) {
                showInfoMessage("Task title is required.", "error", 3000, document);
                return;
            }
            if (priority === 'CRITICAL' && !deadline) {
                showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document);
                return;
            }
            if (priority !== 'CRITICAL') {
                deadline = null;
            }

            const newTask = await addNewTask(title, url, priority, deadline, type);
            if (newTask) {
                if (taskTitleInput) taskTitleInput.value = '';
                if (taskUrlInput) taskUrlInput.value = '';
                if (taskPriorityInput) taskPriorityInput.value = 'SOMEDAY';
                if (taskDeadlineInput) taskDeadlineInput.value = '';
                if (taskTypeInput) taskTypeInput.value = 'home';
                if (taskDeadlineGroup) taskDeadlineGroup.style.display = 'none';
                showInfoMessage("Task added successfully!", "success", 3000, document);
                renderManagerTasks(); // Re-render tasks
            } else {
                showInfoMessage("Failed to add task. Please try again.", "error", 3000, document);
            }
        });
    }
    // --- End of Task Addition ---

    renderManagerTasks();
    setupManagerEventListeners();
    console.log("Task Manager Page Loaded. Event listeners set up.");

    // --- Google Sheets Integration Logic ---
    if (connectSheetBtn) {
        connectSheetBtn.addEventListener('click', () => {
            showLoadingState(false, connectSheetBtn); // Show loading state for connect button
            const urlOrId = sheetUrlInput ? sheetUrlInput.value.trim() : '';
            if (!urlOrId) {
                showInfoMessage("Please enter a Google Sheet Link or ID.", "error", 3000, document);
                hideLoadingState();
                return;
            }

            const extractedId = extractSheetId(urlOrId);
            if (!extractedId) {
                showInfoMessage("Invalid Google Sheet URL or ID format. Please check and try again.", "error", 4000, document);
                hideLoadingState();
                return;
            }

            showInfoMessage("Requesting authorization...", "info", 0, document);

            chrome.identity.getAuthToken({ interactive: true }, function(token) {
                if (chrome.runtime.lastError) {
                    showInfoMessage(`Authorization failed: ${chrome.runtime.lastError.message}`, "error", 5000, document);
                    USER_HAS_AUTHORIZED = false;
                    currentAuthToken = null;
                    hideLoadingState();
                    return;
                }
                if (!token) {
                     showInfoMessage("Authorization failed. No token received.", "error", 5000, document);
                     USER_HAS_AUTHORIZED = false;
                     currentAuthToken = null;
                     hideLoadingState();
                     return;
                }

                currentAuthToken = token;
                USER_HAS_AUTHORIZED = true;
                googleSheetId = extractedId;

                chrome.storage.local.set({ googleSheetId: extractedId }, () => {
                    showInfoMessage(`Authorized. Connected to Sheet ID: ${extractedId.substring(0,10)}...`, "success", 4000, document);
                    if (sheetUrlInput) sheetUrlInput.value = extractedId; // Update input to show just the ID
                    if (sheetStatus) {
                        sheetStatus.innerHTML = `Fetching title for Sheet ID: ${extractedId.substring(0,10)}...`;
                        sheetStatus.className = 'info-message info'; // Use info class for loading state
                    }
                    if (connectSheetBtn) connectSheetBtn.style.display = 'none';
                    if (disconnectSheetBtn) disconnectSheetBtn.style.display = 'inline-block';
                    if (exportToSheetBtn) exportToSheetBtn.style.display = 'inline-block';
                    if (importFromSheetBtn) importFromSheetBtn.style.display = 'inline-block';

                    // Initialize GAPI and then fetch title
                    initializeGapiClientAndLoadSheetData().then(() => { // Assuming it returns a promise or can be awaited if async
                        getSpreadsheetTitle(googleSheetId, (title, error) => {
                            if (sheetStatus) { // Check again in case disconnected during async ops
                                if (error) {
                                    console.warn("Failed to fetch spreadsheet title:", error);
                                    sheetStatus.innerHTML = `Connected to Sheet ID: ${googleSheetId}`;
                                } else {
                                    sheetStatus.innerHTML = `Connected to: <a href="https://docs.google.com/spreadsheets/d/${googleSheetId}" target="_blank">${title}</a>`;
                                }
                                sheetStatus.className = 'info-message success'; // Set to success after attempting title fetch
                            }
                        });
                    }).catch(err => {
                         if (sheetStatus) {
                            sheetStatus.innerHTML = `Error initializing. Connected to Sheet ID: ${googleSheetId}`;
                            sheetStatus.className = 'info-message error';
                         }
                         console.error("Error during GAPI init or title fetch after connect:", err);
                        }).finally(() => {
                            hideLoadingState();
                        });
                    });
                });
            });
        });
    }

    if (disconnectSheetBtn) {
        disconnectSheetBtn.addEventListener('click', () => {
            // Disconnect is usually fast, but good practice to ensure UI consistency
            // showLoadingState(false, disconnectSheetBtn); // Optional: if disconnect had async steps
            showInfoMessage("Disconnecting...", "info", 0, document);
            // ... rest of disconnect logic ...
            // hideLoadingState(); // Optional: if disconnect had async steps and showLoadingState was called
            if (currentAuthToken) {
                chrome.identity.removeCachedAuthToken({ token: currentAuthToken }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn("Failed to remove cached token:", chrome.runtime.lastError.message);
                        // Proceed with UI changes even if token removal fails silently
                    } else {
                        console.log("Cached token removed successfully.");
                    }
                    currentAuthToken = null; // Clear stored token
                });
            }
            // Also try to clear any identity by 'logging out' the user from the app's perspective for GAPI
            // This is a bit complex as GAPI handles its own token state.
            // The most reliable way is to ensure GAPI client is re-initialized without a token.

            chrome.storage.local.remove('googleSheetId', () => {
                googleSheetId = null;
                USER_HAS_AUTHORIZED = false; // Crucial for GAPI re-init logic
                if (sheetStatus) {
                    sheetStatus.textContent = "Not Connected. Enter Google Sheet Link/ID and click connect.";
                    sheetStatus.className = 'info-message';
                }
                if (sheetUrlInput) sheetUrlInput.value = '';
                if (connectSheetBtn) connectSheetBtn.style.display = 'inline-block';
                if (disconnectSheetBtn) disconnectSheetBtn.style.display = 'none';
                if (exportToSheetBtn) exportToSheetBtn.style.display = 'none';
                if (importFromSheetBtn) importFromSheetBtn.style.display = 'none';
                showInfoMessage("Disconnected from Google Sheet.", "success", 3000, document);
                // Potentially clear any loaded sheet data from UI if necessary
                // And reset/re-initialize GAPI client if it's active
                if (typeof gapi !== 'undefined' && gapi.client) {
                    // This is a simplified approach; GAPI might require more specific handling
                    // to truly "sign out" or clear its active token.
                    // For now, our internal USER_HAS_AUTHORIZED flag will prevent further GAPI calls.
                    console.log("GAPI client might need to be re-initialized or token explicitly cleared if library supports it.");
                }
            });
        });
    }

    // Load Sheet ID on startup and check auth
    chrome.storage.local.get(['googleSheetId'], function(result) {
        if (result.googleSheetId) {
            const loadedSheetId = result.googleSheetId;
            if (sheetUrlInput) sheetUrlInput.value = loadedSheetId; // Pre-fill input

            // Try to get token silently
            showLoadingState(false, connectSheetBtn); // Show loading for silent auth attempt
            chrome.identity.getAuthToken({ interactive: false }, function(token) {
                if (chrome.runtime.lastError || !token) {
                    console.log("Silent auth failed or no token. User needs to connect manually.");
                    USER_HAS_AUTHORIZED = false;
                    currentAuthToken = null;
                    if (sheetStatus) {
                        sheetStatus.textContent = `Previously connected to ${loadedSheetId.substring(0,10)}... Click Connect.`;
                        sheetStatus.className = 'info-message warn';
                    }
                    if (connectSheetBtn) connectSheetBtn.style.display = 'inline-block';
                    if (disconnectSheetBtn) disconnectSheetBtn.style.display = 'none';
                    if (exportToSheetBtn) exportToSheetBtn.style.display = 'none';
                    if (importFromSheetBtn) importFromSheetBtn.style.display = 'none';
                    hideLoadingState(); // Hide loading if silent auth failed
                } else {
                    console.log("Silent auth successful.");
                    currentAuthToken = token;
                    USER_HAS_AUTHORIZED = true;
                    googleSheetId = loadedSheetId; // Set global
                    if (sheetStatus) {
                        sheetStatus.innerHTML = `Fetching title for Sheet ID: ${googleSheetId.substring(0,10)}...`;
                        sheetStatus.className = 'info-message info';
                    }
                    if (connectSheetBtn) connectSheetBtn.style.display = 'none';
                    if (disconnectSheetBtn) disconnectSheetBtn.style.display = 'inline-block';
                    if (exportToSheetBtn) exportToSheetBtn.style.display = 'inline-block';
                    if (importFromSheetBtn) importFromSheetBtn.style.display = 'inline-block';

                    initializeGapiClientAndLoadSheetData().then(() => {
                        getSpreadsheetTitle(googleSheetId, (title, error) => {
                             if (sheetStatus) {
                                if (error) {
                                    console.warn("Failed to fetch spreadsheet title on load:", error);
                                    sheetStatus.innerHTML = `Connected to Sheet ID: ${googleSheetId}`;
                                } else {
                                    sheetStatus.innerHTML = `Connected to: <a href="https://docs.google.com/spreadsheets/d/${googleSheetId}" target="_blank">${title}</a>`;
                                }
                                sheetStatus.className = 'info-message success';
                             }
                        });
                    }).catch(err => {
                        if (sheetStatus) {
                           sheetStatus.innerHTML = `Error initializing. Connected to Sheet ID: ${googleSheetId}`; // Fallback on init error
                           sheetStatus.className = 'info-message error';
                        }
                        console.error("Error during GAPI init or title fetch on load:", err);
                    }).finally(() => {
                        hideLoadingState();
                    });
                }
            });
        } else {
            if (sheetStatus) sheetStatus.textContent = "Not Connected. Enter Google Sheet Link/ID and click connect.";
            USER_HAS_AUTHORIZED = false;
        }
    });

    // --- Import/Export Event Listeners ---
    if (exportToSheetBtn) {
        exportToSheetBtn.addEventListener('click', () => {
            if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
                showInfoMessage("Not connected to a configured sheet. Please connect and try again.", "error", 4000, document);
                return;
            }
            if (!currentAuthToken) {
                showInfoMessage("Authorization token is missing. Please reconnect.", "error", 4000, document);
                return;
            }

            if (!confirm("This will overwrite all tasks in the 'Active List' sheet with your current local tasks. Are you sure?")) {
                return;
            }

            setToken(currentAuthToken); // Ensure GAPI client has the latest token
            showInfoMessage("Exporting tasks to sheet...", "info", 0, document); // Persistent message

            getTasks(async (localTasks) => {
                // Clear the sheet first (keeping headers)
                clearSheet(googleSheetId, ACTIVE_LIST_SHEET_NAME, activeListHeaders, (clearResponse, clearError) => {
                    if (clearError) {
                        console.error("Error clearing sheet for export:", clearError.message || clearError);
                        showInfoMessage(`Error clearing sheet: ${clearError.message || 'Unknown error'}`, "error", 5000, document);
                        return;
                    }
                    console.log("'Active List' sheet cleared, headers preserved.");

                    if (!localTasks || localTasks.length === 0) {
                        showInfoMessage("No local tasks to export. Sheet is now empty (except headers).", "success", 4000, document);
                        renderManagerTasks(); // Refresh view if it was showing something
                        return;
                    }

                    const allSheetRows = localTasks.map(task => _mapTaskToSheetRow(task, activeListHeaders));

                    // Use updateRows to write all data starting from A2
                    updateRows(googleSheetId, ACTIVE_LIST_SHEET_NAME, "A2", allSheetRows, (updateResponse, updateError) => {
                        if (updateError) {
                            console.error("Error exporting tasks to sheet:", updateError.message || updateError);
                            showInfoMessage(`Error exporting tasks: ${updateError.message || 'Unknown error'}`, "error", 5000, document);
                        } else {
                            console.log("Tasks exported to sheet successfully:", updateResponse);
                            showInfoMessage("All local tasks exported to 'Active List' sheet.", "success", 4000, document);
                        }
                    });
                });
            });
        });
    }

    if (importFromSheetBtn) {
        importFromSheetBtn.addEventListener('click', () => {
            if (!USER_HAS_AUTHORIZED || !googleSheetId || !activeListSheetId || !activeListHeaders || activeListHeaders.length === 0) {
                showInfoMessage("Not connected to a configured sheet. Please connect and try again.", "error", 4000, document);
                return;
            }
            if (!currentAuthToken) {
                showInfoMessage("Authorization token is missing. Please reconnect.", "error", 4000, document);
                return;
            }

            if (!confirm("This will overwrite all your local tasks with tasks from the 'Active List' sheet. Are you sure?")) {
                return;
            }

            setToken(currentAuthToken); // Ensure GAPI client has the latest token
            showInfoMessage("Importing tasks from sheet...", "info", 0, document); // Persistent message

            getRows(googleSheetId, ACTIVE_LIST_SHEET_NAME, async (sheetRows, error) => {
                if (error) {
                    console.error("Error importing tasks from sheet:", error.message || error);
                    showInfoMessage(`Error importing tasks: ${error.message || 'Unknown error'}`, "error", 5000, document);
                    return;
                }

                if (!sheetRows || sheetRows.length === 0) {
                    showInfoMessage("No data found in 'Active List' sheet to import.", "warn", 4000, document);
                    // Optionally, clear local tasks if sheet is empty and user confirms
                    if (confirm("The sheet is empty. Do you want to clear all your local tasks as well?")) {
                        saveTasks([], (saveSuccess) => {
                            if (saveSuccess) {
                                renderManagerTasks();
                                showInfoMessage("Local tasks cleared to match empty sheet.", "success", 3000, document);
                            } else {
                                showInfoMessage("Failed to clear local tasks.", "error", 3000, document);
                            }
                        });
                    }
                    return;
                }

                // Check if the first row is headers and slice it off
                const taskDataRows = (sheetRows[0].join('') === activeListHeaders.join('')) ? sheetRows.slice(1) : sheetRows;

                if (taskDataRows.length === 0) {
                     showInfoMessage("Sheet contains only headers or no tasks. No tasks imported.", "info", 4000, document);
                     // Consider clearing local tasks similar to above if desired
                    if (confirm("The sheet has no task data (only headers or empty). Do you want to clear all your local tasks as well?")) {
                        saveTasks([], (saveSuccess) => {
                            if (saveSuccess) {
                                renderManagerTasks();
                                showInfoMessage("Local tasks cleared as sheet has no task data.", "success", 3000, document);
                            } else {
                                showInfoMessage("Failed to clear local tasks.", "error", 3000, document);
                            }
                        });
                    }
                    return;
                }

                const importedTasks = taskDataRows.map(row => _mapSheetRowToTask(row, activeListHeaders));

                // Before saving, ensure displayOrder is coherent or re-assign
                // For simplicity, we'll trust the sheet's order or re-evaluate if needed.
                // The _mapSheetRowToTask should handle 'Display Order' string to int conversion.
                // We might need to re-sort or ensure displayOrder is not undefined.
                importedTasks.forEach((task, index) => {
                    if (task.displayOrder === undefined || task.displayOrder === null || isNaN(task.displayOrder)) {
                        // A basic strategy: if displayOrder is missing or invalid, use array index.
                        // More sophisticated would be to group by priority then assign.
                        task.displayOrder = index;
                    }
                });


                saveTasks(importedTasks, (success) => {
                    if (success) {
                        renderManagerTasks(); // Update the UI with imported tasks
                        showInfoMessage("Tasks imported successfully from 'Active List' sheet.", "success", 4000, document);
                    } else {
                        showInfoMessage("Failed to save imported tasks locally.", "error", 5000, document);
                    }
                });
            });
        });
    }
});


function renderManagerTasks() {
    getTasks(allTasks => {
        const criticalListElement = document.getElementById('critical-tasks-list');
        const importantListElement = document.getElementById('important-tasks-list');
        const somedayListElement = document.getElementById('someday-tasks-list');

        if (!criticalListElement || !importantListElement || !somedayListElement) {
            console.error("One or more task list elements not found in manager.html.");
            return;
        }

        // Filter tasks by priority
        const criticalTasks = allTasks.filter(task => task.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const importantTasks = allTasks.filter(task => task.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const somedayTasks = allTasks.filter(task => task.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        // Clear existing tasks in all columns
        criticalListElement.innerHTML = '';
        importantListElement.innerHTML = '';
        somedayListElement.innerHTML = '';

        const renderColumn = (tasks, columnElement, priorityName) => {
            if (tasks.length === 0) {
                columnElement.innerHTML = `<p style="text-align:center; color:#777;">No ${priorityName.toLowerCase()} tasks.</p>`;
                return;
            }

            tasks.forEach((task, index) => {
                const taskItem = document.createElement('div');
                taskItem.classList.add('task-item', `priority-${task.priority}`);
                if (task.completed) {
                    taskItem.classList.add('task-completed-edit');
                }
                taskItem.setAttribute('data-task-id', task.id);
                taskItem.setAttribute('data-task-priority', task.priority); // Store priority for move logic
                taskItem.setAttribute('draggable', 'true');

                const titleSpan = document.createElement('span');
                titleSpan.classList.add('task-title');
                if (task.url) {
                    const link = document.createElement('a');
                    link.href = task.url;
                    link.textContent = task.title;
                    link.target = '_blank';
                    titleSpan.appendChild(link);
                } else {
                    titleSpan.textContent = task.title;
                }
                taskItem.appendChild(titleSpan);

                if (task.priority === 'CRITICAL' && task.deadline) {
                    const deadlineSpan = document.createElement('span');
                    deadlineSpan.classList.add('task-deadline-display');
                    const today = new Date(); today.setHours(0,0,0,0);
                    const parts = task.deadline.split('-');
                    const deadlineDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
                    deadlineDate.setHours(0,0,0,0);
                    const timeDiff = deadlineDate.getTime() - today.getTime();
                    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                    let deadlineText = ''; let deadlineClass = '';
                    if (dayDiff > 0) { deadlineText = `${dayDiff} day${dayDiff > 1 ? 's' : ''} left`; deadlineClass = 'deadline-future'; }
                    else if (dayDiff === 0) { deadlineText = 'TODAY'; deadlineClass = 'deadline-today'; }
                    else { deadlineText = `${Math.abs(dayDiff)} day${Math.abs(dayDiff) > 1 ? 's' : ''} OVERDUE`; deadlineClass = 'deadline-overdue'; }
                    deadlineSpan.textContent = ` (${deadlineText})`;
                    deadlineSpan.classList.add(deadlineClass);
                    taskItem.appendChild(deadlineSpan);
                }

                const buttonContainer = document.createElement('div');
                buttonContainer.classList.add('task-item-actions');

                // Move Up button: only if not the first in its column
                if (index > 0) {
                    const moveUpButton = document.createElement('button');
                    moveUpButton.innerHTML = '&uarr;';
                    moveUpButton.classList.add('neumorphic-btn', 'move-task-up-btn');
                    moveUpButton.title = "Move Up";
                    moveUpButton.setAttribute('data-task-id', task.id);
                    buttonContainer.appendChild(moveUpButton);
                }

                // Move Down button: only if not the last in its column
                if (index < tasks.length - 1) {
                    const moveDownButton = document.createElement('button');
                    moveDownButton.innerHTML = '&darr;';
                    moveDownButton.classList.add('neumorphic-btn', 'move-task-down-btn');
                    moveDownButton.title = "Move Down";
                    moveDownButton.setAttribute('data-task-id', task.id);
                    buttonContainer.appendChild(moveDownButton);
                }
                taskItem.appendChild(buttonContainer);

                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.classList.add('neumorphic-btn', 'edit-task-btn-list');
                editButton.setAttribute('data-task-id', task.id);
                taskItem.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('neumorphic-btn', 'delete-task-btn-list');
                deleteButton.setAttribute('data-task-id', task.id);
                taskItem.appendChild(deleteButton);

                columnElement.appendChild(taskItem);
            });
        };

        renderColumn(criticalTasks, criticalListElement, 'Critical');
        renderColumn(importantTasks, importantListElement, 'Important');
        renderColumn(somedayTasks, somedayListElement, 'Someday');
    });
}

// --- Event Listeners Setup (Deletion, Inline Editing, Drag&Drop, Move Buttons) ---
// These will be very similar to those in popup.js for the 'edit' tab.
// For brevity, I'll define a setup function and assume the helper functions
// (like handleMoveTask, setupDragAndDropListeners etc.) will be adapted or
// made available from task_utils.js or defined within manager.js if specific.

let originalTaskDataBeforeEditManager = null; // Scope to manager.js
let draggedTaskElementManager = null; // Scope to manager.js

function setupManagerEventListeners() {
    // Adjusted to query all three columns for attaching listeners,
    // or delegate from a common parent like 'tasks-display-area'.
    // For simplicity, let's assume listeners are attached to each column list
    // or a common ancestor. If events are delegated from tasks-display-area:
    const tasksDisplayArea = document.querySelector('.tasks-display-area');
    if (!tasksDisplayArea) {
        // Fallback or alternative: query each list individually if tasksDisplayArea is not a suitable parent for delegation
        const criticalList = document.getElementById('critical-tasks-list');
        const importantList = document.getElementById('important-tasks-list');
        const somedayList = document.getElementById('someday-tasks-list');
        if (criticalList) setupListenersForList(criticalList);
        if (importantList) setupListenersForList(importantList);
        if (somedayList) setupListenersForList(somedayList);
        return; // Exit if primary delegation target isn't found
    }

    // Consolidated event listeners on the parent tasksDisplayArea
    // This requires event handlers to correctly identify the target list/task.

    // Deletion Listener (Delegated)
    tasksDisplayArea.addEventListener('click', async function(event) {
        if (event.target.matches('.delete-task-btn-list')) {
            const taskItem = event.target.closest('.task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId) return;
            if (!confirm("Are you sure you want to delete this task?")) return;

            const success = await deleteTask(taskId);
            if (success) {
                showInfoMessage("Task deleted successfully.", "success", 3000, document);
                renderManagerTasks();
            } else {
                showInfoMessage("Failed to delete task.", "error", 3000, document);
            }
        }
    });

    // Inline Editing Listener (Delegated)
    tasksDisplayArea.addEventListener('click', async function(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');

        // Cancel logic for any ongoing edit
        const allEditingForms = tasksDisplayArea.querySelectorAll('.inline-edit-form');
        allEditingForms.forEach(form => {
            if (form.closest('.task-item') !== taskItem || !target.matches('.edit-task-btn-list')) { // if click is outside the form's task item or not an edit button
                 const cancelBtn = form.querySelector('.cancel-inline-btn');
                 if(cancelBtn && (!taskItem || !taskItem.contains(form) || target.matches('.edit-task-btn-list') && taskItem !== form.closest('.task-item'))){
                    // cancel if clicking another edit, or outside an active edit form
                    cancelBtn.click();
                 }
            }
        });

        if (target.matches('.edit-task-btn-list')) {
            if (!taskItem || taskItem.classList.contains('editing-task-item')) return;

            const taskId = taskItem.getAttribute('data-task-id');
            const task = await getTaskById(taskId);
            if (!task) return;

            originalTaskDataBeforeEditManager = { ...task };
            taskItem.classList.add('editing-task-item');
            // Hide view elements, show form (condensed version of popup.js logic)
            taskItem.querySelectorAll('.task-title, .task-deadline-display, .task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = 'none');

            // Simplified form structure for manager page
            let formHtml = `
                <div class="inline-edit-form">
                    <div class="form-group-inline"><label>Title:</label><input type="text" class="neumorphic-input edit-task-title" value="${task.title}"></div>
                    <div class="form-group-inline"><label>URL:</label><input type="url" class="neumorphic-input edit-task-url" value="${task.url || ''}"></div>
                    <div class="form-group-inline"><label>Priority:</label><select class="neumorphic-select edit-task-priority">
                        <option value="SOMEDAY" ${task.priority === 'SOMEDAY' ? 'selected' : ''}>Someday</option>
                        <option value="IMPORTANT" ${task.priority === 'IMPORTANT' ? 'selected' : ''}>Important</option>
                        <option value="CRITICAL" ${task.priority === 'CRITICAL' ? 'selected' : ''}>Critical</option>
                    </select></div>
                    <div class="form-group-inline edit-task-deadline-group" style="display: ${task.priority === 'CRITICAL' ? 'block' : 'none'};"><label>Deadline:</label><input type="date" class="neumorphic-input edit-task-deadline" value="${task.deadline || ''}"></div>
                    <div class="form-group-inline"><label>Type:</label><select class="neumorphic-select edit-task-type">
                        <option value="home" ${task.type === 'home' ? 'selected' : ''}>Home</option>
                        <option value="work" ${task.type === 'work' ? 'selected' : ''}>Work</option>
                    </select></div>
                    <div class="form-group-inline form-group-inline-checkbox"><label>Completed:</label><input type="checkbox" class="edit-task-completed" ${task.completed ? 'checked' : ''}></div>
                    <div class="inline-edit-actions"><button class="neumorphic-btn save-inline-btn">Save</button><button class="neumorphic-btn cancel-inline-btn">Cancel</button></div>
                </div>`;
            taskItem.insertAdjacentHTML('beforeend', formHtml);

            const prioritySelect = taskItem.querySelector('.edit-task-priority');
            const deadlineGroup = taskItem.querySelector('.edit-task-deadline-group');
            if (prioritySelect && deadlineGroup) {
                prioritySelect.addEventListener('change', function() {
                    deadlineGroup.style.display = this.value === 'CRITICAL' ? 'block' : 'none';
                    if (this.value !== 'CRITICAL') {
                        const deadlineInput = deadlineGroup.querySelector('.edit-task-deadline');
                        if(deadlineInput) deadlineInput.value = '';
                    }
                });
            }
        }

        if (target.matches('.cancel-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            if (!taskItem || !originalTaskDataBeforeEditManager) return;
            taskItem.classList.remove('editing-task-item');
            const form = taskItem.querySelector('.inline-edit-form');
            if (form) form.remove();
            taskItem.querySelectorAll('.task-title, .task-deadline-display, .task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = '');
            originalTaskDataBeforeEditManager = null;
        }

        if (target.matches('.save-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId || !originalTaskDataBeforeEditManager) return;

            const editForm = taskItem.querySelector('.inline-edit-form');
            const updatedTask = { ...originalTaskDataBeforeEditManager }; // Start with original data

            updatedTask.title = editForm.querySelector('.edit-task-title').value.trim();
            updatedTask.url = editForm.querySelector('.edit-task-url').value.trim();
            updatedTask.priority = editForm.querySelector('.edit-task-priority').value;
            updatedTask.deadline = editForm.querySelector('.edit-task-deadline').value;
            updatedTask.type = editForm.querySelector('.edit-task-type').value;
            updatedTask.completed = editForm.querySelector('.edit-task-completed').checked;

            if (!updatedTask.title) {
                showInfoMessage("Task title cannot be empty.", "error", 3000, document); return;
            }
            if (updatedTask.priority === 'CRITICAL' && !updatedTask.deadline) {
                showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document); return;
            }
            if (updatedTask.priority !== 'CRITICAL') {
                updatedTask.deadline = null;
            }

            const success = await updateTask(updatedTask);
            if (success) {
                taskItem.classList.remove('editing-task-item');
                if(editForm) editForm.remove();
                taskItem.querySelectorAll('.task-title, .task-deadline-display, .task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = '');
                originalTaskDataBeforeEditManager = null;
                renderManagerTasks();
                showInfoMessage("Task updated successfully!", "success", 3000, document);
            } else {
                showInfoMessage("Failed to update task.", "error", 3000, document);
            }
        }
    });

    // Drag and Drop Listener (Delegated from .tasks-display-area)
    tasksDisplayArea.addEventListener('dragstart', function(event) {
        const taskItem = event.target.closest('.task-item');
        if (taskItem && taskItem.getAttribute('draggable')) {
            const editingForm = taskItem.querySelector('.inline-edit-form');
            if (editingForm) {
                const cancelButton = editingForm.querySelector('.cancel-inline-btn');
                if (cancelButton) cancelButton.click();
            }
            draggedTaskElementManager = taskItem;
            event.dataTransfer.setData('text/plain', taskItem.getAttribute('data-task-id'));
            taskItem.style.opacity = '0.5';
        }
    });
    tasksDisplayArea.addEventListener('dragover', function(event) { event.preventDefault(); });
    tasksDisplayArea.addEventListener('drop', async function(event) {
        event.preventDefault();
        if (!draggedTaskElementManager) return;

        const targetTaskElement = event.target.closest('.task-item');
        const targetListElement = event.target.closest('.task-list');
        draggedTaskElementManager.style.opacity = '1';

        if (!targetListElement) { // Dropped outside a valid list
            draggedTaskElementManager = null;
            return;
        }

        const draggedTaskPriority = draggedTaskElementManager.getAttribute('data-task-priority');
        const targetListPriority = targetListElement.id.split('-')[0].toUpperCase(); // e.g., "critical" from "critical-tasks-list"

        getTasks(tasks => {
            const draggedTaskObj = tasks.find(t => t.id === draggedTaskElementManager.getAttribute('data-task-id'));
            if (!draggedTaskObj) { draggedTaskElementManager = null; return; }

            let displayOrderChanged = false;

            if (targetTaskElement && targetTaskElement !== draggedTaskElementManager && targetTaskElement.getAttribute('data-task-priority') === draggedTaskPriority) {
                // Dropped on another task within the same priority column
                const taskElementsInColumn = Array.from(targetListElement.querySelectorAll('.task-item'));
                const draggedIndexInDOM = taskElementsInColumn.indexOf(draggedTaskElementManager);
                const targetIndexInDOM = taskElementsInColumn.indexOf(targetTaskElement);

                if (draggedIndexInDOM < targetIndexInDOM) {
                    targetTaskElement.parentNode.insertBefore(draggedTaskElementManager, targetTaskElement.nextSibling);
                } else {
                    targetTaskElement.parentNode.insertBefore(draggedTaskElementManager, targetTaskElement);
                }
            } else if (!targetTaskElement && draggedTaskPriority !== targetListPriority) {
                // Dropped into an empty space of a DIFFERENT priority column (priority change)
                targetListElement.appendChild(draggedTaskElementManager);
                draggedTaskObj.priority = targetListPriority;
                draggedTaskElementManager.setAttribute('data-task-priority', targetListPriority);
                // Update class for styling
                draggedTaskElementManager.className = 'task-item'; // Reset classes
                draggedTaskElementManager.classList.add(`priority-${targetListPriority}`);
                if (draggedTaskObj.completed) draggedTaskElementManager.classList.add('task-completed-edit');

                displayOrderChanged = true; // Priority change implies order change
            } else if (!targetTaskElement) {
                 // Dropped into an empty space of the SAME priority column
                targetListElement.appendChild(draggedTaskElementManager);
            } else {
                // Other cases, like dropping on itself or invalid target
                draggedTaskElementManager = null;
                return;
            }

            // Update displayOrder for all tasks in all columns
            ['critical', 'important', 'someday'].forEach(pName => {
                const listEl = document.getElementById(`${pName}-tasks-list`);
                const itemsInList = Array.from(listEl.querySelectorAll('.task-item'));
                itemsInList.forEach((item, index) => {
                    const task = tasks.find(t => t.id === item.getAttribute('data-task-id'));
                    if (task && (task.displayOrder !== index || task.priority !== pName.toUpperCase())) {
                        task.displayOrder = index;
                        task.priority = pName.toUpperCase(); // Ensure priority is updated if moved column
                        displayOrderChanged = true;
                    }
                });
            });

            if (displayOrderChanged) {
                saveTasks(tasks, (success) => {
                    if (success) showInfoMessage("Task order/priority updated.", "success", 3000, document);
                    else showInfoMessage("Failed to save new task order/priority.", "error", 3000, document);
                    renderManagerTasks(); // Always re-render to ensure consistency
                });
            }
            draggedTaskElementManager = null;
        });
    });
    tasksDisplayArea.addEventListener('dragend', function() {
        if (draggedTaskElementManager) draggedTaskElementManager.style.opacity = '1';
        draggedTaskElementManager = null;
    });

    // Move Up/Down Button Listeners (Delegated)
    tasksDisplayArea.addEventListener('click', async function(event) {
        const target = event.target;
        let taskId = null;
        let direction = null;

        const moveUpBtn = target.closest('.move-task-up-btn');
        const moveDownBtn = target.closest('.move-task-down-btn');

        if (moveUpBtn) { taskId = moveUpBtn.getAttribute('data-task-id'); direction = 'up';}
        else if (moveDownBtn) { taskId = moveDownBtn.getAttribute('data-task-id'); direction = 'down'; }

        if (taskId && direction) {
            const currentlyEditing = tasksDisplayArea.querySelector('.editing-task-item'); // Check within the whole area
            if (currentlyEditing) {
                showInfoMessage("Please save or cancel current edit before reordering.", "info", 3000, document);
                return;
            }
            await handleManagerMoveTask(taskId, direction);
        }
    });
}

async function handleManagerMoveTask(taskId, direction) {
    getTasks(allTasks => { // Changed 'tasks' to 'allTasks' for clarity
        const taskToMove = allTasks.find(t => t.id === taskId);
        if (!taskToMove) {
            showInfoMessage("Error: Task to move not found.", "error", 3000, document);
            return;
        }
        const currentPriority = taskToMove.priority;
        const sortedSamePriorityTasks = allTasks
            .filter(t => t.priority === currentPriority)
            .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        const currentIndexInLane = sortedSamePriorityTasks.findIndex(t => t.id === taskId);

        let targetIndexInLane = -1;
        if (direction === 'up' && currentIndexInLane > 0) {
            targetIndexInLane = currentIndexInLane - 1;
        } else if (direction === 'down' && currentIndexInLane < sortedSamePriorityTasks.length - 1) {
            targetIndexInLane = currentIndexInLane + 1;
        } else {
            console.warn("Cannot move task further in this direction or invalid index.");
            return; // Cannot move
        }

        const taskToSwapWithId = sortedSamePriorityTasks[targetIndexInLane].id;
        // Find the actual task objects from the main allTasks array to modify them
        const originalTaskToMove = allTasks.find(t => t.id === taskToMove.id); // Already have taskToMove, but ensure it's from allTasks
        const taskToSwapWith = allTasks.find(t => t.id === taskToSwapWithId);

        if (!originalTaskToMove || !taskToSwapWith) {
            showInfoMessage("Error finding tasks to swap in the main list.", "error", 3000, document);
            return;
        }

        // Swap displayOrder
        const tempDisplayOrder = originalTaskToMove.displayOrder;
        originalTaskToMove.displayOrder = taskToSwapWith.displayOrder;
        taskToSwapWith.displayOrder = tempDisplayOrder;

        saveTasks(allTasks, (success, errorMsg) => {
            if (success) {
                showInfoMessage(`Task moved ${direction}.`, "success", 3000, document);
            } else {
                showInfoMessage(`Failed to save order: ${errorMsg || 'Unknown error'}`, "error", 3000, document);
                // Revert in-memory change before re-render
                taskToSwapWith.displayOrder = taskToMove.displayOrder;
                taskToMove.displayOrder = tempDisplayOrder;
            }
            renderManagerTasks(); // Re-render to reflect changes or reverted state
        });
    });
}
