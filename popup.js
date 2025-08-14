// popup.js

// --- Task Rendering Functions ---

function renderTasks(tabName = 'today') {
    getTasks(allTasks => {
        let itemsToRender = [];
        let taskListElement;
        let isAssignmentView = false;

        const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();
        const todayName = dayMapping[today.getDay()];

        if (tabName === 'today') {
            isAssignmentView = true;
            taskListElement = document.getElementById('today-task-list');
            const timeBlockOrder = TIME_BLOCKS.reduce((acc, block, index) => {
                acc[block.id] = index;
                return acc;
            }, {});

            allTasks.forEach(task => {
                task.schedule.forEach(scheduleItem => {
                    if (scheduleItem.day === todayName) {
                        const block = TIME_BLOCKS.find(b => b.id === scheduleItem.blockId);
                        itemsToRender.push({
                            ...task,
                            scheduleItem: scheduleItem,
                            sortOrder: timeBlockOrder[scheduleItem.blockId],
                            timeMarker: block ? block.time : ''
                        });
                    }
                });
            });
            itemsToRender.sort((a, b) => a.sortOrder - b.sortOrder);

        } else if (tabName === 'display') {
            taskListElement = document.getElementById('display-task-list');
            itemsToRender = allTasks.filter(task => !task.completed);
            const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
            itemsToRender.sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return (a.displayOrder || 0) - (b.displayOrder || 0);
            });
        } else if (tabName === 'add') {
            return; // No tasks to render
        }

        if (!taskListElement) {
            console.error(`Task list element for tab '${tabName}' not found.`);
            return;
        }

        taskListElement.innerHTML = '';

        if (itemsToRender.length === 0) {
            let message = "No tasks yet.";
            if (tabName === 'today') message = "No tasks scheduled for today.";
            else if (tabName === 'display') message = "No active tasks. Add some in the ADD tab!";
            else if (tabName === 'edit') message = "No tasks to edit. Add one in the ADD tab!";
            taskListElement.innerHTML = `<p>${message}</p>`;
            return;
        }

        itemsToRender.forEach((item, index) => {
            const task = isAssignmentView ? item : item;
            const scheduleItem = isAssignmentView ? item.scheduleItem : null;

            const taskItem = document.createElement('div');
            taskItem.classList.add('task-item', `priority-${task.priority}`);

            const isItemCompleted = isAssignmentView ? scheduleItem.completed : task.completed;
            if (isItemCompleted) {
                taskItem.classList.add('task-completed');
            } else {
                if (task.energy === 'low') taskItem.classList.add('energy-low-incomplete');
                else if (task.energy === 'high') taskItem.classList.add('energy-high-incomplete');
            }
            taskItem.setAttribute('data-task-id', task.id);
            if (isAssignmentView) {
                taskItem.dataset.day = scheduleItem.day;
                taskItem.dataset.blockId = scheduleItem.blockId;
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isItemCompleted;

            const checkboxId = isAssignmentView
                ? `assign-check-${task.id}-${scheduleItem.day}-${scheduleItem.blockId}`
                : `master-check-${task.id}`;
            checkbox.id = checkboxId;
            checkbox.classList.add(isAssignmentView ? 'assignment-complete-checkbox' : 'task-complete-checkbox');
            taskItem.appendChild(checkbox);

            if (tabName !== 'edit') {
                const checkboxLabel = document.createElement('label');
                checkboxLabel.classList.add('neumorphic-checkbox-label');
                checkboxLabel.setAttribute('for', checkboxId);
                taskItem.appendChild(checkboxLabel);
            } else {
                checkbox.style.display = 'none';
            }

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('task-title');

            if (isAssignmentView && item.timeMarker) {
                const timeMarkerSpan = document.createElement('span');
                timeMarkerSpan.classList.add('time-marker');
                timeMarkerSpan.textContent = `${item.timeMarker} `;
                titleSpan.appendChild(timeMarkerSpan);
            }

            if (task.url) {
                const link = document.createElement('a');
                link.href = task.url;
                link.textContent = task.title;
                link.target = '_blank';
                titleSpan.appendChild(link);
            } else {
                const textNode = document.createTextNode(task.title);
                titleSpan.appendChild(textNode);
            }
            taskItem.appendChild(titleSpan);

            if (task.priority === 'CRITICAL' && task.deadline) {
                // (Deadline rendering logic remains the same)
            }

            if (tabName === 'edit') {
                // (Edit buttons rendering logic remains the same)
            } else if (tabName === 'display' || tabName === 'today') {
                taskItem.setAttribute('draggable', 'true');
            }

            taskListElement.appendChild(taskItem);
        });
    });
}
// --- End of Task Rendering Functions ---

// --- Task Completion Functionality ---
function renderAllTabs() {
    renderTasks('today');
    renderTasks('display');
}

function setupTaskCompletionListeners() {
    const taskListContainers = [
        document.getElementById('today-task-list'),
        document.getElementById('display-task-list')
    ];

    taskListContainers.forEach(container => {
        if (!container) return;
        container.addEventListener('click', async function(event) {
            const target = event.target;
            const taskItem = target.closest('.task-item');
            if (!taskItem) return;

            const taskId = taskItem.dataset.taskId;
            const isCompleted = target.checked;

            if (target.matches('.task-complete-checkbox')) { // Master checkbox
                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    if (task.schedule && task.schedule.length > 0) {
                        task.schedule.forEach(item => item.completed = isCompleted);
                    }
                    await updateTask(task);
                    renderAllTabs();
                }
            } else if (target.matches('.assignment-complete-checkbox')) { // Assignment checkbox
                const day = taskItem.dataset.day;
                const blockId = taskItem.dataset.blockId;
                const task = await getTaskById(taskId);
                if (task) {
                    const scheduleItem = task.schedule.find(item => item.day === day && item.blockId === blockId);
                    if (scheduleItem) {
                        scheduleItem.completed = isCompleted;
                        await updateTask(task); // This will auto-update parent task's `completed` status
                        renderAllTabs();
                    }
                }
            }
        });
    });
}
// --- End of Task Completion Functionality ---

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
            const targetContent = document.getElementById(targetTabId);
            if(targetContent) {
                targetContent.classList.add('active');
            }

            renderTasks(targetTabId);
        });
    });

    const addTaskBtn = document.getElementById('add-task-btn');
    const taskTitleInput = document.getElementById('task-title');
    const taskUrlInput = document.getElementById('task-url');
    const taskDeadlineGroup = document.getElementById('task-deadline-group');
    const taskDeadlineInput = document.getElementById('task-deadline');

    const priorityRadios = document.querySelectorAll('input[name="priority"]');
    priorityRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'CRITICAL') {
                taskDeadlineGroup.style.display = 'block';
            } else {
                taskDeadlineGroup.style.display = 'none';
                taskDeadlineInput.value = '';
            }
        });
    });

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const title = taskTitleInput.value.trim();
            const url = taskUrlInput.value.trim();
            const priority = document.querySelector('input[name="priority"]:checked').value;
            const type = document.querySelector('input[name="type"]:checked').value;
            let deadline = taskDeadlineInput.value;
            const energy = document.querySelector('input[name="energy"]:checked').value;

            if (!title) {
                showInfoMessage("Task title is required.", "error", 3000, document);
                return;
            }
            if (priority === 'CRITICAL' && !deadline) {
                showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document);
                return;
            }
            if (priority !== 'CRITICAL') deadline = null;

            const newTask = await addNewTask(title, url, priority, deadline, type, energy);
            if (newTask) {
                taskTitleInput.value = '';
                taskUrlInput.value = '';
                document.getElementById('priority-someday').checked = true;
                document.getElementById('type-home').checked = true;
                taskDeadlineInput.value = '';
                taskDeadlineGroup.style.display = 'none';
                showInfoMessage("Task added successfully!", "success", 3000, document);
                renderAllTabs();
            } else {
                showInfoMessage("Failed to add task. Please try again.", "error", 3000, document);
            }
        });
    }

    renderAllTabs();

    setupTaskCompletionListeners();
    setupDisplayTabDragAndDropListeners();

    const openManagerBtn = document.getElementById('open-manager-btn');
    if (openManagerBtn) {
        openManagerBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('manager.html') });
        });
    }
});
