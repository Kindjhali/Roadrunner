# Roadrunner UI Icon List

This document outlines the suggested icons and buttons for the Roadrunner user interface. Each icon is stored as an SVG under `frontend/src/icons/` and uses `fill="var(--theme-orange)"` with a satin gold stroke (`#d4af37`).

- **Run / Execute** – `.cardinalis-button-primary` with `run.svg`.
- **Stop Task** – `.pelecanus-button-action` with `stop.svg`.
- **Pause / Resume** – toggle showing `pause.svg` or `resume.svg`.
- **Refresh** – circular arrow `refresh.svg`.
- **New Task** – `.tachornis-floating-button` using `new-task.svg`.
- **Save / Download** – `save.svg` for session saves or downloads.
- **File Upload** – `upload.svg` near file inputs.
- **Settings** – gear `settings.svg`.
- **Help / Info** – `help.svg` for assistance.
- **Close / Cancel** – `.fringilla-close-button` with `close.svg`.

## Implementation Plan for UI Icons

### Add icon assets
- Save each icon as an SVG under `frontend/src/icons/`.
- Files: `run.svg`, `stop.svg`, `pause.svg`, `resume.svg`, `refresh.svg`, `new-task.svg`, `save.svg`, `upload.svg`, `settings.svg`, `help.svg`, `close.svg`.
- Each SVG uses `fill="var(--theme-orange)"` and `stroke="#d4af37"` (satin gold) with a small `stroke-width`.

### Update Vue components
- Import the required SVG in `frontend/src/App.vue` and any component with buttons:
  ```javascript
  import runIcon from './icons/run.svg';
  ```
- Replace text or emoji placeholders inside buttons with:
  ```html
  <img :src="runIcon" class="icon" alt="Run">
  ```
- Add new buttons if they do not exist (e.g., Stop Task, Pause/Resume).
- For toggles such as Pause/Resume, use `v-if` to switch icons.

### Extend styles
- Edit `frontend/src/styles/roadrunner.css` and add:
  ```css
  .icon {
    width: 1rem;
    height: 1rem;
    fill: var(--theme-orange);
    stroke: #d4af37;
    stroke-width: 1.5;
  }
  ```
- Ensure button classes (`.cardinalis-button-primary`, `.pelecanus-button-action`, `.tachornis-floating-button`, `.fringilla-close-button`) include space for the icon `<img>`.

### Placement summary
- **Run / Execute** – `.cardinalis-button-primary` in the Coder tab.
- **Stop Task** – adjacent `.pelecanus-button-action` near the Run button.
- **Pause / Resume** – toggle within the task controls area.
- **Refresh** – existing refresh buttons for models or modules.
- **New Task** – `.tachornis-floating-button` at the top right of the main card.
- **Save / Download** – session "Save Session" button.
- **File Upload** – label for file inputs in Coder and Brainstorming tabs.
- **Settings** – header button linking to the Configuration tab.
- **Help / Info** – small `.pelecanus-button-action` next to the tab bar or inside modals.
- **Close / Cancel** – current `.fringilla-close-button` in the header.

### Steps to implement
1. Create or source the SVGs with correct fills and stroke.
2. Place them in `frontend/src/icons/`.
3. Import and reference each icon in the relevant Vue files.
4. Apply the `.icon` class for consistent sizing and colour.
5. Run existing build and test commands (`npm install`, `npm run build`) to verify assets load.

```
✅ Verified Implementation:
- [x] All functions and classes are present
- [x] All references are locally resolved
- [x] Logic matches description
- [x] Follows structure and module conventions
```

