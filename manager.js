// manager.js

document.addEventListener('DOMContentLoaded', function() {
    // --- Task Addition ---
    const addTaskBtn = document.getElementById('add-task-btn');
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
});


function renderManagerTasks() {
    getTasks(allTasks => {
        const taskListElement = document.getElementById('edit-task-list');
        if (!taskListElement) {
            console.error("Task list element 'edit-task-list' not found in manager.html.");
            return;
        }

        // Sort tasks by displayOrder for the manager view
        allTasks.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        taskListElement.innerHTML = ''; // Clear existing tasks

        if (allTasks.length === 0) {
            taskListElement.innerHTML = '<p>No tasks yet. Add some using the form above!</p>';
            return;
        }

        allTasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item', `priority-${task.priority}`);
            if (task.completed) {
                taskItem.classList.add('task-completed-edit');
            }
            taskItem.setAttribute('data-task-id', task.id);
            taskItem.setAttribute('draggable', 'true'); // All tasks draggable in this view

            // Checkbox (for visual consistency, though not directly functional for completion here)
            // Or, make it functional for completion status change
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.classList.add('task-complete-checkbox-edit'); // Distinct class if needed
            checkbox.id = `checkbox-edit-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
            // taskItem.appendChild(checkbox); // Not adding to DOM for now, but could be used for inline edit

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('task-title');
            if (task.url) {
                const link = document.createElement('a');
                link.href = task.url;
                link.textContent = task.title;
                link.target = '_blank'; // Open links in new tab
                titleSpan.appendChild(link);
            } else {
                titleSpan.textContent = task.title;
            }
            taskItem.appendChild(titleSpan);

            if (task.priority === 'CRITICAL' && task.deadline) {
                const deadlineSpan = document.createElement('span');
                deadlineSpan.classList.add('task-deadline-display');
                // (Deadline calculation logic from popup.js's renderTasks can be reused or simplified here)
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

            // Action buttons container
            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('task-item-actions');

            if (index > 0) {
                const moveUpButton = document.createElement('button');
                moveUpButton.innerHTML = '&uarr;';
                moveUpButton.classList.add('neumorphic-btn', 'move-task-up-btn');
                moveUpButton.title = "Move Up";
                moveUpButton.setAttribute('data-task-id', task.id);
                buttonContainer.appendChild(moveUpButton);
            }

            if (index < allTasks.length - 1) {
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

            taskListElement.appendChild(taskItem);
        });
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
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) return;

    // Deletion Listener
    editTaskListContainer.addEventListener('click', async function(event) {
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

    // Inline Editing Listener (Simplified version of popup.js's one)
    editTaskListContainer.addEventListener('click', async function(event) {
        const target = event.target;
        // Cancel any ongoing edit if trying to edit another or clicking outside
        const currentlyEditingForm = editTaskListContainer.querySelector('.inline-edit-form');
        if (currentlyEditingForm && !currentlyEditingForm.contains(target) && !target.matches('.edit-task-btn-list')) {
            const cancelBtn = currentlyEditingForm.querySelector('.cancel-inline-btn');
            if(cancelBtn) cancelBtn.click();
        }

        if (target.matches('.edit-task-btn-list')) {
            const taskItem = target.closest('.task-item');
            if (!taskItem || taskItem.classList.contains('editing-task-item')) return;

            // If another item is being edited, cancel it first
            const otherEditingItem = editTaskListContainer.querySelector('.editing-task-item');
            if (otherEditingItem) {
                const otherCancelBtn = otherEditingItem.querySelector('.cancel-inline-btn');
                if(otherCancelBtn) otherCancelBtn.click();
            }

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

    // Drag and Drop Listener (Simplified from popup.js)
    editTaskListContainer.addEventListener('dragstart', function(event) {
        if (event.target.classList.contains('task-item') && event.target.getAttribute('draggable')) {
            // If a task is being edited, cancel the edit before dragging
            const editingForm = event.target.querySelector('.inline-edit-form');
            if (editingForm) {
                const cancelButton = editingForm.querySelector('.cancel-inline-btn');
                if (cancelButton) cancelButton.click(); // Simulate cancel click
            }
            draggedTaskElementManager = event.target;
            event.dataTransfer.setData('text/plain', event.target.getAttribute('data-task-id'));
            event.target.style.opacity = '0.5';
        }
    });
    editTaskListContainer.addEventListener('dragover', function(event) { event.preventDefault(); });
    editTaskListContainer.addEventListener('drop', async function(event) {
        event.preventDefault();
        if (!draggedTaskElementManager) return;
        const targetTaskElement = event.target.closest('.task-item');
        draggedTaskElementManager.style.opacity = '1';

        if (!targetTaskElement || targetTaskElement === draggedTaskElementManager) {
            draggedTaskElementManager = null; return;
        }
        // Reorder logic (update displayOrder in tasks array and save)
        getTasks(tasks => {
            const taskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item[draggable="true"]'));
            const draggedIndexInDOM = taskElements.indexOf(draggedTaskElementManager);
            const targetIndexInDOM = taskElements.indexOf(targetTaskElement);

            if (draggedIndexInDOM < targetIndexInDOM) {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementManager, targetTaskElement.nextSibling);
            } else {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementManager, targetTaskElement);
            }

            const updatedTaskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item[draggable="true"]'));
            let displayOrderChanged = false;
            updatedTaskElements.forEach((el, index) => {
                const taskId = el.getAttribute('data-task-id');
                const task = tasks.find(t => t.id === taskId);
                if (task && task.displayOrder !== index) {
                    task.displayOrder = index;
                    displayOrderChanged = true;
                }
            });

            if (displayOrderChanged) {
                saveTasks(tasks, (success) => {
                    if (success) {
                        showInfoMessage("Task order updated.", "success", 3000, document);
                        renderManagerTasks(); // Re-render to reflect new order and update buttons
                    } else {
                        showInfoMessage("Failed to save new task order.", "error", 3000, document);
                        renderManagerTasks(); // Re-render to revert to original DOM order from storage
                    }
                });
            }
            draggedTaskElementManager = null;
        });
    });
    editTaskListContainer.addEventListener('dragend', function() {
        if (draggedTaskElementManager) draggedTaskElementManager.style.opacity = '1';
        draggedTaskElementManager = null;
    });

    // Move Up/Down Button Listeners
    editTaskListContainer.addEventListener('click', async function(event) {
        const target = event.target;
        let taskId = null;
        let direction = null;

        const moveUpBtn = target.closest('.move-task-up-btn');
        const moveDownBtn = target.closest('.move-task-down-btn');

        if (moveUpBtn) { taskId = moveUpBtn.getAttribute('data-task-id'); direction = 'up';}
        else if (moveDownBtn) { taskId = moveDownBtn.getAttribute('data-task-id'); direction = 'down'; }

        if (taskId && direction) {
            const currentlyEditing = editTaskListContainer.querySelector('.editing-task-item');
            if (currentlyEditing) {
                showInfoMessage("Please save or cancel current edit before reordering.", "info", 3000, document);
                return;
            }
            await handleManagerMoveTask(taskId, direction);
        }
    });
}

async function handleManagerMoveTask(taskId, direction) {
    getTasks(tasks => {
        const sortedTasks = [...tasks].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const taskIndex = sortedTasks.findIndex(t => t.id === taskId);

        if (taskIndex === -1) {
            showInfoMessage("Error: Task not found.", "error", 3000, document); return;
        }

        let otherTaskIndex = -1;
        if (direction === 'up' && taskIndex > 0) otherTaskIndex = taskIndex - 1;
        else if (direction === 'down' && taskIndex < sortedTasks.length - 1) otherTaskIndex = taskIndex + 1;
        else return; // Cannot move further

        const taskToMove = tasks.find(t => t.id === sortedTasks[taskIndex].id);
        const taskToSwapWith = tasks.find(t => t.id === sortedTasks[otherTaskIndex].id);

        if (!taskToMove || !taskToSwapWith) {
            showInfoMessage("Error finding tasks to swap.", "error", 3000, document); return;
        }

        // Swap displayOrder
        const tempDisplayOrder = taskToMove.displayOrder;
        taskToMove.displayOrder = taskToSwapWith.displayOrder;
        taskToSwapWith.displayOrder = tempDisplayOrder;

        saveTasks(tasks, (success, errorMsg) => {
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
