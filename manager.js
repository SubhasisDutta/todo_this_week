// manager.js

// --- CONSTANTS ---
const TIME_BLOCKS = [
    { id: 'late-night-read', label: 'Late Night Read', time: '[12AM-1AM]', limit: 'multiple', colorClass: 'block-color-sakura' },
    { id: 'sleep', label: 'Sleep', time: '[1AM-7AM]', limit: '0', colorClass: '' },
    { id: 'ai-study', label: 'AI study time', time: '[7AM-8AM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'morning-prep', label: 'Morning Prep Time', time: '[8AM-9AM]', limit: '0', colorClass: '' },
    { id: 'engagement', label: 'Engagement Block', time: '[9AM-12PM]', limit: 'multiple', colorClass: 'block-color-purple' },
    { id: 'lunch', label: 'Lunch Break', time: '[12PM-1PM]', limit: '0', colorClass: '' },
    { id: 'deep-work-1', label: 'Deep Work Block 1', time: '[1PM-3PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'deep-work-2', label: 'Deep Work Block 2', time: '[3PM-6PM]', limit: '1', colorClass: 'block-color-yellow' },
    { id: 'commute-relax', label: 'Commute and Relax', time: '[6PM-8PM]', limit: 'multiple', colorClass: 'block-color-sage' },
    { id: 'family-time', label: 'Family time Block', time: '[8PM-10PM]', limit: 'multiple', colorClass: 'block-color-skyblue' },
    { id: 'night-build', label: 'Night Build Block', time: '[10PM-11PM]', limit: '1', colorClass: 'block-color-orange' }
];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    setupTabSwitching();
    generatePlannerGrid();
    renderPage();
    setupAllListeners();
});

function setupAllListeners() {
    setupDragAndDropListeners();
    setupCoreFeatureListeners();
    setupTaskManagementListeners();
    setupSchedulingListeners();
}

// --- RENDERING LOGIC ---

async function renderPage() {
    const tasks = await new Promise(resolve => getTasks(resolve));

    // --- Render Planner Tab (only active tasks) ---
    clearPlannerTasks();
    const activeTasks = tasks.filter(t => !t.completed);
    const unassignedTasks = activeTasks.filter(t => !t.schedule || t.schedule.length === 0);
    const assignedTasks = activeTasks.filter(t => t.schedule && t.schedule.length > 0);
    renderSidebarLists(unassignedTasks, assignedTasks);

    const assignedGridTasks = tasks.filter(t => t.schedule && t.schedule.length > 0);
    renderTasksOnGrid(assignedGridTasks);

    // --- Render Task Lists Tab (all tasks) ---
    clearPriorityLists();
    renderPriorityLists(tasks);

    // --- Render All Tasks Tab (all tasks) ---
    clearHomeWorkLists();
    renderHomeWorkLists(tasks);
}

function generatePlannerGrid() {
    const plannerGrid = document.getElementById('planner-grid');
    if (plannerGrid.childElementCount > 8) return;

    TIME_BLOCKS.forEach(block => {
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('time-label');
        timeLabel.textContent = block.time;
        plannerGrid.appendChild(timeLabel);

        DAYS.forEach(day => {
            const cell = document.createElement('div');
            cell.classList.add('grid-cell');
            if (block.colorClass) cell.classList.add(block.colorClass);
            cell.dataset.day = day;
            cell.dataset.blockId = block.id;
            cell.dataset.taskLimit = block.limit;
            const cellLabel = document.createElement('div');
            cellLabel.classList.add('grid-cell-label');
            cellLabel.textContent = block.label;
            cell.appendChild(cellLabel);
            plannerGrid.appendChild(cell);
        });
    });
}

function setupSchedulingListeners() {
    const plannerContainer = document.querySelector('.planner-container');
    if (!plannerContainer) return;

    plannerContainer.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.matches('.toggle-schedule-btn')) {
            const taskItem = target.closest('.task-item');
            const scheduleDetails = taskItem.querySelector('.task-schedule-details');
            if (scheduleDetails) {
                const isHidden = scheduleDetails.style.display === 'none';
                scheduleDetails.style.display = isHidden ? 'block' : 'none';
                target.textContent = isHidden ? 'Hide Schedule' : 'Show Schedule';
            }
        }

        if (target.matches('.schedule-task-btn')) {
            const taskItem = target.closest('.task-item');
            const taskId = target.dataset.taskId;
            const currentlyEditing = plannerContainer.querySelector('.editing-schedule');
            if (currentlyEditing) {
                currentlyEditing.querySelector('.cancel-schedule-btn').click();
            }

            const task = await getTaskById(taskId);
            if (!task) return;

            taskItem.classList.add('editing-schedule');
            Array.from(taskItem.children).forEach(child => {
                if (!child.classList.contains('inline-schedule-form')) {
                    child.style.display = 'none';
                }
            });

            const schedulableBlocks = TIME_BLOCKS.filter(b => b.limit !== '0');
            const dayHeaders = DAYS.map(day => `<div class="schedule-header-cell" style="font-size: 0.8em; text-align: center;">${day.charAt(0).toUpperCase() + day.slice(1, 3)}</div>`).join('');

            const bodyRows = schedulableBlocks.map(block => `
                <div class="schedule-block-label" style="font-size: 0.8em; text-align: right; padding-right: 5px;">${block.label}</div>
                ${DAYS.map(day => `
                    <div class="schedule-grid-cell" style="text-align: center;">
                        <input type="checkbox" class="schedule-checkbox" data-day="${day}" data-block-id="${block.id}"
                            ${task.schedule.some(s => s.day === day && s.blockId === block.id) ? 'checked' : ''}>
                    </div>
                `).join('')}
            `).join('');

            const formHtml = `
                <div class="inline-schedule-form">
                    <div class="schedule-form-grid" style="display: grid; grid-template-columns: 120px repeat(7, 1fr); gap: 5px;">
                        <div class="schedule-header-cell"></div>
                        ${dayHeaders}
                        ${bodyRows}
                    </div>
                    <div class="inline-schedule-actions" style="margin-top: 10px; text-align: right;">
                        <button class="neumorphic-btn save-schedule-btn">Save</button>
                        <button class="neumorphic-btn cancel-schedule-btn">Cancel</button>
                    </div>
                </div>
            `;
            taskItem.insertAdjacentHTML('beforeend', formHtml);
        }

        if (target.matches('.cancel-schedule-btn')) {
            const taskItem = target.closest('.editing-schedule');
            if (taskItem) {
                taskItem.classList.remove('editing-schedule');
                const form = taskItem.querySelector('.inline-schedule-form');
                if (form) form.remove();
                Array.from(taskItem.children).forEach(child => {
                    child.style.display = '';
                });
            }
        }

        if (target.matches('.save-schedule-btn')) {
            const taskItem = target.closest('.editing-schedule');
            const taskId = taskItem.dataset.taskId;
            const task = await getTaskById(taskId);
            if (!task) return;

            const newSchedule = [];
            const checkboxes = taskItem.querySelectorAll('.schedule-checkbox:checked');
            checkboxes.forEach(cb => {
                newSchedule.push({
                    day: cb.dataset.day,
                    blockId: cb.dataset.blockId
                });
            });

            task.schedule = newSchedule;
            await updateTask(task);
            renderPage();
        }
    });
}

function clearPlannerTasks() {
    document.getElementById('unassigned-tasks-list').innerHTML = '';
    document.getElementById('assigned-tasks-list').innerHTML = '';
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const label = cell.querySelector('.grid-cell-label');
        cell.innerHTML = '';
        if (label) cell.appendChild(label);
    });
}

function clearPriorityLists() {
    document.getElementById('critical-tasks-list').innerHTML = '';
    document.getElementById('important-tasks-list').innerHTML = '';
    document.getElementById('someday-tasks-list').innerHTML = '';
}

function clearHomeWorkLists() {
    document.getElementById('home-tasks-list').innerHTML = '';
    document.getElementById('work-tasks-list').innerHTML = '';
}

function renderSidebarLists(unassigned, assigned) {
    const unassignedListEl = document.getElementById('unassigned-tasks-list');
    const assignedListEl = document.getElementById('assigned-tasks-list');

    unassignedListEl.innerHTML = '';
    if (unassigned.length > 0) {
        unassigned.forEach(task => unassignedListEl.appendChild(createTaskElement(task, { context: 'sidebar' })));
    } else {
        unassignedListEl.innerHTML = '<p class="empty-list-msg">All tasks assigned!</p>';
    }

    assignedListEl.innerHTML = '';
    if (assigned.length > 0) {
        assigned.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)).forEach(task => {
            assignedListEl.appendChild(createTaskElement(task, { context: 'sidebar', isAssigned: true }));
        });
    } else {
        assignedListEl.innerHTML = '<p class="empty-list-msg">No tasks scheduled.</p>';
    }
}

function renderTasksOnGrid(assignedTasks) {
    assignedTasks.forEach(task => {
        task.schedule.forEach(item => {
            const cell = document.querySelector(`.grid-cell[data-day='${item.day}'][data-block-id='${item.blockId}']`);
            if (cell) {
                const taskClone = createTaskElement(task, { context: 'grid' });
                cell.appendChild(taskClone);
            }
        });
    });
}

function renderPriorityLists(tasks) {
    const criticalList = document.getElementById('critical-tasks-list');
    const importantList = document.getElementById('important-tasks-list');
    const somedayList = document.getElementById('someday-tasks-list');

    const criticalTasks = tasks.filter(t => t.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantTasks = tasks.filter(t => t.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const somedayTasks = tasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const renderColumn = (tasksForColumn, columnElement) => {
        if (tasksForColumn.length === 0) {
            columnElement.innerHTML = `<p class="empty-list-msg">No tasks in this category.</p>`;
            return;
        }
        tasksForColumn.forEach((task, index) => {
            const taskElement = createTaskElement(task, { context: 'management', index: index, total: tasksForColumn.length });
            columnElement.appendChild(taskElement);
        });
    };

    renderColumn(criticalTasks, criticalList);
    renderColumn(importantTasks, importantList);
    renderColumn(somedayTasks, somedayList);
}

function renderHomeWorkLists(tasks) {
    const homeList = document.getElementById('home-tasks-list');
    const workList = document.getElementById('work-tasks-list');

    const homeTasks = tasks.filter(t => t.type === 'home');
    const workTasks = tasks.filter(t => t.type === 'work');

    const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };

    const sortTasks = (a, b) => {
        const priorityComparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityComparison !== 0) {
            return priorityComparison;
        }
        return (a.displayOrder || 0) - (b.displayOrder || 0);
    };

    homeTasks.sort(sortTasks);
    workTasks.sort(sortTasks);

    const renderColumn = (tasksForColumn, columnElement) => {
        if (tasksForColumn.length === 0) {
            columnElement.innerHTML = `<p class="empty-list-msg">No tasks in this category.</p>`;
            return;
        }
        tasksForColumn.forEach((task, index) => {
            const taskElement = createTaskElement(task, { context: 'management', index: index, total: tasksForColumn.length });
            columnElement.appendChild(taskElement);
        });
    };

    renderColumn(homeTasks, homeList);
    renderColumn(workTasks, workList);
}

function createTaskElement(task, options = {}) {
    const { context = 'sidebar', isAssigned = false, index = -1, total = -1 } = options;

    const taskItem = document.createElement('div');
    taskItem.classList.add('task-item', `priority-${task.priority.toLowerCase()}`);
    if (task.completed) taskItem.classList.add('task-completed');
    taskItem.setAttribute('data-task-id', task.id);

    if (context === 'management') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.classList.add('task-complete-checkbox');
        const checkboxId = `checkbox-manager-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
        checkbox.id = checkboxId;
        taskItem.appendChild(checkbox);

        const checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add('neumorphic-checkbox-label');
        checkboxLabel.setAttribute('for', checkboxId);
        taskItem.appendChild(checkboxLabel);
    }

    if (context !== 'grid') {
        taskItem.setAttribute('draggable', 'true');
    }

    if (context === 'sidebar') {
        const scheduleButton = document.createElement('button');
        scheduleButton.innerHTML = '⏱️';
        scheduleButton.classList.add('neumorphic-btn', 'schedule-task-btn', 'schedule-btn-icon');
        scheduleButton.setAttribute('data-task-id', task.id);
        scheduleButton.setAttribute('title', 'Schedule Task');
        scheduleButton.style.width = '30px';
        scheduleButton.style.height = '30px';
        scheduleButton.style.borderRadius = '50%';
        scheduleButton.style.padding = '0';
        scheduleButton.style.lineHeight = '30px';
        scheduleButton.style.marginLeft = 'auto';
        taskItem.appendChild(scheduleButton);
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
    titleSpan.appendChild(textNode);
    taskItem.appendChild(titleSpan);

    if (isAssigned) {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = 'Show Schedule';
        toggleButton.classList.add('neumorphic-btn', 'toggle-schedule-btn');
        taskItem.appendChild(toggleButton);

        const scheduleContainer = document.createElement('div');
        scheduleContainer.classList.add('task-schedule-details');
        scheduleContainer.style.display = 'none';

        const dayMapping = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

        task.schedule.forEach((item, index) => {
            const block = TIME_BLOCKS.find(b => b.id === item.blockId);
            if (block) {
                const scheduleItem = document.createElement('div');
                scheduleItem.classList.add('task-schedule-list-item');
                scheduleItem.textContent = `${index + 1}) ${dayMapping[item.day] || 'Unk'}: ${block.label}`;
                scheduleContainer.appendChild(scheduleItem);
            }
        });
        taskItem.appendChild(scheduleContainer);
    }

    if (context === 'management') {
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('task-item-actions');
        if (index > 0) {
            const moveUpButton = document.createElement('button');
            moveUpButton.innerHTML = '&uarr;';
            moveUpButton.classList.add('neumorphic-btn', 'move-task-up-btn');
            moveUpButton.setAttribute('data-task-id', task.id);
            buttonContainer.appendChild(moveUpButton);
        }
        if (index < total - 1) {
            const moveDownButton = document.createElement('button');
            moveDownButton.innerHTML = '&darr;';
            moveDownButton.classList.add('neumorphic-btn', 'move-task-down-btn');
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
    }

    return taskItem;
}

// --- EVENT LISTENERS ---

function setupTabSwitching() {
    const tabs = document.querySelectorAll('.tabs .tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.getAttribute('data-tab')).classList.add('active');
        });
    });
}

function setupCoreFeatureListeners() {
    const unassignAllBtn = document.getElementById('unassign-all-btn');
    if (unassignAllBtn) {
        unassignAllBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to unschedule all tasks?")) {
                const tasks = await new Promise(resolve => getTasks(resolve));
                tasks.forEach(task => { task.schedule = []; });
                await new Promise(resolve => saveTasks(tasks, resolve));
                renderPage();
            }
        });
    }
}

function setupDragAndDropListeners() {
    const plannerContainer = document.querySelector('.planner-container');
    if (!plannerContainer) return;

    let draggedTaskId = null;

    plannerContainer.addEventListener('dragstart', (event) => {
        const taskItem = event.target.closest('.task-item');
        if (taskItem && taskItem.getAttribute('draggable')) {
            draggedTaskId = taskItem.getAttribute('data-task-id');
            event.dataTransfer.setData('text/plain', draggedTaskId);
            event.dataTransfer.effectAllowed = 'move';
            setTimeout(() => taskItem.classList.add('dragging'), 0);
        }
    });

    const handleDragOver = (event) => {
        event.preventDefault();
        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list, #assigned-tasks-list');
        if (dropTarget) {
            // Remove from other potential targets
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            dropTarget.classList.add('drag-over');
        }
    };

    const handleDragLeave = (event) => {
        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list, #assigned-tasks-list');
        if (dropTarget) {
            dropTarget.classList.remove('drag-over');
        }
    };

    const handleDragEnd = () => {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedTaskId = null;
    };

    plannerContainer.addEventListener('dragover', handleDragOver);
    plannerContainer.addEventListener('dragleave', handleDragLeave);
    plannerContainer.addEventListener('dragend', handleDragEnd);

    plannerContainer.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (!draggedTaskId) return;

        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');
        if (!dropTarget) return;

        const tasks = await new Promise(resolve => getTasks(resolve));
        const task = tasks.find(t => t.id === draggedTaskId);
        if (!task) return;

        if (dropTarget.id === 'unassigned-tasks-list') {
            if (task.schedule.length > 0) {
                task.schedule = [];
                await new Promise(resolve => saveTasks(tasks, resolve));
                renderPage();
            }
        } else if (dropTarget.classList.contains('grid-cell')) {
            const limit = dropTarget.dataset.taskLimit;
            const day = dropTarget.dataset.day;
            const blockId = dropTarget.dataset.blockId;

            if (limit === '0') return;
            const tasksInCell = Array.from(dropTarget.querySelectorAll('.task-item')).length;
            if (limit === '1' && tasksInCell >= 1) return;

            const alreadyExists = task.schedule.some(item => item.day === day && item.blockId === blockId);
            if (!alreadyExists) {
                task.schedule.push({ day, blockId });
                await new Promise(resolve => saveTasks(tasks, resolve));
                renderPage();
            }
        }
    });
}

function setupTaskManagementListeners() {
    const addTaskBtn = document.getElementById('add-task-btn');
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const titleInput = document.getElementById('task-title');
            const title = titleInput.value.trim();
            if (!title) {
                showInfoMessage("Task title is required.", "error"); return;
            }
            const url = document.getElementById('task-url').value.trim();
            const priority = document.getElementById('task-priority').value;
            const type = document.getElementById('task-type').value;
            let deadline = document.getElementById('task-deadline').value;
            if (priority !== 'CRITICAL' || !deadline) deadline = null;

            await addNewTask(title, url, priority, deadline, type);
            // Clear form
            titleInput.value = '';
            document.getElementById('task-url').value = '';
            document.getElementById('task-priority').value = 'SOMEDAY';
            document.getElementById('task-type').value = 'home';
            document.getElementById('task-deadline').value = '';
            document.getElementById('task-deadline-group').style.display = 'none';

            renderPage();
            showInfoMessage("Task added!", "success");
        });
    }

    const prioritySelect = document.getElementById('task-priority');
    if(prioritySelect) {
        prioritySelect.addEventListener('change', (e) => {
            document.getElementById('task-deadline-group').style.display = e.target.value === 'CRITICAL' ? 'block' : 'none';
        });
    }

    const tasksDisplayAreas = document.querySelectorAll('.tasks-display-area');
    if (tasksDisplayAreas.length === 0) return;

    let originalTaskDataForEdit = null;

    tasksDisplayAreas.forEach(area => {
        area.addEventListener('click', async (event) => {
            const target = event.target;
            const taskItem = target.closest('.task-item');
            const taskId = taskItem?.dataset.taskId;

            if (target.matches('.task-complete-checkbox')) {
                const isCompleted = target.checked;
                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    await updateTask(task);
                    renderPage();
                }
            } else if (target.matches('.delete-task-btn-list')) {
                if (confirm('Are you sure you want to delete this task?')) {
                    await deleteTask(taskId);
                    renderPage();
                }
            } else if (target.matches('.move-task-up-btn') || target.matches('.move-task-down-btn')) {
                const direction = target.matches('.move-task-up-btn') ? 'up' : 'down';
                const tasks = await new Promise(getTasks);
                const taskToMove = tasks.find(t => t.id === taskId);
                const priorityGroup = tasks.filter(t => t.priority === taskToMove.priority).sort((a,b) => a.displayOrder - b.displayOrder);
                const currentIndex = priorityGroup.findIndex(t => t.id === taskId);
                const otherIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

                if (otherIndex >= 0 && otherIndex < priorityGroup.length) {
                    const otherTask = priorityGroup[otherIndex];
                    [taskToMove.displayOrder, otherTask.displayOrder] = [otherTask.displayOrder, taskToMove.displayOrder];
                    await saveTasks(tasks);
                    renderPage();
                }
            } else if (target.matches('.edit-task-btn-list')) {
                if (taskItem.classList.contains('editing-task-item')) return;
                const currentlyEditing = document.querySelector('.editing-task-item');
                if (currentlyEditing) currentlyEditing.querySelector('.cancel-inline-btn').click();

                const task = await getTaskById(taskId);
                originalTaskDataForEdit = { ...task };
                taskItem.classList.add('editing-task-item');
                taskItem.querySelector('.task-title').style.display = 'none';
                taskItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = 'none');

                const formHtml = `
                    <div class="inline-edit-form">
                        <input type="text" class="neumorphic-input edit-task-title" value="${task.title}">
                        <select class="neumorphic-select edit-task-priority"><option value="SOMEDAY" ${task.priority === 'SOMEDAY' ? 'selected' : ''}>Someday</option><option value="IMPORTANT" ${task.priority === 'IMPORTANT' ? 'selected' : ''}>Important</option><option value="CRITICAL" ${task.priority === 'CRITICAL' ? 'selected' : ''}>Critical</option></select>
                        <div class="inline-edit-actions"><button class="neumorphic-btn save-inline-btn">Save</button><button class="neumorphic-btn cancel-inline-btn">Cancel</button></div>
                    </div>`;
                taskItem.insertAdjacentHTML('beforeend', formHtml);

            } else if (target.matches('.cancel-inline-btn')) {
                const taskItem = target.closest('.editing-task-item');
                taskItem.classList.remove('editing-task-item');
                taskItem.querySelector('.inline-edit-form').remove();
                taskItem.querySelector('.task-title').style.display = '';
                taskItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list').forEach(el => el.style.display = '');
            } else if (target.matches('.save-inline-btn')) {
                const taskItem = target.closest('.editing-task-item');
                const updatedTask = { ...originalTaskDataForEdit };
                updatedTask.title = taskItem.querySelector('.edit-task-title').value.trim();
                updatedTask.priority = taskItem.querySelector('.edit-task-priority').value;
                await updateTask(updatedTask);
                renderPage();
            }
        });
    });
}
