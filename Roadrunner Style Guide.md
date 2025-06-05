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

* `.accipiter-header` – main header
* `.geococcyx-executor-page` – root RoadrunnerExecutor layout
* `.cardinalis-button-primary` – primary CTA button
* `.columbidae-task-list` – task display
* `.sylvia-task-description` – rendered rich text with highlight
* `.strigiformes-log-display` – console/log outputs

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

#### 📋 Task Lists & Editors

| Class                       | Description                         |
| --------------------------- | ----------------------------------- |
| `.passer-task-item`         | A single task block                 |
| `.parus-task-checkbox`      | Checkbox for task                   |
| `.sylvia-task-editor-input` | Input field for inline task editing |
| `.sylvia-task-description`  | Highlighted markdown output         |
| `.regulus-metadata-badge`   | Label/tag for task metadata         |
| `.motacilla-parse-warning`  | Parser warning in yellow            |

---

#### 💬 Chat/Agent Log Area

* `.chat-history-panel`, `.chat-message`, `.user-message`, `.model-message`
* `.chat-input-area`, `.chat-send-button`, `.chat-file-upload-button`
* Styled like a monospaced terminal-meets-chat interface
* Messages are color-coded by sender and include `sender-label`

---

#### 🔤 Console Output

| Class                          | Use                                              |
| ------------------------------ | ------------------------------------------------ |
| `.corvus-console-output-panel` | Logs in task view                                |
| `.otus-log-area`               | Logs in executor view                            |
| `.pica-log-message-*`          | Log line types: success, error, warn, info, etc. |

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
* Place all CSS in `frontend/src/styles/`; `.vue` files must not include `<style>` sections or inline styles

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
- Modify `src/RoadrunnerExecutor.vue` to expand or customize functionality.
- All visual styles are from Tailwind — no SCSS or custom preprocessors required.
