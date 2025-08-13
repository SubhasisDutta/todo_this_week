// manager.js

document.addEventListener('DOMContentLoaded', function() {
    setupTabSwitching();
    setupDragAndDropListeners();
    setupCoreFeatureListeners();
    setupTaskManagementListeners();
    renderPage();
});

/**
 * Sets up the event listeners for switching between the main tabs.
 */
function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tabs .tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all tabs and content
            tabs.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Activate the clicked tab and its content
            tab.classList.add('active');
            const targetTabId = tab.getAttribute('data-tab');
            document.getElementById(targetTabId).classList.add('active');
        });
    });
}

/**
 * Main function to render all dynamic content on the page.
 * Fetches tasks and populates the different sections of the UI.
 */
async function renderPage() {
    // getTasks is callback-based, so we wrap it in a promise for async/await
    const tasks = await new Promise(resolve => getTasks(resolve));

    // Clear all existing task elements to prevent duplication
    clearAllTaskElements();

    const unassignedTasks = tasks.filter(task => !task.schedule || task.schedule.length === 0);
    const scheduledTasks = tasks.filter(task => task.schedule && task.schedule.length > 0);

    // Render the list of unassigned tasks
    renderUnassignedTasks(unassignedTasks);

    // Render tasks that are scheduled into the weekly grid
    renderScheduledTasks(scheduledTasks);

    // Render the comprehensive priority-based lists
    renderPriorityLists(tasks);
}

/**
 * Clears all task elements from the DOM before a re-render.
 */
function clearAllTaskElements() {
    document.getElementById('unassigned-tasks-list').innerHTML = '';
    document.querySelectorAll('.task-list-dropzone').forEach(dz => dz.innerHTML = '');
    document.getElementById('critical-tasks-list').innerHTML = '';
    document.getElementById('important-tasks-list').innerHTML = '';
    document.getElementById('someday-tasks-list').innerHTML = '';
}

/**
 * Renders tasks into the "Unassigned Tasks" list.
 * @param {Array<Task>} unassignedTasks - The list of tasks to render.
 */
function renderUnassignedTasks(unassignedTasks) {
    const unassignedListElement = document.getElementById('unassigned-tasks-list');
    if (unassignedTasks.length > 0) {
        unassignedTasks.forEach(task => {
            const taskElement = createTaskElement(task, { context: 'unassigned' });
            unassignedListElement.appendChild(taskElement);
        });
    } else {
        unassignedListElement.innerHTML = '<p>No unassigned tasks.</p>';
    }
}

/**
 * Renders scheduled tasks into their corresponding time blocks in the weekly view.
 * @param {Array<Task>} scheduledTasks - The list of tasks that have a schedule.
 */
function renderScheduledTasks(scheduledTasks) {
    scheduledTasks.forEach(task => {
        task.schedule.forEach(scheduleItem => {
            const { day, blockId } = scheduleItem;
            const dropzone = document.querySelector(`.time-block[data-day='${day}'][data-block-id='${blockId}'] .task-list-dropzone`);
            if (dropzone) {
                const taskElement = createTaskElement(task, { context: 'schedule', scheduleItem: scheduleItem });
                dropzone.appendChild(taskElement);
            } else {
                console.warn(`Could not find dropzone for day: ${day}, blockId: ${blockId}`);
            }
        });
    });
}

/**
 * Renders all tasks into the three priority columns with full management controls.
 * @param {Array<Task>} tasks - The complete list of all tasks.
 */
function renderPriorityLists(tasks) {
    const criticalList = document.getElementById('critical-tasks-list');
    const importantList = document.getElementById('important-tasks-list');
    const somedayList = document.getElementById('someday-tasks-list');

    const criticalTasks = tasks.filter(t => t.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantTasks = tasks.filter(t => t.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const somedayTasks = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const renderColumn = (tasksForColumn, columnElement) => {
        if (tasksForColumn.length === 0) {
            columnElement.innerHTML = `<p style="text-align:center; color:#777;">No tasks in this category.</p>`;
            return;
        }
        tasksForColumn.forEach((task, index) => {
            const taskElement = createTaskElement(task, {
                context: 'management',
                index: index,
                total: tasksForColumn.length
            });
            columnElement.appendChild(taskElement);
        });
    };

    renderColumn(criticalTasks, criticalList);
    renderColumn(importantTasks, importantList);
    renderColumn(somedayTasks, somedayList);
}


/**
 * Creates a DOM element for a single task, with variations based on context.
 * @param {Task} task - The task object.
 * @param {object} options - Options to control rendering.
 * @param {string} options.context - The context ('unassigned', 'schedule', 'management').
 * @param {object|null} options.scheduleItem - The specific schedule item if context is 'schedule'.
 * @param {number} options.index - The index of the task in its list (for management controls).
 * @param {number} options.total - The total number of tasks in the list (for management controls).
 * @returns {HTMLElement} The created task item element.
 */
function createTaskElement(task, options = {}) {
    const { context = 'unassigned', scheduleItem = null, index = -1, total = -1 } = options;

    const taskItem = document.createElement('div');
    taskItem.classList.add('task-item', `priority-${task.priority.toLowerCase()}`);
    if (task.completed) {
        taskItem.classList.add('task-completed-edit');
    }
    taskItem.setAttribute('data-task-id', task.id);
    taskItem.setAttribute('draggable', 'true');

    if (scheduleItem) {
        taskItem.setAttribute('data-scheduled-day', scheduleItem.day);
        taskItem.setAttribute('data-scheduled-block-id', scheduleItem.blockId);
    }

    const titleSpan = document.createElement('span');
    titleSpan.classList.add('task-title');

    if (task.type) {
        const iconSpan = document.createElement('span');
        iconSpan.classList.add('task-type-icon');
        iconSpan.textContent = task.type === 'home' ? '🏠' : '🏢';
        iconSpan.setAttribute('aria-label', `${task.type} task`);
        titleSpan.appendChild(iconSpan);
    }

    const textNode = document.createTextNode(task.title);
    if (task.url) {
        const link = document.createElement('a');
        link.href = task.url;
        link.target = '_blank';
        link.appendChild(textNode);
        titleSpan.appendChild(link);
    } else {
        titleSpan.appendChild(textNode);
    }
    taskItem.appendChild(titleSpan);

    if (task.priority === 'CRITICAL' && task.deadline) {
        const deadlineSpan = document.createElement('span');
        deadlineSpan.classList.add('task-deadline-display');
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(task.deadline); deadlineDate.setHours(0, 0, 0, 0);
        const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const utcDeadline = Date.UTC(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
        const dayDiff = Math.round((utcDeadline - utcToday) / (1000 * 60 * 60 * 24));
        let deadlineText = '', deadlineClass = '';
        if (dayDiff > 0) { deadlineText = `${dayDiff}d left`; deadlineClass = 'deadline-future'; }
        else if (dayDiff === 0) { deadlineText = 'Today'; deadlineClass = 'deadline-today'; }
        else { deadlineText = `${Math.abs(dayDiff)}d overdue`; deadlineClass = 'deadline-overdue'; }
        deadlineSpan.textContent = ` (${deadlineText})`;
        deadlineSpan.classList.add(deadlineClass);
        taskItem.appendChild(deadlineSpan);
    }

    if (context === 'management') {
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

        if (index < total - 1) {
            const moveDownButton = document.createElement('button');
            moveDownButton.innerHTML = '&darr;';
            moveDownButton.classList.add('neumorphic-btn', 'move-task-down-btn');
            moveDownButton.title = "Move Down";
            moveDownButton.setAttribute('data-task-id', task.id);
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

        taskItem.appendChild(buttonContainer);
        taskItem.appendChild(editButton);
        taskItem.appendChild(deleteButton);
    }

    return taskItem;
}

function setupTaskManagementListeners() {
    // --- Add Task ---
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const taskTitleInput = document.getElementById('task-title');
            const taskUrlInput = document.getElementById('task-url');
            const taskPriorityInput = document.getElementById('task-priority');
            const taskDeadlineInput = document.getElementById('task-deadline');
            const taskTypeInput = document.getElementById('task-type');

            const title = taskTitleInput.value.trim();
            if (!title) {
                showInfoMessage("Task title is required.", "error", 3000, document);
                return;
            }
            const priority = taskPriorityInput.value;
            let deadline = taskDeadlineInput.value;
            if (priority === 'CRITICAL' && !deadline) {
                showInfoMessage("Deadline is required for CRITICAL tasks.", "error", 3000, document);
                return;
            }
            if (priority !== 'CRITICAL') deadline = null;

            const newTask = await addNewTask(title, taskUrlInput.value.trim(), priority, deadline, taskTypeInput.value);
            if (newTask) {
                taskTitleInput.value = '';
                taskUrlInput.value = '';
                taskPriorityInput.value = 'SOMEDAY';
                taskDeadlineInput.value = '';
                taskTypeInput.value = 'home';
                document.getElementById('task-deadline-group').style.display = 'none';
                showInfoMessage("Task added successfully!", "success", 3000, document);
                renderPage();
            } else {
                showInfoMessage("Failed to add task.", "error", 3000, document);
            }
        });
    }
    // Also handle the deadline field visibility
    const taskPriorityInput = document.getElementById('task-priority');
    if(taskPriorityInput) {
        taskPriorityInput.addEventListener('change', function() {
            document.getElementById('task-deadline-group').style.display = this.value === 'CRITICAL' ? 'block' : 'none';
        });
    }


    // --- Edit/Delete/Move Listeners (Delegated) ---
    const tasksDisplayArea = document.querySelector('.tasks-display-area');
    if (!tasksDisplayArea) return;

    let originalTaskDataForEdit = null;

    tasksDisplayArea.addEventListener('click', async (event) => {
        const target = event.target;

        // Handle Delete
        if (target.matches('.delete-task-btn-list')) {
            const taskId = target.getAttribute('data-task-id');
            if (confirm('Are you sure you want to delete this task?')) {
                await deleteTask(taskId);
                renderPage();
                showInfoMessage('Task deleted.', 'success', 3000, document);
            }
        }

        // Handle Edit
        if (target.matches('.edit-task-btn-list')) {
            const taskItem = target.closest('.task-item');
            if (taskItem.classList.contains('editing-task-item')) return;

            const currentlyEditing = tasksDisplayArea.querySelector('.editing-task-item');
            if (currentlyEditing) {
                currentlyEditing.querySelector('.cancel-inline-btn').click();
            }

            const taskId = target.getAttribute('data-task-id');
            const task = await getTaskById(taskId);
            originalTaskDataForEdit = { ...task };
            taskItem.classList.add('editing-task-item');

            const formHtml = `
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

            taskItem.querySelector('.task-title').style.display = 'none';
            taskItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = 'none');
            taskItem.insertAdjacentHTML('beforeend', formHtml);
        }

        // Handle Cancel Edit
        if (target.matches('.cancel-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            taskItem.classList.remove('editing-task-item');
            taskItem.querySelector('.inline-edit-form').remove();
            taskItem.querySelector('.task-title').style.display = '';
            taskItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = '');
            originalTaskDataForEdit = null;
        }

        // Handle Save Edit
        if (target.matches('.save-inline-btn')) {
            const taskItem = target.closest('.editing-task-item');
            const taskId = taskItem.getAttribute('data-task-id');
            const updatedTask = { ...originalTaskDataForEdit };

            updatedTask.title = taskItem.querySelector('.edit-task-title').value.trim();
            if (!updatedTask.title) {
                showInfoMessage("Title cannot be empty.", "error", 3000, document);
                return;
            }
            updatedTask.url = taskItem.querySelector('.edit-task-url').value.trim();
            updatedTask.priority = taskItem.querySelector('.edit-task-priority').value;
            updatedTask.deadline = taskItem.querySelector('.edit-task-deadline').value;
            updatedTask.type = taskItem.querySelector('.edit-task-type').value;
            updatedTask.completed = taskItem.querySelector('.edit-task-completed').checked;

            if (updatedTask.priority !== 'CRITICAL') updatedTask.deadline = null;

            await updateTask(updatedTask);
            renderPage();
            showInfoMessage('Task updated!', 'success', 3000, document);
        }

        // Handle Move Up/Down
        if (target.matches('.move-task-up-btn') || target.matches('.move-task-down-btn')) {
            const taskId = target.getAttribute('data-task-id');
            const direction = target.matches('.move-task-up-btn') ? 'up' : 'down';
            const tasks = await new Promise(resolve => getTasks(resolve));
            const taskToMove = tasks.find(t => t.id === taskId);
            const priorityGroup = tasks.filter(t => t.priority === taskToMove.priority).sort((a,b) => a.displayOrder - b.displayOrder);
            const currentIndex = priorityGroup.findIndex(t => t.id === taskId);

            let otherIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (otherIndex >= 0 && otherIndex < priorityGroup.length) {
                const otherTask = priorityGroup[otherIndex];
                // Swap displayOrder
                const tempOrder = taskToMove.displayOrder;
                taskToMove.displayOrder = otherTask.displayOrder;
                otherTask.displayOrder = tempOrder;

                await updateTask(taskToMove);
                await updateTask(otherTask);
                renderPage();
            }
        }
    });
}

function setupCoreFeatureListeners() {
    const unassignAllBtn = document.getElementById('unassign-all-btn');
    if (unassignAllBtn) {
        unassignAllBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to remove all tasks from the schedule? They will be moved to the 'Unassigned' list.")) {
                const tasks = await new Promise(resolve => getTasks(resolve));
                tasks.forEach(task => {
                    task.schedule = [];
                });
                await new Promise(resolve => saveTasks(tasks, resolve));
                await renderPage();
                showInfoMessage("All tasks have been unscheduled.", "success", 3000, document);
            }
        });
    }
}

/**
 * Sets up all the drag and drop event listeners for the manager page.
 * Uses event delegation on the main container for efficiency.
 */
function setupDragAndDropListeners() {
    const container = document.querySelector('.manager-container');
    let draggedElement = null;

    container.addEventListener('dragstart', (event) => {
        const taskItem = event.target.closest('.task-item');
        if (taskItem) {
            draggedElement = taskItem;
            const taskId = taskItem.getAttribute('data-task-id');
            event.dataTransfer.setData('text/plain', taskId);
            event.dataTransfer.effectAllowed = 'move';
            setTimeout(() => {
                taskItem.classList.add('dragging');
            }, 0);
        }
    });

    container.addEventListener('dragover', (event) => {
        event.preventDefault();
        const dropzone = event.target.closest('.task-list-dropzone, #unassigned-tasks-list');
        if (dropzone) {
            // Add visual feedback
            dropzone.classList.add('drag-over');
        }
    });

    container.addEventListener('dragleave', (event) => {
        const dropzone = event.target.closest('.task-list-dropzone, #unassigned-tasks-list');
        if (dropzone) {
            dropzone.classList.remove('drag-over');
        }
    });

    container.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (!draggedElement) return;

        const dropTarget = event.target;
        const dropzone = dropTarget.closest('.task-list-dropzone, #unassigned-tasks-list');

        if (dropzone) {
            dropzone.classList.remove('drag-over');
            const taskId = event.dataTransfer.getData('text/plain');
            const tasks = await new Promise(resolve => getTasks(resolve));
            const task = tasks.find(t => t.id === taskId);

            if (!task) {
                console.error("Dragged task not found!");
                return;
            }

            // --- Handle the drop logic ---
            const targetTimeBlock = dropTarget.closest('.time-block');

            // Case 1: Dropping into the 'Unassigned' list
            if (dropzone.id === 'unassigned-tasks-list') {
                const originDay = draggedElement.getAttribute('data-scheduled-day');
                const originBlockId = draggedElement.getAttribute('data-scheduled-block-id');
                if (originDay && originBlockId) { // Only unschedule if it came from a schedule block
                    task.schedule = task.schedule.filter(item => !(item.day === originDay && item.blockId === originBlockId));
                    await new Promise(resolve => saveTasks(tasks, resolve));
                    await renderPage();
                }
            }
            // Case 2: Dropping into a time block
            else if (targetTimeBlock) {
                const limit = targetTimeBlock.getAttribute('data-task-limit');
                const day = targetTimeBlock.getAttribute('data-day');
                const blockId = targetTimeBlock.getAttribute('data-block-id');

                if (limit === '0') {
                    showInfoMessage('This block is not available for tasks.', 'error', 3000, document);
                    return;
                }
                if (limit === '1' && dropzone.children.length > 0 && !dropzone.contains(draggedElement)) {
                    showInfoMessage('This block can only hold one task.', 'error', 3000, document);
                    return;
                }

                // Add to schedule if not already there
                const alreadyExists = task.schedule.some(item => item.day === day && item.blockId === blockId);
                if (!alreadyExists) {
                    // If moving from another block, we need to remove the old entry
                    const originDay = draggedElement.getAttribute('data-scheduled-day');
                    const originBlockId = draggedElement.getAttribute('data-scheduled-block-id');
                    if(originDay && originBlockId) {
                        task.schedule = task.schedule.filter(item => !(item.day === originDay && item.blockId === originBlockId));
                    }

                    task.schedule.push({ day, blockId });
                    await new Promise(resolve => saveTasks(tasks, resolve));
                    await renderPage();
                }
            }
        }
    });

    container.addEventListener('dragend', (event) => {
        if (draggedElement) {
            draggedElement.classList.remove('dragging');
            draggedElement = null;
        }
        // Clean up any stray drag-over classes
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
}
