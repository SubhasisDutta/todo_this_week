// popup.js

// --- Task Rendering Functions ---

function createTaskItem(item, options = {}) {
    const { isAssignment = false, tabName = '' } = options;
    const task = item;
    const scheduleItem = isAssignment ? item.scheduleItem : null;

    const taskItem = document.createElement('div');
    taskItem.classList.add('task-item', `priority-${task.priority}`);

    const isItemCompleted = isAssignment ? scheduleItem.completed : task.completed;
    if (isItemCompleted) {
        taskItem.classList.add('task-completed');
    } else {
        if (task.energy === 'low') taskItem.classList.add('energy-low-incomplete');
        else if (task.energy === 'high') taskItem.classList.add('energy-high-incomplete');
    }
    taskItem.setAttribute('data-task-id', task.id);
    if (isAssignment) {
        taskItem.dataset.day = scheduleItem.day;
        taskItem.dataset.blockId = scheduleItem.blockId;
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isItemCompleted;

    const checkboxId = isAssignment
        ? `assign-check-${task.id}-${scheduleItem.day}-${scheduleItem.blockId}`
        : `master-check-${task.id}`;
    checkbox.id = checkboxId;
    checkbox.classList.add(isAssignment ? 'assignment-complete-checkbox' : 'task-complete-checkbox');
    taskItem.appendChild(checkbox);

    const checkboxLabel = document.createElement('label');
    checkboxLabel.classList.add('neumorphic-checkbox-label');
    checkboxLabel.setAttribute('for', checkboxId);
    taskItem.appendChild(checkboxLabel);

    const titleSpan = document.createElement('span');
    titleSpan.classList.add('task-title');

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

    return taskItem;
}

function renderTasks(tabName = 'today') {
    getTasks(allTasks => {
        let taskListElement;
        const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = new Date();
        const todayName = dayMapping[today.getDay()];

        if (tabName === 'today') {
            taskListElement = document.getElementById('today-task-list');
            taskListElement.innerHTML = '';

            const timeBlockOrder = TIME_BLOCKS.reduce((acc, block, index) => {
                acc[block.id] = index;
                return acc;
            }, {});

            const todaysAssignments = [];
            allTasks.forEach(task => {
                task.schedule.forEach(scheduleItem => {
                    if (scheduleItem.day === todayName) {
                        todaysAssignments.push({ ...task, scheduleItem });
                    }
                });
            });

            if (todaysAssignments.length === 0) {
                taskListElement.innerHTML = `<p>No tasks scheduled for today.</p>`;
                return;
            }

            const groupedByBlock = todaysAssignments.reduce((acc, assignment) => {
                const blockId = assignment.scheduleItem.blockId;
                if (!acc[blockId]) {
                    acc[blockId] = [];
                }
                acc[blockId].push(assignment);
                return acc;
            }, {});

            const sortedBlockIds = Object.keys(groupedByBlock).sort((a, b) => timeBlockOrder[a] - timeBlockOrder[b]);

            sortedBlockIds.forEach(blockId => {
                const block = TIME_BLOCKS.find(b => b.id === blockId);
                const blockHeader = document.createElement('h4');
                blockHeader.classList.add('time-block-header');
                blockHeader.textContent = `${block.time} ${block.label}`;
                taskListElement.appendChild(blockHeader);

                const assignmentsInBlock = groupedByBlock[blockId];
                assignmentsInBlock.forEach(item => {
                    const taskItem = createTaskItem(item, { isAssignment: true, tabName: tabName });
                    taskListElement.appendChild(taskItem);
                });
            });

        } else if (tabName === 'display') {
            taskListElement = document.getElementById('display-task-list');
            taskListElement.innerHTML = '';
            const tasksToRender = allTasks.filter(task => !task.completed);
            const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
            tasksToRender.sort((a, b) => {
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return (a.displayOrder || 0) - (b.displayOrder || 0);
            });

            if (tasksToRender.length === 0) {
                taskListElement.innerHTML = `<p>No active tasks. Add some in the ADD tab!</p>`;
                return;
            }
            tasksToRender.forEach(task => {
                const taskItem = createTaskItem(task, { tabName: tabName });
                taskListElement.appendChild(taskItem);
            });
        } else if (tabName === 'add') {
            return;
        }
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
                        await updateTask(task);
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
                return;
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
                        renderAllTabs();
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
