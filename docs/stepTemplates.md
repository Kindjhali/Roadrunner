# Step Templates

Roadrunner uses predefined step templates to standardize common development tasks.
Each template describes required inputs, expected outputs, and an icon category.

## ReACT Blocks

Templates now include an optional `reactTemplate` object. This structure
matches the **ReACT** prompt pattern (Reasoning → Action → ActionInput → Observation → FinalAnswer).
It allows the planner to generate agentic prompts directly from template data.

### Example
```js
{
  name: 'Generate Code',
  icon: 'corvidae-code',
  category: 'generation',
  reactTemplate: {
    thought: 'I need to convert the user\'s request into working code.',
    action: 'GenerateCode',
    actionInput: 'Build a function to filter items in a list based on user input.',
    observation: '',
    finalAnswer: ''
  }
}
```

The ReACT fields are merged into `apps/renderer/data/stepTemplates.js` and are
consumed by the canvas planner and execution engine.
