// task_utils.js

const TIME_BLOCKS = [
    { id: 'late-night-read', label: 'Late Night Read', time: '[12AM-1AM]', limit: 'multiple', colorClass: 'block-color-sakura' },
    { id: 'sleep', label: 'Sleep', time: '[1AM-7AM]', limit: '0', colorClass: '' },
    { id: 'ai-study', label: 'AI study time', time: '[7AM-8AM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'morning-prep', label: '🌞🚽🚿🥛💊', time: '[8AM-9AM]', limit: '0', colorClass: '' },
    { id: 'engagement', label: 'Engagement Block', time: '[9AM-12PM]', limit: 'multiple', colorClass: 'block-color-purple' },
    { id: 'lunch', label: 'Lunch Break', time: '[12PM-1PM]', limit: '0', colorClass: '' },
    { id: 'deep-work-1', label: 'Deep Work Block 1', time: '[1PM-3PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'deep-work-2', label: 'Deep Work Block 2', time: '[3PM-6PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'commute-relax', label: 'Commute and Relax', time: '[6PM-8PM]', limit: 'multiple', colorClass: 'block-color-sage' },
    { id: 'family-time', label: 'Family time Block', time: '[8PM-10PM]', limit: 'multiple', colorClass: 'block-color-skyblue' },
    { id: 'night-build', label: 'Night Build Block', time: '[10PM-11PM]', limit: '1', colorClass: 'block-color-orange' }
];

// --- Task Data Structure and Storage ---
class Task {
    constructor(id, title, url = '', priority = 'SOMEDAY', completed = false, deadline = null, type = 'home', displayOrder = 0, schedule = [], energy = 'low') {
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
                    // This is the new migration logic for schedule items
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
async function addNewTask(title, url, priority, deadline, type, energy = 'low') {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const tasksInSamePriorityGroup = tasks.filter(task => task.priority === priority && !task.completed); // Consider only active tasks for new displayOrder
            let newDisplayOrder = 0;
            if (tasksInSamePriorityGroup.length > 0) {
                newDisplayOrder = Math.max(...tasksInSamePriorityGroup.map(t => t.displayOrder || 0)) + 1;
            } else {
                 // If no tasks in the group, or all are completed, check all tasks for max displayOrder
                const allDisplayOrders = tasks.map(t => t.displayOrder || 0);
                newDisplayOrder = allDisplayOrders.length > 0 ? Math.max(...allDisplayOrders) + 1 : 0;
            }

            const newTask = new Task(null, title, url, priority, false, deadline, type, newDisplayOrder, [], energy);
            tasks.push(newTask);

            saveTasks(tasks, (success) => {
                if (success) {
                    resolve(newTask);
                } else {
                    resolve(null); // Indicate failure
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


// Function to update a task
async function updateTask(updatedTask) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const taskIndex = tasks.findIndex(task => task.id === updatedTask.id);
            if (taskIndex > -1) {
                // Before saving, ensure the parent task's completion status is up-to-date
                updateTaskCompletion(updatedTask);
                tasks[taskIndex] = updatedTask;
                saveTasks(tasks, (success) => resolve(success)); // Pass boolean success
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
                resolve(false); // Indicate task not found or no change
                return;
            }

            saveTasks(filteredTasks, (success) => {
                if (success) {
                    resolve(true);
                } else {
                    resolve(false); // Indicate failure
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

    // Clear existing timeout attached to this specific message element
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

// --- Debounce Utility ---
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
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
