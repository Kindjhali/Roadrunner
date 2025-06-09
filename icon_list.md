# Roadrunner UI Icon List

This document outlines icons currently used in the Roadrunner UI (`App.vue`) as well as suggestions or plans for icons for additional features. Each icon is stored as an SVG under `frontend/src/icons/`. The styling (fill/stroke) is generally handled via CSS or by the SVG content itself, rather than fixed attributes in this document.

**Currently Used Icons in `App.vue`:**
*   **Run / Execute (`run.svg`)**: Used in the "Run Task" button (`.cardinalis-button-primary`) on the Coder tab.
*   **Refresh (`refresh.svg`)**: Used in the "Refresh Models" button (`.pelecanus-button-action`) on the Coder tab.
*   **File Upload (`upload.svg`)**: Used in the "Custom Task File" label (`.chat-file-input-label`) on the Coder tab.
*   **Close / Cancel (`close.svg`)**: Used in the main window close button (`.fringilla-close-button`) in the header.

**Suggested/Planned Icons (may not be in active use in `App.vue`):**
*   **Stop Task (`stop.svg`)**: Suggested for a button to halt ongoing tasks.
*   **Pause / Resume (`pause.svg`, `resume.svg`)**: Suggested for task control toggles.
*   **New Task (`new-task.svg`)**: Suggested for initiating a new task or clearing the current one.
*   **Save / Download (`save.svg`)**: Suggested for saving task configurations, results, or sessions. (Note: `save.svg` is loaded in `App.vue`'s data but not visibly used in its direct template).
*   **Settings (`settings.svg`)**: Suggested for accessing configuration, though `App.vue` uses a dedicated "Configuration" tab.
*   **Help / Info (`help.svg`)**: Suggested for providing contextual help.


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

**Icons Actively Used in `App.vue`:**
- **Run / Execute (`run.svg`)** – On the "Run Task" button (`.cardinalis-button-primary`) in the Coder tab.
- **Refresh (`refresh.svg`)** – On the "Refresh Models" button (`.pelecanus-button-action`) in the Coder tab.
- **File Upload (`upload.svg`)** – On the "Custom Task File" label (`.chat-file-input-label`) in the Coder tab.
- **Close / Cancel (`close.svg`)** – On the main window close button (`.fringilla-close-button`) in the header.

**Placement for Suggested/Planned Icons:**
- **Stop Task (`stop.svg`)** – Could be placed near the "Run Task" button, possibly as a `.pelecanus-button-action`. (Planned)
- **Pause / Resume (`pause.svg`, `resume.svg`)** – Would appear in task control areas if this feature is added. (Planned)
- **New Task (`new-task.svg`)** – Could be a general action button, perhaps a `.tachornis-floating-button` if that style is used. (Suggested)
- **Save / Download (`save.svg`)** – Could be used for saving configurations, task outputs, or future session features. (Suggested; `save.svg` loaded but not directly used in `App.vue` template).
- **Settings (`settings.svg`)** – While `App.vue` has a "Configuration" tab, a settings icon could be used elsewhere if needed. (Suggested)
- **Help / Info (`help.svg`)** – Could be used for tooltips or info buttons within specific sections or modals. (Suggested)

### Steps to implement
1. Create or source the SVGs. Ensure they are optimized and styled appropriately (fill/stroke can often be controlled via CSS).
2. Place them in `frontend/src/icons/`.
3. Import and reference each icon in the relevant Vue files (e.g., `import myIcon from './icons/my-icon.svg';`).
4. In the template, use `<img :src="myIcon" class="icon" alt="Descriptive Alt Text">`.
5. Apply the `.icon` class (defined in global styles like `roadrunner.css`) for consistent sizing and potentially basic styling. Specific color/fill can be managed by the SVG content or overridden by more specific CSS if needed.
6. Run existing build and test commands (`npm install`, `npm run build`) to verify assets load correctly.

