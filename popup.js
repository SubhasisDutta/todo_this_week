// popup.js

// --- Task Data Structure and Storage ---

// Define the Task class (or a factory function if preferred)
class Task {
    constructor(id, title, url = '', priority = 'SOMEDAY', completed = false, deadline = null, type = 'home') {
        this.id = id || `task_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`; // Unique ID
        this.title = title;
        this.url = url;
        this.priority = priority; // CRITICAL, IMPORTANT, SOMEDAY
        this.completed = completed;
        this.deadline = deadline; // Expected format: YYYY-MM-DD
        this.type = type; // 'home' or 'work'
        // 'tags' from the plan seems to be covered by 'priority' and 'type'.
        // If additional free-form tags are needed, a 'tags: []' property can be added.
    }
}

// Function to get all tasks from storage
function getTasks(callback) {
    chrome.storage.local.get({ tasks: [] }, (result) => {
        if (chrome.runtime.lastError) {
            console.error("Error getting tasks:", chrome.runtime.lastError);
            callback([]);
        } else {
            // Ensure all tasks are instances of Task, or have the expected structure
            const tasks = result.tasks.map(taskData => {
                // A simple way to ensure methods if Task class had any, or just for consistency
                // For now, assuming tasks in storage are plain objects matching the structure
                return Object.assign(new Task(taskData.id, ''), taskData);
            });
            callback(tasks);
        }
    });
}

// Function to save all tasks to storage
function saveTasks(tasks, callback) {
    chrome.storage.local.set({ tasks: tasks }, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving tasks:", chrome.runtime.lastError);
            if (callback) callback(false);
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
            const newTask = new Task(null, title, url, priority, false, deadline, type);
            tasks.push(newTask);
            saveTasks(tasks, () => resolve(newTask));
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
            const filteredTasks = tasks.filter(task => task.id !== taskId);
            saveTasks(filteredTasks, () => resolve(true));
        });
    });
}

// --- End of Task Data Structure and Storage ---

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

        // Sort tasks by priority: CRITICAL > IMPORTANT > SOMEDAY
        const priorityOrder = { 'CRITICAL': 1, 'IMPORTANT': 2, 'SOMEDAY': 3 };
        tasksToRender.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

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

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.classList.add('task-complete-checkbox');
            // Event listener for completion will be added in a later step for Display/Home/Work tabs

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

            taskItem.appendChild(checkbox);
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
                checkbox.style.display = 'none'; // Hide checkbox in edit list for now
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
            alert("Task title is required.");
            return;
        }

        if (priority === 'CRITICAL' && !deadline) {
            alert("Deadline is required for CRITICAL tasks.");
            return;
        }

        if (priority !== 'CRITICAL') {
            deadline = null; // Ensure deadline is null if not critical
        }

        console.log("Adding task:", { title, url, priority, deadline, type });

        await addNewTask(title, url, priority, deadline, type);

        // Clear form fields
        taskTitleInput.value = '';
        taskUrlInput.value = '';
        taskPriorityInput.value = 'SOMEDAY'; // Reset to default
        taskDeadlineInput.value = '';
        taskTypeInput.value = 'home'; // Reset to default
        taskDeadlineGroup.style.display = 'none'; // Hide deadline field

        alert("Task added successfully!");
        // Later, we'll refresh the task lists here
        // renderTasksInEditTab(); // Placeholder for future function
        // renderTasksInDisplayTab(); // Placeholder for future function
        renderTasks('display'); // Refresh display tab
        renderTasks('edit');    // Refresh edit tab
        renderTasks('home');    // Refresh home tab
        renderTasks('work');    // Refresh work tab
    });
    // --- End of Add Task Functionality ---

    // Initial render for the default active tab (Display)
    renderTasks('display');
    // Also render for edit tab so it's ready if user switches
    // This avoids seeing "No tasks to edit" if tasks exist.
    renderTasks('edit');

    setupTaskCompletionListeners(); // Call the function to attach listeners

    setupTaskDeletionListener(); // Call the function to attach deletion listener

    // console.log("Task Manager Loaded. Task completion listeners set up."); // Previous log
    console.log("Task Manager Loaded. Completion and deletion listeners set up."); // Update log
});
