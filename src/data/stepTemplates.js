/**
 * stepTemplates.js - Step template definitions for plan builder
 * 
 * Following AGENTS.md principles:
 * - Modular, testable components only
 * - Rule of 3: Input → Process → Output
 * - All logic commented and attributed
 * 
 * @version 1.0.0
 * @author Roadrunner Autocoder System
 */

/**
 * Step Templates - Predefined step types for plan creation
 * 
 * Each template defines:
 * - name: Display name
 * - icon: Icon identifier using bird taxonomy
 * - category: Grouping category
 * - inputs: Required input parameters
 * - outputs: Expected output parameters
 * - description: Template description
 * - estimatedDuration: Estimated execution time in seconds
 */
export const STEP_TEMPLATES = {
  // Code Generation Templates (corvidae family)
  CODE_GENERATION: {
    name: 'Generate Code',
    icon: 'corvidae-code',
    category: 'generation',
    inputs: ['prompt', 'language', 'framework'],
    outputs: ['code', 'tests', 'documentation'],
    description: 'Generate code based on natural language description',
    estimatedDuration: 120,
    parameters: {
      prompt: {
        type: 'textarea',
        label: 'Code Description',
        placeholder: 'Describe what code you want to generate...',
        required: true
      },
      language: {
        type: 'select',
        label: 'Programming Language',
        options: ['javascript', 'typescript', 'python', 'vue', 'react', 'html', 'css'],
        default: 'javascript',
        required: true
      },
      framework: {
        type: 'text',
        label: 'Framework (Optional)',
        placeholder: 'e.g., Vue 3, React, Express',
        required: false
      }
    }
  },

  COMPONENT_CREATION: {
    name: 'Create Component',
    icon: 'furnariidae-component',
    category: 'generation',
    inputs: ['componentName', 'componentType', 'props', 'features'],
    outputs: ['component', 'styles', 'tests'],
    description: 'Create a reusable UI component',
    estimatedDuration: 180,
    parameters: {
      componentName: {
        type: 'text',
        label: 'Component Name',
        placeholder: 'e.g., UserCard, NavigationMenu',
        required: true
      },
      componentType: {
        type: 'select',
        label: 'Component Type',
        options: ['vue', 'react', 'angular', 'svelte'],
        default: 'vue',
        required: true
      },
      props: {
        type: 'textarea',
        label: 'Component Props',
        placeholder: 'List the props this component should accept...',
        required: false
      },
      features: {
        type: 'textarea',
        label: 'Features & Functionality',
        placeholder: 'Describe what this component should do...',
        required: true
      }
    }
  },

  API_ENDPOINT: {
    name: 'Create API Endpoint',
    icon: 'piciformes-api',
    category: 'generation',
    inputs: ['endpoint', 'method', 'parameters', 'response'],
    outputs: ['route', 'controller', 'validation'],
    description: 'Generate REST API endpoint with validation',
    estimatedDuration: 150,
    parameters: {
      endpoint: {
        type: 'text',
        label: 'Endpoint Path',
        placeholder: '/api/users/:id',
        required: true
      },
      method: {
        type: 'select',
        label: 'HTTP Method',
        options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        default: 'GET',
        required: true
      },
      parameters: {
        type: 'textarea',
        label: 'Parameters',
        placeholder: 'Describe request parameters and body...',
        required: false
      },
      response: {
        type: 'textarea',
        label: 'Response Format',
        placeholder: 'Describe expected response structure...',
        required: true
      }
    }
  },

  // File Operations (accipiter family)
  FILE_OPERATION: {
    name: 'File Operation',
    icon: 'accipiter-file',
    category: 'filesystem',
    inputs: ['operation', 'path', 'content'],
    outputs: ['result', 'status'],
    description: 'Perform file system operations',
    estimatedDuration: 30,
    parameters: {
      operation: {
        type: 'select',
        label: 'Operation Type',
        options: ['create', 'read', 'update', 'delete', 'copy', 'move'],
        default: 'create',
        required: true
      },
      path: {
        type: 'text',
        label: 'File Path',
        placeholder: 'src/components/MyComponent.vue',
        required: true
      },
      content: {
        type: 'textarea',
        label: 'File Content',
        placeholder: 'Content to write to file...',
        required: false
      }
    }
  },

  FOLDER_STRUCTURE: {
    name: 'Create Folder Structure',
    icon: 'accipiter-folder',
    category: 'filesystem',
    inputs: ['structure', 'basePath'],
    outputs: ['folders', 'files'],
    description: 'Create organized folder structure',
    estimatedDuration: 60,
    parameters: {
      structure: {
        type: 'textarea',
        label: 'Folder Structure',
        placeholder: 'src/\n  components/\n  services/\n  utils/',
        required: true
      },
      basePath: {
        type: 'text',
        label: 'Base Path',
        placeholder: './',
        default: './',
        required: true
      }
    }
  },

  // Validation and Testing (turdus family)
  CODE_VALIDATION: {
    name: 'Validate Code',
    icon: 'corvidae-validate',
    category: 'validation',
    inputs: ['code', 'language', 'rules'],
    outputs: ['isValid', 'errors', 'suggestions'],
    description: 'Validate code quality and syntax',
    estimatedDuration: 45,
    parameters: {
      code: {
        type: 'textarea',
        label: 'Code to Validate',
        placeholder: 'Paste code here...',
        required: true
      },
      language: {
        type: 'select',
        label: 'Language',
        options: ['javascript', 'typescript', 'python', 'vue', 'html', 'css'],
        required: true
      },
      rules: {
        type: 'textarea',
        label: 'Validation Rules',
        placeholder: 'Specific rules or standards to check...',
        required: false
      }
    }
  },

  UNIT_TESTS: {
    name: 'Generate Unit Tests',
    icon: 'accipiter-test',
    category: 'testing',
    inputs: ['code', 'framework', 'coverage'],
    outputs: ['tests', 'mocks', 'fixtures'],
    description: 'Generate comprehensive unit tests',
    estimatedDuration: 200,
    parameters: {
      code: {
        type: 'textarea',
        label: 'Code to Test',
        placeholder: 'Function or component code...',
        required: true
      },
      framework: {
        type: 'select',
        label: 'Testing Framework',
        options: ['jest', 'vitest', 'mocha', 'cypress', 'playwright'],
        default: 'jest',
        required: true
      },
      coverage: {
        type: 'select',
        label: 'Coverage Level',
        options: ['basic', 'comprehensive', 'edge-cases'],
        default: 'comprehensive',
        required: true
      }
    }
  },

  // Documentation (passeriformes family)
  DOCUMENTATION: {
    name: 'Generate Documentation',
    icon: 'passeriformes-edit',
    category: 'documentation',
    inputs: ['code', 'format', 'audience'],
    outputs: ['docs', 'examples', 'api'],
    description: 'Generate comprehensive documentation',
    estimatedDuration: 120,
    parameters: {
      code: {
        type: 'textarea',
        label: 'Code to Document',
        placeholder: 'Code that needs documentation...',
        required: true
      },
      format: {
        type: 'select',
        label: 'Documentation Format',
        options: ['markdown', 'jsdoc', 'typedoc', 'sphinx'],
        default: 'markdown',
        required: true
      },
      audience: {
        type: 'select',
        label: 'Target Audience',
        options: ['developers', 'users', 'maintainers', 'all'],
        default: 'developers',
        required: true
      }
    }
  },

  README_GENERATION: {
    name: 'Create README',
    icon: 'passeriformes-new',
    category: 'documentation',
    inputs: ['projectName', 'description', 'features'],
    outputs: ['readme', 'badges', 'examples'],
    description: 'Generate comprehensive README file',
    estimatedDuration: 90,
    parameters: {
      projectName: {
        type: 'text',
        label: 'Project Name',
        placeholder: 'My Awesome Project',
        required: true
      },
      description: {
        type: 'textarea',
        label: 'Project Description',
        placeholder: 'What does this project do?',
        required: true
      },
      features: {
        type: 'textarea',
        label: 'Key Features',
        placeholder: 'List the main features...',
        required: true
      }
    }
  },

  // Configuration and Setup (piciformes family)
  PROJECT_SETUP: {
    name: 'Setup Project',
    icon: 'furnariidae-scaffold',
    category: 'setup',
    inputs: ['projectType', 'features', 'dependencies'],
    outputs: ['structure', 'config', 'scripts'],
    description: 'Initialize new project with configuration',
    estimatedDuration: 300,
    parameters: {
      projectType: {
        type: 'select',
        label: 'Project Type',
        options: ['vue', 'react', 'node', 'python', 'static'],
        required: true
      },
      features: {
        type: 'checkbox',
        label: 'Features',
        options: ['typescript', 'testing', 'linting', 'formatting', 'ci/cd'],
        required: false
      },
      dependencies: {
        type: 'textarea',
        label: 'Additional Dependencies',
        placeholder: 'List any specific packages needed...',
        required: false
      }
    }
  },

  ENVIRONMENT_CONFIG: {
    name: 'Configure Environment',
    icon: 'piciformes-config',
    category: 'setup',
    inputs: ['environment', 'variables', 'secrets'],
    outputs: ['config', 'env', 'docker'],
    description: 'Setup environment configuration',
    estimatedDuration: 120,
    parameters: {
      environment: {
        type: 'select',
        label: 'Environment Type',
        options: ['development', 'staging', 'production', 'testing'],
        required: true
      },
      variables: {
        type: 'textarea',
        label: 'Environment Variables',
        placeholder: 'API_URL=https://api.example.com\nDEBUG=true',
        required: false
      },
      secrets: {
        type: 'textarea',
        label: 'Secret Variables',
        placeholder: 'List variables that need secure handling...',
        required: false
      }
    }
  },

  // Database Operations (piciformes family)
  DATABASE_SCHEMA: {
    name: 'Create Database Schema',
    icon: 'piciformes-database',
    category: 'database',
    inputs: ['tables', 'relationships', 'constraints'],
    outputs: ['schema', 'migrations', 'models'],
    description: 'Design and create database schema',
    estimatedDuration: 240,
    parameters: {
      tables: {
        type: 'textarea',
        label: 'Table Definitions',
        placeholder: 'Describe the tables and their fields...',
        required: true
      },
      relationships: {
        type: 'textarea',
        label: 'Table Relationships',
        placeholder: 'Describe foreign keys and relationships...',
        required: false
      },
      constraints: {
        type: 'textarea',
        label: 'Constraints & Indexes',
        placeholder: 'Unique constraints, indexes, etc...',
        required: false
      }
    }
  },

  // Deployment (accipiter family)
  DEPLOYMENT_CONFIG: {
    name: 'Setup Deployment',
    icon: 'accipiter-deploy',
    category: 'deployment',
    inputs: ['platform', 'environment', 'domain'],
    outputs: ['config', 'scripts', 'ci'],
    description: 'Configure deployment pipeline',
    estimatedDuration: 180,
    parameters: {
      platform: {
        type: 'select',
        label: 'Deployment Platform',
        options: ['vercel', 'netlify', 'aws', 'docker', 'heroku'],
        required: true
      },
      environment: {
        type: 'select',
        label: 'Environment',
        options: ['staging', 'production', 'both'],
        default: 'production',
        required: true
      },
      domain: {
        type: 'text',
        label: 'Custom Domain',
        placeholder: 'example.com',
        required: false
      }
    }
  }
}

/**
 * Get step templates by category
 * 
 * @returns {Object} Templates grouped by category
 */
export function getStepTemplatesByCategory() {
  const categories = {}
  
  Object.entries(STEP_TEMPLATES).forEach(([key, template]) => {
    const category = template.category
    if (!categories[category]) {
      categories[category] = []
    }
    categories[category].push({ key, ...template })
  })
  
  return categories
}

/**
 * Get template by key
 * 
 * @param {string} key - Template key
 * @returns {Object|null} Template object
 */
export function getStepTemplate(key) {
  return STEP_TEMPLATES[key] || null
}

/**
 * Search templates by name or description
 * 
 * @param {string} query - Search query
 * @returns {Array} Matching templates
 */
export function searchStepTemplates(query) {
  const lowerQuery = query.toLowerCase()
  
  return Object.entries(STEP_TEMPLATES)
    .filter(([key, template]) => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      key.toLowerCase().includes(lowerQuery)
    )
    .map(([key, template]) => ({ key, ...template }))
}

/**
 * Get recommended templates for a use case
 * 
 * @param {string} useCase - Use case identifier
 * @returns {Array} Recommended templates
 */
export function getRecommendedTemplates(useCase) {
  const recommendations = {
    'web-app': ['CODE_GENERATION', 'COMPONENT_CREATION', 'PROJECT_SETUP', 'UNIT_TESTS'],
    'api': ['API_ENDPOINT', 'DATABASE_SCHEMA', 'UNIT_TESTS', 'DOCUMENTATION'],
    'component': ['COMPONENT_CREATION', 'UNIT_TESTS', 'DOCUMENTATION'],
    'setup': ['PROJECT_SETUP', 'ENVIRONMENT_CONFIG', 'FOLDER_STRUCTURE'],
    'documentation': ['DOCUMENTATION', 'README_GENERATION']
  }
  
  const templateKeys = recommendations[useCase] || []
  return templateKeys.map(key => ({ key, ...STEP_TEMPLATES[key] }))
}

export default STEP_TEMPLATES
