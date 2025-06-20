import { STEP_TEMPLATES } from './stepTemplates.js'

/**
 * ReACT template definitions for step templates.
 * Each key mirrors STEP_TEMPLATES and provides default
 * blocks for Thought, Action, ActionInput, Observation, and FinalAnswer.
 */
export const REACT_TEMPLATES = {
  CODE_GENERATION: {
    thought: 'I need to convert the user\u2019s request into working code.',
    action: 'GenerateCode',
    actionInput: 'Build a function to filter items in a list based on user input.',
    observation: '',
    finalAnswer: ''
  },
  COMPONENT_CREATION: {
    thought: 'A reusable UI element is needed for the interface.',
    action: 'CreateComponent',
    actionInput: 'Component: Button\nProps: label, onClick',
    observation: '',
    finalAnswer: ''
  },
  API_ENDPOINT: {
    thought: 'We need a REST endpoint to expose this data to the frontend.',
    action: 'GenerateAPIEndpoint',
    actionInput: 'POST /submit with body validation',
    observation: '',
    finalAnswer: ''
  },
  FILE_OPERATION: {
    thought: 'We need to manipulate files for correct runtime behavior.',
    action: 'PerformFileOperation',
    actionInput: 'Move all .log files to archive/',
    observation: '',
    finalAnswer: ''
  },
  FOLDER_STRUCTURE: {
    thought: 'This project needs a standard folder layout.',
    action: 'CreateFolderStructure',
    actionInput: 'src/, dist/, tests/, assets/',
    observation: '',
    finalAnswer: ''
  },
  CODE_VALIDATION: {
    thought: 'We should ensure the generated code is error-free.',
    action: 'ValidateCode',
    actionInput: 'Run linting and syntax validation',
    observation: '',
    finalAnswer: ''
  },
  UNIT_TESTS: {
    thought: 'Unit tests will confirm this code behaves as expected.',
    action: 'GenerateTests',
    actionInput: 'Target: utils/dateHelpers.js',
    observation: '',
    finalAnswer: ''
  },
  DOCUMENTATION: {
    thought: 'We need documentation for this module to support developers.',
    action: 'GenerateDocumentation',
    actionInput: 'Module: UserService',
    observation: '',
    finalAnswer: ''
  },
  README_GENERATION: {
    thought: 'Every project should include a clear README file.',
    action: 'GenerateREADME',
    actionInput: 'Project: Roadrunner Autocoder',
    observation: '',
    finalAnswer: ''
  },
  PROJECT_SETUP: {
    thought: 'This app requires initialization with configuration files.',
    action: 'SetupProject',
    actionInput: 'Project: Prompt Planner UI\nTemplate: Vite + Vue',
    observation: '',
    finalAnswer: ''
  },
  ENVIRONMENT_CONFIG: {
    thought: 'Environment variables must be defined for dev/prod.',
    action: 'ConfigureEnvironment',
    actionInput: '.env with API_KEY and DB_URL',
    observation: '',
    finalAnswer: ''
  },
  DATABASE_SCHEMA: {
    thought: 'A database schema defines our data relationships.',
    action: 'CreateDatabaseSchema',
    actionInput: 'Tables: users, sessions, logs',
    observation: '',
    finalAnswer: ''
  },
  DEPLOYMENT_CONFIG: {
    thought: 'This system must be deployable with minimal manual steps.',
    action: 'SetupDeployment',
    actionInput: 'Pipeline: GitHub Actions \u2192 Vercel',
    observation: '',
    finalAnswer: ''
  }
}

/**
 * STEP_TEMPLATES_PLUS - STEP_TEMPLATES extended with ReACT templates.
 * This keeps existing data intact while providing additional prompt blocks
 * for the canvas planner.
 */
export const STEP_TEMPLATES_PLUS = Object.fromEntries(
  Object.entries(STEP_TEMPLATES).map(([key, template]) => {
    return [key, { ...template, reactTemplate: REACT_TEMPLATES[key] || {
      thought: '', action: '', actionInput: '', observation: '', finalAnswer: ''
    } }]
  })
)

export default STEP_TEMPLATES_PLUS
