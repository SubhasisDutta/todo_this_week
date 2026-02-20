// manager.js

// --- CONSTANTS ---
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
let currentDays = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async function() {
    await initSettings();          // Apply theme, font, seed sample tasks if first run
    setupTabSwitching();
    await generatePlannerGrid();   // async: loads configurable time blocks
    highlightCurrentDay();
    await renderPage();
    setupAllListeners();
    setupStorageSync(renderPage);
});

function setupAllListeners() {
    setupDragAndDropListeners();
    setupCoreFeatureListeners();
    setupTaskManagementListeners();
    setupSchedulingListeners();
    setupSettingsListeners();
    setupImportExportListeners();
    setupTimeBlocksListeners();
    setupHelpListeners();
    setupAddTaskModalListeners();
    setupUndoKeyboardListeners();
    setupScheduleSearch();
    setupPrioritySearch();
    setupLocationSearch();
    setupArchiveSearch();
    setupArchiveListeners();
}

// --- RENDERING LOGIC ---

async function renderPage() {
    const tasks = await getTasksAsync();

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

    // --- Render Archive Tab (if active) ---
    const archiveTab = document.getElementById('archive-tab');
    if (archiveTab && archiveTab.classList.contains('active')) {
        await renderArchiveTab();
    }

    // --- Render Stats Tab (if active) ---
    const statsTab = document.getElementById('stats-tab');
    if (statsTab && statsTab.classList.contains('active')) {
        await renderStatsTab();
    }
}

async function generateDayHeaders() {
    const now = new Date();
    const dayIndex = now.getDay();

    const rotatedDays = [...DAYS.slice(dayIndex), ...DAYS.slice(0, dayIndex)];
    currentDays = rotatedDays;

    const plannerGrid = document.getElementById('planner-grid');
    plannerGrid.innerHTML = '';

    const timeHeader = document.createElement('div');
    timeHeader.classList.add('grid-header');
    timeHeader.textContent = 'Time';
    plannerGrid.appendChild(timeHeader);

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

async function generatePlannerGrid() {
    await generateDayHeaders();
    const plannerGrid = document.getElementById('planner-grid');
    const blocks = await getTimeBlocks();

    blocks.forEach(block => {
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

// showInfoMessage is provided by task_utils.js

function highlightCurrentDay() {
    const todayName = currentDays[0];
    if (!todayName) return;

    const header = document.querySelector(`.grid-header[data-day='${todayName}']`);
    if (header) header.classList.add('today');

    const todayCells = document.querySelectorAll(`.grid-cell[data-day='${todayName}']`);
    todayCells.forEach(cell => cell.classList.add('today'));
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
            withTaskLock(async () => {
                const tasks = await getTasksAsync();
                pushUndoState(tasks);
                const task = await getTaskById(taskId);
                if (task) {
                    task.completed = isCompleted;
                    if (task.schedule && task.schedule.length > 0) {
                        task.schedule.forEach(item => item.completed = isCompleted);
                    }
                    await updateTask(task);
                    renderPage();
                }
            });
        } else if (target.matches('.toggle-schedule-btn')) {
            const taskItem = target.closest('.task-item');
            if (!taskItem) return;
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

            const blocks = await getTimeBlocks();
            const schedulableBlocks = blocks.filter(b => b.limit !== '0');
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
            if (!taskItem) return;
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
                    day,
                    blockId,
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
    const unassigned = document.getElementById('unassigned-tasks-list');
    const assigned = document.getElementById('assigned-tasks-list');
    if (unassigned) unassigned.innerHTML = '';
    if (assigned) assigned.innerHTML = '';
    document.querySelectorAll('.grid-cell').forEach(cell => {
        const label = cell.querySelector('.grid-cell-label');
        cell.innerHTML = '';
        if (label) cell.appendChild(label);
    });
}

function clearPriorityLists() {
    const lists = ['critical-tasks-list', 'important-tasks-list', 'someday-tasks-list'];
    const completedLists = ['critical-completed-list', 'important-completed-list', 'someday-completed-list'];
    [...lists, ...completedLists].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
}

function clearHomeWorkLists() {
    const lists = ['home-tasks-list', 'work-tasks-list'];
    const completedLists = ['home-completed-list', 'work-completed-list'];
    [...lists, ...completedLists].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
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
    const criticalCompletedList = document.getElementById('critical-completed-list');
    const importantCompletedList = document.getElementById('important-completed-list');
    const somedayCompletedList = document.getElementById('someday-completed-list');

    // Separate active and completed tasks by priority
    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    const criticalActive = activeTasks.filter(t => t.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantActive = activeTasks.filter(t => t.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const somedayActive = activeTasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const criticalCompleted = completedTasks.filter(t => t.priority === 'CRITICAL').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const importantCompleted = completedTasks.filter(t => t.priority === 'IMPORTANT').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    const somedayCompleted = completedTasks.filter(t => t.priority === 'SOMEDAY').sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

    const renderColumn = (tasksForColumn, columnElement) => {
        if (!columnElement) return;
        if (tasksForColumn.length === 0) {
            columnElement.innerHTML = `<p class="empty-list-msg">No tasks in this category.</p>`;
            return;
        }
        tasksForColumn.forEach((task, index) => {
            columnElement.appendChild(createTaskElement(task, { context: 'management', index, total: tasksForColumn.length }));
        });
    };

    const renderCompletedSection = (completedTasksForColumn, completedListElement, countElement, disclosureElement) => {
        if (!completedListElement || !countElement || !disclosureElement) return;

        // Update count badge
        countElement.textContent = completedTasksForColumn.length;

        // Show/hide disclosure based on whether there are completed tasks
        if (completedTasksForColumn.length === 0) {
            disclosureElement.classList.add('hidden');
        } else {
            disclosureElement.classList.remove('hidden');
            completedTasksForColumn.forEach((task, index) => {
                completedListElement.appendChild(createTaskElement(task, { context: 'management', index, total: completedTasksForColumn.length }));
            });
        }
    };

    // Render active tasks
    renderColumn(criticalActive, criticalList);
    renderColumn(importantActive, importantList);
    renderColumn(somedayActive, somedayList);

    // Render completed tasks in disclosure sections
    renderCompletedSection(criticalCompleted, criticalCompletedList,
        document.getElementById('critical-completed-count'),
        document.getElementById('critical-completed-disclosure'));
    renderCompletedSection(importantCompleted, importantCompletedList,
        document.getElementById('important-completed-count'),
        document.getElementById('important-completed-disclosure'));
    renderCompletedSection(somedayCompleted, somedayCompletedList,
        document.getElementById('someday-completed-count'),
        document.getElementById('someday-completed-disclosure'));
}

function renderHomeWorkLists(tasks) {
    const homeList = document.getElementById('home-tasks-list');
    const workList = document.getElementById('work-tasks-list');
    const homeCompletedList = document.getElementById('home-completed-list');
    const workCompletedList = document.getElementById('work-completed-list');

    // Separate active and completed tasks by type
    const activeTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
    const sortTasks = (a, b) => {
        const priorityComparison = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityComparison !== 0) return priorityComparison;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
    };

    const homeActive = activeTasks.filter(t => t.type === 'home').sort(sortTasks);
    const workActive = activeTasks.filter(t => t.type === 'work').sort(sortTasks);
    const homeCompleted = completedTasks.filter(t => t.type === 'home').sort(sortTasks);
    const workCompleted = completedTasks.filter(t => t.type === 'work').sort(sortTasks);

    const renderColumn = (tasksForColumn, columnElement) => {
        if (!columnElement) return;
        if (tasksForColumn.length === 0) {
            columnElement.innerHTML = `<p class="empty-list-msg">No tasks in this category.</p>`;
            return;
        }
        tasksForColumn.forEach((task, index) => {
            columnElement.appendChild(createTaskElement(task, { context: 'management', index, total: tasksForColumn.length }));
        });
    };

    const renderCompletedSection = (completedTasksForColumn, completedListElement, countElement, disclosureElement) => {
        if (!completedListElement || !countElement || !disclosureElement) return;

        // Update count badge
        countElement.textContent = completedTasksForColumn.length;

        // Show/hide disclosure based on whether there are completed tasks
        if (completedTasksForColumn.length === 0) {
            disclosureElement.classList.add('hidden');
        } else {
            disclosureElement.classList.remove('hidden');
            completedTasksForColumn.forEach((task, index) => {
                completedListElement.appendChild(createTaskElement(task, { context: 'management', index, total: completedTasksForColumn.length }));
            });
        }
    };

    // Render active tasks
    renderColumn(homeActive, homeList);
    renderColumn(workActive, workList);

    // Render completed tasks in disclosure sections
    renderCompletedSection(homeCompleted, homeCompletedList,
        document.getElementById('home-completed-count'),
        document.getElementById('home-completed-disclosure'));
    renderCompletedSection(workCompleted, workCompletedList,
        document.getElementById('work-completed-count'),
        document.getElementById('work-completed-disclosure'));
}

// --- ARCHIVE TAB ---
async function renderArchiveTab() {
    const container = document.getElementById('archive-list');
    if (!container) return;

    const tasks = await getTasksAsync();
    const completedTasks = tasks.filter(t => t.completed);

    if (completedTasks.length === 0) {
        container.innerHTML = '<p class="archive-empty-msg">No completed tasks yet. Complete some tasks and they\'ll appear here!</p>';
        return;
    }

    const now = new Date();
    const todayStr = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    const groups = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Older': [] };

    completedTasks.forEach(task => {
        if (!task.completedAt) {
            groups['Older'].push(task);
            return;
        }
        const d = new Date(task.completedAt);
        const dStr = d.toDateString();
        if (dStr === todayStr) {
            groups['Today'].push(task);
        } else if (dStr === yesterdayStr) {
            groups['Yesterday'].push(task);
        } else if (d >= weekAgo) {
            groups['This Week'].push(task);
        } else {
            groups['Older'].push(task);
        }
    });

    container.innerHTML = '';

    Object.entries(groups).forEach(([groupName, groupTasks]) => {
        if (groupTasks.length === 0) return;

        // Sort tasks by lastModified (latest first)
        groupTasks.sort((a, b) => {
            const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
            const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
            return bTime - aTime; // Descending order (latest first)
        });
        const groupEl = document.createElement('div');
        groupEl.classList.add('archive-date-group');
        groupEl.innerHTML = `<h3>${groupName} (${groupTasks.length})</h3>`;

        groupTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.classList.add('task-item', `priority-${task.priority}`, 'task-completed');
            taskEl.dataset.taskId = task.id;

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('task-title');
            titleSpan.textContent = (task.type === 'home' ? '🏠 ' : '🏢 ') + task.title;
            taskEl.appendChild(titleSpan);

            if (task.completedAt) {
                const dateSpan = document.createElement('span');
                dateSpan.style.cssText = 'font-size:0.72em; color:var(--text-muted); margin-left:auto; flex-shrink:0;';
                dateSpan.textContent = new Date(task.completedAt).toLocaleDateString();
                taskEl.appendChild(dateSpan);
            }

            const restoreBtn = document.createElement('button');
            restoreBtn.classList.add('neumorphic-btn', 'restore-btn');
            restoreBtn.textContent = '↩️ Restore';
            restoreBtn.dataset.taskId = task.id;
            taskEl.appendChild(restoreBtn);

            groupEl.appendChild(taskEl);
        });

        container.appendChild(groupEl);
    });
}

function setupArchiveListeners() {
    const archiveList = document.getElementById('archive-list');
    if (archiveList) {
        archiveList.addEventListener('click', async (event) => {
            if (event.target.matches('.restore-btn')) {
                const taskId = event.target.dataset.taskId;
                const task = await getTaskById(taskId);
                if (task) {
                    const tasks = await getTasksAsync();
                    pushUndoState(tasks);
                    task.completed = false;
                    task.completedAt = null;
                    await updateTask(task);
                    showInfoMessage('Task restored!', 'success');
                    await renderPage();
                    await renderArchiveTab();
                }
            }
        });
    }

    const clearAllBtn = document.getElementById('clear-all-completed-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', async () => {
            const tasks = await getTasksAsync();
            const completedCount = tasks.filter(t => t.completed).length;
            if (completedCount === 0) {
                showInfoMessage('No completed tasks to clear.', 'info');
                return;
            }
            if (!confirm(`Are you sure you want to permanently delete all ${completedCount} completed tasks? This cannot be undone.`)) return;

            pushUndoState(tasks);
            const activeTasks = tasks.filter(t => !t.completed);
            await saveTasksAsync(activeTasks);
            showInfoMessage(`Cleared ${completedCount} completed tasks.`, 'success');
            await renderPage();
            await renderArchiveTab();
        });
    }
}

// --- STATS TAB (Enhanced) ---

// Helper: Calculate tasks completed in a date range
function getCompletedInRange(tasks, startDate, endDate) {
    return tasks.filter(t => {
        if (!t.completed || !t.completedAt) return false;
        const completedDate = new Date(t.completedAt);
        return completedDate >= startDate && completedDate < endDate;
    });
}

// Helper: Calculate streak (consecutive days with completions)
function calculateStreak(tasks) {
    const completedTasks = tasks.filter(t => t.completed && t.completedAt);
    if (completedTasks.length === 0) return 0;

    // Get all unique completion dates
    const completionDates = new Set();
    completedTasks.forEach(t => {
        const date = new Date(t.completedAt);
        completionDates.add(date.toDateString());
    });

    // Check consecutive days starting from today going backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let streak = 0;
    let checkDate = new Date(today);

    // First check if today has completions, if not start from yesterday
    if (!completionDates.has(checkDate.toDateString())) {
        checkDate.setDate(checkDate.getDate() - 1);
    }

    while (completionDates.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
}

// Helper: Get peak productivity hours from completedAt timestamps
function getPeakHours(tasks) {
    const hourCounts = Array(24).fill(0);
    tasks.forEach(t => {
        if (t.completed && t.completedAt) {
            const hour = new Date(t.completedAt).getHours();
            hourCounts[hour]++;
        }
    });
    return hourCounts;
}

// Helper: Calculate focus distribution (Deep Work vs Other based on time blocks)
async function getFocusDistribution(tasks) {
    const blocks = await getTimeBlocks();
    const deepWorkBlockIds = blocks
        .filter(b => b.label.toLowerCase().includes('deep work') || b.id.includes('deep-work') || b.id.includes('ai-study'))
        .map(b => b.id);

    let deepWorkCount = 0;
    let otherCount = 0;

    tasks.forEach(task => {
        (task.schedule || []).forEach(item => {
            if (deepWorkBlockIds.includes(item.blockId)) {
                deepWorkCount++;
            } else {
                otherCount++;
            }
        });
    });

    return { deepWorkCount, otherCount };
}

// Helper: Get time block distribution
async function getBlockDistribution(tasks) {
    const blocks = await getTimeBlocks();
    const blockCounts = {};
    blocks.forEach(b => { blockCounts[b.id] = { label: b.label, count: 0 }; });

    tasks.forEach(task => {
        (task.schedule || []).forEach(item => {
            if (blockCounts[item.blockId]) {
                blockCounts[item.blockId].count++;
            }
        });
    });

    return Object.values(blockCounts).filter(b => b.count > 0).sort((a, b) => b.count - a.count);
}

// Helper: Find stale tasks (created > 14 days ago, not completed)
function getStaleTasks(tasks) {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    return tasks.filter(t => {
        if (t.completed) return false;
        // Extract timestamp from task ID (format: task_{timestamp}_{random})
        const match = t.id.match(/task_(\d+)_/);
        if (match) {
            const createdAt = new Date(parseInt(match[1]));
            return createdAt < twoWeeksAgo;
        }
        // Fallback to lastModified
        if (t.lastModified) {
            return new Date(t.lastModified) < twoWeeksAgo;
        }
        return false;
    }).map(t => {
        const match = t.id.match(/task_(\d+)_/);
        const createdAt = match ? new Date(parseInt(match[1])) : (t.lastModified ? new Date(t.lastModified) : new Date());
        const daysOld = Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24));
        return { ...t, daysOld };
    }).sort((a, b) => b.daysOld - a.daysOld).slice(0, 5);
}

async function renderStatsTab() {
    const container = document.getElementById('stats-content');
    if (!container) return;

    const tasks = await getTasksAsync();
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const active = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Week-over-week momentum
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - 7);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const thisWeekCompleted = getCompletedInRange(tasks, thisWeekStart, now).length;
    const lastWeekCompleted = getCompletedInRange(tasks, lastWeekStart, thisWeekStart).length;
    const weekChange = lastWeekCompleted > 0
        ? Math.round(((thisWeekCompleted - lastWeekCompleted) / lastWeekCompleted) * 100)
        : (thisWeekCompleted > 0 ? 100 : 0);
    const momentumArrow = weekChange > 0 ? 'up' : (weekChange < 0 ? 'down' : 'neutral');
    const momentumIcon = weekChange > 0 ? '⬆️' : (weekChange < 0 ? '⬇️' : '➡️');

    // Streak
    const streak = calculateStreak(tasks);

    // Focus distribution
    const focusData = await getFocusDistribution(tasks);
    const focusTotal = focusData.deepWorkCount + focusData.otherCount;
    const deepWorkPercent = focusTotal > 0 ? Math.round((focusData.deepWorkCount / focusTotal) * 100) : 0;

    // Peak hours
    const hourCounts = getPeakHours(tasks);
    const maxHourCount = Math.max(...hourCounts, 1);
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    const peakHourLabel = peakHour < 12 ? `${peakHour || 12}AM` : `${peakHour === 12 ? 12 : peakHour - 12}PM`;

    // Time block distribution
    const blockDistribution = await getBlockDistribution(tasks);
    const maxBlockCount = blockDistribution.length > 0 ? blockDistribution[0].count : 1;

    // Stale tasks
    const staleTasks = getStaleTasks(tasks);

    // Priority counts
    const criticalCount = tasks.filter(t => t.priority === 'CRITICAL').length;
    const importantCount = tasks.filter(t => t.priority === 'IMPORTANT').length;
    const somedayCount = tasks.filter(t => t.priority === 'SOMEDAY').length;

    // Energy counts
    const lowEnergyCount = tasks.filter(t => t.energy === 'low').length;
    const highEnergyCount = tasks.filter(t => t.energy === 'high').length;

    // Home/Work counts
    const homeCount = tasks.filter(t => t.type === 'home').length;
    const workCount = tasks.filter(t => t.type === 'work').length;

    // Tasks per day this week
    const tasksPerDay = {};
    currentDays.forEach(day => { tasksPerDay[day] = 0; });
    tasks.forEach(task => {
        (task.schedule || []).forEach(item => {
            if (tasksPerDay.hasOwnProperty(item.day)) {
                tasksPerDay[item.day]++;
            }
        });
    });
    const maxDayCount = Math.max(...Object.values(tasksPerDay), 1);
    const dayAbbr = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
    const todayName = currentDays[0];

    // SVG circle calculations
    const ringRadius = 58;
    const ringCircumference = 2 * Math.PI * ringRadius;
    const ringOffset = ringCircumference - (completionRate / 100) * ringCircumference;

    // Donut chart calculations for focus
    const donutRadius = 36;
    const donutCircumference = 2 * Math.PI * donutRadius;
    const deepWorkDash = (deepWorkPercent / 100) * donutCircumference;

    container.innerHTML = `
        <h2>📊 Insights & Analytics</h2>

        <!-- SVG Definitions -->
        <svg width="0" height="0">
            <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#4299e1;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#667eea;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="deepWorkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#4299e1;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#667eea;stop-opacity:1" />
                </linearGradient>
                <linearGradient id="otherGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style="stop-color:#9ae6b4;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#68d391;stop-opacity:1" />
                </linearGradient>
            </defs>
        </svg>

        <div class="stats-bento-grid">
            <!-- Hero: Weekly Progress Ring -->
            <div class="stats-glass-card stats-hero-card">
                <div class="stats-ring-container">
                    <svg class="stats-ring-svg" viewBox="0 0 140 140">
                        <circle class="stats-ring-bg" cx="70" cy="70" r="${ringRadius}" />
                        <circle class="stats-ring-progress" cx="70" cy="70" r="${ringRadius}"
                            stroke-dasharray="${ringCircumference}"
                            stroke-dashoffset="${ringOffset}" />
                    </svg>
                    <div class="stats-ring-center">
                        <div class="stats-ring-percent">${completionRate}%</div>
                        <div class="stats-ring-label">Complete</div>
                    </div>
                </div>
                <div class="stats-hero-title">Weekly Progress</div>
            </div>

            <!-- Momentum Card -->
            <div class="stats-glass-card stats-momentum-card">
                <div class="stats-section-header">
                    <span class="stats-section-icon">⚡</span>
                    <span class="stats-section-title">Momentum</span>
                </div>
                <div class="stats-momentum-value">
                    <span class="stats-momentum-arrow ${momentumArrow}">${momentumIcon}</span>
                    <span class="stats-momentum-percent">${Math.abs(weekChange)}%</span>
                </div>
                <div class="stats-momentum-label">vs. last week</div>
                <div class="stats-momentum-detail">
                    This week: ${thisWeekCompleted} completed<br>
                    Last week: ${lastWeekCompleted} completed
                </div>
            </div>

            <!-- Streak Card -->
            <div class="stats-glass-card stats-streak-card">
                <div class="stats-streak-icon">🔥</div>
                <div class="stats-streak-count">${streak}</div>
                <div class="stats-streak-label">Day Streak</div>
            </div>

            <!-- Mini Stats Row -->
            <div class="stats-glass-card stats-mini-card stats-card-sm">
                <div class="stats-mini-number">${total}</div>
                <div class="stats-mini-label">Total Tasks</div>
            </div>
            <div class="stats-glass-card stats-mini-card stats-card-sm">
                <div class="stats-mini-number success">${completed}</div>
                <div class="stats-mini-label">Completed</div>
            </div>
            <div class="stats-glass-card stats-mini-card stats-card-sm">
                <div class="stats-mini-number">${active}</div>
                <div class="stats-mini-label">Active</div>
            </div>
            <div class="stats-glass-card stats-mini-card stats-card-sm">
                <div class="stats-mini-number warning">${staleTasks.length}</div>
                <div class="stats-mini-label">Stale Tasks</div>
            </div>

            <!-- Focus Distribution -->
            <div class="stats-glass-card stats-card-lg">
                <div class="stats-section-header">
                    <span class="stats-section-icon">🧠</span>
                    <span class="stats-section-title">Focus Distribution</span>
                </div>
                <div class="stats-focus-chart">
                    <div class="stats-donut-container">
                        <svg class="stats-donut-svg" viewBox="0 0 100 100">
                            <circle class="stats-donut-bg" cx="50" cy="50" r="${donutRadius}" />
                            <circle class="stats-donut-segment" cx="50" cy="50" r="${donutRadius}"
                                stroke="url(#deepWorkGradient)"
                                stroke-dasharray="${deepWorkDash} ${donutCircumference}"
                                stroke-dashoffset="0" />
                        </svg>
                    </div>
                    <div class="stats-focus-legend">
                        <div class="stats-legend-item">
                            <span class="stats-legend-dot deep"></span>
                            <span class="stats-legend-text">Deep Work</span>
                            <span class="stats-legend-value">${focusData.deepWorkCount} (${deepWorkPercent}%)</span>
                        </div>
                        <div class="stats-legend-item">
                            <span class="stats-legend-dot other"></span>
                            <span class="stats-legend-text">Other</span>
                            <span class="stats-legend-value">${focusData.otherCount} (${100 - deepWorkPercent}%)</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Peak Hours Heatmap -->
            <div class="stats-glass-card stats-card-lg">
                <div class="stats-section-header">
                    <span class="stats-section-icon">⏰</span>
                    <span class="stats-section-title">Peak Productivity Hours</span>
                </div>
                <div class="stats-heatmap">
                    ${Array.from({length: 12}, (_, i) => {
                        const hour = i + 6; // Show 6AM to 5PM (work hours)
                        const count = hourCounts[hour] || 0;
                        const intensity = maxHourCount > 0 ? Math.ceil((count / maxHourCount) * 5) : 0;
                        return `<div class="stats-heatmap-cell" data-intensity="${intensity}" title="${hour < 12 ? hour + 'AM' : (hour === 12 ? '12PM' : (hour - 12) + 'PM')}: ${count} tasks"></div>`;
                    }).join('')}
                </div>
                <div class="stats-heatmap-labels">
                    ${['6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p'].map(l =>
                        `<span class="stats-heatmap-label">${l}</span>`
                    ).join('')}
                </div>
                ${hourCounts.some(c => c > 0) ? `
                <div class="stats-peak-insight">
                    <span class="stats-peak-insight-icon">💡</span>
                    <span>You're most productive around <strong>${peakHourLabel}</strong></span>
                </div>
                ` : ''}
            </div>

            <!-- Time Block Distribution -->
            <div class="stats-glass-card stats-card-lg">
                <div class="stats-section-header">
                    <span class="stats-section-icon">📊</span>
                    <span class="stats-section-title">Time Block Usage</span>
                </div>
                <div class="stats-block-bars">
                    ${blockDistribution.slice(0, 6).map((b, i) => `
                        <div class="stats-block-row">
                            <span class="stats-block-label">${b.label}</span>
                            <div class="stats-block-bar-track">
                                <div class="stats-block-bar-fill gradient-${(i % 6) + 1}" style="width:${(b.count / maxBlockCount * 100)}%"></div>
                            </div>
                            <span class="stats-block-count">${b.count}</span>
                        </div>
                    `).join('')}
                    ${blockDistribution.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85em;text-align:center;">No scheduled tasks yet</p>' : ''}
                </div>
            </div>

            <!-- Stale Tasks Alert -->
            <div class="stats-glass-card stats-card-lg stats-stale-card">
                <div class="stats-section-header">
                    <span class="stats-section-icon">🐢</span>
                    <span class="stats-section-title">Aging Tasks (2+ weeks)</span>
                </div>
                ${staleTasks.length > 0 ? `
                <div class="stats-stale-list">
                    ${staleTasks.map(t => `
                        <div class="stats-stale-item">
                            <span class="stats-stale-title">${t.title}</span>
                            <span class="stats-stale-age">${t.daysOld}d</span>
                        </div>
                    `).join('')}
                </div>
                ` : `
                <div class="stats-empty-stale">🎉 No stale tasks! You're on top of things.</div>
                `}
            </div>

            <!-- Tasks Per Day Chart -->
            <div class="stats-glass-card stats-card-full">
                <div class="stats-section-header">
                    <span class="stats-section-icon">📅</span>
                    <span class="stats-section-title">Weekly Schedule</span>
                </div>
                <div class="stats-bar-chart">
                    ${currentDays.map(day => `
                        <div class="stats-bar-group">
                            <span class="stats-bar-value">${tasksPerDay[day] || 0}</span>
                            <div class="stats-bar ${day === todayName ? 'today' : ''}" style="height:${maxDayCount > 0 ? Math.max((tasksPerDay[day] || 0) / maxDayCount * 80, 4) : 4}px"></div>
                            <span class="stats-bar-label ${day === todayName ? 'today' : ''}">${dayAbbr[day] || day.slice(0,3)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Priority Distribution -->
            <div class="stats-glass-card stats-card-md">
                <div class="stats-section-header">
                    <span class="stats-section-icon">⭐</span>
                    <span class="stats-section-title">Priority</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">🔥 Critical</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-critical" style="width:${total > 0 ? (criticalCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${criticalCount}</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">⭐ Important</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-important" style="width:${total > 0 ? (importantCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${importantCount}</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">🗓️ Someday</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-someday" style="width:${total > 0 ? (somedayCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${somedayCount}</span>
                </div>
            </div>

            <!-- Energy Distribution -->
            <div class="stats-glass-card stats-card-md">
                <div class="stats-section-header">
                    <span class="stats-section-icon">⚡</span>
                    <span class="stats-section-title">Energy</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">🍃 Low</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-someday" style="width:${total > 0 ? (lowEnergyCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${lowEnergyCount}</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">⚡ High</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-critical" style="width:${total > 0 ? (highEnergyCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${highEnergyCount}</span>
                </div>
            </div>

            <!-- Home vs Work -->
            <div class="stats-glass-card stats-card-md">
                <div class="stats-section-header">
                    <span class="stats-section-icon">🌍</span>
                    <span class="stats-section-title">Location</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">🏠 Home</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-blue" style="width:${total > 0 ? (homeCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${homeCount}</span>
                </div>
                <div class="stats-priority-row">
                    <span class="stats-priority-label">💼 Work</span>
                    <div class="stats-priority-bar-track">
                        <div class="stats-priority-bar-fill bar-important" style="width:${total > 0 ? (workCount/total*100) : 0}%"></div>
                    </div>
                    <span class="stats-priority-count">${workCount}</span>
                </div>
            </div>
        </div>
    `;
}

// --- SEARCH / FILTER ---

function applySearchFilter(query, containers, includeGridCells = false) {
    const q = query.trim().toLowerCase();
    containers.forEach(container => {
        if (!container) return;
        container.querySelectorAll('.task-item').forEach(taskEl => {
            const titleEl = taskEl.querySelector('.task-title');
            const title = titleEl ? titleEl.textContent.toLowerCase() : '';
            taskEl.style.display = (!q || title.includes(q)) ? '' : 'none';
        });
    });

    // Also filter tasks in grid cells for schedule tab
    if (includeGridCells) {
        document.querySelectorAll('.grid-cell .task-item').forEach(taskEl => {
            const titleEl = taskEl.querySelector('.task-title');
            const title = titleEl ? titleEl.textContent.toLowerCase() : '';
            taskEl.style.display = (!q || title.includes(q)) ? '' : 'none';
        });
    }
}

function setupScheduleSearch() {
    const input = document.getElementById('schedule-search-input');
    const clearBtn = document.getElementById('schedule-search-clear');
    if (!input) return;

    const containers = [
        document.getElementById('unassigned-tasks-list'),
        document.getElementById('assigned-tasks-list')
    ];

    const debouncedFilter = debounce((q) => applySearchFilter(q, containers, true), 300);

    input.addEventListener('input', () => debouncedFilter(input.value));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            applySearchFilter('', containers, true);
        });
    }
}

function setupPrioritySearch() {
    const input = document.getElementById('priority-search-input');
    const clearBtn = document.getElementById('priority-search-clear');
    if (!input) return;

    const containers = [
        document.getElementById('critical-tasks-list'),
        document.getElementById('important-tasks-list'),
        document.getElementById('someday-tasks-list'),
        document.getElementById('critical-completed-list'),
        document.getElementById('important-completed-list'),
        document.getElementById('someday-completed-list')
    ];

    const debouncedFilter = debounce((q) => applySearchFilter(q, containers), 300);

    input.addEventListener('input', () => debouncedFilter(input.value));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            applySearchFilter('', containers);
        });
    }
}

function setupLocationSearch() {
    const input = document.getElementById('location-search-input');
    const clearBtn = document.getElementById('location-search-clear');
    if (!input) return;

    const containers = [
        document.getElementById('home-tasks-list'),
        document.getElementById('work-tasks-list'),
        document.getElementById('home-completed-list'),
        document.getElementById('work-completed-list')
    ];

    const debouncedFilter = debounce((q) => applySearchFilter(q, containers), 300);

    input.addEventListener('input', () => debouncedFilter(input.value));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            applySearchFilter('', containers);
        });
    }
}

function setupArchiveSearch() {
    const input = document.getElementById('archive-search-input');
    const clearBtn = document.getElementById('archive-search-clear');
    if (!input) return;

    const debouncedFilter = debounce((q) => {
        const container = document.getElementById('archive-list');
        if (!container) return;
        container.querySelectorAll('.task-item').forEach(taskEl => {
            const titleEl = taskEl.querySelector('.task-title');
            const title = titleEl ? titleEl.textContent.toLowerCase() : '';
            taskEl.style.display = (!q.trim() || title.includes(q.trim().toLowerCase())) ? '' : 'none';
        });
    }, 300);

    input.addEventListener('input', () => debouncedFilter(input.value));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            const container = document.getElementById('archive-list');
            if (container) {
                container.querySelectorAll('.task-item').forEach(taskEl => {
                    taskEl.style.display = '';
                });
            }
        });
    }
}

// --- UNDO TOAST ---

let _undoToastTimeout = null;

function showUndoToast(message, undoCallback, duration = 5000) {
    const toast = document.getElementById('undo-toast');
    const msgEl = document.getElementById('undo-toast-message');
    const actionBtn = document.getElementById('undo-action-btn');
    const dismissBtn = document.getElementById('undo-dismiss-btn');
    if (!toast || !msgEl) return;

    if (_undoToastTimeout) clearTimeout(_undoToastTimeout);

    msgEl.textContent = message + ' ';
    toast.classList.remove('hidden');

    const dismiss = () => {
        toast.classList.add('hidden');
        if (_undoToastTimeout) clearTimeout(_undoToastTimeout);
    };

    if (actionBtn) {
        actionBtn.onclick = async () => {
            dismiss();
            if (undoCallback) await undoCallback();
        };
    }
    if (dismissBtn) {
        dismissBtn.onclick = dismiss;
    }

    _undoToastTimeout = setTimeout(dismiss, duration);
}

function setupUndoKeyboardListeners() {
    document.addEventListener('keydown', async (e) => {
        // Ignore if typing in an input/textarea
        if (e.target.matches('input, textarea, select')) return;

        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
            e.preventDefault();
            const restored = await undo();
            if (restored) {
                showInfoMessage('Undo successful!', 'success');
                await renderPage();
            }
        } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
            e.preventDefault();
            const restored = await redo();
            if (restored) {
                showInfoMessage('Redo successful!', 'success');
                await renderPage();
            }
        }
    });
}

// --- SETTINGS LISTENERS (delegates to settings.js) ---

function setupSettingsListeners() {
    setupSettingsModalListeners(renderPage);
}

// --- IMPORT/EXPORT LISTENERS (delegates to settings.js) ---

function setupImportExportListeners() {
    setupImportExportModalListeners(renderPage);
}

// --- TIME BLOCKS LISTENERS (delegates to settings.js) ---

function setupTimeBlocksListeners() {
    setupTimeBlocksModalListeners(async () => {
        await generatePlannerGrid();
        highlightCurrentDay();
        await renderPage();
    });
}

// --- HELP MODAL LISTENERS ---

function setupHelpListeners() {
    const helpBtn = document.getElementById('help-btn');
    const helpCloseBtn = document.getElementById('help-close-btn');
    const helpModal = document.getElementById('help-modal');

    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (helpModal) helpModal.classList.remove('hidden');
        });
    }

    if (helpCloseBtn) {
        helpCloseBtn.addEventListener('click', () => {
            if (helpModal) helpModal.classList.add('hidden');
        });
    }

    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) helpModal.classList.add('hidden');
        });
    }

    // Tab switching within help modal
    const helpTabLinks = document.querySelectorAll('.help-tabs .tab-link');
    const helpPanels = document.querySelectorAll('.help-panel');

    helpTabLinks.forEach(tab => {
        tab.addEventListener('click', () => {
            helpTabLinks.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
            helpPanels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const targetId = tab.getAttribute('data-help-tab');
            const panel = document.getElementById(targetId);
            if (panel) panel.classList.add('active');
        });
    });
}

// --- ADD TASK MODAL LISTENERS ---

function setupAddTaskModalListeners() {
    const addTaskBtn = document.getElementById('add-task-modal-btn');
    const addTaskCloseBtn = document.getElementById('add-task-close-btn');
    const addTaskModal = document.getElementById('add-task-modal');

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            if (addTaskModal) addTaskModal.classList.remove('hidden');
        });
    }

    if (addTaskCloseBtn) {
        addTaskCloseBtn.addEventListener('click', () => {
            if (addTaskModal) addTaskModal.classList.add('hidden');
        });
    }

    if (addTaskModal) {
        addTaskModal.addEventListener('click', (e) => {
            if (e.target === addTaskModal) addTaskModal.classList.add('hidden');
        });
    }

    // Priority radio change for deadline visibility
    const priorityRadios = document.querySelectorAll('input[name="manager-priority"]');
    priorityRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('manager-task-deadline-group').style.display = e.target.value === 'CRITICAL' ? 'block' : 'none';
        });
    });
}

// --- CREATE TASK ELEMENT ---

function createTaskElement(task, options = {}) {
    const { context = 'sidebar', isAssigned = false, index = -1, total = -1 } = options;

    const taskItem = document.createElement('div');
    taskItem.classList.add('task-item', `priority-${task.priority}`);
    if (task.completed) {
        taskItem.classList.add('task-completed');
    } else {
        if (task.energy === 'low') taskItem.classList.add('energy-low-incomplete');
        else if (task.energy === 'high') taskItem.classList.add('energy-high-incomplete');
    }
    taskItem.setAttribute('data-task-id', task.id);

    // Checkbox (for management and sidebar views)
    if (context === 'management' || context === 'sidebar') {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
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

    // Task Title
    const titleSpan = document.createElement('span');
    titleSpan.classList.add('task-title');
    if (task.type) {
        const iconSpan = document.createElement('span');
        iconSpan.classList.add('task-type-icon');
        iconSpan.textContent = task.type === 'home' ? '🏠' : '🏢';
        iconSpan.setAttribute('aria-label', `${task.type} task`);
        titleSpan.appendChild(iconSpan);
    }
    titleSpan.appendChild(document.createTextNode(task.title));
    taskItem.appendChild(titleSpan);

    // Recurrence badge
    if (task.recurrence) {
        const badge = document.createElement('span');
        badge.classList.add('recurrence-badge');
        badge.textContent = '🔄 ' + task.recurrence;
        taskItem.appendChild(badge);
    }

    // Action Buttons
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
        scheduleButton.style.cssText = 'width:30px;height:30px;border-radius:50%;padding:0;line-height:30px;';
        actionsContainer.appendChild(scheduleButton);
    }

    if (context === 'management') {
        if (index > 0) {
            const moveUpBtn = document.createElement('button');
            moveUpBtn.innerHTML = '&uarr;';
            moveUpBtn.classList.add('neumorphic-btn', 'move-task-up-btn');
            moveUpBtn.setAttribute('data-task-id', task.id);
            actionsContainer.appendChild(moveUpBtn);
        }
        if (index < total - 1) {
            const moveDownBtn = document.createElement('button');
            moveDownBtn.innerHTML = '&darr;';
            moveDownBtn.classList.add('neumorphic-btn', 'move-task-down-btn');
            moveDownBtn.setAttribute('data-task-id', task.id);
            actionsContainer.appendChild(moveDownBtn);
        }
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.classList.add('neumorphic-btn', 'edit-task-btn-list');
        editBtn.setAttribute('data-task-id', task.id);
        actionsContainer.appendChild(editBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('neumorphic-btn', 'delete-task-btn-list');
        deleteBtn.setAttribute('data-task-id', task.id);
        actionsContainer.appendChild(deleteBtn);
    }

    if (actionsContainer.hasChildNodes()) taskItem.appendChild(actionsContainer);

    // Notes expand/collapse (management and sidebar contexts)
    if ((context === 'management' || context === 'sidebar') && task.notes && task.notes.trim()) {
        taskItem.classList.add('has-notes');
        const notesToggle = document.createElement('button');
        notesToggle.classList.add('task-notes-toggle');
        notesToggle.textContent = '📝 Notes';
        const notesContent = document.createElement('div');
        notesContent.classList.add('task-notes-content');
        notesContent.textContent = task.notes;
        notesToggle.addEventListener('click', () => {
            notesContent.classList.toggle('visible');
            notesToggle.textContent = notesContent.classList.contains('visible') ? '📝 Hide' : '📝 Notes';
        });
        taskItem.appendChild(notesToggle);
        taskItem.appendChild(notesContent);
    }

    // Schedule Details (collapsible, for assigned sidebar items)
    if (isAssigned) {
        const scheduleContainer = document.createElement('div');
        scheduleContainer.classList.add('task-schedule-details');
        scheduleContainer.style.display = 'none';

        const dayMapping = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
        const timeBlockOrder = DEFAULT_TIME_BLOCKS.reduce((acc, block, index) => { acc[block.id] = index; return acc; }, {});

        task.schedule
            .slice()
            .sort((a, b) => {
                const dayA = currentDays.indexOf(a.day);
                const dayB = currentDays.indexOf(b.day);
                if (dayA !== dayB) return dayA - dayB;
                return (timeBlockOrder[a.blockId] || 0) - (timeBlockOrder[b.blockId] || 0);
            })
            .forEach((item) => {
                const block = DEFAULT_TIME_BLOCKS.find(b => b.id === item.blockId);
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
                    if (item.completed) label.style.textDecoration = 'line-through';
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
    const tabContents = document.querySelectorAll('.main-content .tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            tabs.forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); });
            tabContents.forEach(content => content.classList.remove('active'));
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
            const targetEl = document.getElementById(tab.getAttribute('data-tab'));
            if (targetEl) targetEl.classList.add('active');

            // Render archive/stats on demand
            if (tab.getAttribute('data-tab') === 'archive-tab') {
                await renderArchiveTab();
            } else if (tab.getAttribute('data-tab') === 'stats-tab') {
                await renderStatsTab();
            }
        });
    });
}

function setupCoreFeatureListeners() {
    const unassignAllBtn = document.getElementById('unassign-all-btn');
    if (unassignAllBtn) {
        unassignAllBtn.addEventListener('click', async () => {
            if (confirm("Are you sure you want to unschedule all tasks?")) {
                const tasks = await getTasksAsync();
                pushUndoState(tasks);
                tasks.forEach(task => { task.schedule = []; });
                await saveTasksAsync(tasks);

                showUndoToast('All tasks unscheduled.', async () => {
                    await undo();
                    await renderPage();
                });
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
                taskId,
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
        if (!dropTarget) { event.dataTransfer.dropEffect = 'none'; return; }
        if (dropTarget.classList.contains('grid-cell')) {
            const limit = dropTarget.dataset.taskLimit;
            const tasksInCell = dropTarget.querySelectorAll('.task-item:not(.dragging)').length;
            if (limit === '1' && tasksInCell >= 1) { event.dataTransfer.dropEffect = 'none'; return; }
        }
        event.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        dropTarget.classList.add('drag-over');
    };

    const handleDragLeave = (event) => {
        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');
        if (dropTarget) dropTarget.classList.remove('drag-over');
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

        // Capture dragged info immediately before any async operations
        const currentDragInfo = { ...draggedTaskInfo };
        draggedTaskInfo = null;

        const dropTarget = event.target.closest('.grid-cell, #unassigned-tasks-list');
        if (!dropTarget) return;

        const tasks = await getTasksAsync();
        const task = tasks.find(t => t.id === currentDragInfo.taskId);
        if (!task) return;

        let scheduleChanged = false;

        if (dropTarget.id === 'unassigned-tasks-list') {
            if (currentDragInfo.sourceDay && currentDragInfo.sourceBlockId) {
                const idx = task.schedule.findIndex(item => item.day === currentDragInfo.sourceDay && item.blockId === currentDragInfo.sourceBlockId);
                if (idx > -1) { task.schedule.splice(idx, 1); scheduleChanged = true; }
            } else if (!currentDragInfo.sourceDay && task.schedule.length > 0) {
                task.schedule = [];
                scheduleChanged = true;
            }
        } else if (dropTarget.classList.contains('grid-cell')) {
            const day = dropTarget.dataset.day;
            const blockId = dropTarget.dataset.blockId;

            if (day === currentDragInfo.sourceDay && blockId === currentDragInfo.sourceBlockId) {
                return;
            }
            const alreadyExists = task.schedule.some(item => item.day === day && item.blockId === blockId);
            if (alreadyExists) return;

            if (currentDragInfo.sourceDay && currentDragInfo.sourceBlockId) {
                const idx = task.schedule.findIndex(item => item.day === currentDragInfo.sourceDay && item.blockId === currentDragInfo.sourceBlockId);
                if (idx > -1) task.schedule.splice(idx, 1);
            }
            task.schedule.push({ day, blockId, completed: false });
            scheduleChanged = true;
        }

        if (scheduleChanged) {
            await saveTasksAsync(tasks);
            setTimeout(renderPage, 0);
        }
    });
}

function setupTaskManagementListeners() {
    const addTaskBtn = document.getElementById('manager-add-task-btn');
    const addTaskModal = document.getElementById('add-task-modal');

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', async () => {
            const titleInput = document.getElementById('manager-task-title');
            const title = titleInput.value.trim();
            if (!title) { showInfoMessage("Task title is required.", "error"); return; }

            const url = document.getElementById('manager-task-url').value.trim();
            const priority = document.querySelector('input[name="manager-priority"]:checked').value;
            const type = document.querySelector('input[name="manager-type"]:checked').value;
            const energy = document.querySelector('input[name="manager-energy"]:checked').value;
            const notes = document.getElementById('manager-task-notes')?.value.trim() || '';
            const recurrenceEl = document.getElementById('manager-task-recurrence');
            const recurrence = recurrenceEl?.value || null;
            let deadline = document.getElementById('manager-task-deadline').value;
            if (priority !== 'CRITICAL' || !deadline) deadline = null;

            await addNewTask(title, url, priority, deadline, type, energy, notes, recurrence || null);

            // Clear form
            titleInput.value = '';
            document.getElementById('manager-task-url').value = '';
            if (document.getElementById('manager-task-notes')) document.getElementById('manager-task-notes').value = '';
            if (recurrenceEl) recurrenceEl.value = '';
            document.getElementById('manager-priority-someday').checked = true;
            document.getElementById('manager-type-home').checked = true;
            document.getElementById('manager-energy-low').checked = true;
            document.getElementById('manager-task-deadline').value = '';
            document.getElementById('manager-task-deadline-group').style.display = 'none';

            // Close modal after adding task
            if (addTaskModal) addTaskModal.classList.add('hidden');

            renderPage();
            showInfoMessage("Task added!", "success");
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
                withTaskLock(async () => {
                    const tasks = await getTasksAsync();
                    pushUndoState(tasks);
                    const task = await getTaskById(taskId);
                    if (task) {
                        task.completed = isCompleted;
                        if (task.schedule && task.schedule.length > 0) {
                            task.schedule.forEach(item => item.completed = isCompleted);
                        }
                        await updateTask(task);
                        renderPage();
                    }
                });
            } else if (target.matches('.assignment-complete-checkbox')) {
                const isCompleted = target.checked;
                const day = target.dataset.day;
                const blockId = target.dataset.blockId;
                const assignTaskId = target.dataset.taskId;
                withTaskLock(async () => {
                    const task = await getTaskById(assignTaskId);
                    if (task) {
                        const scheduleItem = task.schedule.find(item => item.day === day && item.blockId === blockId);
                        if (scheduleItem) {
                            scheduleItem.completed = isCompleted;
                            await updateTask(task);
                            renderPage();
                        }
                    }
                });
            } else if (target.matches('.delete-task-btn-list')) {
                if (confirm('Are you sure you want to delete this task?')) {
                    const tasks = await getTasksAsync();
                    pushUndoState(tasks);
                    const taskTitle = tasks.find(t => t.id === taskId)?.title || 'Task';
                    await deleteTask(taskId);

                    showUndoToast(`"${taskTitle}" deleted.`, async () => {
                        await undo();
                        await renderPage();
                    });
                    renderPage();
                }
            } else if (target.matches('.move-task-up-btn') || target.matches('.move-task-down-btn')) {
                const direction = target.matches('.move-task-up-btn') ? 'up' : 'down';
                const tasks = await getTasksAsync();
                const taskToMove = tasks.find(t => t.id === taskId);
                const priorityGroup = tasks.filter(t => t.priority === taskToMove.priority).sort((a, b) => a.displayOrder - b.displayOrder);
                const currentIndex = priorityGroup.findIndex(t => t.id === taskId);
                const otherIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

                if (otherIndex >= 0 && otherIndex < priorityGroup.length) {
                    const otherTask = priorityGroup[otherIndex];
                    [taskToMove.displayOrder, otherTask.displayOrder] = [otherTask.displayOrder, taskToMove.displayOrder];
                    try {
                        await saveTasksAsync(tasks);
                    } catch (e) {
                        showInfoMessage("Failed to save task order.", "error");
                    }
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
                taskItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list, .task-notes-toggle, .task-notes-content, .recurrence-badge').forEach(el => el.style.display = 'none');

                const safeId = task.id.replace(/[^a-zA-Z0-9-_]/g, '');
                const formHtml = `
                    <div class="inline-edit-form">
                        <div class="form-group-inline"><label>Title:</label><input type="text" class="neumorphic-input edit-task-title" value="${task.title.replace(/"/g, '&quot;')}"></div>
                        <div class="form-group-inline"><label>URL:</label><input type="url" class="neumorphic-input edit-task-url" value="${(task.url || '').replace(/"/g, '&quot;')}"></div>
                        <div class="form-group-inline">
                            <label>Priority:</label>
                            <div class="radio-group-modern edit-task-priority">
                                <input type="radio" id="edit-priority-someday-${safeId}" name="edit-priority-${safeId}" value="SOMEDAY" ${task.priority === 'SOMEDAY' ? 'checked' : ''}><label for="edit-priority-someday-${safeId}">🗓️ Someday</label>
                                <input type="radio" id="edit-priority-important-${safeId}" name="edit-priority-${safeId}" value="IMPORTANT" ${task.priority === 'IMPORTANT' ? 'checked' : ''}><label for="edit-priority-important-${safeId}">⭐ Important</label>
                                <input type="radio" id="edit-priority-critical-${safeId}" name="edit-priority-${safeId}" value="CRITICAL" ${task.priority === 'CRITICAL' ? 'checked' : ''}><label for="edit-priority-critical-${safeId}">🔥 Critical</label>
                            </div>
                        </div>
                        <div class="form-group-inline edit-task-deadline-group" style="display: ${task.priority === 'CRITICAL' ? 'block' : 'none'};"><label>Deadline:</label><input type="date" class="neumorphic-input edit-task-deadline" value="${task.deadline || ''}"></div>
                        <div class="form-group-inline">
                            <label>Type:</label>
                            <div class="radio-group-modern edit-task-type">
                                <input type="radio" id="edit-type-home-${safeId}" name="edit-type-${safeId}" value="home" ${task.type === 'home' ? 'checked' : ''}><label for="edit-type-home-${safeId}">🏠 Home</label>
                                <input type="radio" id="edit-type-work-${safeId}" name="edit-type-${safeId}" value="work" ${task.type === 'work' ? 'checked' : ''}><label for="edit-type-work-${safeId}">💼 Work</label>
                            </div>
                        </div>
                        <div class="form-group-inline">
                            <label>Energy:</label>
                            <div class="radio-group-modern horizontal edit-task-energy">
                                <input type="radio" id="edit-energy-low-${safeId}" name="edit-energy-${safeId}" value="low" ${task.energy === 'low' ? 'checked' : ''}><label for="edit-energy-low-${safeId}">🍃 Low</label>
                                <input type="radio" id="edit-energy-high-${safeId}" name="edit-energy-${safeId}" value="high" ${task.energy === 'high' ? 'checked' : ''}><label for="edit-energy-high-${safeId}">⚡ High</label>
                            </div>
                        </div>
                        <div class="form-group-inline">
                            <label>Recurrence:</label>
                            <select class="neumorphic-select edit-task-recurrence">
                                <option value="" ${!task.recurrence ? 'selected' : ''}>None</option>
                                <option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>🔄 Daily</option>
                                <option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>🔄 Weekly</option>
                                <option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>🔄 Monthly</option>
                            </select>
                        </div>
                        <div class="form-group-inline"><label>Notes:</label><textarea class="neumorphic-input edit-task-notes" rows="3">${(task.notes || '').replace(/</g, '&lt;')}</textarea></div>
                        <div class="form-group-inline form-group-inline-checkbox"><label for="edit-task-completed-${safeId}">Completed:</label><input type="checkbox" id="edit-task-completed-${safeId}" class="edit-task-completed" ${task.completed ? 'checked' : ''} style="width: auto; margin-right: 5px;"></div>
                        <div class="inline-edit-actions"><span class="save-status"></span><button class="neumorphic-btn save-inline-btn">Save</button><button class="neumorphic-btn cancel-inline-btn">Cancel</button></div>
                    </div>`;
                taskItem.insertAdjacentHTML('beforeend', formHtml);

                // Auto-save setup
                const editForm = taskItem.querySelector('.inline-edit-form');
                const saveStatusEl = editForm.querySelector('.save-status');

                function setSaveStatus(status) {
                    if (!saveStatusEl) return;
                    saveStatusEl.className = 'save-status ' + status;
                    if (status === 'saving') saveStatusEl.textContent = 'Saving...';
                    else if (status === 'saved') saveStatusEl.textContent = 'Saved';
                    else if (status === 'unsaved') saveStatusEl.textContent = 'Unsaved';
                    else saveStatusEl.textContent = '';
                    if (status === 'saved') {
                        setTimeout(() => {
                            if (saveStatusEl.classList.contains('saved')) {
                                saveStatusEl.textContent = '';
                                saveStatusEl.className = 'save-status';
                            }
                        }, 2000);
                    }
                }

                function collectFormValues() {
                    const updatedTask = { ...originalTaskDataForEdit };
                    updatedTask.title = taskItem.querySelector('.edit-task-title').value.trim();
                    updatedTask.url = taskItem.querySelector('.edit-task-url').value.trim();
                    updatedTask.priority = taskItem.querySelector(`input[name^="edit-priority-"]:checked`).value;
                    let dl = taskItem.querySelector('.edit-task-deadline').value;
                    if (updatedTask.priority !== 'CRITICAL') dl = null;
                    updatedTask.deadline = dl;
                    updatedTask.type = taskItem.querySelector(`input[name^="edit-type-"]:checked`).value;
                    updatedTask.energy = taskItem.querySelector(`input[name^="edit-energy-"]:checked`).value;
                    updatedTask.completed = taskItem.querySelector('.edit-task-completed').checked;
                    updatedTask.notes = taskItem.querySelector('.edit-task-notes').value;
                    updatedTask.recurrence = taskItem.querySelector('.edit-task-recurrence').value || null;
                    return updatedTask;
                }

                const autoSave = debounce(async () => {
                    const updatedTask = collectFormValues();
                    const errors = validateTask(updatedTask);
                    if (errors.length === 0) {
                        setSaveStatus('saving');
                        await updateTask(updatedTask);
                        originalTaskDataForEdit = { ...updatedTask };
                        setSaveStatus('saved');
                    }
                }, 1500);

                editForm.querySelectorAll('input, textarea, select').forEach(input => {
                    input.addEventListener('input', () => { setSaveStatus('unsaved'); autoSave(); });
                    input.addEventListener('change', () => { setSaveStatus('unsaved'); autoSave(); });
                });

                const editPriorityRadios = taskItem.querySelectorAll(`input[name^="edit-priority-"]`);
                const deadlineGroup = taskItem.querySelector('.edit-task-deadline-group');
                editPriorityRadios.forEach(radio => {
                    radio.addEventListener('change', function() {
                        if (deadlineGroup) deadlineGroup.style.display = this.value === 'CRITICAL' ? 'block' : 'none';
                        if (this.value !== 'CRITICAL') {
                            const deadlineInput = deadlineGroup?.querySelector('.edit-task-deadline');
                            if (deadlineInput) deadlineInput.value = '';
                        }
                    });
                });

            } else if (target.matches('.cancel-inline-btn')) {
                const editItem = target.closest('.editing-task-item');
                editItem.classList.remove('editing-task-item');
                editItem.querySelector('.inline-edit-form').remove();
                editItem.querySelector('.task-title').style.display = '';
                editItem.querySelectorAll('.task-item-actions, .edit-task-btn-list, .delete-task-btn-list, .task-notes-toggle, .task-notes-content, .recurrence-badge').forEach(el => el.style.display = '');
            } else if (target.matches('.save-inline-btn')) {
                const editItem = target.closest('.editing-task-item');
                const updatedTask = collectFormValues();

                if (!updatedTask.title) { showInfoMessage("Task title cannot be empty.", "error"); return; }
                if (updatedTask.priority === 'CRITICAL' && !updatedTask.deadline) { showInfoMessage("Deadline is required for CRITICAL tasks.", "error"); return; }

                await updateTask(updatedTask);
                renderPage();
            }
        });
    });
}
