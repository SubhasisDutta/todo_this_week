// events.js — Event Notes module for the Weekly Task Manager
// Events are lightweight items (appointments, errands) distinct from tasks.
// They have no completion status, auto-expire after their time block passes,
// and support recurrence.

// --- Event Data Structure ---
class EventNote {
    constructor(
        id,
        title,
        notes = '',
        createdAt = null,
        recurrence = null,   // null | 'daily' | 'weekly' | 'monthly'
        colorCode = null,    // null | 'red' | 'blue' | 'green' | 'purple' | 'orange'
        schedule = []        // [{ day, blockId, expiresAt }]
    ) {
        this.id = id || `event_${new Date().getTime()}_${Math.random().toString(36).substring(2, 11)}`;
        this.title = title;
        this.notes = notes;
        this.createdAt = createdAt || new Date().toISOString();
        this.recurrence = recurrence;
        this.colorCode = colorCode;
        this.schedule = schedule;
    }
}

// --- CRUD Operations ---

function getEvents(callback) {
    chrome.storage.local.get({ eventNotes: [] }, (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting events:", chrome.runtime.lastError.message || chrome.runtime.lastError);
            callback([]);
        } else {
            const events = result.eventNotes.map(data => {
                const event = Object.assign(new EventNote(data.id, ''), data);
                // Backfill missing fields
                if (typeof event.notes === 'undefined') event.notes = '';
                if (typeof event.createdAt === 'undefined') event.createdAt = new Date().toISOString();
                if (typeof event.recurrence === 'undefined') event.recurrence = null;
                if (typeof event.colorCode === 'undefined') event.colorCode = null;
                if (typeof event.schedule === 'undefined') event.schedule = [];
                // Backfill schedule items
                event.schedule.forEach(item => {
                    if (typeof item.expiresAt === 'undefined') item.expiresAt = null;
                });
                return event;
            });
            callback(events);
        }
    });
}

function getEventsAsync() {
    return new Promise(resolve => getEvents(resolve));
}

function saveEvents(events, callback) {
    const plainEvents = JSON.parse(JSON.stringify(events));
    chrome.storage.local.set({ eventNotes: plainEvents }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving events:", chrome.runtime.lastError.message);
            if (callback) callback(false, chrome.runtime.lastError.message);
        } else {
            if (callback) callback(true);
        }
    });
}

function saveEventsAsync(events) {
    return new Promise((resolve, reject) => {
        saveEvents(events, (success, errorMsg) => {
            if (success) resolve(true);
            else reject(new Error(errorMsg || "Failed to save events"));
        });
    });
}

async function addNewEvent(title, notes, recurrence, colorCode) {
    const events = await getEventsAsync();
    const event = new EventNote(null, title, notes || '', null, recurrence || null, colorCode || null, []);
    events.push(event);
    await saveEventsAsync(events);
    return event;
}

async function getEventById(eventId) {
    const events = await getEventsAsync();
    return events.find(e => e.id === eventId);
}

async function updateEvent(updatedEvent) {
    const events = await getEventsAsync();
    const index = events.findIndex(e => e.id === updatedEvent.id);
    if (index === -1) return false;
    events[index] = updatedEvent;
    await saveEventsAsync(events);
    return true;
}

async function deleteEvent(eventId) {
    const events = await getEventsAsync();
    const filtered = events.filter(e => e.id !== eventId);
    if (filtered.length === events.length) return false;
    await saveEventsAsync(filtered);
    return true;
}

function duplicateEvent(event) {
    return new EventNote(
        null,
        event.title,
        event.notes || '',
        null,
        event.recurrence,
        event.colorCode,
        []  // Empty schedule — duplicate goes to Parking Lot
    );
}

// --- Operation Queue ---
let _eventOperationQueue = Promise.resolve();

function withEventLock(asyncFn) {
    _eventOperationQueue = _eventOperationQueue.then(asyncFn).catch(err => {
        console.error("Event operation error:", err);
    });
    return _eventOperationQueue;
}

// --- Recurrence ---

function createRecurringEventInstance(event) {
    return new EventNote(
        null,
        event.title,
        event.notes || '',
        null,                  // Fresh createdAt
        event.recurrence,
        event.colorCode,
        []                     // Empty schedule — goes back to Parking Lot
    );
}

// --- Expiry Logic ---

/**
 * Calculate the ISO timestamp when a time block ends on a specific calendar date.
 * @param {string} day - Day name (e.g., 'monday')
 * @param {string} blockId - Time block ID
 * @param {Array} timeBlocks - Array of time block objects
 * @param {Object} dayDates - Map of day names to Date objects for the current week
 * @returns {string|null} ISO timestamp or null if invalid
 */
function calculateEventExpiry(day, blockId, timeBlocks, dayDates) {
    const block = timeBlocks.find(b => b.id === blockId);
    if (!block) return null;

    const range = parseTimeRange(block.time);
    if (!range) return null;

    const targetDate = dayDates[day];
    if (!targetDate) return null;

    const expiryDate = new Date(targetDate);
    // Handle midnight wraparound: end=0 means next day midnight (24:00)
    const endHour = range.end === 0 ? 24 : range.end;
    expiryDate.setHours(endHour, 0, 0, 0);

    return expiryDate.toISOString();
}

/**
 * Remove expired schedule entries from events.
 * - Non-recurring events with all entries expired: delete the event entirely
 * - Recurring events with all entries expired: create next instance, delete old one
 * - Unscheduled events: left untouched
 */
async function cleanupExpiredEvents() {
    const events = await getEventsAsync();
    const now = new Date();
    let modified = false;
    const newEventsToAdd = [];
    const eventIdsToRemove = [];

    events.forEach(event => {
        if (!event.schedule || event.schedule.length === 0) return;

        const beforeLength = event.schedule.length;
        event.schedule = event.schedule.filter(item => {
            if (!item.expiresAt) return true;
            return new Date(item.expiresAt) > now;
        });

        if (event.schedule.length < beforeLength) {
            modified = true;

            // All schedule items expired
            if (event.schedule.length === 0) {
                if (event.recurrence) {
                    newEventsToAdd.push(createRecurringEventInstance(event));
                }
                eventIdsToRemove.push(event.id);
            }
        }
    });

    if (modified) {
        let updatedEvents = events.filter(e => !eventIdsToRemove.includes(e.id));
        updatedEvents = updatedEvents.concat(newEventsToAdd);
        await saveEventsAsync(updatedEvents);
    }

    return modified;
}

// --- Cross-Tab Sync Timestamp Patch ---
// Update _lastSaveTimestamp (from task_utils.js) when saving events
const _originalSaveEvents = saveEvents;
saveEvents = function(events, callback) {
    if (typeof _lastSaveTimestamp !== 'undefined') {
        _lastSaveTimestamp = Date.now();
    }
    _originalSaveEvents(events, callback);
};
