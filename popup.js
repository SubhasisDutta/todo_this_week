// popup.js

// --- Task Data Structure and Storage ---

// Define the Task class (or a factory function if preferred)
class Task {
    constructor(id, title, url = '', priority = 'SOMEDAY', completed = false, deadline = null, type = 'home', displayOrder = 0) { // Added displayOrder
        this.id = id || `task_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
        this.title = title;
        this.url = url;
        this.priority = priority;
        this.completed = completed;
        this.deadline = deadline;
        this.type = type;
        this.displayOrder = displayOrder; // New property
    }
}

// Function to get all tasks from storage
function getTasks(callback) {
    chrome.storage.local.get({ tasks: [] }, (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting tasks:", chrome.runtime.lastError.message);
            callback([]);
        } else {
            let needsSave = false;
            const tasks = result.tasks.map((taskData, index) => {
                if (typeof taskData.displayOrder === 'undefined') {
                    taskData.displayOrder = index; // Assign based on current array order
                    needsSave = true;
                }
                // Ensure tasks are instances of Task or have the full structure
                return Object.assign(new Task(taskData.id, ''), taskData);
            });

            if (needsSave) {
                // Save tasks back to storage if any displayOrder was backfilled
                // This is an auto-migration step.
                saveTasks(tasks, (success) => {
                    if (!success) console.error("Failed to save tasks after backfilling displayOrder.");
                    // Proceed with callback regardless of this save's success for now,
                    // or handle more gracefully.
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
    chrome.storage.local.set({ tasks: tasks }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving tasks:", chrome.runtime.lastError.message); // Log error message
            if (callback) callback(false, chrome.runtime.lastError.message);
        } else {
            console.log("Tasks saved successfully.");
            if (callback) callback(true);
        }
    });
}

// Example of adding a new task (will be used later)
async function addNewTask(title, url, priority, deadline, type) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            // Assign displayOrder - tasks.length is a simple way to append to the end
            const newDisplayOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.displayOrder || 0)) + 1 : 0;
            const newTask = new Task(null, title, url, priority, false, deadline, type, newDisplayOrder); // Pass displayOrder
            tasks.push(newTask);
            saveTasks(tasks, (success) => { // Assuming saveTasks callback provides success boolean
                if (success) {
                    resolve(newTask);
                } else {
                    resolve(null); // Indicate failure
                }
            });
        });
    });
}

// Example of getting a task by ID (will be used later)
async function getTaskById(taskId) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            resolve(tasks.find(task => task.id === taskId));
        });
    });
}

// Example of updating a task (will be used later)
async function updateTask(updatedTask) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const taskIndex = tasks.findIndex(task => task.id === updatedTask.id);
            if (taskIndex > -1) {
                tasks[taskIndex] = updatedTask;
                saveTasks(tasks, () => resolve(true));
            } else {
                resolve(false); // Task not found
            }
        });
    });
}

// Example of deleting a task (will be used later)
async function deleteTask(taskId) {
    return new Promise((resolve) => {
        getTasks(tasks => {
            const initialTaskCount = tasks.length;
            const filteredTasks = tasks.filter(task => task.id !== taskId);

            if (filteredTasks.length === initialTaskCount) {
                console.warn(`Task with ID ${taskId} not found for deletion.`);
                resolve(false); // Task not found, so deletion is effectively "unsuccessful" in terms of change
                return;
            }

            saveTasks(filteredTasks, (success, error) => {
                if (success) {
                    resolve(true);
                } else {
                    console.error(`Failed to save after deleting task ${taskId}. Error: ${error}`);
                    resolve(false);
                }
            });
        });
    });
}

// --- End of Task Data Structure and Storage ---

// --- Info Message Functionality ---
let infoMessageTimeout = null; // To manage the timeout for hiding the message

function showInfoMessage(message, type = 'info', duration = 3000) {
    const messageArea = document.getElementById('info-message-area');
    if (!messageArea) {
        console.error("Info message area not found!");
        // Fallback to alert if message area is missing, though it shouldn't be.
        alert(message);
        return;
    }

    // Clear any existing message timeout to prevent premature hiding if called again quickly
    if (infoMessageTimeout) {
        clearTimeout(infoMessageTimeout);
    }

    // Set message content
    messageArea.textContent = message;

    // Set message type class
    // Remove previous type classes before adding the new one
    messageArea.classList.remove('success', 'error', 'info');
    messageArea.classList.add(type); // e.g., 'success', 'error', 'info'

    // Make the message area visible
    // The 'display: none' from HTML is overridden by adding 'visible' which sets opacity and max-height
    messageArea.style.display = 'block'; // Make sure it's not display:none before animation
    requestAnimationFrame(() => { // Ensure display:block is applied before starting transition
        messageArea.classList.add('visible');
    });


    // Set timeout to hide the message
    infoMessageTimeout = setTimeout(() => {
        messageArea.classList.remove('visible');
        // Wait for transition to finish before setting display: none
        // The transition duration is 0.5s (500ms)
        setTimeout(() => {
            if (!messageArea.classList.contains('visible')) { // Check if it wasn't shown again quickly
                 messageArea.style.display = 'none';
                 messageArea.textContent = ''; // Clear content
                 messageArea.classList.remove(type); // Clean up type class
            }
        }, 500); // Match this to CSS transition duration
        infoMessageTimeout = null;
    }, duration);
}
// --- End of Info Message Functionality ---

// --- Task Rendering Functions ---

function renderTasks(tabName = 'display') {
    getTasks(allTasks => {
        let tasksToRender = allTasks.filter(task => !task.completed);
        let taskListElement;
        let filterType = null; // 'all', 'home', 'work'

        if (tabName === 'display') {
            taskListElement = document.getElementById('display-task-list');
            filterType = 'all';
        } else if (tabName === 'home') {
            taskListElement = document.getElementById('home-task-list');
            filterType = 'home';
        } else if (tabName === 'work') {
            taskListElement = document.getElementById('work-task-list');
            filterType = 'work';
        } else if (tabName === 'edit') {
            taskListElement = document.getElementById('edit-task-list');
            // For edit tab, we show all tasks, including completed ones, perhaps styled differently later
            tasksToRender = allTasks; // Show all for edit mode initially
            filterType = 'all'; // Or handle differently for edit
        }


        if (!taskListElement) {
            console.error(`Task list element for tab '${tabName}' not found.`);
            return;
        }

        // Filter by type for 'home' and 'work' tabs
        if (filterType === 'home') {
            tasksToRender = tasksToRender.filter(task => task.type === 'home');
        } else if (filterType === 'work') {
            tasksToRender = tasksToRender.filter(task => task.type === 'work');
        }

        // Sort tasks
        if (tabName === 'edit') {
            // Edit tab: Sort primarily by displayOrder
            tasksToRender.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        } else {
            // Display, Home, Work tabs: Sort by C/I/S priority, then by displayOrder
            const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
            tasksToRender.sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }
                return (a.displayOrder || 0) - (b.displayOrder || 0); // Secondary sort by displayOrder
            });
        }

        taskListElement.innerHTML = ''; // Clear existing tasks

        if (tasksToRender.length === 0) {
            let message = "No tasks yet.";
            if (tabName === 'display') message = "No active tasks. Add some in the Edit tab!";
            else if (tabName === 'home') message = "No active home tasks.";
            else if (tabName === 'work') message = "No active work tasks.";
            else if (tabName === 'edit') message = "No tasks to edit. Add some first!";
            taskListElement.innerHTML = `<p>${message}</p>`;
            return;
        }

        tasksToRender.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item', `priority-${task.priority}`);
            taskItem.setAttribute('data-task-id', task.id);

            // Create checkbox and its label for Neumorphic styling
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.classList.add('task-complete-checkbox'); // This class is targeted by CSS to hide the input
            const checkboxId = `checkbox-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}`; // Sanitize ID
            checkbox.id = checkboxId;

            // Append the (hidden) checkbox input first
            taskItem.appendChild(checkbox);

            // In Display, Home, Work tabs, add the visible custom styled label
            if (tabName !== 'edit') {
                const checkboxLabel = document.createElement('label');
                checkboxLabel.classList.add('neumorphic-checkbox-label');
                checkboxLabel.setAttribute('for', checkboxId); // Link label to checkbox
                taskItem.appendChild(checkboxLabel);
            } else {
                // In Edit tab, the checkbox is not meant to be interactive or visible in this custom way.
                // The original hidden input is already appended.
                // Its completed status is shown by '.task-completed-edit' class on taskItem.
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('task-title');

            if (task.url) {
                const link = document.createElement('a');
                link.href = task.url;
                link.textContent = task.title;
                link.target = '_blank'; // Open in new tab
                titleSpan.appendChild(link);
            } else {
                titleSpan.textContent = task.title;
            }

            taskItem.appendChild(titleSpan);

            if (task.priority === 'CRITICAL' && task.deadline) {
                const deadlineSpan = document.createElement('span');
                deadlineSpan.classList.add('task-deadline-display');
                deadlineSpan.textContent = ` (Due: ${task.deadline})`;
                taskItem.appendChild(deadlineSpan);
            }

            // For Edit tab, we might want different controls (delete, edit buttons)
            // For Display/Home/Work, it's mainly the checkbox and title.
            if (tabName === 'edit') {
                // Add Edit/Delete buttons for the edit tab (to be implemented more fully later)
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.classList.add('neumorphic-btn', 'edit-task-btn-list'); // new class for specific styling if needed
                editButton.style.marginLeft = '10px';
                editButton.style.fontSize = '0.8em';
                editButton.style.padding = '5px 8px';


                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('neumorphic-btn', 'delete-task-btn-list'); // new class
                deleteButton.style.marginLeft = '5px';
                deleteButton.style.fontSize = '0.8em';
                deleteButton.style.padding = '5px 8px';
                deleteButton.style.backgroundColor = '#ff6b6b'; // A bit of color for delete
                deleteButton.style.color = 'white';


                taskItem.appendChild(editButton);
                taskItem.appendChild(deleteButton);

                taskItem.setAttribute('draggable', 'true'); // Make the task item draggable

                // Hide the regular checkbox, but add styling if completed
                checkbox.style.display = 'none';
                if (task.completed) {
                    taskItem.classList.add('task-completed-edit');
                }
            }


            taskListElement.appendChild(taskItem);
        });
    });
}
// --- End of Task Rendering Functions ---

// --- Task Completion Functionality ---
function setupTaskCompletionListeners() {
    const taskListContainers = [
        document.getElementById('display-task-list'),
        document.getElementById('home-task-list'),
        document.getElementById('work-task-list')
        // Not adding 'edit-task-list' here as completion is handled differently or not at all in edit mode
    ];

    taskListContainers.forEach(container => {
        if (!container) return;

        container.addEventListener('click', async function(event) {
            if (event.target.matches('.task-complete-checkbox')) {
                const checkbox = event.target;
                const taskItem = checkbox.closest('.task-item');
                const taskId = taskItem.getAttribute('data-task-id');
                const isCompleted = checkbox.checked;

                if (!taskId) return;

                console.log(`Task ${taskId} completion status changed to: ${isCompleted}`);

                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    await updateTask(task);

                    // Re-render the current active tab
                    const activeTabLink = document.querySelector('.tab-link.active');
                    if (activeTabLink) {
                        const activeTabName = activeTabLink.getAttribute('data-tab');
                        renderTasks(activeTabName);
                        // If the change happened in Display/Home/Work, also refresh Edit tab
                        // as it shows completed status differently (though not implemented fully yet)
                        if (['display', 'home', 'work'].includes(activeTabName)) {
                            renderTasks('edit');
                        }
                    }
                }
            }
        });
    });
}
// --- End of Task Completion Functionality ---

// --- Task Deletion Functionality (Edit Tab) ---
function setupTaskDeletionListener() {
    const editTaskListContainer = document.getElementById('edit-task-list');

    if (!editTaskListContainer) return;

    editTaskListContainer.addEventListener('click', async function(event) {
        if (event.target.matches('.delete-task-btn-list')) {
            const deleteButton = event.target;
            const taskItem = deleteButton.closest('.task-item');
            const taskId = taskItem.getAttribute('data-task-id');

            if (!taskId) return;

            // Optional: Confirm before deleting
            if (!confirm("Are you sure you want to delete this task?")) {
                return;
            }

            console.log(`Attempting to delete task ${taskId}`);

            const success = await deleteTask(taskId);
            if (success) {
                console.log(`Task ${taskId} deleted successfully.`);
                // Re-render the Edit tab's tasks
                renderTasks('edit');
                // Also re-render other tabs as the task is now gone
                renderTasks('display');
                renderTasks('home');
                renderTasks('work');
            } else {
                console.error(`Failed to delete task ${taskId}.`);
                // Optionally, show an error message to the user
            }
        }
    });
}
// --- End of Task Deletion Functionality ---

// --- Inline Task Editing Functionality (Edit Tab) ---

// Store original task data for cancellation
let originalTaskDataBeforeEdit = null;

function setupInlineTaskEditingListeners() {
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) return;

    editTaskListContainer.addEventListener('click', async function(event) {
        const target = event.target;

        // Handle "Edit" button click
        if (target.matches('.edit-task-btn-list')) {
            const taskItem = target.closest('.task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId) return;

            // If another task is already in edit mode, cancel it first (optional, for simplicity now)
            const currentlyEditing = editTaskListContainer.querySelector('.editing-task-item');
            if (currentlyEditing && currentlyEditing !== taskItem) {
                // Revert the other editing task or show an alert
                // For now, let's just log it and proceed. A more robust solution would handle this.
                console.warn("Another task is already being edited. Please save or cancel it first.");
                // Alternatively, programmatically cancel the other edit:
                // const otherTaskId = currentlyEditing.getAttribute('data-task-id');
                // if(otherTaskId) cancelEditTask(otherTaskId, currentlyEditing); // cancelEditTask would need to be written
                // For now, we'll allow multiple, but this might get complex to manage.
                // A simpler approach: if (currentlyEditing) { alert("Save or cancel current edit"); return; }
            }
            if (taskItem.classList.contains('editing-task-item')) return; // Already in edit mode

            const task = await getTaskById(taskId);
            if (!task) return;

            // Store original data for potential cancellation
            originalTaskDataBeforeEdit = { ...task };
            taskItem.classList.add('editing-task-item');

            // Clear current content except for what we might reuse or modify
            const taskTitleSpan = taskItem.querySelector('.task-title');
            const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');

            // Preserve existing edit/delete buttons to hide them
            const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
            const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');

            // Build the edit form within the task item
            let formHtml = `
                <div class="inline-edit-form">
                    <div class="form-group-inline">
                        <label>Title:</label>
                        <input type="text" class="neumorphic-input edit-task-title" value="${task.title}">
                    </div>
                    <div class="form-group-inline">
                        <label>URL:</label>
                        <input type="url" class="neumorphic-input edit-task-url" value="${task.url || ''}">
                    </div>
                    <div class="form-group-inline">
                        <label>Priority:</label>
                        <select class="neumorphic-select edit-task-priority">
                            <option value="SOMEDAY" ${task.priority === 'SOMEDAY' ? 'selected' : ''}>Someday</option>
                            <option value="IMPORTANT" ${task.priority === 'IMPORTANT' ? 'selected' : ''}>Important</option>
                            <option value="CRITICAL" ${task.priority === 'CRITICAL' ? 'selected' : ''}>Critical</option>
                        </select>
                    </div>
                    <div class="form-group-inline edit-task-deadline-group" style="display: ${task.priority === 'CRITICAL' ? 'block' : 'none'};">
                        <label>Deadline:</label>
                        <input type="date" class="neumorphic-input edit-task-deadline" value="${task.deadline || ''}">
                    </div>
                    <div class="form-group-inline">
                        <label>Type:</label>
                        <select class="neumorphic-select edit-task-type">
                            <option value="home" ${task.type === 'home' ? 'selected' : ''}>Home</option>
                            <option value="work" ${task.type === 'work' ? 'selected' : ''}>Work</option>
                        </select>
                    </div>
                    <div class="inline-edit-actions">
                        <button class="neumorphic-btn save-inline-btn">Save</button>
                        <button class="neumorphic-btn cancel-inline-btn">Cancel</button>
                    </div>
                </div>
            `;

            // Hide original display elements and original buttons
            if(taskTitleSpan) taskTitleSpan.style.display = 'none';
            if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = 'none';
            if(existingEditButton) existingEditButton.style.display = 'none';
            if(existingDeleteButton) existingDeleteButton.style.display = 'none';

            // Append the form
            taskItem.insertAdjacentHTML('beforeend', formHtml);

            // Add event listener for priority change within this specific inline form
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

        // Handle "Cancel" button click (Part 2 will handle save)
        // We add cancel here because it primarily reverts UI
        if (target.matches('.cancel-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            if (!taskItem || !originalTaskDataBeforeEdit) return;

            // Restore original view (simplified, assumes renderTasks will fix it)
            // A more direct DOM revert would also be possible but complex here
            taskItem.classList.remove('editing-task-item');
            const form = taskItem.querySelector('.inline-edit-form');
            if (form) form.remove();

            // Show original display elements and buttons
            const taskTitleSpan = taskItem.querySelector('.task-title');
            const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');
            const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
            const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');
            if(taskTitleSpan) taskTitleSpan.style.display = ''; // Revert to default display
            if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = '';
            if(existingEditButton) existingEditButton.style.display = '';
            if(existingDeleteButton) existingDeleteButton.style.display = '';

            originalTaskDataBeforeEdit = null; // Clear stored data
            // Optionally, re-render just this task or the whole list if easier
            // renderTasks('edit'); // This would be the simplest way to ensure correctness
        }

        // Handle "Save" button click for inline editing
        if (target.matches('.save-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId || !originalTaskDataBeforeEdit) {
                console.error("Save error: No task ID or original data found.");
                return;
            }

            const editForm = taskItem.querySelector('.inline-edit-form');
            if (!editForm) {
                console.error("Save error: Edit form not found.");
                return;
            }

            // Retrieve new values from the form
            const newTitle = editForm.querySelector('.edit-task-title').value.trim();
            const newUrl = editForm.querySelector('.edit-task-url').value.trim();
            const newPriority = editForm.querySelector('.edit-task-priority').value;
            let newDeadline = editForm.querySelector('.edit-task-deadline').value;
            const newType = editForm.querySelector('.edit-task-type').value;

            // Validation
            if (!newTitle) {
                showInfoMessage("Task title cannot be empty.", "error");
                return;
            }
            if (newPriority === 'CRITICAL' && !newDeadline) {
                showInfoMessage("Deadline is required for CRITICAL tasks.", "error");
                return;
            }
            if (newPriority !== 'CRITICAL') {
                newDeadline = null; // Ensure deadline is null if not critical
            }

            // Create an updated task object - start with original and update
            const updatedTask = {
                ...originalTaskDataBeforeEdit, // Preserve ID, completed status, etc.
                title: newTitle,
                url: newUrl,
                priority: newPriority,
                deadline: newDeadline,
                type: newType
            };

            const success = await updateTask(updatedTask);
            if (success) {
                taskItem.classList.remove('editing-task-item');
                editForm.remove();

                // Restore display of original elements (which will be updated by renderTasks)
                const taskTitleSpan = taskItem.querySelector('.task-title');
                const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');
                const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
                const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');

                if(taskTitleSpan) taskTitleSpan.style.display = '';
                if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = '';
                if(existingEditButton) existingEditButton.style.display = '';
                if(existingDeleteButton) existingDeleteButton.style.display = '';

                originalTaskDataBeforeEdit = null; // Clear stored data

                // Re-render all tabs to reflect changes
                renderTasks('edit');
                renderTasks('display');
                renderTasks('home');
                renderTasks('work');
                showInfoMessage("Task updated successfully!", "success");
                console.log("Task updated successfully and lists refreshed.");
            } else {
                showInfoMessage("Failed to update task. Please try again.", "error");
            }
        }
    });
}
// --- End of Inline Task Editing Functionality ---

// --- Drag and Drop Task Reordering (Edit Tab) ---
let draggedTaskElement = null; // To store the element being dragged

function setupDragAndDropListeners() {
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) return;

    // dragstart: Fired on an element when a drag operation starts
    editTaskListContainer.addEventListener('dragstart', function(event) {
        if (event.target.classList.contains('task-item')) {
            draggedTaskElement = event.target;
            event.dataTransfer.setData('text/plain', event.target.getAttribute('data-task-id'));
            event.target.style.opacity = '0.5'; // Visual cue for dragging
            // Ensure that inline editing form is not open on the item being dragged
            if (draggedTaskElement.classList.contains('editing-task-item')) {
                 // Find and click the cancel button if it exists
                const cancelButton = draggedTaskElement.querySelector('.cancel-inline-btn');
                if (cancelButton) {
                    cancelButton.click(); // Programmatically cancel edit
                }
            }
        }
    });

    // dragover: Fired when an element or text selection is being dragged over a valid drop target
    editTaskListContainer.addEventListener('dragover', function(event) {
        event.preventDefault(); // Necessary to allow dropping
        const taskItemOver = event.target.closest('.task-item');
        if (taskItemOver && draggedTaskElement && taskItemOver !== draggedTaskElement) {
            // Optional: add a visual cue for where it will be dropped
            // Example: taskItemOver.style.borderTop = '2px dashed blue';
        }
    });

    // Optional: dragleave to remove visual cues
    editTaskListContainer.addEventListener('dragleave', function(event) {
        const taskItemLeft = event.target.closest('.task-item');
        if (taskItemLeft) {
            // Example: taskItemLeft.style.borderTop = ''; // Clear visual cue
        }
    });

    // drop: Fired when an element or text selection is dropped on a valid drop target
    editTaskListContainer.addEventListener('drop', async function(event) {
        event.preventDefault();
        if (!draggedTaskElement) return;

        const targetTaskElement = event.target.closest('.task-item');
        if (!targetTaskElement || targetTaskElement === draggedTaskElement) {
            // Dropped on itself or not on a task item, reset opacity and do nothing else
            draggedTaskElement.style.opacity = '1';
            draggedTaskElement = null;
            return;
        }

        const targetTaskId = targetTaskElement.getAttribute('data-task-id');
        const draggedTaskId = draggedTaskElement.getAttribute('data-task-id');

        // Determine new order
        getTasks(tasks => {
            const draggedTask = tasks.find(t => t.id === draggedTaskId);
            const targetTask = tasks.find(t => t.id === targetTaskId);

            if (!draggedTask || !targetTask) {
                console.error("Drag or target task not found in tasks array.");
                if(draggedTaskElement) draggedTaskElement.style.opacity = '1';
                draggedTaskElement = null;
                return;
            }

            // Simple re-ordering logic:
            // Remove dragged task, then insert it before the target task.
            // Adjust displayOrder values for all tasks based on their new DOM order.

            const taskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item'));
            const draggedIndex = taskElements.indexOf(draggedTaskElement);
            const targetIndex = taskElements.indexOf(targetTaskElement);

            // Reorder the DOM elements first to visualize
            if (draggedIndex < targetIndex) {
                targetTaskElement.parentNode.insertBefore(draggedTaskElement, targetTaskElement.nextSibling);
            } else {
                targetTaskElement.parentNode.insertBefore(draggedTaskElement, targetTaskElement);
            }
            draggedTaskElement.style.opacity = '1'; // Reset opacity

            // Update displayOrder for all tasks based on the new DOM order
            const updatedTaskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item'));
            let displayOrderChanged = false;
            const tasksToUpdate = [];

            updatedTaskElements.forEach((el, index) => {
                const taskId = el.getAttribute('data-task-id');
                const task = tasks.find(t => t.id === taskId);
                if (task && task.displayOrder !== index) {
                    task.displayOrder = index;
                    tasksToUpdate.push(task); // Collect tasks that need updating
                    displayOrderChanged = true;
                }
            });

            if (displayOrderChanged) {
                // Update all tasks in storage. This could be optimized to save only changed tasks
                // if updateTask could handle an array or if we call it multiple times.
                // For simplicity, save all tasks.
                saveTasks(tasks, (success) => {
                    if (success) {
                        console.log("Tasks reordered and displayOrder updated.");
                        // Re-render to ensure data consistency and apply sorting from data
                        renderTasks('edit');
                        // Potentially refresh other tabs if their secondary sort is affected
                        renderTasks('display');
                        renderTasks('home');
                        renderTasks('work');
                    } else {
                        console.error("Failed to save tasks after reordering.");
                        // Re-render 'edit' to revert to original order from data if save failed
                        renderTasks('edit');
                    }
                });
            }
            draggedTaskElement = null;
        });
    });

    // dragend: Fired when a drag operation is finished (e.g., mouse up, escape key)
    editTaskListContainer.addEventListener('dragend', function(event) {
        if (draggedTaskElement) {
            draggedTaskElement.style.opacity = '1'; // Reset opacity if drag ended unexpectedly
        }
        // Clear any visual cues from dragover
        Array.from(editTaskListContainer.querySelectorAll('.task-item')).forEach(item => {
            // item.style.borderTop = ''; // Example: clear visual cue
        });
        draggedTaskElement = null;
    });
}
// --- End of Drag and Drop Task Reordering ---

// Existing tab switching code follows:
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            tab.classList.add('active');
            const targetTabId = tab.getAttribute('data-tab');
            document.getElementById(targetTabId).classList.add('active');

            console.log("Switched to tab:", targetTabId);
            renderTasks(targetTabId); // Render tasks for the newly active tab
        });
    });

    // Test storage functions (optional, for development)
    // (async () => {
    //     console.log("Initial tasks:", await new Promise(getTasks));
    //     const testTask = await addNewTask("Test Task", "http://example.com", "CRITICAL", "2023-12-31", "work");
    //     console.log("Added task:", testTask);
    //     console.log("Tasks after add:", await new Promise(getTasks));
    //     testTask.completed = true;
    //     await updateTask(testTask);
    //     console.log("Tasks after update:", await new Promise(getTasks));
    //     // await deleteTask(testTask.id);
    //     // console.log("Tasks after delete:", await new Promise(getTasks));
    // })();

    // --- Add Task Functionality ---
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskUrlInput = document.getElementById('task-url');
    const taskPriorityInput = document.getElementById('task-priority');
    const taskDeadlineGroup = document.getElementById('task-deadline-group');
    const taskDeadlineInput = document.getElementById('task-deadline');
    const taskTypeInput = document.getElementById('task-type');

    // Show/hide deadline field based on priority
    taskPriorityInput.addEventListener('change', function() {
        if (this.value === 'CRITICAL') {
            taskDeadlineGroup.style.display = 'block';
        } else {
            taskDeadlineGroup.style.display = 'none';
            taskDeadlineInput.value = ''; // Clear deadline if not critical
        }
    });

    addTaskBtn.addEventListener('click', async () => {
        const title = taskTitleInput.value.trim();
        const url = taskUrlInput.value.trim();
        const priority = taskPriorityInput.value;
        const type = taskTypeInput.value;
        let deadline = taskDeadlineInput.value;

        if (!title) {
            showInfoMessage("Task title is required.", "error");
            return;
        }

        if (priority === 'CRITICAL' && !deadline) {
            showInfoMessage("Deadline is required for CRITICAL tasks.", "error");
            return;
        }

        if (priority !== 'CRITICAL') {
            deadline = null; // Ensure deadline is null if not critical
        }

        console.log("Adding task:", { title, url, priority, deadline, type });

        const newTask = await addNewTask(title, url, priority, deadline, type);

        if (newTask) { // Check if task was added successfully
            taskTitleInput.value = '';
            taskUrlInput.value = '';
            taskPriorityInput.value = 'SOMEDAY'; // Reset to default
            taskDeadlineInput.value = '';
            taskTypeInput.value = 'home'; // Reset to default
            taskDeadlineGroup.style.display = 'none'; // Hide deadline field

            showInfoMessage("Task added successfully!", "success");
            renderTasks('display'); // Refresh display tab
            renderTasks('edit');    // Refresh edit tab
            renderTasks('home');    // Refresh home tab
            renderTasks('work');    // Refresh work tab
        } else {
            showInfoMessage("Failed to add task. Please try again.", "error");
        }
    });
    // --- End of Add Task Functionality ---

    // Initial render for the default active tab (Display)
    renderTasks('display');
    // Also render for edit tab so it's ready if user switches
    // This avoids seeing "No tasks to edit" if tasks exist.
    renderTasks('edit');

    setupTaskCompletionListeners(); // Call the function to attach listeners

    setupTaskDeletionListener();
    setupInlineTaskEditingListeners();
    setupDragAndDropListeners(); // Add this call

    // console.log("Task Manager Loaded. Task completion listeners set up."); // Previous log
    console.log("Task Manager Loaded. Completion, deletion, inline edit, and D&D listeners set up.");
});
