# Weekly Task Manager

A powerful browser extension to help you manage your weekly tasks efficiently. It allows you to add, edit, prioritize, and schedule your tasks across different categories and time blocks.

[Placeholder for a GIF of the main popup interface in action]

## Features

### Core Task Management
- **Create Tasks:** Add tasks with a title, optional URL, priority, type, and energy level.
- **Modern UI:** Selections are made via intuitive, icon-enhanced radio buttons.
- **Deadlines:** Assign a deadline to "Critical" priority tasks to keep track of due dates.

[Placeholder for image of the ADD tab in the popup]

### The Popup View
The popup is a quick-access interface for your daily and upcoming tasks.

- **TODAY Tab:**
    - Shows all tasks scheduled for the current day.
    - Tasks are automatically grouped and sorted by their scheduled time block (e.g., "[9AM-12PM] Engagement Block").
    - Each scheduled assignment can be checked off individually.

    [Placeholder for image of the TODAY tab with grouped tasks]

- **Display Tab:**
    - View all your active (non-completed) tasks, sorted by priority.
    - Features a "master" checkbox for each task. Checking it completes the task and all its scheduled assignments at once.

- **ADD Tab:**
    - A clean, dedicated tab for quickly adding new tasks.

### The Planner Page (Manager)
Access a full-page, powerful task planner for detailed weekly scheduling and management.

[Placeholder for a GIF showing the planner page in action, e.g., dragging a task to the grid]

- **SCHEDULE Tab:**
    - Drag-and-drop tasks from the "Unassigned" list onto a weekly calendar grid.
    - The grid is divided into customizable time blocks (e.g., "Deep Work", "Family Time").
    - Schedule tasks for multiple time blocks across the week.

    [Placeholder for image of the weekly schedule grid]

- **PRIORITY Tab:**
    - Manage all tasks in columns based on their priority (Critical, Important, Someday).
    - **Inline Editing:** Click "Edit" on any task to modify all its properties, including its schedule.
    - **Reordering:** Drag-and-drop tasks or use arrow buttons to change their display order.

    [Placeholder for image of the PRIORITY tab]

- **LOCATION Tab:**
    - View tasks conveniently grouped by "Home" or "Work".

### Advanced Features
- **Granular Task Completion:** For scheduled tasks, each assignment can be completed individually from the Manager page. The parent task is only marked as fully complete when all its assignments are done.

    [Placeholder for image showing the collapsible assignment list with checkboxes in the manager]

- **Import/Export:** Save your entire task list to a JSON file for backup or transfer, and import it back at any time.

## Installation

As this is an unpacked extension, you'll need to load it manually into a compatible browser (like Chrome, Edge, or other Chromium-based browsers):

1.  **Download or Clone:** Get the project files and place them in a local folder.
2.  **Open Browser Extensions Page:**
    -   Navigate to `chrome://extensions` in Chrome.
    -   Navigate to `edge://extensions` in Microsoft Edge.
3.  **Enable Developer Mode:** Ensure the "Developer mode" toggle is ON.
4.  **Load the Extension:** Click the "Load unpacked" button and select the folder containing the `manifest.json` file.
5.  **Done!** The extension icon will appear in your browser's toolbar.

## How to Use

1.  **Adding a Task:** Click the extension icon, go to the "ADD" tab, fill out the form, and click "Add Task".
2.  **Scheduling a Task:** Click the "PLANNER" button to open the full manager page. On the "SCHEDULE" tab, drag your task from the "Unassigned Tasks" list onto any time block in the weekly grid.
3.  **Completing Tasks:**
    -   In the popup's "TODAY" tab, check off individual assignments.
    -   In the popup's "Display" tab, use the master checkbox to complete a task and all its assignments.
    -   In the Manager's "Assigned Tasks" list, expand a task to see and complete its individual assignments.

## Contributing

Contributions, issues, and feature requests are welcome!

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
