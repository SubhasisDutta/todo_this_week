// task_utils.js

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
                // Ensure tasks are instances of Task or have the full structure
                // and backfill missing properties
                let taskInstance = Object.assign(new Task(taskData.id, ''), taskData);
                if (typeof taskInstance.displayOrder === 'undefined') {
                    taskInstance.displayOrder = index; // Assign based on current array order
                    needsSave = true;
                }
                if (typeof taskInstance.schedule === 'undefined') {
                    taskInstance.schedule = []; // Backfill schedule property
                    needsSave = true;
                }
                if (typeof taskInstance.energy === 'undefined') {
                    taskInstance.energy = 'low'; // Backfill energy property
                    needsSave = true;
                }
                return taskInstance;
            });

            if (needsSave) {
                // Save tasks back to storage if any displayOrder was backfilled
                saveTasks(tasks, (success) => {
                    if (!success) console.error("Failed to save tasks after backfilling displayOrder.");
                    callback(tasks); // Proceed with callback regardless of this save's success for now
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

// Function to update a task
async function updateTask(updatedTask) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const taskIndex = tasks.findIndex(task => task.id === updatedTask.id);
            if (taskIndex > -1) {
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
let infoMessageTimeout = null; // This state should be managed per-document (popup vs manager)
                               // For now, keeping it simple. If issues arise, this needs scoping.

function showInfoMessage(message, type = 'info', duration = 3000, documentContext = document) {
    const messageArea = documentContext.getElementById('info-message-area');
    if (!messageArea) {
        // If it's a shared util, it shouldn't assume 'alert' is always best.
        // But for this extension, it's a safe fallback.
        console.error("Info message area not found in the provided document context!");
        if (documentContext === document) { // Only alert if it's the main popup's document
            alert(message);
        }
        return;
    }

    // Clear existing timeout if any (specific to this messageArea's context, effectively)
    // This simple global timeout might lead to issues if both popup and manager page are manipulated fast.
    // A more robust solution would associate the timeout with the messageArea element itself.
    if (infoMessageTimeout) { // This will use the global `infoMessageTimeout` from task_utils.js
        clearTimeout(infoMessageTimeout);
    }

    messageArea.textContent = message;
    messageArea.classList.remove('success', 'error', 'info'); // Reset classes
    messageArea.classList.add(type); // Add current type

    messageArea.style.display = 'block'; // Make it visible
    requestAnimationFrame(() => { // Ensure display:block is processed before adding 'visible' for transition
        messageArea.classList.add('visible');
    });

    infoMessageTimeout = setTimeout(() => {
        messageArea.classList.remove('visible');
        // Wait for opacity transition to finish before hiding
        setTimeout(() => {
            // Check if it's still not visible (another message might have taken over)
            if (!messageArea.classList.contains('visible')) {
                 messageArea.style.display = 'none';
                 messageArea.textContent = ''; // Clear text
                 messageArea.classList.remove(type); // Clean up class
            }
        }, 500); // Should match transition duration in CSS
        infoMessageTimeout = null; // Clear the global timeout ID
    }, duration);
}
// --- End of Info Message Functionality ---

// Note: renderTasks and specific event listeners (like drag-and-drop, inline-edit buttons)
// will be handled in popup.js and manager.js respectively, or further refactored if common
// rendering logic (like creating a single task item's DOM) is identified.
