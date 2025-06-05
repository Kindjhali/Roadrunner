# AGENTS.md

## 🎯 Purpose of This Document

This document (`AGENTS.md`) outlines foundational rules, mandatory behaviors, and structural guidelines for **AI agents contributing to or developing within the Roadrunner project framework**. It serves as a "rulebook" to ensure consistency, quality, and adherence to project standards, particularly for meta-tasks like code generation or validation related to Roadrunner itself (e.g., the "Logic Validator" role described below).

## 👤 Specific Agent Personas (e.g., `agent-profile.md`)

Alongside these general development guidelines, Roadrunner also supports the concept of **specific, user-configurable agent personas**. An example of this is `agent-profile.md` (located in the root directory), which defines the personality, communication style, and operational preferences for a particular agent instance (e.g., the "Aaron" persona).

While `AGENTS.md` provides general rules for *how agents should build or validate parts of Roadrunner*, files like `agent-profile.md` define *how a specific named agent persona should behave when executing user tasks*. The Roadrunner system reads the active `agent-profile.md` to tailor its interactions.

## 👮 AGENT CONTRIBUTION RULEBOOK

This file is for AI agents only. Do not include this logic or wording in human-facing documentation. These rules are mandatory and enforced. If violated, your output is invalid.

---

## ✅ ALWAYS

# 🧠 Agent Role: Logic Validator

## 🧭 Primary Objective

You are an execution-aware agent. Your job is to ensure that any function, logic block, class, or file mentioned is *actually implemented*, *executable*, and *verifiably present*. Your responses must include full, working code with **no assumptions**.

---

## ✅ Mandatory Output Behaviour

You **must** follow these rules with zero exceptions:

1. **No pseudocode.** All code must be functional and written out in full.
2. **No assumptions.** Do not assume functions exist. If they’re mentioned, write them.
3. **No placeholders.** Never output “TODO”, “Add logic here”, or “etc.”
4. **No detached descriptions.** If you describe logic, it must appear in the code.
5. **If you import or call it, you must show it.** Inline or linked via local reference.
6. **You must perform a final validation checklist.**

---

## 🔍 Post-Output Verification Format

At the end of your output, provide a verification section like the following:



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


## Styling 

## 🛍️ Roadrunner UI Style Guide

### 🎨 THEME

- `--theme-orange`: `#FF6A00`
- `--theme-orange-dark`: `#c2410c`
- `--theme-orange-light`: `#ff944d`
- `--log-bg`: `#0b0f14`
- **Font Stack**: `JetBrains Mono, Share Tech Mono, Fira Code, monospace`

---

### 🩶 BIRD TAXONOMY NAMING SYSTEM

Component classes follow the format:

Examples:
- `.accipiter-header` – main header  
- `.geococcyx-executor-page` – RoadrunnerExecutor wrapper  
- `.cardinalis-button-primary` – primary CTA button  
- `.columbidae-task-list` – task display  
- `.sylvia-task-description` – markdown output  
- `.strigiformes-log-display` – logs panel  

---

### 📊 LAYOUT CONVENTIONS

- Use `flex` and `grid` for layout
- Cards:
  - `.tyrannidae-main-card`, `.bubo-executor-card` – round corners, bordered in orange
- Panels:
  - `.furnariidae-inner-panel` – background: `#111827`, border: orange, padding: `1.5rem`, `flex-direction: column`

---

### 🔠 TYPOGRAPHY

- **Font**: `'JetBrains Mono'` (with fallbacks)
- **Weights**: 400 / 500 / 700
- **Sizes**:
  - Base: `0.875rem` (14px)
  - `.accipiter-header`: `1.25rem`
  - `.aquila-executor-title`: `1.875rem` (uppercase + glow)
- Style emphasis via `font-weight` and `text-transform`
