# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Weekly Task Manager** - a Chrome/Chromium browser extension for managing tasks with priority levels (Critical, Important, Someday) and categories (Home, Work). The extension uses Chrome's storage API for data persistence and provides both a compact popup interface and a full-page manager view.

## Architecture

### Core Components

**Frontend Files:**
- `popup.html` + `popup.js` - Main extension popup interface with tabbed views (Display, Edit, Home, Work)
- `manager.html` + `manager.js` - Full-page task manager with column-based priority view
- `popup.css` - Unified styling with neumorphic design for both popup and manager pages
- `task_utils.js` - Core task management utilities and storage operations

**Extension Configuration:**
- `manifest.json` - Chrome Extension Manifest V3 configuration
- `images/` - Extension icons (16px, 48px, 128px)

### Data Model

Tasks are stored using Chrome's `chrome.storage.local` API with this structure:
```javascript
{
  id: string,           // Unique identifier
  title: string,        // Task title
  url: string,          // Optional URL
  priority: string,     // 'CRITICAL', 'IMPORTANT', 'SOMEDAY'
  completed: boolean,   // Completion status
  deadline: string,     // Date string for CRITICAL tasks only
  type: string,         // 'home' or 'work'
  displayOrder: number  // For custom ordering within priority groups
}
```

### Key Features Implementation

**Task Management:**
- **Priority System:** CRITICAL (requires deadline) > IMPORTANT > SOMEDAY
- **Categories:** Home/Work task types with filtering
- **Ordering:** Primary sort by priority, secondary by user-defined displayOrder
- **Drag & Drop:** Reordering within same priority (Display tab) or global reordering (Edit tab)
- **Inline Editing:** Edit tasks directly in lists with form overlay

**Storage Operations:**
- All data operations in `task_utils.js` use callback patterns with Chrome Storage API
- Tasks are automatically backfilled with `displayOrder` if missing during retrieval

**UI Architecture:**
- **Popup Interface:** Tabbed view (500px width) for quick task management
- **Manager Page:** Full-screen three-column layout (Critical | Important | Someday)
- **Neumorphic Design:** Consistent soft shadow styling throughout

## Development Commands

This is a browser extension with no build process - load directly as unpacked extension:

1. **Loading Extension:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. **Testing:**
   - Make code changes
   - Click refresh icon on extension card in `chrome://extensions/`
   - Test in extension popup or manager page

3. **Debugging:**
   - Right-click extension icon → "Inspect popup" for popup debugging
   - Open manager page and use regular DevTools for manager debugging
   - Check `chrome://extensions/` for error details

## Code Patterns

**Event Handling:**
- Use event delegation on container elements for dynamic task lists
- All async operations use Promise-based patterns with `getTasks()` callback structure

**DOM Manipulation:**
- Task rendering creates complete DOM structures programmatically
- Inline editing replaces task content with form elements temporarily
- Drag and drop updates both DOM order and underlying data

**State Management:**
- No complex state management - data flows from Chrome storage through rendering functions
- Task completion, editing, and reordering immediately persist to storage
- Multiple views (popup tabs, manager columns) re-render after data changes

**Error Handling:**
- Storage operations include error callbacks with user feedback via `showInfoMessage()`
- Form validation for required fields (task title, deadline for critical tasks)

## Important Notes

- **Chrome Storage:** Uses `chrome.storage.local` - no external dependencies
- **Permissions:** Extension requires "storage" and "tabs" permissions
- **Cross-Page Consistency:** Changes in popup automatically reflect in manager page and vice versa
- **Task IDs:** Generated using timestamp + random string pattern for uniqueness
- **Deadline Calculation:** Critical tasks show "days remaining/overdue" relative to current date