// manager.js

document.addEventListener('DOMContentLoaded', function() {
    setupTabSwitching();
    setupDragAndDropListeners();
    setupCoreFeatureListeners();
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
            const taskElement = createTaskElement(task);
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
            // Find the correct dropzone based on the schedule data
            const dropzone = document.querySelector(`.time-block[data-day='${day}'][data-block-id='${blockId}'] .task-list-dropzone`);
            if (dropzone) {
                // Pass the specific schedule item to create a unique element for this instance
                const taskElement = createTaskElement(task, scheduleItem);
                dropzone.appendChild(taskElement);
            } else {
                console.warn(`Could not find dropzone for day: ${day}, blockId: ${blockId}`);
            }
        });
    });
}

/**
 * Renders all tasks into the three priority columns for a complete overview.
 * @param {Array<Task>} tasks - The complete list of all tasks.
 */
function renderPriorityLists(tasks) {
    const criticalList = document.getElementById('critical-tasks-list');
    const importantList = document.getElementById('important-tasks-list');
    const somedayList = document.getElementById('someday-tasks-list');

    const criticalTasks = tasks.filter(t => t.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantTasks = tasks.filter(t => t.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const somedayTasks = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    criticalTasks.forEach(task => criticalList.appendChild(createTaskElement(task)));
    importantTasks.forEach(task => importantList.appendChild(createTaskElement(task)));
    somedayTasks.forEach(task => somedayList.appendChild(createTaskElement(task)));

    if (criticalTasks.length === 0) criticalList.innerHTML = '<p style="text-align:center; color:#777;">No critical tasks.</p>';
    if (importantTasks.length === 0) importantList.innerHTML = '<p style="text-align:center; color:#777;">No important tasks.</p>';
    if (somedayTasks.length === 0) somedayList.innerHTML = '<p style="text-align:center; color:#777;">No someday tasks.</p>';
}


/**
 * Creates a DOM element for a single task.
 * @param {Task} task - The task object.
 * @param {object|null} scheduleItem - If scheduled, the specific schedule object {day, blockId}.
 * @returns {HTMLElement} The created task item element.
 */
function createTaskElement(task, scheduleItem = null) {
    const taskItem = document.createElement('div');
    taskItem.classList.add('task-item', `priority-${task.priority.toLowerCase()}`);
    if (task.completed) {
        taskItem.classList.add('task-completed-edit');
    }
    taskItem.setAttribute('data-task-id', task.id);
    taskItem.setAttribute('draggable', 'true');

    // If the task is rendered in a schedule, add data attributes for its location
    if (scheduleItem) {
        taskItem.setAttribute('data-scheduled-day', scheduleItem.day);
        taskItem.setAttribute('data-scheduled-block-id', scheduleItem.blockId);
    }

    const titleSpan = document.createElement('span');
    titleSpan.classList.add('task-title');

    // Add task type icon
    if (task.type) {
        const iconSpan = document.createElement('span');
        iconSpan.classList.add('task-type-icon');
        iconSpan.textContent = task.type === 'home' ? '🏠' : '🏢';
        iconSpan.setAttribute('aria-label', `${task.type} task`);
        titleSpan.appendChild(iconSpan);
    }

    // Append title text or link
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

    // Add deadline info for critical tasks
    if (task.priority === 'CRITICAL' && task.deadline) {
        const deadlineSpan = document.createElement('span');
        deadlineSpan.classList.add('task-deadline-display');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(task.deadline);
        deadlineDate.setHours(0, 0, 0, 0);

        // Adjust for timezone offset to compare dates correctly
        const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const utcDeadline = Date.UTC(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate());
        const dayDiff = Math.round((utcDeadline - utcToday) / (1000 * 60 * 60 * 24));

        let deadlineText = '';
        let deadlineClass = '';
        if (dayDiff > 0) {
            deadlineText = `${dayDiff}d left`;
            deadlineClass = 'deadline-future';
        } else if (dayDiff === 0) {
            deadlineText = 'Today';
            deadlineClass = 'deadline-today';
        } else {
            deadlineText = `${Math.abs(dayDiff)}d overdue`;
            deadlineClass = 'deadline-overdue';
        }
        deadlineSpan.textContent = ` (${deadlineText})`;
        deadlineSpan.classList.add(deadlineClass);
        taskItem.appendChild(deadlineSpan);
    }

    return taskItem;
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
