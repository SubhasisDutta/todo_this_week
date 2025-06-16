// Google Sheets Utility Functions
// Placeholder for API Key - Replace with your actual API Key
const API_KEY = 'YOUR_API_KEY_PLACEHOLDER';
// Client ID is managed via manifest.json for Chrome extensions,
// but GAPI client init might still take it or it's implicitly used by GIS.
const CLIENT_ID = 'YOUR_CHROME_EXTENSION_CLIENT_ID_PLACEHOLDER'; // Usually from manifest

const ACTIVE_LIST_SHEET_NAME = "Active List";
const DELETED_SHEET_NAME = "Deleted";

const ACTIVE_LIST_HEADERS = ["Task ID", "Title", "URL", "Priority", "Deadline", "Type", "Completed", "Display Order", "Last Modified"];
const DELETED_LIST_HEADERS = ["Task ID", "Title", "URL", "Priority", "Deadline", "Type", "Completed", "Display Order", "Last Modified", "Date Deleted"];

let tokenClient; // For Google Identity Services (GIS)

/**
 * Initializes the Google API client library.
 * @param {function} callback - Called with true on success, false on failure.
 */
async function initializeGapiClient(callback) {
    try {
        await new Promise((resolve) => gapi.load('client', resolve));
        await gapi.client.init({
            apiKey: API_KEY, // IMPORTANT: Replace with your actual API Key
            discoveryDocs: ["https://sheets.googleapis.com/$discovery/rest?version=v4"],
        });

        // Initialize the GIS token client
        // The client_id comes from your Google Cloud Console credentials for the extension
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID, // IMPORTANT: Ensure this matches your extension's OAuth client ID from manifest
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: '', // Callback will be set dynamically per request or handled by `chrome.identity`
        });
        console.log("GAPI client and GIS token client initialized.");
        if (callback) callback(true);
    } catch (error) {
        console.error("Error initializing GAPI client:", error);
        if (callback) callback(false);
    }
}

/**
 * Fetches the title of the spreadsheet.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {function} callback - Called with (title, error).
 */
async function getSpreadsheetTitle(spreadsheetId, callback) {
    if (!gapi || !gapi.client || !gapi.client.sheets) {
        console.error("GAPI client or Sheets API not loaded for getSpreadsheetTitle.");
        if (callback) callback(null, new Error("GAPI client or Sheets API not loaded."));
        return;
    }
    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'properties(title)',
        });
        if (callback) callback(response.result.properties.title, null);
    } catch (error) {
        console.error("Error fetching spreadsheet title:", error);
        if (callback) callback(null, error);
    }
}

/**
 * Sets the access token for GAPI client.
 * @param {string} token - The OAuth2 access token.
 */
function setToken(token) {
    if (gapi && gapi.client) {
        gapi.client.setToken({ access_token: token });
        console.log("Access token set for GAPI client.");
    } else {
        console.error("GAPI client not available to set token.");
    }
}

/**
 * Ensures that the required sheets ("Active List", "Deleted") exist and have headers.
 * Creates them and adds headers if they don't.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {function} callback - Called with sheetInfo object or an error.
 *                             sheetInfo = { activeListSheetId, deletedSheetId, activeListTitle, deletedTitle, activeListHeaders, deletedListHeaders }
 */
async function ensureSheetsExist(spreadsheetId, callback) {
    if (!gapi || !gapi.client || !gapi.client.sheets) {
        console.error("GAPI client or Sheets API not loaded.");
        if (callback) callback(null, new Error("GAPI client or Sheets API not loaded."));
        return;
    }

    try {
        const response = await gapi.client.sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
            fields: 'sheets(properties(title,sheetId))',
        });

        const sheets = response.result.sheets;
        let activeListSheet = sheets.find(sheet => sheet.properties.title === ACTIVE_LIST_SHEET_NAME);
        let deletedSheet = sheets.find(sheet => sheet.properties.title === DELETED_SHEET_NAME);

        const requests = [];
        let createdActiveList = false;
        let createdDeletedList = false;

        if (!activeListSheet) {
            requests.push({ addSheet: { properties: { title: ACTIVE_LIST_SHEET_NAME } } });
            createdActiveList = true;
        }
        if (!deletedSheet) {
            requests.push({ addSheet: { properties: { title: DELETED_SHEET_NAME } } });
            createdDeletedList = true;
        }

        if (requests.length > 0) {
            const batchUpdateResponse = await gapi.client.sheets.spreadsheets.batchUpdate({
                spreadsheetId: spreadsheetId,
                resource: { requests: requests },
            });
            console.log("Sheets created/batchUpdate response:", batchUpdateResponse.result);

            // After creating sheets, we need their IDs to write headers.
            // Refresh the sheet list.
            const refreshedSheetsResponse = await gapi.client.sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId,
                fields: 'sheets(properties(title,sheetId))',
            });
            const refreshedSheets = refreshedSheetsResponse.result.sheets;
            activeListSheet = refreshedSheets.find(sheet => sheet.properties.title === ACTIVE_LIST_SHEET_NAME);
            deletedSheet = refreshedSheets.find(sheet => sheet.properties.title === DELETED_SHEET_NAME);

            if (!activeListSheet || !deletedSheet) {
                 throw new Error("Failed to obtain sheet properties after creation.");
            }

            const headerUpdatePromises = [];
            if (createdActiveList && activeListSheet) {
                console.log(`Writing headers to newly created ${ACTIVE_LIST_SHEET_NAME} (ID: ${activeListSheet.properties.sheetId})`);
                headerUpdatePromises.push(
                    gapi.client.sheets.spreadsheets.values.append({
                        spreadsheetId: spreadsheetId,
                        range: `${ACTIVE_LIST_SHEET_NAME}!A1`,
                        valueInputOption: 'USER_ENTERED',
                        resource: { values: [ACTIVE_LIST_HEADERS] },
                    })
                );
            }
            if (createdDeletedList && deletedSheet) {
                console.log(`Writing headers to newly created ${DELETED_SHEET_NAME} (ID: ${deletedSheet.properties.sheetId})`);
                headerUpdatePromises.push(
                    gapi.client.sheets.spreadsheets.values.append({
                        spreadsheetId: spreadsheetId,
                        range: `${DELETED_SHEET_NAME}!A1`,
                        valueInputOption: 'USER_ENTERED',
                        resource: { values: [DELETED_LIST_HEADERS] },
                    })
                );
            }
            await Promise.all(headerUpdatePromises);
            console.log("Header rows written if sheets were created.");
        }

        if (!activeListSheet || !deletedSheet) {
            throw new Error("Failed to find or create required sheets even after operations.");
        }

        const sheetInfo = {
            activeListSheetId: activeListSheet.properties.sheetId,
            activeListTitle: ACTIVE_LIST_SHEET_NAME,
            deletedSheetId: deletedSheet.properties.sheetId,
            deletedTitle: DELETED_SHEET_NAME,
            activeListHeaders: ACTIVE_LIST_HEADERS,
            deletedListHeaders: DELETED_LIST_HEADERS,
        };
        console.log("Required sheets ensured and headers processed:", sheetInfo);
        if (callback) callback(sheetInfo, null);

    } catch (error) {
        console.error("Error ensuring sheets exist:", error);
        let errorMessage = "Failed to ensure sheets exist.";
        if (error.result && error.result.error && error.result.error.message) {
            errorMessage += ` Server message: ${error.result.error.message}`;
             // Check for specific permission errors which are common
            if (error.result.error.status === 'PERMISSION_DENIED') {
                errorMessage = "Permission denied. Check API Key, OAuth Scopes, and ensure Sheets API is enabled in Google Cloud Console.";
            }
        }
        if (callback) callback(null, new Error(errorMessage));
    }
}

// --- Data Mapping Functions ---

/**
 * (Private) Maps a Task object to an array of values for a sheet row.
 * @param {object} task - The task object.
 * @param {string[]} headers - The headers for the sheet (e.g., ACTIVE_LIST_HEADERS).
 * @returns {Array} An array of values corresponding to the headers.
 */
function _mapTaskToSheetRow(task, headers) {
    const now = new Date().toISOString();
    const rowMap = {
        "Task ID": task.id,
        "Title": task.title,
        "URL": task.url || "",
        "Priority": task.priority,
        "Deadline": task.deadline || "",
        "Type": task.type,
        "Completed": task.completed,
        "Display Order": task.displayOrder !== undefined ? task.displayOrder : null, // Ensure it's null if undefined
        "Last Modified": now,
        "Date Deleted": now // Only relevant for DELETED_LIST_HEADERS
    };
    return headers.map(header => rowMap[header]);
}

/**
 * (Private) Maps an array of values from a sheet row back to a Task-like object.
 * @param {Array} row - Array of values from the sheet.
 * @param {string[]} headers - The headers for the sheet.
 * @returns {object} A task-like object.
 */
function _mapSheetRowToTask(row, headers) {
    const taskData = {};
    headers.forEach((header, index) => {
        let value = row[index];
        // Basic type conversion (can be expanded)
        if (header === "Completed" && typeof value === 'string') {
            value = value.toLowerCase() === 'true';
        } else if (header === "Display Order" && typeof value === 'string' && value !== "") {
            value = parseInt(value, 10);
        } else if (value === undefined || value === null) {
            value = ""; // Or handle as per task object requirements
        }
        // Normalize header name to a JS-friendly property name
        const propName = header.replace(/ /g, '');
        taskData[propName] = value;
    });
    // Rename 'TaskID' to 'id' to match local task object structure
    if (taskData.TaskID !== undefined) {
        taskData.id = taskData.TaskID;
        delete taskData.TaskID;
    }
    return taskData;
}


// --- Core Sheet Data Functions ---

/**
 * Gets all rows from a specified sheet.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet (e.g., "Active List").
 * @param {function} callback - Called with (rows, error). 'rows' is an array of arrays.
 */
async function getRows(spreadsheetId, sheetName, callback) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: sheetName, // Fetches all data from the sheet
        });
        if (callback) callback(response.result.values || [], null);
    } catch (error) {
        console.error(`Error getting rows from ${sheetName}:`, error);
        if (callback) callback(null, error);
    }
}

/**
 * Updates multiple rows in a sheet starting from a specific cell.
 * This is useful for overwriting a block of data.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} startingCell - E.g., "A2" to start writing data from the second row.
 * @param {Array<Array>} rowsData - An array of arrays, where each inner array is a row.
 * @param {function} callback - Called with (response, error).
 */
async function updateRows(spreadsheetId, sheetName, startingCell, rowsData, callback) {
    if (!rowsData || rowsData.length === 0) {
        if (callback) callback(null, new Error("No data provided to update rows."));
        return;
    }
    try {
        const range = `${sheetName}!${startingCell}`;
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: rowsData }, // `rowsData` should be an array of arrays
        });
        if (callback) callback(response.result, null);
    } catch (error) {
        console.error(`Error updating rows in ${sheetName} starting from ${startingCell}:`, error);
        if (callback) callback(null, error);
    }
}

/**
 * Appends a new row to the specified sheet.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {Array} rowValues - An array of values for the new row.
 * @param {function} callback - Called with (response, error).
 */
async function appendRow(spreadsheetId, sheetName, rowValues, callback) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: sheetName, // Appends after the last row with data
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: { values: [rowValues] },
        });
        if (callback) callback(response.result, null);
    } catch (error) {
        console.error(`Error appending row to ${sheetName}:`, error);
        if (callback) callback(null, error);
    }
}

/**
 * Finds the 1-based index of a row by Task ID.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {string} taskId - The Task ID to search for.
 * @param {string[]} headers - The headers for this sheet.
 * @param {function} callback - Called with (rowIndex, error). rowIndex is 1-based, or -1 if not found.
 */
async function findRowIndexByTaskId(spreadsheetId, sheetName, taskId, headers, callback) {
    getRows(spreadsheetId, sheetName, (rows, error) => {
        if (error) {
            if (callback) callback(-1, error);
            return;
        }
        if (!rows || rows.length === 0) { // No data or only headers
            if (callback) callback(-1, null);
            return;
        }

        const taskIdColumnIndex = headers.indexOf("Task ID");
        if (taskIdColumnIndex === -1) {
            if (callback) callback(-1, new Error("Task ID header not found."));
            return;
        }

        // Start from 1 because row 0 is headers, data starts at row 1 (index 0 in `rows` if headers are not included, or index 1 if they are)
        // The `rows` from `getRows` usually includes headers if they are the first row.
        // Let's assume the first row IS headers if it matches `headers`
        let dataStartIndex = 0;
        if (rows.length > 0 && JSON.stringify(rows[0]) === JSON.stringify(headers)) {
            dataStartIndex = 1;
        }

        for (let i = dataStartIndex; i < rows.length; i++) {
            if (rows[i][taskIdColumnIndex] === taskId) {
                if (callback) callback(i + 1, null); // 1-based index
                return;
            }
        }
        if (callback) callback(-1, null); // Not found
    });
}

/**
 * Updates an existing row in the specified sheet.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {number} rowIndex - The 1-based index of the row to update.
 * @param {number} numCols - The number of columns in the rowValues.
 * @param {Array} rowValues - An array of new values for the row.
 * @param {function} callback - Called with (response, error).
 */
async function updateRow(spreadsheetId, sheetName, rowIndex, numCols, rowValues, callback) {
    if (rowIndex <= 0) {
        if (callback) callback(null, new Error("Row index must be 1-based."));
        return;
    }
    try {
        const range = `${sheetName}!A${rowIndex}:${String.fromCharCode(64 + numCols)}${rowIndex}`;
        const response = await gapi.client.sheets.spreadsheets.values.update({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [rowValues] },
        });
        if (callback) callback(response.result, null);
    } catch (error) {
        console.error(`Error updating row ${rowIndex} in ${sheetName}:`, error);
        if (callback) callback(null, error);
    }
}

/**
 * Deletes a row from the specified sheet using its 0-based index.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {number} sheetId - The GID of the sheet (not the name).
 * @param {number} rowIndexToDelete - The 1-based index of the row to delete.
 * @param {function} callback - Called with (response, error).
 */
async function deleteRow(spreadsheetId, sheetId, rowIndexToDelete, callback) {
     if (rowIndexToDelete <= 0) {
        if (callback) callback(null, new Error("Row index must be 1-based for deletion target."));
        return;
    }
    try {
        const requests = [{
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndexToDelete - 1, // API's startIndex is 0-based
                    endIndex: rowIndexToDelete,     // endIndex is exclusive
                },
            },
        }];
        const response = await gapi.client.sheets.spreadsheets.batchUpdate({
            spreadsheetId: spreadsheetId,
            resource: { requests: requests },
        });
        if (callback) callback(response.result, null);
    } catch (error) {
        console.error(`Error deleting row ${rowIndexToDelete} from sheetId ${sheetId}:`, error);
        if (callback) callback(null, error);
    }
}

/**
 * Clears all data from a sheet, optionally keeping headers.
 * @param {string} spreadsheetId - The ID of the spreadsheet.
 * @param {string} sheetName - The name of the sheet.
 * @param {Array|null} headersToKeep - Array of header values. If null, sheet is just cleared.
 * @param {function} callback - Called with (response, error).
 */
async function clearSheet(spreadsheetId, sheetName, headersToKeep, callback) {
    try {
        // Clear the entire sheet first
        const clearResponse = await gapi.client.sheets.spreadsheets.values.clear({
            spreadsheetId: spreadsheetId,
            range: sheetName, // Clears all cells in the sheet
        });
        console.log(`Sheet ${sheetName} cleared. Response:`, clearResponse.result);

        if (headersToKeep && headersToKeep.length > 0) {
            // If headers are provided, append them back
            appendRow(spreadsheetId, sheetName, headersToKeep, (appendResp, appendErr) => {
                if (appendErr) {
                     console.error(`Error re-adding headers to ${sheetName} after clear:`, appendErr);
                    if (callback) callback(null, appendErr); // Report the append error
                } else {
                    console.log(`Headers re-added to ${sheetName}.`);
                    if (callback) callback(appendResp, null); // Report success of append
                }
            });
        } else {
            // If no headers to keep, the clear operation is the final one
            if (callback) callback(clearResponse.result, null);
        }
    } catch (error) {
        console.error(`Error clearing sheet ${sheetName}:`, error);
        if (callback) callback(null, error);
    }
}
