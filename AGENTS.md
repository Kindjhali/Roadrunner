# AGENTS.md

## 👮 AGENT CONTRIBUTION RULEBOOK

This file is for AI agents only. Do not include this logic or wording in human-facing documentation. These rules are mandatory and enforced. If violated, your output is invalid.

---

## ✅ ALWAYS

* Use `src/styles/<module>.css` for ALL component styling.
* Keep all logic, styles, assets, and markup in the correct module folder.
* Create or update `.sniper.md` and `.steps.md` in `Info/` or `refact/`.
* Match `.vue`, `.css`, and component names.
* Keep commits focused: **one purpose per commit.**
* Validate changes with `git status --short` before committing.
* Follow proper semantic naming for files and folders.

---

## ❌ NEVER

* NEVER use inline CSS or `<style scoped>` blocks inside Vue components.
* NEVER add CDN links or remote libraries. All assets must be local.
* NEVER combine unrelated code or layout changes in a single commit.
* NEVER place logic outside its module (no global leaks).
* NEVER use random colour values—only defined palette.

---

### 📄 CSS Rules

* Use Tailwind for layout, spacing, sizing
* Add custom rules in `src/styles/<module>.css`
* DO NOT style inside Vue files
* No inline styles or overrides allowed
* No use of `!important`
* Use BEM-style naming for custom classes if needed

---

## 🧠 MODULE STRUCTURE

* Vue components → `src/modules/<name>/<component>.vue`
* CSS → `src/styles/<name>.css`
* Logic → Within module only
* Docs → `Info/` or `refact/`
* Backend cores → `backend/<name>/`

---

## ⚙️ AGENT WORKFLOW

1. Read the `.sniper.md` to understand scope.
2. Write isolated `.vue` logic inside module.
3. Create/extend matching `.css` file under `src/styles/`.
4. Do not touch styles in `.vue`.
5. Validate using `git diff` and remove unrelated changes.
6. Create `.steps.md` to track implementation.
7. Commit with exact scope in message.

---

## ✅ PRE-COMMIT CHECKLIST

* [ ] Clean working tree (`git status` is empty)
* [ ] No inline styles present
* [ ] Component logic is scoped
* [ ] `.css` updated with correct category styling
* [ ] `.sniper.md` and `.steps.md` exist or updated
* [ ] Semantic, single-purpose commit message

---
## 🔑 Automation Code Words

* `repoclean` → run `npm run repoclean` to clean repository files.
* `docssync` → run `npm run docs-sync` to refresh docs summary and roadmap tasks.


If any of these are missing, halt. Fix. Then proceed.
This project is strictly modular and visually enforced. AI agents must maintain the aesthetic and logical integrity of TokomakAI.
