# ReACT Step Templates

`stepTemplatesPlus.js` extends the existing `stepTemplates.js` definitions with ReACT-style prompt blocks. Each template now provides a `reactTemplate` containing the canonical sections:

- **Thought** – reasoning text
- **Action** – tool or agent name
- **ActionInput** – parameters for the action
- **Observation** – runtime result placeholder
- **FinalAnswer** – optional final output

The module merges the base `STEP_TEMPLATES` with an additional `REACT_TEMPLATES` map so existing functionality remains untouched. Consumers can import `STEP_TEMPLATES_PLUS` to access templates with these blocks ready for the canvas planner.

```js
import { STEP_TEMPLATES_PLUS } from '../data/stepTemplatesPlus.js'
```
