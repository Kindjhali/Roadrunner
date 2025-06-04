# RoadrunnerExecutor UI & Theme Guide

This document explains how to build, style, and run the glowing orange RoadrunnerExecutor app using Vue 3, Vite, Tailwind CSS, and Electron. It refers to the standalone `roadrunner/` project. TokomakAI Desktop contains a modal version driven by the `roadrunnercore` module which reuses these components.

---

## 🚀 Build & Run Instructions

For a complete setup including backend dependencies and server, please follow the detailed instructions in [ROADRUNNER_SETUP_AND_FEATURES.md](./ROADRUNNER_SETUP_AND_FEATURES.md).

The following steps are a quick guide for frontend/theme development, assuming backend setup is already completed or not directly needed for the UI changes you are making:

1. **Install root/frontend dependencies** (if not already done):
   From the `roadrunner` directory:
   ```bash
   npm install
   ```

2. **Build the frontend** (to see your changes):
   From the `roadrunner` directory:
   ```bash
   npm run build
   ```

3. **Run the Electron app** (ensure the backend server is running if app functionality is required):
   From the `roadrunner` directory:
   ```bash
   npm start
   ```
   This command is typically configured in `package.json` to build frontend assets (if necessary) and then launch the Electron application. It should work consistently across Linux, macOS, and Windows.

---

## 🎨 UI Theme Overview

This UI replicates the glowing neon orange panel shown in the reference image. Here's how the look is achieved:

### 🧱 Layout Components

- **Outer Container:** Orange glowing border, large padding, centered
- **Inner Panel:** Deep slate background (`#111827`), orange inset border, rounded corners
- **Text & Icons:** Orange (`--theme-orange`), with light drop shadows

### 🧡 Color Tokens

These are defined via `:root` in `style.css`:

```css
:root {
  --theme-orange: #ff6f00;
  --theme-orange-dark: #e65100;
  --theme-orange-light: #ffb74d;
}
```

### 💅 Tailwind Utility Classes

Key Tailwind classes used:

| Element       | Classes                                                                                                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Outer wrapper | `shadow-[0_0_40px_var(--theme-orange)] border-4 border-[var(--theme-orange-dark)] rounded-3xl`                                                                                         |
| Inner box     | `bg-[#111827] border border-[var(--theme-orange-light)] rounded-2xl shadow-inner`                                                                                                      |
| Header text   | `text-3xl font-extrabold text-center text-[var(--theme-orange)] drop-shadow-[0_0_10px_var(--theme-orange)]`                                                                            |
| Button        | `bg-[var(--theme-orange)] text-black font-bold py-2 px-4 rounded-xl hover:bg-[var(--theme-orange-light)]`                                                                              |
| Close button  | `text-[var(--theme-orange)] bg-black border border-[var(--theme-orange)] rounded-full px-3 py-1 hover:bg-[var(--theme-orange)] hover:text-black shadow-[0_0_10px_var(--theme-orange)]` |

---

## ✨ Fonts

Define the font class in your CSS:

```css
.font-ui-strange {
  font-family: 'Share Tech Mono', 'Fira Code', 'JetBrains Mono', monospace;
}
```

---

## 🧪 Developer Tips

- Press `Ctrl+Shift+I` in the Electron window to open DevTools if needed.
- Modify `src/RoadrunnerExecutor.vue` to expand or customize functionality.
- All visual styles are from Tailwind — no SCSS or custom preprocessors required.

---

This app is designed to look like a glowing terminal UI in a futuristic mobile device.
