// task_utils.js

// --- TIME BLOCKS ---
const DEFAULT_TIME_BLOCKS = [
    { id: 'late-night-read', label: 'Late Night Block', time: '[12AM-1AM]', limit: 'multiple', colorClass: 'block-color-sakura' },
    { id: 'sleep', label: 'Sleep', time: '[1AM-7AM]', limit: '0', colorClass: '' },
    { id: 'ai-study', label: 'Deep Work Block 1', time: '[7AM-8AM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'morning-prep', label: 'Morning Prep', time: '[8AM-9AM]', limit: '0', colorClass: '' },
    { id: 'engagement', label: 'Engagement Block', time: '[9AM-12PM]', limit: 'multiple', colorClass: 'block-color-purple' },
    { id: 'lunch', label: 'Lunch Break', time: '[12PM-1PM]', limit: '0', colorClass: '' },
    { id: 'deep-work-1', label: 'Deep Work Block 2', time: '[1PM-3PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'deep-work-2', label: 'Deep Work Block 3', time: '[3PM-6PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'commute-relax', label: 'Commute and Relax', time: '[6PM-8PM]', limit: 'multiple', colorClass: 'block-color-sage' },
    { id: 'family-time', label: 'Chill Time', time: '[8PM-10PM]', limit: 'multiple', colorClass: 'block-color-skyblue' },
    { id: 'night-build', label: 'Night Block', time: '[10PM-12AM]', limit: '1', colorClass: 'block-color-orange' }
];

// Alias for backward compatibility
const TIME_BLOCKS = DEFAULT_TIME_BLOCKS;

// --- Default Settings ---
const DEFAULT_SETTINGS = {
    theme: 'light',
    fontFamily: 'system',
    fontSize: 'medium',
    hasSeenSampleTasks: false,
    notionApiKey: '',
    notionDatabaseId: '',      // Keep for backward compatibility
    notionViewId: '',          // View/Database ID for Notion sync
    googleSheetsUrl: '',
    // Notion column mapping configuration
    notionColumnMapping: {
        title: '',      // Auto-detected (type: 'title')
        priority: '',   // Maps to CRITICAL/IMPORTANT/SOMEDAY
        status: '',     // Maps to completed (true/false)
        type: '',       // Maps to home/work
        energy: '',     // Maps to low/high
        deadline: '',   // Date field
        notes: '',      // Rich text field
        url: ''         // URL field
    },
    notionValueMappings: {
        priority: { CRITICAL: '', IMPORTANT: '', SOMEDAY: '' },
        type: { home: '', work: '' },
        energy: { low: '', high: '' },
        status: { completed: '', incomplete: '' }
    },
    notionLastSyncedAt: null,
    notionSyncEnabled: false,
    // Magic Fill filler tasks
    gapFillerTasks: [
        { title: 'Check email', priority: 'SOMEDAY', energy: 'Low', type: 'work' },
        { title: 'Stretch break', priority: 'SOMEDAY', energy: 'Low', type: 'home' },
        { title: 'Quick review', priority: 'SOMEDAY', energy: 'Low', type: 'work' },
        { title: 'Water break', priority: 'SOMEDAY', energy: 'Low', type: 'home' }
    ],
    // Focus mode preference
    focusModeEnabled: false,
    // Enabled task attributes (for Groups tab and forms)
    // Note: priority and type can now be disabled by user, but default to enabled
    enabledAttributes: {
        priority: true,     // Default enabled (can be disabled)
        type: true,         // Default enabled (Location, can be disabled)
        status: false,
        impact: false,
        value: false,
        complexity: false,
        energy: true,       // Default enabled
        action: false,
        estimates: false,
        interval: false
    }
};

// --- Task Attribute Options ---
const ATTRIBUTE_OPTIONS = {
    status: {
        groups: {
            'To-do': ['inbox', 'breakdown', 'stretch', 'ready', 'next-action', 'blocked'],
            'In Progress': ['in-progress', 'influence', 'monitor', 'delegate'],
            'Complete': ['done', 'archive']
        },
        flatOptions: [
            'inbox', 'breakdown', 'stretch', 'ready', 'next-action', 'blocked',
            'in-progress', 'influence', 'monitor', 'delegate',
            'done', 'archive'
        ],
        default: 'inbox',
        labels: {
            'inbox': 'Inbox',
            'breakdown': 'Breakdown',
            'stretch': 'Stretch',
            'ready': 'Ready',
            'next-action': 'Next Action',
            'blocked': 'Blocked',
            'in-progress': 'In Progress',
            'influence': 'Influence',
            'monitor': 'Monitor',
            'delegate': 'Delegate',
            'done': 'Done',
            'archive': 'Archive'
        },
        icons: {
            'inbox': '📥',
            'breakdown': '📝',
            'stretch': '🎯',
            'ready': '✅',
            'next-action': '▶️',
            'blocked': '🚫',
            'in-progress': '⏳',
            'influence': '🤝',
            'monitor': '👁️',
            'delegate': '📤',
            'done': '✓',
            'archive': '🗄️'
        }
    },
    impact: {
        options: ['TBD', 'LOW', 'Medium', 'High'],
        default: 'TBD',
        icons: { 'TBD': '❓', 'LOW': '🔵', 'Medium': '🟡', 'High': '🔴' }
    },
    value: {
        options: ['TBD', 'BUILD', 'LEARN'],
        default: 'TBD',
        icons: { 'TBD': '❓', 'BUILD': '🔨', 'LEARN': '📚' }
    },
    complexity: {
        options: ['TBD', 'JUST DO IT', 'Trivial', 'Simple & Clear', 'Multiple Steps', 'Dependent/Risk', 'Unknown/Broad'],
        default: 'TBD',
        icons: {
            'TBD': '⏳',
            'JUST DO IT': '⚡',
            'Trivial': '🟢',
            'Simple & Clear': '📘',
            'Multiple Steps': '🟡',
            'Dependent/Risk': '⚠️',
            'Unknown/Broad': '❓'
        }
    },
    energy: {
        options: ['Low', 'High'],
        default: 'Low',
        icons: { 'Low': '🍃', 'High': '🔋' }
    },
    action: {
        options: ['TBD', 'Question', 'Mandate', 'Delete', 'Simplify', 'Accelerate', 'Automate'],
        default: 'TBD',
        icons: {
            'TBD': '⏳',
            'Question': '❓',
            'Mandate': '✅',
            'Delete': '🗑️',
            'Simplify': '✂️',
            'Accelerate': '⏩',
            'Automate': '🤖'
        }
    },
    estimates: {
        options: [
            'Unknown', '0 HR', '1 Hr', '2 Hr', '4 HR',
            '8 Hr - 1 Day', '16 Hr - 2 Day', '24 Hr - 3 Day', '40 Hr - 5 Day',
            '56 Hr - 1 Week', '112 Hr - 2 Week', '224 Hr - 1 Month'
        ],
        default: 'Unknown',
        icons: {
            'Unknown': '❓',
            '0 HR': '⏱️',
            '1 Hr': '⏱️',
            '2 Hr': '⏱️',
            '4 HR': '⏱️',
            '8 Hr - 1 Day': '📅',
            '16 Hr - 2 Day': '📅',
            '24 Hr - 3 Day': '📅',
            '40 Hr - 5 Day': '📅',
            '56 Hr - 1 Week': '📆',
            '112 Hr - 2 Week': '📆',
            '224 Hr - 1 Month': '🗓️'
        }
    }
};

// Default enabled attributes constant (for reference)
// Note: priority and type can be disabled by user but default to enabled
const DEFAULT_ENABLED_ATTRIBUTES = {
    priority: true,
    type: true,
    status: false,
    impact: false,
    value: false,
    complexity: false,
    energy: true,       // Default enabled
    action: false,
    estimates: false,
    interval: false
};

// --- Task Data Structure and Storage ---
class Task {
    constructor(
        id, title,
        url = '',
        priority = 'SOMEDAY',
        completed = false,
        deadline = null,
        type = 'home',
        displayOrder = 0,
        schedule = [],
        energy = 'Low',
        notes = '',
        completedAt = null,
        recurrence = null,
        notionPageId = null,
        lastModified = null,
        colorCode = null,
        // --- Attribute fields ---
        status = 'inbox',
        impact = 'TBD',
        value = 'TBD',
        complexity = 'TBD',
        action = 'TBD',
        estimates = 'Unknown',
        interval = null  // { startDate: string|null, endDate: string|null }
    ) {
        this.id = id || `task_${new Date().getTime()}_${Math.random().toString(36).substring(2, 11)}`;
        this.title = title;
        this.url = url;
        this.priority = priority;
        this.completed = completed;
        this.deadline = deadline;
        this.type = type;
        this.displayOrder = displayOrder;
        this.schedule = schedule;
        this.energy = energy;
        this.notes = notes;
        this.completedAt = completedAt;
        this.recurrence = recurrence;
        this.notionPageId = notionPageId;
        this.lastModified = lastModified || new Date().toISOString();
        this.colorCode = colorCode; // Custom color: null | 'red' | 'blue' | 'green' | 'purple' | 'orange'
        // --- Attribute assignments ---
        this.status = status;
        this.impact = impact;
        this.value = value;
        this.complexity = complexity;
        this.action = action;
        this.estimates = estimates;
        this.interval = interval;
    }
}

// Function to get all tasks from storage
function getTasks(callback) {
    chrome.storage.local.get({ tasks: [] }, (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting tasks:", chrome.runtime.lastError.message || chrome.runtime.lastError);
            callback([]); // Pass empty array on error
        } else {
            let needsSave = false;
            const tasks = result.tasks.map((taskData, index) => {
                let taskInstance = Object.assign(new Task(taskData.id, ''), taskData);

                // --- Backfill/Migration Logic ---
                if (typeof taskInstance.displayOrder === 'undefined') {
                    taskInstance.displayOrder = index;
                    needsSave = true;
                }
                if (typeof taskInstance.schedule === 'undefined') {
                    taskInstance.schedule = [];
                    needsSave = true;
                } else {
                    taskInstance.schedule.forEach(scheduleItem => {
                        if (typeof scheduleItem.completed === 'undefined') {
                            scheduleItem.completed = false;
                            needsSave = true;
                        }
                    });
                }
                // Energy field migration: 'low'/'high' -> 'Low'/'High'/'Medium'/'TBD'
                // Energy field migration: normalize to 'Low' or 'High' only
                if (typeof taskInstance.energy === 'undefined') {
                    taskInstance.energy = 'Low';
                    needsSave = true;
                } else if (taskInstance.energy === 'low' || taskInstance.energy === 'TBD' || taskInstance.energy === 'Medium') {
                    taskInstance.energy = 'Low';
                    needsSave = true;
                } else if (taskInstance.energy === 'high') {
                    taskInstance.energy = 'High';
                    needsSave = true;
                }
                // Existing fields backfill
                if (typeof taskInstance.notes === 'undefined') {
                    taskInstance.notes = '';
                    needsSave = true;
                }
                if (typeof taskInstance.completedAt === 'undefined') {
                    taskInstance.completedAt = null;
                    needsSave = true;
                }
                if (typeof taskInstance.recurrence === 'undefined') {
                    taskInstance.recurrence = null;
                    needsSave = true;
                }
                if (typeof taskInstance.notionPageId === 'undefined') {
                    taskInstance.notionPageId = null;
                    needsSave = true;
                }
                if (typeof taskInstance.lastModified === 'undefined') {
                    taskInstance.lastModified = new Date().toISOString();
                    needsSave = true;
                }
                if (typeof taskInstance.colorCode === 'undefined') {
                    taskInstance.colorCode = null;
                    needsSave = true;
                }
                // --- Attribute fields backfill ---
                if (typeof taskInstance.status === 'undefined') {
                    taskInstance.status = 'inbox';
                    needsSave = true;
                }
                if (typeof taskInstance.impact === 'undefined') {
                    taskInstance.impact = 'TBD';
                    needsSave = true;
                }
                if (typeof taskInstance.value === 'undefined') {
                    taskInstance.value = 'TBD';
                    needsSave = true;
                }
                if (typeof taskInstance.complexity === 'undefined') {
                    taskInstance.complexity = 'TBD';
                    needsSave = true;
                }
                if (typeof taskInstance.action === 'undefined') {
                    taskInstance.action = 'TBD';
                    needsSave = true;
                }
                if (typeof taskInstance.estimates === 'undefined') {
                    taskInstance.estimates = 'Unknown';
                    needsSave = true;
                }
                if (typeof taskInstance.interval === 'undefined') {
                    taskInstance.interval = null;
                    needsSave = true;
                }
                // Remove deprecated fields (cleanup)
                if ('why' in taskInstance) {
                    delete taskInstance.why;
                    needsSave = true;
                }
                if ('projects' in taskInstance) {
                    delete taskInstance.projects;
                    needsSave = true;
                }
                if ('sprint' in taskInstance) {
                    delete taskInstance.sprint;
                    needsSave = true;
                }
                // Backfill schedule item fields for new features
                if (taskInstance.schedule && taskInstance.schedule.length > 0) {
                    taskInstance.schedule.forEach(scheduleItem => {
                        if (typeof scheduleItem.spanBlocks === 'undefined') {
                            scheduleItem.spanBlocks = 1;
                            needsSave = true;
                        }
                        if (typeof scheduleItem.actualStartTime === 'undefined') {
                            scheduleItem.actualStartTime = null;
                        }
                        if (typeof scheduleItem.actualEndTime === 'undefined') {
                            scheduleItem.actualEndTime = null;
                        }
                    });
                }
                return taskInstance;
            });

            if (needsSave) {
                saveTasks(tasks, (success) => {
                    if (!success) console.error("Failed to save tasks after backfilling properties.");
                    callback(tasks);
                });
            } else {
                callback(tasks);
            }
        }
    });
}

// Function to save all tasks to storage
function saveTasks(tasks, callback) {
    // Ensure we are always saving plain objects, not class instances
    const plainTasks = JSON.parse(JSON.stringify(tasks));
    chrome.storage.local.set({ tasks: plainTasks }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving tasks:", chrome.runtime.lastError.message || chrome.runtime.lastError);
            if (callback) callback(false, chrome.runtime.lastError.message || String(chrome.runtime.lastError));
        } else {
            console.log("Tasks saved successfully.");
            if (callback) callback(true);
        }
    });
}

// Function to add a new task
async function addNewTask(title, url, priority, deadline, type, energy = 'TBD', notes = '', recurrence = null, extraAttrs = {}) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const tasksInSamePriorityGroup = tasks.filter(task => task.priority === priority && !task.completed);
            let newDisplayOrder = 0;
            if (tasksInSamePriorityGroup.length > 0) {
                newDisplayOrder = Math.max(...tasksInSamePriorityGroup.map(t => t.displayOrder || 0)) + 1;
            } else {
                const allDisplayOrders = tasks.map(t => t.displayOrder || 0);
                newDisplayOrder = allDisplayOrders.length > 0 ? Math.max(...allDisplayOrders) + 1 : 0;
            }

            // Extract attribute fields from extraAttrs with defaults
            const {
                status = 'inbox',
                impact = 'TBD',
                value = 'TBD',
                complexity = 'TBD',
                action = 'TBD',
                estimates = 'Unknown',
                interval = null
            } = extraAttrs;

            const newTask = new Task(
                null, title, url, priority, false, deadline, type, newDisplayOrder, [],
                energy, notes, null, recurrence || null, null, null, null,
                status, impact, value, complexity, action, estimates, interval
            );
            tasks.push(newTask);

            saveTasks(tasks, (success) => {
                if (success) {
                    resolve(newTask);
                } else {
                    resolve(null);
                }
            });
        });
    });
}

// Function to get a task by ID
async function getTaskById(taskId) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            resolve(tasks.find(task => task.id === taskId));
        });
    });
}

// --- New utility function to update parent task completion status ---
function updateTaskCompletion(task) {
    if (task.schedule && task.schedule.length > 0) {
        const allAssignmentsCompleted = task.schedule.every(item => item.completed);
        task.completed = allAssignmentsCompleted;
    }
    // If there is no schedule, task.completed is managed directly by its own checkbox.
}

// Function to create the next recurring instance of a task
function createRecurringInstance(task) {
    let newDeadline = null;
    if (task.deadline) {
        const d = new Date(task.deadline);
        if (task.recurrence === 'daily') {
            d.setDate(d.getDate() + 1);
        } else if (task.recurrence === 'weekly') {
            d.setDate(d.getDate() + 7);
        } else if (task.recurrence === 'monthly') {
            d.setMonth(d.getMonth() + 1);
        }
        newDeadline = d.toISOString().split('T')[0]; // YYYY-MM-DD
    }

    // For interval, shift dates if both are set
    let newInterval = null;
    if (task.interval && task.interval.startDate && task.interval.endDate) {
        const startD = new Date(task.interval.startDate);
        const endD = new Date(task.interval.endDate);
        const daysOffset = task.recurrence === 'daily' ? 1 : task.recurrence === 'weekly' ? 7 : 30;
        startD.setDate(startD.getDate() + daysOffset);
        endD.setDate(endD.getDate() + daysOffset);
        newInterval = {
            startDate: startD.toISOString().split('T')[0],
            endDate: endD.toISOString().split('T')[0]
        };
    }

    return new Task(
        null, // new id
        task.title,
        task.url || '',
        task.priority,
        false,       // not completed
        newDeadline,
        task.type,
        task.displayOrder,
        [],          // empty schedule
        task.energy,
        task.notes || '',
        null,        // completedAt = null
        task.recurrence,
        null,        // notionPageId = null (recurring instances are not linked to Notion)
        null,        // lastModified = null (will be auto-set by constructor)
        null,        // colorCode
        // --- Copy attribute fields ---
        task.status || 'inbox',
        task.impact || 'TBD',
        task.value || 'TBD',
        task.complexity || 'TBD',
        task.action || 'TBD',
        task.estimates || 'Unknown',
        newInterval
    );
}

// Function to update a task
async function updateTask(updatedTask) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const taskIndex = tasks.findIndex(task => task.id === updatedTask.id);
            if (taskIndex > -1) {
                const previousTask = tasks[taskIndex];
                const wasCompleted = previousTask.completed;

                // Before saving, ensure the parent task's completion status is up-to-date
                updateTaskCompletion(updatedTask);

                // Set/clear completedAt based on completion state transition
                if (!wasCompleted && updatedTask.completed) {
                    updatedTask.completedAt = new Date().toISOString();
                } else if (wasCompleted && !updatedTask.completed) {
                    updatedTask.completedAt = null;
                }

                // Update lastModified timestamp
                updatedTask.lastModified = new Date().toISOString();

                tasks[taskIndex] = updatedTask;

                // Auto-create next instance for recurring tasks on completion
                if (!wasCompleted && updatedTask.completed && updatedTask.recurrence) {
                    const nextInstance = createRecurringInstance(updatedTask);
                    tasks.push(nextInstance);
                }

                saveTasks(tasks, (success) => resolve(success));
            } else {
                resolve(false); // Task not found
            }
        });
    });
}

// Function to delete a task
async function deleteTask(taskId) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const initialTaskCount = tasks.length;
            const filteredTasks = tasks.filter(task => task.id !== taskId);

            if (filteredTasks.length === initialTaskCount) {
                console.warn(`Task with ID ${taskId} not found for deletion.`);
                resolve(false);
                return;
            }

            saveTasks(filteredTasks, (success) => {
                if (success) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    });
}
// --- End of Task Data Structure and Storage ---


// --- Toast Notification Functionality ---

function getOrCreateToastContainer(documentContext = document) {
    let container = documentContext.getElementById('toast-container');
    if (!container) {
        container = documentContext.createElement('div');
        container.id = 'toast-container';
        documentContext.body.appendChild(container);
    }
    return container;
}

function showInfoMessage(message, type = 'info', duration = 5000, documentContext = document) {
    const container = getOrCreateToastContainer(documentContext);

    // Create toast element
    const toast = documentContext.createElement('div');
    toast.className = `toast ${type}`;

    // Icon based on type
    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Dismiss">✕</button>
    `;

    // Add to container
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    const dismissToast = () => {
        toast.classList.remove('visible');
        toast.classList.add('hiding');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    };

    if (closeBtn) {
        closeBtn.addEventListener('click', dismissToast);
    }

    // Auto dismiss after duration
    const timeoutId = setTimeout(dismissToast, duration);

    // Store timeout for potential early dismissal
    toast._dismissTimeout = timeoutId;

    return toast;
}
// --- End of Toast Notification Functionality ---


// --- Promise Wrappers ---
function getTasksAsync() {
    return new Promise(resolve => getTasks(resolve));
}

function saveTasksAsync(tasks) {
    return new Promise((resolve, reject) => {
        saveTasks(tasks, (success, errorMsg) => {
            if (success) resolve(true);
            else reject(new Error(errorMsg || "Failed to save tasks"));
        });
    });
}

// --- Operation Queue (prevents race conditions from rapid clicks) ---
let _taskOperationQueue = Promise.resolve();

function withTaskLock(asyncFn) {
    _taskOperationQueue = _taskOperationQueue.then(asyncFn).catch(err => {
        console.error("Task operation error:", err);
    });
    return _taskOperationQueue;
}

// --- Validation Utilities ---
function validateTask(task) {
    const errors = [];
    if (!task.title || !task.title.trim()) errors.push("Task title is required.");
    if (task.priority === 'CRITICAL' && !task.deadline) errors.push("Deadline is required for CRITICAL tasks.");
    if (task.url && task.url.trim() && !isValidUrl(task.url.trim())) errors.push("Invalid URL format.");
    return errors;
}

function isValidUrl(string) {
    try { new URL(string); return true; }
    catch { return false; }
}

// --- Time Block Validation ---
function parseTimeRange(timeStr) {
    // Parse "[1PM-3PM]" or "[12AM-1AM]" format to 24-hour numbers
    const match = timeStr.match(/\[(\d{1,2})(AM|PM)-(\d{1,2})(AM|PM)\]/i);
    if (!match) return null;

    let startHour = parseInt(match[1], 10);
    const startPeriod = match[2].toUpperCase();
    let endHour = parseInt(match[3], 10);
    const endPeriod = match[4].toUpperCase();

    // Convert to 24-hour format
    if (startPeriod === 'PM' && startHour !== 12) startHour += 12;
    if (startPeriod === 'AM' && startHour === 12) startHour = 0;
    if (endPeriod === 'PM' && endHour !== 12) endHour += 12;
    if (endPeriod === 'AM' && endHour === 12) endHour = 0;

    return { start: startHour, end: endHour };
}

function validateTimeBlockOverlap(newBlock, existingBlocks, excludeId = null) {
    const newRange = parseTimeRange(newBlock.time);
    if (!newRange) return { valid: false, error: 'Invalid time format.' };

    for (const block of existingBlocks) {
        if (excludeId && block.id === excludeId) continue;

        const existingRange = parseTimeRange(block.time);
        if (!existingRange) continue;

        // Overlap: newStart < existingEnd AND newEnd > existingStart
        if (newRange.start < existingRange.end && newRange.end > existingRange.start) {
            return {
                valid: false,
                error: `Time block overlaps with "${block.label}" (${block.time}).`
            };
        }
    }
    return { valid: true, error: null };
}

/**
 * Validate that time blocks cover all 24 hours of the day without gaps.
 * @param {Array} blocks - Array of time block objects with 'time' property in "[1PM-3PM]" format
 * @returns {Object} { valid: boolean, error: string|null, gaps: Array<{start, end}>|null }
 */
function validate24HourCoverage(blocks) {
    if (!blocks || blocks.length === 0) {
        return { valid: false, error: 'No time blocks defined. The day must be fully covered (24 hours).', gaps: [{ start: 0, end: 24 }] };
    }

    // Parse all time ranges
    const ranges = [];
    for (const block of blocks) {
        const range = parseTimeRange(block.time);
        if (!range) {
            return { valid: false, error: `Invalid time format for block "${block.label}".`, gaps: null };
        }
        // Convert end=0 (12AM) to end=24 when it represents end of day
        // This happens when a block spans to midnight, e.g., [10PM-12AM] -> {start: 22, end: 0}
        // For coverage calculation, we need end=24 to represent end of day
        let end = range.end;
        if (end === 0 && range.start > 0) {
            end = 24;
        }
        ranges.push({ start: range.start, end: end, label: block.label });
    }

    // Sort by start time
    ranges.sort((a, b) => a.start - b.start);

    // Find gaps
    const gaps = [];
    let coveredUntil = 0;

    for (const range of ranges) {
        if (range.start > coveredUntil) {
            // Gap found
            gaps.push({ start: coveredUntil, end: range.start });
        }
        // Extend coverage (handle overlapping blocks)
        if (range.end > coveredUntil) {
            coveredUntil = range.end;
        }
    }

    // Check if we covered until midnight (24)
    if (coveredUntil < 24) {
        gaps.push({ start: coveredUntil, end: 24 });
    }

    if (gaps.length > 0) {
        // Format gap times for error message
        const formatHour = (h) => {
            if (h === 0 || h === 24) return '12AM';
            if (h === 12) return '12PM';
            return h < 12 ? `${h}AM` : `${h - 12}PM`;
        };

        const gapStrings = gaps.map(g => `${formatHour(g.start)}-${formatHour(g.end)}`);
        const gapList = gapStrings.join(', ');

        return {
            valid: false,
            error: `Time blocks must cover all 24 hours. Missing coverage: ${gapList}. Please adjust the time blocks to fill the gaps.`,
            gaps
        };
    }

    return { valid: true, error: null, gaps: null };
}

// --- Debounce Utility ---
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// --- Settings Functions ---
async function getSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ settings: {} }, (result) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting settings:", chrome.runtime.lastError.message);
                resolve({ ...DEFAULT_SETTINGS });
                return;
            }
            resolve({ ...DEFAULT_SETTINGS, ...result.settings });
        });
    });
}

async function saveSettings(settings) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ settings }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(true);
            }
        });
    });
}

// --- Sample Tasks Seeding ---
async function seedSampleTasks() {
    const today = new Date();
    const inThreeDays = new Date(today);
    inThreeDays.setDate(today.getDate() + 3);
    const deadlineStr = inThreeDays.toISOString().split('T')[0];

    const sampleTasks = [
        new Task(null, 'Review project proposal', 'https://example.com/proposal', 'CRITICAL', false, deadlineStr, 'work', 0, [], 'High',
            'Check budget estimates and timeline. Get sign-off from stakeholders.', null, null),
        new Task(null, 'Set up weekly planning routine', '', 'IMPORTANT', false, null, 'work', 1, [], 'High',
            'Use this planner every Monday morning. Assign tasks to time blocks for the week.', null, 'weekly'),
        new Task(null, 'Read "Deep Work" by Cal Newport', 'https://www.goodreads.com/book/show/25744928', 'IMPORTANT', false, null, 'home', 2, [], 'Low',
            'Focus on chapters 1-3 this week. Take notes on the time-blocking strategy.', null, null),
        new Task(null, 'Grocery shopping', '', 'SOMEDAY', false, null, 'home', 3, [], 'Low', '', null, 'weekly'),
        new Task(null, 'Learn keyboard shortcuts for VS Code', '', 'SOMEDAY', false, null, 'work', 4, [], 'Low',
            'Focus on multi-cursor editing and quick file navigation shortcuts.', null, null),
        new Task(null, 'Morning workout routine', '', 'IMPORTANT', false, null, 'home', 5, [], 'High', '', null, 'daily'),
    ];

    return new Promise((resolve) => {
        saveTasks(sampleTasks, async (success) => {
            if (success) {
                const settings = await getSettings();
                settings.hasSeenSampleTasks = true;
                await saveSettings(settings);
            }
            resolve(success);
        });
    });
}

// --- Configurable Time Blocks ---
async function getTimeBlocks() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ timeBlocks: null }, (result) => {
            if (chrome.runtime.lastError || !result.timeBlocks) {
                resolve([...DEFAULT_TIME_BLOCKS]);
            } else {
                resolve(result.timeBlocks);
            }
        });
    });
}

async function saveTimeBlocks(blocks) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ timeBlocks: blocks }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(true);
            }
        });
    });
}

// --- Duplicate Task Helper ---
function duplicateTask(task) {
    const newTask = new Task(
        null, // new ID
        task.title + ' (copy)',
        task.url || '',
        task.priority,
        false, // not completed
        task.deadline,
        task.type,
        task.displayOrder + 1,
        [], // empty schedule
        task.energy,
        task.notes || '',
        null, // completedAt
        task.recurrence,
        null, // notionPageId
        null, // lastModified (auto-set)
        task.colorCode,
        // --- Copy attribute fields ---
        task.status || 'inbox',
        task.impact || 'TBD',
        task.value || 'TBD',
        task.complexity || 'TBD',
        task.action || 'TBD',
        task.estimates || 'Unknown',
        task.interval ? { ...task.interval } : null
    );
    return newTask;
}

// --- Undo / Redo ---
let _undoStack = [];
let _redoStack = [];

function pushUndoState(taskSnapshot) {
    _undoStack.push(JSON.parse(JSON.stringify(taskSnapshot)));
    if (_undoStack.length > 5) {
        _undoStack.shift(); // Remove oldest
    }
    _redoStack = []; // Clear redo stack on new action
}

async function undo() {
    if (_undoStack.length === 0) return false;
    const snapshot = _undoStack.pop();
    // Save current state to redo stack
    const currentTasks = await getTasksAsync();
    _redoStack.push(JSON.parse(JSON.stringify(currentTasks)));
    await saveTasksAsync(snapshot);
    return true;
}

async function redo() {
    if (_redoStack.length === 0) return false;
    const snapshot = _redoStack.pop();
    // Save current state to undo stack
    const currentTasks = await getTasksAsync();
    _undoStack.push(JSON.parse(JSON.stringify(currentTasks)));
    await saveTasksAsync(snapshot);
    return true;
}

// --- Cross-Tab Sync ---
let _lastSaveTimestamp = 0;

function setupStorageSync(renderCallback) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.tasks) {
            // Ignore changes we just made ourselves (within last 500ms)
            if (Date.now() - _lastSaveTimestamp > 500) {
                renderCallback();
            }
        }
    });
}

// Patch saveTasks to track save timestamps for cross-tab sync
const _originalSaveTasks = saveTasks;
saveTasks = function(tasks, callback) {
    _lastSaveTimestamp = Date.now();
    _originalSaveTasks(tasks, callback);
};
