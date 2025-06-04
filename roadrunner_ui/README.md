# Roadrunner UI (TokomakAI Style)

This is the final, cleaned version of the Roadrunner AI Executor UI mockup. It includes:
- External CSS (`styles/tokomakai.css`)
- Correct colors and font (`JetBrains Mono`)
- Finalized layout with styling decoupled from HTML
- Glow and text stylings per verified screenshots

## How to Run (Standalone)
1. Open `index.html` in any modern browser (Chrome, Firefox, Edge).
2. Tailwind CSS is loaded via CDN.
3. Fonts are from Google Fonts (JetBrains Mono 700).

## How to Embed in Electron

To avoid the layout stretching full-screen when embedded in Electron:

### 🛡️ DO NOT STRETCH TO FULLSCREEN
Electron will default to a large viewport unless constrained. You should:

#### In `main.js` (Electron):

```js
const mainWindow = new BrowserWindow({
  width: 400,
  height: 800,
  resizable: false,
  fullscreenable: false,
  frame: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false
  },
  backgroundColor: '#0b0d13'
});
```

This ensures the app runs in a **fixed-height, narrow frame** like the mockup intends.

### 🧱 Container Behavior
The outer `<body>` is styled with:
```css
display: flex;
align-items: center;
justify-content: center;
min-height: 100vh;
```

This centers the UI and prevents vertical stretching in fullscreen. Avoid overriding this with `height: 100%` in Electron.

---

## File Structure

- `index.html`: UI markup
- `styles/tokomakai.css`: All styling rules
- `README.md`: You’re here.

Ready to drop into Electron or extend as a Vue component.
