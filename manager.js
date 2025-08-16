// manager.js

// --- CONSTANTS ---
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let currentDays = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', function() {
    setupTabSwitching();
    generatePlannerGrid();
    highlightCurrentDay();
    renderPage();
    setupAllListeners();
});

function setupAllListeners() {
    setupDragAndDropListeners();
    setupCoreFeatureListeners();
    setupTaskManagementListeners();
    setupSchedulingListeners();
    setupFeatureListeners();
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

function generateDayHeaders() {
    const now = new Date();
    const dayIndex = now.getDay(); // 0 for Sunday, 1 for Monday, etc.

    // Rotate days array to start from today
    const rotatedDays = [...DAYS.slice(dayIndex), ...DAYS.slice(0, dayIndex)];
    currentDays = rotatedDays;

    const plannerGrid = document.getElementById('planner-grid');
    plannerGrid.innerHTML = ''; // Clear previous grid

    // Create "Time" header
    const timeHeader = document.createElement('div');
    timeHeader.classList.add('grid-header');
    timeHeader.textContent = 'Time';
    plannerGrid.appendChild(timeHeader);

    // Create headers for the next 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() + i);

        const header = document.createElement('div');
        header.classList.add('grid-header');

        const month = date.toLocaleString('default', { month: 'short' });
        const dayOfMonth = date.getDate();

        header.innerHTML = `<span class="header-month">${month} ${dayOfMonth}</span><span class="header-day">${rotatedDays[i].charAt(0).toUpperCase() + rotatedDays[i].slice(1)}</span>`;
        header.dataset.day = rotatedDays[i];
        plannerGrid.appendChild(header);
    }
}

function generatePlannerGrid() {
    generateDayHeaders();
    const plannerGrid = document.getElementById('planner-grid');

    TIME_BLOCKS.forEach(block => {
        const timeLabel = document.createElement('div');
        timeLabel.classList.add('time-label');
        timeLabel.textContent = block.time;
        plannerGrid.appendChild(timeLabel);

        currentDays.forEach(day => {
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

function setupFeatureListeners() {
    const exportBtn = document.getElementById('export-tasks-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const tasks = await new Promise(resolve => getTasks(resolve));
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "tasks.json");
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            showInfoMessage("Tasks exported successfully!", "success");
        });
    }

    const importBtn = document.getElementById('import-tasks-btn');
    const fileInput = document.getElementById('import-file-input');

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) {
                showInfoMessage("No file selected.", "error");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importedTasks = JSON.parse(e.target.result);
                    if (!Array.isArray(importedTasks)) {
                        throw new Error("Invalid format: JSON file should contain an array of tasks.");
                    }

                    const existingTasks = await new Promise(resolve => getTasks(resolve));
                    const existingTaskIds = new Set(existingTasks.map(t => t.id));

                    const tasksToCreate = [];
                    const tasksToUpdate = [];

                    for (const importedTask of importedTasks) {
                        if (!importedTask.id || !importedTask.title) {
                             console.warn("Skipping invalid task object:", importedTask);
                             continue;
                        }

                        if (existingTaskIds.has(importedTask.id)) {
                            tasksToUpdate.push(importedTask);
                        } else {
                            tasksToCreate.push(importedTask);
                        }
                    }

                    // Process updates and creates
                    const updatedTasks = existingTasks.map(existingTask => {
                        const taskToUpdate = tasksToUpdate.find(t => t.id === existingTask.id);
                        return taskToUpdate ? taskToUpdate : existingTask;
                    });

                    const finalTasks = [...updatedTasks, ...tasksToCreate];

                    await new Promise(resolve => saveTasks(finalTasks, resolve));


                    await renderPage();
                    showInfoMessage("Tasks imported successfully!", "success");

                } catch (error) {
                    showInfoMessage(`Error importing tasks: ${error.message}`, "error");
                } finally {
                    // Reset file input so the user can import the same file again if they want
                    fileInput.value = '';
                }
            };
            reader.onerror = () => {
                showInfoMessage("Error reading file.", "error");
                fileInput.value = '';
            };
            reader.readAsText(file);
        });
    }
}

function showInfoMessage(message, type = 'info', duration = 3000) {
    const infoArea = document.getElementById('info-message-area');
    if (!infoArea) return;

    // Set message and type
    infoArea.textContent = message;
    infoArea.className = 'info-message'; // Reset classes
    infoArea.classList.add(type); // 'success', 'error', or 'info'

    // Make it visible
    infoArea.style.display = 'block';
    setTimeout(() => {
        infoArea.classList.add('visible');
    }, 10); // Small delay to allow CSS transition to trigger

    // Hide it after 'duration'
    setTimeout(() => {
        infoArea.classList.remove('visible');
        // Wait for fade out transition to finish before setting display to none
        setTimeout(() => {
            infoArea.style.display = 'none';
        }, 500); // This should match the transition duration in CSS
    }, duration);
}

function highlightCurrentDay() {
    const todayName = currentDays[0];
    if (!todayName) return;

    // Highlight header
    const header = document.querySelector(`.grid-header[data-day='${todayName}']`);
    if (header) {
        header.classList.add('today');
    }

    // Highlight cells
    const todayCells = document.querySelectorAll(`.grid-cell[data-day='${todayName}']`);
    todayCells.forEach(cell => {
        cell.classList.add('today');
    });
}

function setupSchedulingListeners() {
    const plannerContainer = document.querySelector('.planner-container');
    if (!plannerContainer) return;

    plannerContainer.addEventListener('click', async (event) => {
        const target = event.target;

        if (target.matches('.task-complete-checkbox')) {
            const taskItem = target.closest('.task-item');
            const taskId = taskItem?.dataset.taskId;
            if (!taskId) return;

            const isCompleted = target.checked;
            const task = await getTaskById(taskId);
            if (task) {
                task.completed = isCompleted;
                // If it's an assigned task, cascade the completion status to all assignments
                if (task.schedule && task.schedule.length > 0) {
                    task.schedule.forEach(item => item.completed = isCompleted);
                }
                await updateTask(task); // updateTask will call updateTaskCompletion automatically
                renderPage(); // Re-render the entire page to reflect the change
            }
        } else if (target.matches('.toggle-schedule-btn')) {
            const taskItem = target.closest('.task-item');
            const scheduleDetails = taskItem.querySelector('.task-schedule-details');
            if (scheduleDetails) {
                const isHidden = scheduleDetails.style.display === 'none';
                scheduleDetails.style.display = isHidden ? 'block' : 'none';
                target.textContent = isHidden ? '🔽' : '▶️';
                target.classList.toggle('show');
                target.classList.toggle('hide');
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
            const dayHeaders = currentDays.map(day => `<div class="schedule-header-cell" style="font-size: 0.8em; text-align: center;">${day.charAt(0).toUpperCase() + day.slice(1, 3)}</div>`).join('');

            const bodyRows = schedulableBlocks.map(block => `
                <div class="schedule-block-label" style="font-size: 0.8em; text-align: right; padding-right: 5px;">${block.label}</div>
                ${currentDays.map(day => `
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

            const oldSchedule = task.schedule || [];
            const newSchedule = [];
            const checkboxes = taskItem.querySelectorAll('.schedule-checkbox:checked');

            checkboxes.forEach(cb => {
                const day = cb.dataset.day;
                const blockId = cb.dataset.blockId;
                const existingItem = oldSchedule.find(item => item.day === day && item.blockId === blockId);

                newSchedule.push({
                    day: day,
                    blockId: blockId,
                    completed: existingItem ? existingItem.completed : false
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
    taskItem.classList.add('task-item', `priority-${task.priority}`);
    if (task.completed) {
        taskItem.classList.add('task-completed');
    } else {
        if (task.energy === 'low') {
            taskItem.classList.add('energy-low-incomplete');
        } else if (task.energy === 'high') {
            taskItem.classList.add('energy-high-incomplete');
        }
    }
    taskItem.setAttribute('data-task-id', task.id);

    // --- Checkbox (for management and sidebar views) ---
    if (context === 'management' || context === 'sidebar') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        // Use a more generic class and a specific one for targeting
        checkbox.classList.add('task-complete-checkbox');
        const checkboxId = `checkbox-${context}-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}`;
        checkbox.id = checkboxId;
        taskItem.appendChild(checkbox);

        const checkboxLabel = document.createElement('label');
        checkboxLabel.classList.add('neumorphic-checkbox-label');
        checkboxLabel.setAttribute('for', checkboxId);
        taskItem.appendChild(checkboxLabel);
    }

    if (context === 'sidebar' || context === 'grid') {
        taskItem.setAttribute('draggable', 'true');
    }

    // --- Task Title ---
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

    // --- Action Buttons ---
    const actionsContainer = document.createElement('div');
    actionsContainer.classList.add('task-item-actions');

    if (isAssigned) {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = '▶️';
        toggleButton.classList.add('neumorphic-btn', 'toggle-schedule-btn', 'show');
        actionsContainer.appendChild(toggleButton);
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
        actionsContainer.appendChild(scheduleButton);
    }

    if (context === 'management') {
        if (index > 0) {
            const moveUpButton = document.createElement('button');
            moveUpButton.innerHTML = '&uarr;';
            moveUpButton.classList.add('neumorphic-btn', 'move-task-up-btn');
            moveUpButton.setAttribute('data-task-id', task.id);
            actionsContainer.appendChild(moveUpButton);
        }
        if (index < total - 1) {
            const moveDownButton = document.createElement('button');
            moveDownButton.innerHTML = '&darr;';
            moveDownButton.classList.add('neumorphic-btn', 'move-task-down-btn');
            moveDownButton.setAttribute('data-task-id', task.id);
            actionsContainer.appendChild(moveDownButton);
        }
        const editButton = document.createElement('button');
        editButton.textContent = 'Edit';
        editButton.classList.add('neumorphic-btn', 'edit-task-btn-list');
        editButton.setAttribute('data-task-id', task.id);
        actionsContainer.appendChild(editButton);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('neumorphic-btn', 'delete-task-btn-list');
        deleteButton.setAttribute('data-task-id', task.id);
        actionsContainer.appendChild(deleteButton);
    }

    if (actionsContainer.hasChildNodes()) {
        taskItem.appendChild(actionsContainer);
    }

    // --- Schedule Details (collapsible) ---
    if (isAssigned) {
        const scheduleContainer = document.createElement('div');
        scheduleContainer.classList.add('task-schedule-details');
        scheduleContainer.style.display = 'none';

        const dayMapping = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

        const timeBlockOrder = TIME_BLOCKS.reduce((acc, block, index) => {
            acc[block.id] = index;
            return acc;
        }, {});

        task.schedule
            .slice() // Create a shallow copy to avoid sorting the original array
            .sort((a, b) => {
                const dayA = currentDays.indexOf(a.day);
                const dayB = currentDays.indexOf(b.day);
                if (dayA !== dayB) return dayA - dayB;
                return timeBlockOrder[a.blockId] - timeBlockOrder[b.blockId];
            })
            .forEach((item, index) => {
                const block = TIME_BLOCKS.find(b => b.id === item.blockId);
                if (block) {
                    const scheduleItem = document.createElement('div');
                    scheduleItem.classList.add('task-schedule-list-item');

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = item.completed;
                    checkbox.classList.add('assignment-complete-checkbox');
                    const checkboxId = `assign-check-${task.id}-${item.day}-${item.blockId}`;
                    checkbox.id = checkboxId;
                    checkbox.dataset.taskId = task.id;
                    checkbox.dataset.day = item.day;
                    checkbox.dataset.blockId = item.blockId;
                    scheduleItem.appendChild(checkbox);

                    const label = document.createElement('label');
                    label.setAttribute('for', checkboxId);
                    label.textContent = ` ${dayMapping[item.day] || 'Unk'}: ${block.label}`;
                    if (item.completed) {
                        label.style.textDecoration = 'line-through';
                    }
                    scheduleItem.appendChild(label);

                    scheduleContainer.appendChild(scheduleItem);
                }
            });
        taskItem.appendChild(scheduleContainer);
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

    let draggedTaskInfo = null;

    plannerContainer.addEventListener('dragstart', (event) => {
        const taskItem = event.target.closest('.task-item');
        if (taskItem && taskItem.getAttribute('draggable')) {
            const taskId = taskItem.getAttribute('data-task-id');
            const sourceCell = taskItem.closest('.grid-cell');

            draggedTaskInfo = {
                taskId: taskId,
                sourceDay: sourceCell ? sourceCell.dataset.day : null,
                sourceBlockId: sourceCell ? sourceCell.dataset.blockId : null
            };

            event.dataTransfer.setData('text/plain', taskId);
            event.dataTransfer.effectAllowed = 'move';
            setTimeout(() => taskItem.classList.add('dragging'), 0);
        }
    });

    const handleDragOver = (event) => {
        event.preventDefault();
        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');
        if (!dropTarget) {
            event.dataTransfer.dropEffect = 'none';
            return;
        }

        if (dropTarget.classList.contains('grid-cell')) {
            const limit = dropTarget.dataset.taskLimit;
            const tasksInCell = dropTarget.querySelectorAll('.task-item:not(.dragging)').length;
            if (limit === '1' && tasksInCell >= 1) {
                event.dataTransfer.dropEffect = 'none';
                return;
            }
        }

        event.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        dropTarget.classList.add('drag-over');
    };

    const handleDragLeave = (event) => {
        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');
        if (dropTarget) {
            dropTarget.classList.remove('drag-over');
        }
    };

    const handleDragEnd = () => {
        document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedTaskInfo = null;
    };

    plannerContainer.addEventListener('dragover', handleDragOver);
    plannerContainer.addEventListener('dragleave', handleDragLeave);
    plannerContainer.addEventListener('dragend', handleDragEnd);

    plannerContainer.addEventListener('drop', async (event) => {
        event.preventDefault();
        if (!draggedTaskInfo) return;

        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');

        if (!dropTarget) {
            draggedTaskInfo = null;
            return;
        }

        const tasks = await new Promise(resolve => getTasks(resolve));
        const task = tasks.find(t => t.id === draggedTaskInfo.taskId);

        if (!task) {
            draggedTaskInfo = null;
            return;
        }

        let scheduleChanged = false;

        if (dropTarget.id === 'unassigned-tasks-list') {
            if (draggedTaskInfo.sourceDay && draggedTaskInfo.sourceBlockId) {
                const indexToRemove = task.schedule.findIndex(item => item.day === draggedTaskInfo.sourceDay && item.blockId === draggedTaskInfo.sourceBlockId);
                if (indexToRemove > -1) {
                    task.schedule.splice(indexToRemove, 1);
                    scheduleChanged = true;
                }
            } else if (!draggedTaskInfo.sourceDay && task.schedule.length > 0) {
                task.schedule = [];
                scheduleChanged = true;
            }
        } else if (dropTarget.classList.contains('grid-cell')) {
            const day = dropTarget.dataset.day;
            const blockId = dropTarget.dataset.blockId;

            if (day === draggedTaskInfo.sourceDay && blockId === draggedTaskInfo.sourceBlockId) {
                draggedTaskInfo = null;
                return;
            }

            const alreadyExists = task.schedule.some(item => item.day === day && item.blockId === blockId);
            if (alreadyExists) {
                draggedTaskInfo = null;
                return;
            }

            if (draggedTaskInfo.sourceDay && draggedTaskInfo.sourceBlockId) {
                const indexToRemove = task.schedule.findIndex(item => item.day === draggedTaskInfo.sourceDay && item.blockId === draggedTaskInfo.sourceBlockId);
                if (indexToRemove > -1) {
                    task.schedule.splice(indexToRemove, 1);
                }
            }

            task.schedule.push({ day, blockId, completed: false });
            scheduleChanged = true;
        }

        if (scheduleChanged) {
            await new Promise(resolve => saveTasks(tasks, success => resolve(success)));
            // Defer the render to avoid race conditions with the browser's drag/drop handling.
            setTimeout(renderPage, 0);
        }

        draggedTaskInfo = null;
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
            const priority = document.querySelector('input[name="manager-priority"]:checked').value;
            const type = document.querySelector('input[name="manager-type"]:checked').value;
            const energy = document.querySelector('input[name="manager-energy"]:checked').value;
            let deadline = document.getElementById('task-deadline').value;
            if (priority !== 'CRITICAL' || !deadline) deadline = null;

            await addNewTask(title, url, priority, deadline, type, energy);
            // Clear form
            titleInput.value = '';
            document.getElementById('task-url').value = '';
            document.getElementById('manager-priority-someday').checked = true;
            document.getElementById('manager-type-home').checked = true;
            document.getElementById('task-deadline').value = '';
            document.getElementById('task-deadline-group').style.display = 'none';

            renderPage();
            showInfoMessage("Task added!", "success");
        });
    }

    const priorityRadios = document.querySelectorAll('input[name="manager-priority"]');
    if(priorityRadios.length > 0) {
        priorityRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                document.getElementById('task-deadline-group').style.display = e.target.value === 'CRITICAL' ? 'block' : 'none';
            });
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

            if (target.matches('.task-complete-checkbox')) { // This is the "master" checkbox
                const isCompleted = target.checked;
                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    // If it's an assigned task, cascade the completion status to all assignments
                    if (task.schedule && task.schedule.length > 0) {
                        task.schedule.forEach(item => item.completed = isCompleted);
                    }
                    await updateTask(task); // updateTask will call updateTaskCompletion automatically
                    renderPage();
                }
            } else if (target.matches('.assignment-complete-checkbox')) {
                const isCompleted = target.checked;
                const day = target.dataset.day;
                const blockId = target.dataset.blockId;
                const task = await getTaskById(target.dataset.taskId);
                if (task) {
                    const scheduleItem = task.schedule.find(item => item.day === day && item.blockId === blockId);
                    if (scheduleItem) {
                        scheduleItem.completed = isCompleted;
                        // updateTask will call updateTaskCompletion, which syncs the parent `completed` status
                        await updateTask(task);
                        renderPage();
                    }
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
                        <div class="form-group-inline"><label>Title:</label><input type="text" class="neumorphic-input edit-task-title" value="${task.title}"></div>
                        <div class="form-group-inline"><label>URL:</label><input type="url" class="neumorphic-input edit-task-url" value="${task.url || ''}"></div>
                        <div class="form-group-inline">
                            <label>Priority:</label>
                            <div class="radio-group-modern edit-task-priority">
                                <input type="radio" id="edit-priority-someday-${task.id}" name="edit-priority-${task.id}" value="SOMEDAY" ${task.priority === 'SOMEDAY' ? 'checked' : ''}>
                            <label for="edit-priority-someday-${task.id}">🗓️ Someday</label>
                                <input type="radio" id="edit-priority-important-${task.id}" name="edit-priority-${task.id}" value="IMPORTANT" ${task.priority === 'IMPORTANT' ? 'checked' : ''}>
                            <label for="edit-priority-important-${task.id}">⭐ Important</label>
                                <input type="radio" id="edit-priority-critical-${task.id}" name="edit-priority-${task.id}" value="CRITICAL" ${task.priority === 'CRITICAL' ? 'checked' : ''}>
                            <label for="edit-priority-critical-${task.id}">🔥 Critical</label>
                            </div>
                        </div>
                        <div class="form-group-inline edit-task-deadline-group" style="display: ${task.priority === 'CRITICAL' ? 'block' : 'none'};"><label>Deadline:</label><input type="date" class="neumorphic-input edit-task-deadline" value="${task.deadline || ''}"></div>
                        <div class="form-group-inline">
                            <label>Type:</label>
                            <div class="radio-group-modern edit-task-type">
                                <input type="radio" id="edit-type-home-${task.id}" name="edit-type-${task.id}" value="home" ${task.type === 'home' ? 'checked' : ''}>
                            <label for="edit-type-home-${task.id}">🏠 Home</label>
                                <input type="radio" id="edit-type-work-${task.id}" name="edit-type-${task.id}" value="work" ${task.type === 'work' ? 'checked' : ''}>
                            <label for="edit-type-work-${task.id}">💼 Work</label>
                            </div>
                        </div>
                        <div class="form-group-inline">
                            <label>Energy:</label>
                            <div class="radio-group-modern horizontal edit-task-energy">
                                <input type="radio" id="edit-energy-low-${task.id}" name="edit-energy-${task.id}" value="low" ${task.energy === 'low' ? 'checked' : ''}>
                            <label for="edit-energy-low-${task.id}">🍃 Low</label>
                                <input type="radio" id="edit-energy-high-${task.id}" name="edit-energy-${task.id}" value="high" ${task.energy === 'high' ? 'checked' : ''}>
                            <label for="edit-energy-high-${task.id}">⚡ High</label>
                            </div>
                        </div>
                        <div class="form-group-inline form-group-inline-checkbox"><label for="edit-task-completed-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}">Completed:</label><input type="checkbox" id="edit-task-completed-${task.id.replace(/[^a-zA-Z0-9-_]/g, '')}" class="edit-task-completed" ${task.completed ? 'checked' : ''} style="width: auto; margin-right: 5px;"></div>
                        <div class="inline-edit-actions"><button class="neumorphic-btn save-inline-btn">Save</button><button class="neumorphic-btn cancel-inline-btn">Cancel</button></div>
                    </div>`;
                taskItem.insertAdjacentHTML('beforeend', formHtml);

                const priorityRadios = taskItem.querySelectorAll('input[name^="edit-priority-"]');
                const deadlineGroup = taskItem.querySelector('.edit-task-deadline-group');
                if (priorityRadios.length > 0 && deadlineGroup) {
                    priorityRadios.forEach(radio => {
                        radio.addEventListener('change', function() {
                            deadlineGroup.style.display = this.value === 'CRITICAL' ? 'block' : 'none';
                            if (this.value !== 'CRITICAL') {
                                const deadlineInput = deadlineGroup.querySelector('.edit-task-deadline');
                                if(deadlineInput) deadlineInput.value = '';
                            }
                        });
                    });
                }

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
                updatedTask.url = taskItem.querySelector('.edit-task-url').value.trim();
                updatedTask.priority = taskItem.querySelector('input[name^="edit-priority-"]:checked').value;
                let newDeadline = taskItem.querySelector('.edit-task-deadline').value;
                if (updatedTask.priority !== 'CRITICAL') newDeadline = null;
                updatedTask.deadline = newDeadline;
                updatedTask.type = taskItem.querySelector('input[name^="edit-type-"]:checked').value;
                updatedTask.energy = taskItem.querySelector('input[name^="edit-energy-"]:checked').value;
                updatedTask.completed = taskItem.querySelector('.edit-task-completed').checked;

                if (!updatedTask.title) {
                    showInfoMessage("Task title cannot be empty.", "error");
                    return;
                }

                await updateTask(updatedTask);
                renderPage();
            }
        });
    });
}
