## 🛍️ Roadrunner UI Style Guide

### 🎨 THEME

* **Base Color**: `--theme-orange: #FF6A00`
* **Dark Accent**: `--theme-orange-dark: #c2410c`
* **Light Accent**: `--theme-orange-light: #ff944d`
* **Log Background**: `--log-bg: #0b0f14`
* **Font Stack**: `JetBrains Mono, Share Tech Mono, Fira Code, monospace`

---

### 🩶 BIRD TAXONOMY NAMING SYSTEM

Component classes follow the format:

```
[bird-family]-[role-or-component]
```

Examples:

* `.tyrannidae-main-card` – The main application card/window.
* `.furnariidae-inner-panel` – Inner content panels within cards.
* `.accipiter-header` – Main header sections.
* `.passeriformes-form-area` – Sections containing forms or groups of inputs.
* `.piciformes-input-row` – A row containing input elements.
* `.cardinalis-button-primary` – Primary call-to-action buttons (e.g., "Run Task", "Approve").
* `.pelecanus-button-action` – Secondary action buttons (e.g., "Refresh Models", "Edit Instructions").
* `.hirundo-text-input` – Text input fields and textareas.
* `.turdus-select` – Select dropdown elements.
* `.fringilla-close-button` – Specific buttons like the main window close button.

This reinforces clarity, avoids naming collision, and adds flair.

---

### 📊 LAYOUT CONVENTIONS

* Use **flex and grid** for layout panels:

  * `.geococcyx-executor-page` → flex-centered viewport
  * `.apodiformes-form-grid` → inner form panels
* Cards like `.tyrannidae-main-card` and `.bubo-executor-card`:

  * Use soft rounded corners (`1rem+`)
  * Strong borders and shadow outlines in theme-orange
* Inner panels like `.furnariidae-inner-panel` use:

  * `#111827` base
  * Orange border highlights
  * `padding: 1.5rem` and flex-column layout

---

### 🧱 COMPONENT STYLES

#### ✅ Buttons

| Class                             | Purpose                          |
| --------------------------------- | -------------------------------- |
| `.cardinalis-button-primary`      | Main CTA (‘Run’ etc.)            |
| `.cardinalis-button-large-action` | Executor ‘Execute’ button        |
| `.pelecanus-button-action`        | Secondary actions (refresh etc.) |
| `.tachornis-floating-button`      | Fixed-position top-right button  |

**Note**: Buttons consistently use:

* Orange fill on black background
* Rounded edges
* Hover state = lighter orange

---

#### 📟 Inputs & Forms

* `.hirundo-text-input` – Text inputs and textareas
* `.turdus-select` – Dropdowns with custom orange arrow
* `.spizella-checkbox-group` – Checkbox containers
* `.parus-checkbox` – Square, monospaced, coloured checkboxes

---

#### 📋 Task Definition & Interaction (Coder Tab)

The Coder tab has evolved from detailed task lists to a single task input area.
Relevant classes include:
*   `.passeriformes-form-area`: Contains the main input controls.
*   `.piciformes-input-row`: Organizes elements like model selection, file upload, and safety mode toggle.
*   `.emberiza-label`: Used for labels next to input fields.
*   `.hirundo-text-input`: For the main "Task Description" textarea.
*   `.chat-file-input-container`, `.chat-file-input-label`, `.chat-file-input`: For the "Custom Task File" upload.

---

#### 💬 Agent Output / Log Area (Coder Tab)

*   The main log display area is within a div classed `executor-output-panel`.
*   Individual log entries are dynamically styled using Tailwind CSS classes based on the log type (e.g., `text-red-400` for errors, `text-green-400` for success) via the `getLogClass()` method in `App.vue`.
*   There are no longer specific BIRD taxonomy classes like `.pica-log-message-*` applied directly in the template for individual log lines. The styling is more utility-class driven.
*   Preformatted data within logs (`<pre>` tags) uses classes like `text-xs bg-gray-800 p-1 mt-1 rounded overflow-x-auto`.

All log boxes use dark backgrounds and small monospace fonts.

---

### 🛍 Tab System

* `.tab-navigation` → horizontal tab bar
* `.tab-navigation button.active` → bold + orange underline
* `.tab-content` → scrollable flex container
* Additional scoped tabs:

  * `.brainstorming-tab-content`
  * `.coder-tab-content`

---

### 🔔 Microinteractions

* Glow effects: `.glow-box`
* Scrollbars: thin, orange-highlighted
* Hover states for nearly all interactives
* Tooltips/states not present but ready to layer

---

### 🛠 Development Notes

* Syntax highlight styles exist under `.sylvia-task-description .text-*`
* Theming assumes **dark mode only**
* System is **component-modular and scalable**
* File Upload and Chat are **fully styled** but minimally scripted—expect them to be used in agent output interaction
* Prefer global styles and theming in `frontend/src/styles/` (e.g., `roadrunner.css`, `conference.css`). For component-specific styles, using `<style scoped>` within individual `.vue` files is acceptable and encouraged for encapsulation. Avoid using inline styles (`style="..."`) directly in templates to maintain better structure, reusability, and adherence to Content Security Policy.

---

### 🎨 Current Theme Implementation Examples

This UI replicates the glowing neon orange panel shown in the reference image. Here's how the look is achieved:

#### 🧱 Layout Components

- **Outer Container:** Orange glowing border, large padding, centered
- **Inner Panel:** Deep slate background (`#111827`), orange inset border, rounded corners
- **Text & Icons:** Orange (`var(--theme-orange)`), with light drop shadows

_Note: The color tokens like `--theme-orange` mentioned below refer to the values defined at the top of this Style Guide (`--theme-orange: #FF6A00; --theme-orange-dark: #c2410c; --theme-orange-light: #ff944d;`). Please prefer these official palette values._

#### 💅 Tailwind Utility Classes

Key Tailwind classes used:

| Element       | Classes                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outer wrapper | `shadow-[0_0_40px_var(--theme-orange)] border-4 border-[var(--theme-orange-dark)] rounded-3xl`                                                                                         |
| Inner box     | `bg-[#111827] border border-[var(--theme-orange-light)] rounded-2xl shadow-inner`                                                                                                      |
| Header text   | `text-3xl font-extrabold text-center text-[var(--theme-orange)] drop-shadow-[0_0_10px_var(--theme-orange)]`                                                                            |
| Button        | `bg-[var(--theme-orange)] text-black font-bold py-2 px-4 rounded-xl hover:bg-[var(--theme-orange-light)]`                                                                              |
| Close button  | `text-[var(--theme-orange)] bg-black border border-[var(--theme-orange)] rounded-full px-3 py-1 hover:bg-[var(--theme-orange)] hover:text-black shadow-[0_0_10px_var(--theme-orange)]` |

#### ✨ Fonts

Define the font class in your CSS:

```css
.font-ui-strange {
  font-family: 'Share Tech Mono', 'Fira Code', 'JetBrains Mono', monospace;
}
```

#### 🧪 Developer Tips

- Press `Ctrl+Shift+I` in the Electron window to open DevTools if needed.
- Modify `src/App.vue` and its child components (e.g., in `frontend/src/components/`) to expand or customize functionality, as `App.vue` is the main UI entry point.
- All visual styles are from Tailwind — no SCSS or custom preprocessors required.
