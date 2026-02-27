// mit.js — Most Important Thing (MIT) Star System
// Allows users to mark exactly 1 task or event per day as their MIT.
// Tracks completion streaks and prompts for unresolved past MITs.

// --- MIT Storage ---
// Stored under 'mitHistory' key in chrome.storage.local
// Each entry: { date, itemId, itemType, completed, resolvedAt }

async function getMitHistory() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ mitHistory: [] }, (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting MIT history:", chrome.runtime.lastError.message);
                resolve([]);
            } else {
                resolve(result.mitHistory || []);
            }
        });
    });
}

function saveMitHistory(entries) {
    return new Promise((resolve, reject) => {
        const plain = JSON.parse(JSON.stringify(entries));
        chrome.storage.local.set({ mitHistory: plain }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(true);
            }
        });
    });
}

/**
 * Set the MIT for a specific date. Enforces exactly 1 MIT per day.
 * Replaces any existing MIT for that date.
 */
async function setMitForDay(date, itemId, itemType) {
    const history = await getMitHistory();
    // Remove any existing MIT for this date
    const filtered = history.filter(m => m.date !== date);
    filtered.push({
        date: date,
        itemId: itemId,
        itemType: itemType,       // 'task' | 'event'
        completed: null,          // Unresolved
        resolvedAt: null
    });
    await saveMitHistory(filtered);
}

/**
 * Remove the MIT designation for a specific date.
 */
async function removeMitForDay(date) {
    const history = await getMitHistory();
    const filtered = history.filter(m => m.date !== date);
    await saveMitHistory(filtered);
}

/**
 * Get the MIT entry for a specific date.
 * @returns {Object|null} MIT entry or null
 */
async function getMitForDay(date) {
    const history = await getMitHistory();
    return history.find(m => m.date === date) || null;
}

/**
 * Get all MIT entries where completed is null AND date is before today.
 * These are MITs that the user hasn't reported on yet.
 */
async function getUnresolvedMits() {
    const history = await getMitHistory();
    const today = new Date().toISOString().split('T')[0];
    return history.filter(m => m.completed === null && m.date < today);
}

/**
 * Resolve an MIT entry by setting its completed status and resolvedAt timestamp.
 */
async function resolveMit(date, completed) {
    const history = await getMitHistory();
    const entry = history.find(m => m.date === date);
    if (entry) {
        entry.completed = completed;
        entry.resolvedAt = new Date().toISOString();
        await saveMitHistory(history);
        return true;
    }
    return false;
}

// --- Stats Calculations ---

/**
 * Calculate consecutive days with completed MITs going backward from yesterday.
 * @param {Array} history - MIT history entries
 * @returns {number} Streak count
 */
function calculateMitStreak(history) {
    if (!history || history.length === 0) return 0;

    const completedDates = new Set(
        history.filter(m => m.completed === true).map(m => m.date)
    );

    let streak = 0;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(yesterday);
        checkDate.setDate(yesterday.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        if (completedDates.has(dateStr)) {
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

/**
 * Calculate the MIT completion rate over the last N days.
 * Only counts days that had a resolved MIT (ignores days with no MIT).
 * @param {Array} history - MIT history entries
 * @param {number} days - Number of days to look back
 * @returns {number} Percentage (0-100), rounded to nearest integer
 */
function calculateMitCompletionRate(history, days) {
    if (!history || history.length === 0) return 0;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const recentResolved = history.filter(m =>
        m.date >= cutoffStr && m.completed !== null
    );

    if (recentResolved.length === 0) return 0;

    const completed = recentResolved.filter(m => m.completed === true).length;
    return Math.round((completed / recentResolved.length) * 100);
}

/**
 * Get MIT status for each day of the current visible week.
 * @param {Array} history - MIT history entries
 * @param {Array} dayDates - Array of {day, dateStr} for the current week view
 * @returns {Array<{date, day, status}>} Status: 'completed', 'missed', 'unresolved', 'none'
 */
function getMitWeeklyStatus(history, dayDates) {
    if (!dayDates || dayDates.length === 0) return [];

    const today = new Date().toISOString().split('T')[0];
    const historyMap = {};
    if (history) {
        history.forEach(m => { historyMap[m.date] = m; });
    }

    return dayDates.map(dd => {
        const entry = historyMap[dd.dateStr];
        let status = 'none';
        if (entry) {
            if (entry.completed === true) status = 'completed';
            else if (entry.completed === false) status = 'missed';
            else if (dd.dateStr < today) status = 'unresolved';
            else status = 'pending';
        }
        return { date: dd.dateStr, day: dd.day, status: status };
    });
}

// --- Cross-Tab Sync Timestamp Patch ---
const _originalSaveMitHistory = saveMitHistory;
saveMitHistory = function(entries) {
    if (typeof _lastSaveTimestamp !== 'undefined') {
        _lastSaveTimestamp = Date.now();
    }
    return _originalSaveMitHistory(entries);
};
