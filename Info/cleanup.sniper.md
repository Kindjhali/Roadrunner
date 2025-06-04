# Roadrunner Inline CSS Cleanup

## Goal
Remove all inline CSS from core Vue components and replace them with Tailwind classes or styles defined in `src/styles/roadrunner.css`.

## Steps
- Scan `frontend/src` for `style="` attributes.
- Move required styling into `roadrunner.css` and apply Tailwind utility classes.
- Ensure no `<style>` blocks remain in Vue components.
- Update documentation (`roadrunner.steps.md`).
