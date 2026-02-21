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
    { id: 'night-build', label: 'Night Block', time: '[10PM-11PM]', limit: '1', colorClass: 'block-color-orange' }
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
        { title: 'Check email', priority: 'SOMEDAY', energy: 'low', type: 'work' },
        { title: 'Stretch break', priority: 'SOMEDAY', energy: 'low', type: 'home' },
        { title: 'Quick review', priority: 'SOMEDAY', energy: 'low', type: 'work' },
        { title: 'Water break', priority: 'SOMEDAY', energy: 'low', type: 'home' }
    ],
    // Focus mode preference
    focusModeEnabled: false
};

// --- Default Habits ---
const DEFAULT_HABITS = [
    {
        id: 'habit_morning',
        name: 'Morning Routine',
        description: 'Start your day with meditation, coffee, and email',
        tasks: [
            { title: 'Meditate', priority: 'IMPORTANT', energy: 'low', type: 'home', relativeBlockIndex: 0 },
            { title: 'Coffee & News', priority: 'SOMEDAY', energy: 'low', type: 'home', relativeBlockIndex: 1 },
            { title: 'Check Email', priority: 'IMPORTANT', energy: 'low', type: 'work', relativeBlockIndex: 2 }
        ]
    },
    {
        id: 'habit_deep_work',
        name: 'Deep Work Session',
        description: 'Focused work with breaks',
        tasks: [
            { title: 'Focus Work', priority: 'CRITICAL', energy: 'high', type: 'work', relativeBlockIndex: 0 },
            { title: 'Short Break', priority: 'SOMEDAY', energy: 'low', type: 'home', relativeBlockIndex: 1 },
            { title: 'Review Notes', priority: 'IMPORTANT', energy: 'low', type: 'work', relativeBlockIndex: 2 }
        ]
    },
    {
        id: 'habit_wind_down',
        name: 'Wind Down',
        description: 'End your day with reflection and planning',
        tasks: [
            { title: 'Review Day', priority: 'IMPORTANT', energy: 'low', type: 'home', relativeBlockIndex: 0 },
            { title: 'Plan Tomorrow', priority: 'IMPORTANT', energy: 'low', type: 'work', relativeBlockIndex: 1 }
        ]
    }
];

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
        energy = 'low',
        notes = '',
        completedAt = null,
        recurrence = null,
        notionPageId = null,
        lastModified = null,
        colorCode = null
    ) {
        this.id = id || `task_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
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
                if (typeof taskInstance.energy === 'undefined') {
                    taskInstance.energy = 'low';
                    needsSave = true;
                }
                // New fields backfill
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
async function addNewTask(title, url, priority, deadline, type, energy = 'low', notes = '', recurrence = null) {
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

            const newTask = new Task(null, title, url, priority, false, deadline, type, newDisplayOrder, [], energy, notes, null, recurrence || null);
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
        null         // lastModified = null (will be auto-set by constructor)
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


// --- Info Message Functionality ---

function showInfoMessage(message, type = 'info', duration = 3000, documentContext = document) {
    const messageArea = documentContext.getElementById('info-message-area');
    if (!messageArea) {
        console.error("Info message area not found in the provided document context!");
        if (documentContext === document) {
            alert(message);
        }
        return;
    }

    if (messageArea._infoTimeout) {
        clearTimeout(messageArea._infoTimeout);
    }

    messageArea.textContent = message;
    messageArea.classList.remove('success', 'error', 'info');
    messageArea.classList.add(type);

    messageArea.style.display = 'block';
    requestAnimationFrame(() => {
        messageArea.classList.add('visible');
    });

    messageArea._infoTimeout = setTimeout(() => {
        messageArea.classList.remove('visible');
        setTimeout(() => {
            if (!messageArea.classList.contains('visible')) {
                messageArea.style.display = 'none';
                messageArea.textContent = '';
                messageArea.classList.remove(type);
            }
        }, 500);
        messageArea._infoTimeout = null;
    }, duration);
}
// --- End of Info Message Functionality ---


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
        new Task(null, 'Review project proposal', 'https://example.com/proposal', 'CRITICAL', false, deadlineStr, 'work', 0, [], 'high',
            'Check budget estimates and timeline. Get sign-off from stakeholders.', null, null),
        new Task(null, 'Set up weekly planning routine', '', 'IMPORTANT', false, null, 'work', 1, [], 'high',
            'Use this planner every Monday morning. Assign tasks to time blocks for the week.', null, 'weekly'),
        new Task(null, 'Read "Deep Work" by Cal Newport', 'https://www.goodreads.com/book/show/25744928', 'IMPORTANT', false, null, 'home', 2, [], 'low',
            'Focus on chapters 1-3 this week. Take notes on the time-blocking strategy.', null, null),
        new Task(null, 'Grocery shopping', '', 'SOMEDAY', false, null, 'home', 3, [], 'low', '', null, 'weekly'),
        new Task(null, 'Learn keyboard shortcuts for VS Code', '', 'SOMEDAY', false, null, 'work', 4, [], 'low',
            'Focus on multi-cursor editing and quick file navigation shortcuts.', null, null),
        new Task(null, 'Morning workout routine', '', 'IMPORTANT', false, null, 'home', 5, [], 'high', '', null, 'daily'),
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

// --- Habits Storage ---
async function getHabits() {
    return new Promise((resolve) => {
        chrome.storage.local.get({ habits: null }, (result) => {
            if (chrome.runtime.lastError || !result.habits || result.habits.length === 0) {
                resolve([...DEFAULT_HABITS]);
            } else {
                resolve(result.habits);
            }
        });
    });
}

async function saveHabits(habits) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ habits }, () => {
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
        task.colorCode
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
