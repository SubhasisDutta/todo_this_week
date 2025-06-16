# Weekly Task Manager

A simple browser extension to help you manage your weekly tasks efficiently. It allows you to add, edit, prioritize, and track your tasks across different categories like home and work.

![Weekly Task Manager Screenshot](images/image.png)

## Features

- **Task Creation:** Add tasks with details such as title, URL (optional), priority (Critical, Important, Someday), deadline (for Critical tasks), and type (Home, Work).
- **Multiple Task Views:**
    - **Display Tab:** Shows all active (non-completed) tasks, sorted first by priority (Critical > Important > Someday) and then by a user-defined order within each priority group. Supports drag-and-drop reordering of tasks within the same priority group.
    - **Home Tab:** Filters and displays only active "Home" type tasks.
    - **Work Tab:** Filters and displays only active "Work" type tasks.
    - **Edit Tab:** Shows all tasks (both active and completed). This tab is the control center for managing tasks.
- **Task Management in Edit Tab:**
    - **Comprehensive Editing:** Modify any attribute of a task (title, URL, priority, deadline, type, completed status) through an inline editing form.
    - **Deletion:** Remove tasks permanently.
    - **Reordering:** Change the global display order of tasks using drag-and-drop or convenient up/down arrow buttons. This order influences the secondary sorting in the "Display" tab.
- **Task Completion:** Mark tasks as complete or incomplete directly from the Display, Home, or Work tabs. Completed tasks are visually distinguished in the Edit tab.
- **Persistent Storage:** Tasks are saved locally using `chrome.storage.local`, so your data persists across browser sessions.
- **User Feedback:** Receive visual confirmation messages for actions like adding, updating, or deleting tasks.
- **Priority System:**
    - **Critical:** For urgent tasks; requires a deadline. Displays days remaining or overdue.
    - **Important:** For significant tasks that are not yet critical.
    - **Someday:** For tasks to be done at some point without immediate urgency.
- **Task Types:** Categorize tasks as 'Home' or 'Work' for better organization.

## Installation

As this is an unpacked extension, you'll need to load it manually into a compatible browser (like Chrome, Edge, or other Chromium-based browsers):

1.  **Download or Clone:**
    *   Download the repository ZIP and extract it to a local folder.
    *   OR, clone the repository if you have its URL.
2.  **Open Browser Extensions Page:**
    *   Navigate to `chrome://extensions` in Chrome.
    *   Navigate to `edge://extensions` in Microsoft Edge.
    *   For other browsers, find the equivalent "Manage Extensions" page.
3.  **Enable Developer Mode:**
    *   Look for a toggle switch labeled "Developer mode" (usually in the top right corner of the extensions page) and ensure it is turned ON.
4.  **Load the Extension:**
    *   Click the "Load unpacked" button.
    *   In the file dialog that appears, navigate to the directory where you extracted or cloned the extension files.
    *   Select the main folder that contains the `manifest.json` file.
5.  **Done!** The "Weekly Task Manager" icon should now appear in your browser's toolbar.

## How to Use

1.  **Accessing the Extension:**
    *   Click on the "Weekly Task Manager" icon in your browser's toolbar to open the popup.

2.  **Navigating Tabs:**
    *   The extension has four main tabs:
        *   **Display:** Shows your active tasks, prioritized and ordered. Ideal for a quick overview.
        *   **Home:** Shows active tasks categorized as 'Home'.
        *   **Work:** Shows active tasks categorized as 'Work'.
        *   **Edit:** This is where you add, modify, and manage all your tasks.

3.  **Adding a New Task:**
    *   Go to the **Edit** tab.
    *   At the top, you'll find a form:
        *   Enter the **Task Title** (required).
        *   Optionally, add a **Task URL**.
        *   Select a **Priority** (Critical, Important, Someday). If "Critical" is chosen, a **Deadline** input will appear; please provide a date.
        *   Choose a **Type** (Home or Work).
        *   Click the "Add Task" button.

4.  **Viewing Tasks:**
    *   Tasks are automatically displayed in the relevant tabs once added.
    *   In the **Display** tab, tasks are color-coded by priority (Critical: Red, Important: Yellow, Someday: Green - *actual colors may vary based on CSS*).
    *   Critical tasks with deadlines will show how many days are remaining or overdue.

5.  **Completing a Task:**
    *   In the **Display**, **Home**, or **Work** tabs, click the checkbox next to a task to mark it as complete.
    *   Click again to mark it as incomplete.
    *   Completed tasks are hidden from these views but can still be seen and managed in the **Edit** tab (they will appear visually distinct, e.g., faded or struck-through).

6.  **Editing a Task:**
    *   Go to the **Edit** tab.
    *   Find the task you wish to modify.
    *   Click the "Edit" button next to the task. An inline form will appear with the task's current details.
    *   Make your changes to the title, URL, priority, deadline, type, or completed status.
    *   Click "Save" to apply the changes, or "Cancel" to discard them.

7.  **Deleting a Task:**
    *   Go to the **Edit** tab.
    *   Find the task you wish to remove.
    *   Click the "Delete" button next to the task. You'll be asked for confirmation.

8.  **Reordering Tasks:**
    *   **In the Edit Tab (Global Order):**
        *   **Drag & Drop:** Click and hold on a task, then drag it to the desired position in the list.
        *   **Buttons:** Use the `↑` (Up) and `↓` (Down) arrow buttons next to each task to move it one step at a time. This order affects the secondary sorting in the "Display" tab.
    *   **In the Display Tab (Within Priority Groups):**
        *   You can drag and drop tasks to reorder them, but only *within their current priority group* (e.g., you can reorder Critical tasks amongst themselves, but cannot drag an Important task into the Critical section).

## Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the issues page if a public repository link is available.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
