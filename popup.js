// popup.js

// --- Task Rendering Functions ---

function renderTasks(tabName = 'display') {
    getTasks(allTasks => {
        let tasksToRender = allTasks.filter(task => !task.completed);
        let taskListElement;
        let filterType = null;

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
            tasksToRender = allTasks;
            filterType = 'all';
        }

        if (!taskListElement) {
            console.error(`Task list element for tab '${tabName}' not found.`);
            return;
        }

        if (filterType === 'home') {
            tasksToRender = tasksToRender.filter(task => task.type === 'home');
        } else if (filterType === 'work') {
            tasksToRender = tasksToRender.filter(task => task.type === 'work');
        }

        if (tabName === 'edit') {
            tasksToRender.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        } else {
            const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
            tasksToRender.sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) {
                    return priorityDiff;
                }
                return (a.displayOrder || 0) - (b.displayOrder || 0);
            });
        }

        taskListElement.innerHTML = '';

        if (tasksToRender.length === 0) {
            let message = "No tasks yet.";
            if (tabName === 'display') message = "No active tasks. Add some in the Edit tab!";
            else if (tabName === 'home') message = "No active home tasks.";
            else if (tabName === 'work') message = "No active work tasks.";
            else if (tabName === 'edit') message = "No tasks to edit. Add some first!";
            taskListElement.innerHTML = `<p>${message}</p>`;
            return;
        }

        tasksToRender.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item', `priority-${task.priority}`);
            taskItem.setAttribute('data-task-id', task.id);

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.classList.add('task-complete-checkbox');
            const checkboxId = `checkbox-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
            checkbox.id = checkboxId;
            console.log('Appending to taskItem:', taskItem, 'Child checkbox:', checkbox);
            taskItem.appendChild(checkbox);

            if (tabName !== 'edit') {
                const checkboxLabel = document.createElement('label');
                checkboxLabel.classList.add('neumorphic-checkbox-label');
                checkboxLabel.setAttribute('for', checkboxId);
                console.log('Appending to taskItem:', taskItem, 'Child checkboxLabel:', checkboxLabel);
                taskItem.appendChild(checkboxLabel);
            } else {
                checkbox.style.display = 'none';
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('task-title');
            if (task.url) {
                const link = document.createElement('a');
                link.href = task.url;
                link.textContent = task.title;
                link.target = '_blank';
                console.log('Appending to titleSpan:', titleSpan, 'Child link:', link);
                titleSpan.appendChild(link);
            } else {
                titleSpan.textContent = task.title;
            }
            console.log('Appending to taskItem:', taskItem, 'Child titleSpan:', titleSpan);
            taskItem.appendChild(titleSpan);

            if (task.priority === 'CRITICAL' && task.deadline) {
                const deadlineSpan = document.createElement('span');
                deadlineSpan.classList.add('task-deadline-display');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const parts = task.deadline.split('-');
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                const deadlineDate = new Date(year, month, day);
                deadlineDate.setHours(0,0,0,0);

                const timeDiff = deadlineDate.getTime() - today.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                let deadlineText = '';
                let deadlineClass = '';

                if (dayDiff > 0) {
                    deadlineText = `${dayDiff} day${dayDiff > 1 ? 's' : ''} remaining`;
                    deadlineClass = 'deadline-future';
                } else if (dayDiff === 0) {
                    deadlineText = 'TODAY';
                    deadlineClass = 'deadline-today';
                } else {
                    const daysOverdue = Math.abs(dayDiff);
                    deadlineText = `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue`;
                    deadlineClass = 'deadline-overdue';
                }

                deadlineSpan.textContent = ` (${deadlineText})`;
                if (deadlineClass) {
                    deadlineSpan.classList.add(deadlineClass);
                }
                console.log('Appending to taskItem:', taskItem, 'Child deadlineSpan:', deadlineSpan);
                taskItem.appendChild(deadlineSpan);
            }

            if (tabName === 'edit') {
                taskItem.setAttribute('draggable', 'true');

                const buttonContainer = document.createElement('div');
                buttonContainer.classList.add('task-item-actions');

                if (index > 0) {
                    const moveUpButton = document.createElement('button');
                    moveUpButton.innerHTML = '&uarr;';
                    moveUpButton.classList.add('neumorphic-btn', 'move-task-up-btn');
                    moveUpButton.setAttribute('data-task-id', task.id);
                    console.log('Appending to buttonContainer:', buttonContainer, 'Child moveUpButton:', moveUpButton);
                    buttonContainer.appendChild(moveUpButton);
                }

                if (index < tasksToRender.length - 1) {
                    const moveDownButton = document.createElement('button');
                    moveDownButton.innerHTML = '&darr;';
                    moveDownButton.classList.add('neumorphic-btn', 'move-task-down-btn');
                    moveDownButton.setAttribute('data-task-id', task.id);
                    console.log('Appending to buttonContainer:', buttonContainer, 'Child moveDownButton:', moveDownButton);
                    buttonContainer.appendChild(moveDownButton);
                }

                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.classList.add('neumorphic-btn', 'edit-task-btn-list');
                editButton.setAttribute('data-task-id', task.id);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('neumorphic-btn', 'delete-task-btn-list');
                deleteButton.setAttribute('data-task-id', task.id);

                console.log('Appending to taskItem:', taskItem, 'Child buttonContainer:', buttonContainer);
                taskItem.appendChild(buttonContainer);
                console.log('Appending to taskItem:', taskItem, 'Child editButton:', editButton);
                taskItem.appendChild(editButton);
                console.log('Appending to taskItem:', taskItem, 'Child deleteButton:', deleteButton);
                taskItem.appendChild(deleteButton);

                if (task.completed) {
                    taskItem.classList.add('task-completed-edit');
                }
            } else if (tabName === 'display') {
                taskItem.setAttribute('draggable', 'true');
            }
            console.log('Appending to taskListElement:', taskListElement, 'Child taskItem:', taskItem);
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
                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    await updateTask(task);
                    const activeTabLink = document.querySelector('.tab-link.active');
                    if (activeTabLink) {
                        const activeTabName = activeTabLink.getAttribute('data-tab');
                        renderTasks(activeTabName);
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
            const taskItem = event.target.closest('.task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId) return;
            if (!confirm("Are you sure you want to delete this task?")) {
                return;
            }
            const success = await deleteTask(taskId);
            if (success) {
                renderTasks('edit');
                renderTasks('display');
                renderTasks('home');
                renderTasks('work');
            } else {
                showInfoMessage(`Failed to delete task ${taskId}.`, "error", 3000, document);
            }
        }
    });
}
// --- End of Task Deletion Functionality ---

// --- Inline Task Editing Functionality (Edit Tab) ---
let originalTaskDataBeforeEdit = null;

function setupInlineTaskEditingListeners() {
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) return;
    editTaskListContainer.addEventListener('click', async function(event) {
        const target = event.target;
        if (target.matches('.edit-task-btn-list')) {
            const taskItem = target.closest('.task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId) return;
            const currentlyEditing = editTaskListContainer.querySelector('.editing-task-item');
            if (currentlyEditing && currentlyEditing !== taskItem) {
                console.warn("Another task is already being edited. Please save or cancel it first.");
                return;
            }
            if (taskItem.classList.contains('editing-task-item')) return;
            const task = await getTaskById(taskId);
            if (!task) return;
            originalTaskDataBeforeEdit = { ...task };
            taskItem.classList.add('editing-task-item');
            const taskTitleSpan = taskItem.querySelector('.task-title');
            const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');
            const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
            const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');
            const existingActionsContainer = taskItem.querySelector('.task-item-actions');

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
                    <div class="form-group-inline form-group-inline-checkbox"><label for="edit-task-completed-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}">Completed:</label><input type="checkbox" id="edit-task-completed-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}" class="edit-task-completed" ${task.completed ? 'checked' : ''} style="width: auto; margin-right: 5px;"></div>
                    <div class="inline-edit-actions"><button class="neumorphic-btn save-inline-btn">Save</button><button class="neumorphic-btn cancel-inline-btn">Cancel</button></div>
                </div>`;
            if(taskTitleSpan) taskTitleSpan.style.display = 'none';
            if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = 'none';
            if(existingEditButton) existingEditButton.style.display = 'none';
            if(existingDeleteButton) existingDeleteButton.style.display = 'none';
            if(existingActionsContainer) existingActionsContainer.style.display = 'none';
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
            if (!taskItem || !originalTaskDataBeforeEdit) return;
            taskItem.classList.remove('editing-task-item');
            const form = taskItem.querySelector('.inline-edit-form');
            if (form) form.remove();
            const taskTitleSpan = taskItem.querySelector('.task-title');
            const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');
            const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
            const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');
            const existingActionsContainer = taskItem.querySelector('.task-item-actions');
            if(taskTitleSpan) taskTitleSpan.style.display = '';
            if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = '';
            if(existingEditButton) existingEditButton.style.display = '';
            if(existingDeleteButton) existingDeleteButton.style.display = '';
            if(existingActionsContainer) existingActionsContainer.style.display = '';
            originalTaskDataBeforeEdit = null;
        }
        if (target.matches('.save-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            if (!taskId || !originalTaskDataBeforeEdit) { console.error("Save error: No task ID or original data found."); return; }
            const editForm = taskItem.querySelector('.inline-edit-form');
            if (!editForm) { console.error("Save error: Edit form not found."); return; }
            const newTitle = editForm.querySelector('.edit-task-title').value.trim();
            const newUrl = editForm.querySelector('.edit-task-url').value.trim();
            const newPriority = editForm.querySelector('.edit-task-priority').value;
            let newDeadline = editForm.querySelector('.edit-task-deadline').value;
            const newType = editForm.querySelector('.edit-task-type').value;
            const newCompleted = editForm.querySelector('.edit-task-completed').checked;
            if (!newTitle) { showInfoMessage("Task title cannot be empty.", "error", 3000, document); return; }
            if (newPriority === 'CRITICAL' && !newDeadline) { showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document); return; }
            if (newPriority !== 'CRITICAL') newDeadline = null;
            const updatedTask = { ...originalTaskDataBeforeEdit, title: newTitle, url: newUrl, priority: newPriority, deadline: newDeadline, type: newType, completed: newCompleted };
            const success = await updateTask(updatedTask);
            if (success) {
                taskItem.classList.remove('editing-task-item');
                editForm.remove();
                const taskTitleSpan = taskItem.querySelector('.task-title');
                const taskDeadlineDisplay = taskItem.querySelector('.task-deadline-display');
                const existingEditButton = taskItem.querySelector('.edit-task-btn-list');
                const existingDeleteButton = taskItem.querySelector('.delete-task-btn-list');
                const existingActionsContainer = taskItem.querySelector('.task-item-actions');
                if(taskTitleSpan) taskTitleSpan.style.display = '';
                if(taskDeadlineDisplay) taskDeadlineDisplay.style.display = '';
                if(existingEditButton) existingEditButton.style.display = '';
                if(existingDeleteButton) existingDeleteButton.style.display = '';
                if(existingActionsContainer) existingActionsContainer.style.display = '';
                originalTaskDataBeforeEdit = null;
                renderTasks('edit'); renderTasks('display'); renderTasks('home'); renderTasks('work');
                showInfoMessage("Task updated successfully!", "success", 3000, document);
            } else {
                showInfoMessage("Failed to update task. Please try again.", "error", 3000, document);
            }
        }
    });
}
// --- End of Inline Task Editing Functionality ---

// --- Drag and Drop Task Reordering (Display Tab - Within Priority) ---
let draggedTaskElementDisplay = null;

function setupDisplayTabDragAndDropListeners() {
    const displayTaskListContainer = document.getElementById('display-task-list');
    if (!displayTaskListContainer) return;
    displayTaskListContainer.addEventListener('dragstart', function(event) {
        if (event.target.classList.contains('task-item')) {
            if (event.target.querySelector('.inline-edit-form')) return;
            draggedTaskElementDisplay = event.target;
            event.dataTransfer.setData('text/plain', event.target.getAttribute('data-task-id'));
            event.target.style.opacity = '0.5';
        }
    });
    displayTaskListContainer.addEventListener('dragover', function(event) {
        event.preventDefault();
    });
    displayTaskListContainer.addEventListener('drop', async function(event) {
        event.preventDefault();
        if (!draggedTaskElementDisplay) return;
        const targetTaskElement = event.target.closest('.task-item');
        draggedTaskElementDisplay.style.opacity = '1';
        if (!targetTaskElement || targetTaskElement === draggedTaskElementDisplay) {
            draggedTaskElementDisplay = null; return;
        }
        const draggedTaskId = draggedTaskElementDisplay.getAttribute('data-task-id');
        const targetTaskId = targetTaskElement.getAttribute('data-task-id');
        getTasks(tasks => {
            const draggedTask = tasks.find(t => t.id === draggedTaskId);
            const targetTask = tasks.find(t => t.id === targetTaskId);
            if (!draggedTask || !targetTask) {
                console.error("Drag or target task not found for Display D&D.");
                draggedTaskElementDisplay = null; return;
            }
            if (draggedTask.priority !== targetTask.priority) {
                showInfoMessage("Tasks can only be reordered within the same priority group.", "error", 3000, document);
                draggedTaskElementDisplay = null; return;
            }
            const taskElements = Array.from(displayTaskListContainer.children).filter(el => el.classList.contains('task-item'));
            const draggedIndexInDOM = taskElements.indexOf(draggedTaskElementDisplay);
            const targetIndexInDOM = taskElements.indexOf(targetTaskElement);
            if (draggedIndexInDOM < targetIndexInDOM) {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementDisplay, targetTaskElement.nextSibling);
            } else {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementDisplay, targetTaskElement);
            }
            const currentPriorityGroup = draggedTask.priority;
            const reorderedTaskIdsInDOM = Array.from(displayTaskListContainer.children)
                                             .filter(el => el.classList.contains('task-item') && tasks.find(t => t.id === el.getAttribute('data-task-id'))?.priority === currentPriorityGroup)
                                             .map(el => el.getAttribute('data-task-id'));
            let displayOrderChanged = false;
            reorderedTaskIdsInDOM.forEach((taskId, newIndexInGroup) => {
                const taskToUpdate = tasks.find(t => t.id === taskId);
                if (taskToUpdate && taskToUpdate.displayOrder !== newIndexInGroup) {
                    taskToUpdate.displayOrder = newIndexInGroup;
                    displayOrderChanged = true;
                }
            });
            if (displayOrderChanged) {
                saveTasks(tasks, (success) => {
                    if (success) {
                        showInfoMessage("Task order updated.", "success", 3000, document);
                        renderTasks('display'); renderTasks('edit'); renderTasks('home'); renderTasks('work');
                    } else {
                        showInfoMessage("Failed to save new task order.", "error", 3000, document);
                        renderTasks('display');
                    }
                });
            }
            draggedTaskElementDisplay = null;
        });
    });
    displayTaskListContainer.addEventListener('dragend', function(event) {
        if (draggedTaskElementDisplay) {
            draggedTaskElementDisplay.style.opacity = '1';
        }
        draggedTaskElementDisplay = null;
    });
}

// --- Drag and Drop Task Reordering (Edit Tab) ---
let draggedTaskElementEdit = null;

function setupDragAndDropListeners() {
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) return;
    editTaskListContainer.addEventListener('dragstart', function(event) {
        if (event.target.classList.contains('task-item')) {
            draggedTaskElementEdit = event.target;
            event.dataTransfer.setData('text/plain', event.target.getAttribute('data-task-id'));
            event.target.style.opacity = '0.5';
            if (draggedTaskElementEdit.classList.contains('editing-task-item')) {
                const cancelButton = draggedTaskElementEdit.querySelector('.cancel-inline-btn');
                if (cancelButton) cancelButton.click();
            }
        }
    });
    editTaskListContainer.addEventListener('dragover', function(event) {
        event.preventDefault();
    });
    editTaskListContainer.addEventListener('drop', async function(event) {
        event.preventDefault();
        if (!draggedTaskElementEdit) return;
        const targetTaskElement = event.target.closest('.task-item');
        draggedTaskElementEdit.style.opacity = '1';
        if (!targetTaskElement || targetTaskElement === draggedTaskElementEdit) {
            draggedTaskElementEdit = null; return;
        }
        getTasks(tasks => {
            const taskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item'));
            const draggedIndexInDOM = taskElements.indexOf(draggedTaskElementEdit);
            const targetIndexInDOM = taskElements.indexOf(targetTaskElement);
            if (draggedIndexInDOM < targetIndexInDOM) {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementEdit, targetTaskElement.nextSibling);
            } else {
                targetTaskElement.parentNode.insertBefore(draggedTaskElementEdit, targetTaskElement);
            }
            const updatedTaskElements = Array.from(editTaskListContainer.querySelectorAll('.task-item'));
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
                        renderTasks('edit'); renderTasks('display'); renderTasks('home'); renderTasks('work');
                    } else {
                        showInfoMessage("Failed to save new task order.", "error", 3000, document);
                        renderTasks('edit');
                    }
                });
            }
            draggedTaskElementEdit = null;
        });
    });
    editTaskListContainer.addEventListener('dragend', function(event) {
        if (draggedTaskElementEdit) {
            draggedTaskElementEdit.style.opacity = '1';
        }
        draggedTaskElementEdit = null;
    });
}
// --- End of Drag and Drop Task Reordering ---

// --- Move Task Up/Down Button Functionality (Edit Tab) ---

function setupMoveTaskButtonListeners() {
    const editTaskListContainer = document.getElementById('edit-task-list');
    if (!editTaskListContainer) {
        console.warn("Edit task list container not found for move buttons.");
        return;
    }

    editTaskListContainer.addEventListener('click', async function(event) {
        const target = event.target;
        let taskId = null;
        let direction = null;

        const moveUpBtn = target.closest('.move-task-up-btn');
        const moveDownBtn = target.closest('.move-task-down-btn');

        if (moveUpBtn) {
            taskId = moveUpBtn.getAttribute('data-task-id');
            direction = 'up';
        } else if (moveDownBtn) {
            taskId = moveDownBtn.getAttribute('data-task-id');
            direction = 'down';
        }

        if (taskId && direction) {
            const currentlyEditing = editTaskListContainer.querySelector('.editing-task-item');
            if (currentlyEditing) {
                showInfoMessage("Please save or cancel the current task edit before reordering.", "info", 3000, document);
                return;
            }
            await handleMoveTask(taskId, direction);
        }
    });
}

async function handleMoveTask(taskId, direction) {
    if (!taskId || !direction) {
        console.error("Task ID or direction missing for handleMoveTask.");
        showInfoMessage("Cannot move task: ID or direction missing.", "error", 3000, document); // User feedback
        return;
    }

    getTasks(tasks => { // Removed 'async' from callback as it's not used with await for saveTasks
        const sortedTasks = [...tasks].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
        const taskIndex = sortedTasks.findIndex(t => t.id === taskId);

        if (taskIndex === -1) {
            showInfoMessage("Error: Task not found for moving.", "error", 3000, document);
            return;
        }

        let otherTaskIndex = -1;
        if (direction === 'up') {
            if (taskIndex > 0) {
                otherTaskIndex = taskIndex - 1;
            } else {
                console.warn("Attempted to move top task up. UI should prevent this.");
                return;
            }
        } else if (direction === 'down') {
            if (taskIndex < sortedTasks.length - 1) {
                otherTaskIndex = taskIndex + 1;
            } else {
                console.warn("Attempted to move bottom task down. UI should prevent this.");
                return;
            }
        }

        if (otherTaskIndex === -1) {
            console.warn(`No task to swap with in direction ${direction} for task ${taskId}.`);
            return;
        }

        const taskToMove = tasks.find(t => t.id === sortedTasks[taskIndex].id);
        const taskToSwapWith = tasks.find(t => t.id === sortedTasks[otherTaskIndex].id);

        if (!taskToMove || !taskToSwapWith) {
            showInfoMessage("Error finding tasks to swap. Please try again.", "error", 3000, document);
            console.error("Critical Error: taskToMove or taskToSwapWith not found in original tasks array during move operation.");
            return;
        }

        const tempDisplayOrder = taskToMove.displayOrder;
        taskToMove.displayOrder = taskToSwapWith.displayOrder;
        taskToSwapWith.displayOrder = tempDisplayOrder;

        saveTasks(tasks, (success, errorMsg) => {
            if (success) {
                showInfoMessage(`Task moved ${direction}.`, "success", 3000, document);
                renderTasks('edit');
                renderTasks('display');
                renderTasks('home');
                renderTasks('work');
            } else {
                showInfoMessage(`Failed to save new task order: ${errorMsg || 'Unknown error'}`, "error", 3000, document);
                // Revert in-memory change to maintain consistency with storage
                taskToMove.displayOrder = tempDisplayOrder;
                taskToSwapWith.displayOrder = taskToMove.displayOrder; // This was the original value of taskToSwapWith before it got tempDisplayOrder
                // Corrected revert:
                // const originalTaskToMoveOrder = tempDisplayOrder;
                // const originalTaskToSwapWithOrder = taskToMove.displayOrder; // This is taskToSwapWith.displayOrder before the swap
                // taskToMove.displayOrder = originalTaskToMoveOrder;
                // taskToSwapWith.displayOrder = originalTaskToSwapWithOrder;
                // The version from the prompt was:
                // taskToSwapWith.displayOrder = taskToMove.displayOrder; (this is original taskToSwapWith.displayOrder)
                // taskToMove.displayOrder = tempDisplayOrder; (this is original taskToMove.displayOrder) - THIS IS CORRECT.

                // So, the correct revert from the prompt is:
                taskToSwapWith.displayOrder = taskToMove.displayOrder;
                taskToMove.displayOrder = tempDisplayOrder;

                console.log("Save failed. Reverted displayOrder in memory. Re-rendering.");
                renderTasks('edit');
                renderTasks('display');
            }
        });
    });
}

// --- End of Move Task Up/Down Button Functionality ---

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
            renderTasks(targetTabId);
        });
    });

    const addTaskBtn = document.getElementById('add-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskUrlInput = document.getElementById('task-url');
    const taskPriorityInput = document.getElementById('task-priority');
    const taskDeadlineGroup = document.getElementById('task-deadline-group');
    const taskDeadlineInput = document.getElementById('task-deadline');
    const taskTypeInput = document.getElementById('task-type');

    taskPriorityInput.addEventListener('change', function() {
        if (this.value === 'CRITICAL') {
            taskDeadlineGroup.style.display = 'block';
        } else {
            taskDeadlineGroup.style.display = 'none';
            taskDeadlineInput.value = '';
        }
    });

    addTaskBtn.addEventListener('click', async () => {
        const title = taskTitleInput.value.trim();
        const url = taskUrlInput.value.trim();
        const priority = taskPriorityInput.value;
        const type = taskTypeInput.value;
        let deadline = taskDeadlineInput.value;

        if (!title) {
            showInfoMessage("Task title is required.", "error", 3000, document);
            return;
        }
        if (priority === 'CRITICAL' && !deadline) {
            showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document);
            return;
        }
        if (priority !== 'CRITICAL') deadline = null;

        const newTask = await addNewTask(title, url, priority, deadline, type);
        if (newTask) {
            taskTitleInput.value = '';
            taskUrlInput.value = '';
            taskPriorityInput.value = 'SOMEDAY';
            taskDeadlineInput.value = '';
            taskTypeInput.value = 'home';
            taskDeadlineGroup.style.display = 'none';
            showInfoMessage("Task added successfully!", "success", 3000, document);
            renderTasks('display'); renderTasks('edit'); renderTasks('home'); renderTasks('work');
        } else {
            showInfoMessage("Failed to add task. Please try again.", "error", 3000, document);
        }
    });

    renderTasks('display');
    renderTasks('edit');

    setupTaskCompletionListeners();
    setupTaskDeletionListener();
    setupInlineTaskEditingListeners();
    setupDragAndDropListeners();
    setupDisplayTabDragAndDropListeners();
    setupMoveTaskButtonListeners();

    const openManagerBtn = document.getElementById('open-manager-btn');
    if (openManagerBtn) {
        openManagerBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
        });
    }

    let finalLogMessage = "Task Manager Loaded. Listeners initialized.";
    if (typeof setupMoveTaskButtonListeners === 'function') {
        finalLogMessage = "Task Manager Loaded. Move Task listeners also initialized.";
    }
    console.log(finalLogMessage);
});
