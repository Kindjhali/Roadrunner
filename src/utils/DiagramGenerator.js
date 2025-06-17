/**
 * DiagramGenerator.js - Mermaid diagram generation utilities
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
 * Generate Mermaid flowchart diagram from plan
 * Input → Process → Output pattern
 * 
 * @param {Object} plan - Plan object with steps and connections
 * @returns {string} Mermaid diagram syntax
 */
export function generateMermaidDiagram(plan) {
  try {
    // Input: Validate plan structure
    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      throw new Error('Invalid plan structure')
    }
    
    // Process: Build diagram components
    const nodes = generateNodes(plan.steps)
    const connections = generateConnections(plan.steps, plan.connections || [])
    const styling = generateStyling(plan.steps)
    
    // Output: Combine into Mermaid syntax
    return `
graph TD
${nodes}
${connections}
${styling}
    `.trim()
    
  } catch (error) {
    console.error('Failed to generate Mermaid diagram:', error)
    return generateErrorDiagram(error.message)
  }
}

/**
 * Generate flowchart nodes from plan steps
 * Question → Explore → Apply pattern
 * 
 * @param {Array} steps - Plan steps
 * @returns {string} Mermaid node definitions
 */
function generateNodes(steps) {
  // Question: What types of nodes do we need?
  const nodeDefinitions = []
  
  steps.forEach(step => {
    // Explore: Determine node shape based on step type
    const nodeShape = getNodeShape(step.type || step.category)
    const nodeId = sanitizeId(step.id)
    const nodeLabel = sanitizeLabel(step.name || step.title || 'Unnamed Step')
    
    // Apply: Create node definition
    nodeDefinitions.push(`    ${nodeId}${nodeShape.start}"${nodeLabel}"${nodeShape.end}`)
  })
  
  return nodeDefinitions.join('\n')
}

/**
 * Generate connections between nodes
 * Prompt → Validate → Result pattern
 * 
 * @param {Array} steps - Plan steps
 * @param {Array} connections - Explicit connections
 * @returns {string} Mermaid connection definitions
 */
function generateConnections(steps, connections) {
  const connectionDefinitions = []
  
  // Prompt: Check for explicit connections first
  if (connections && connections.length > 0) {
    connections.forEach(conn => {
      const fromId = sanitizeId(conn.from)
      const toId = sanitizeId(conn.to)
      const label = conn.label ? `|"${sanitizeLabel(conn.label)}"|` : ''
      
      connectionDefinitions.push(`    ${fromId} -->${label} ${toId}`)
    })
  } else {
    // Validate: Generate sequential connections if no explicit ones
    for (let i = 0; i < steps.length - 1; i++) {
      const currentId = sanitizeId(steps[i].id)
      const nextId = sanitizeId(steps[i + 1].id)
      
      connectionDefinitions.push(`    ${currentId} --> ${nextId}`)
    }
  }
  
  // Result: Add dependency connections
  steps.forEach(step => {
    if (step.dependencies && Array.isArray(step.dependencies)) {
      step.dependencies.forEach(depId => {
        const fromId = sanitizeId(depId)
        const toId = sanitizeId(step.id)
        
        connectionDefinitions.push(`    ${fromId} -.-> ${toId}`)
      })
    }
  })
  
  return connectionDefinitions.join('\n')
}

/**
 * Generate styling for nodes based on categories
 * 
 * @param {Array} steps - Plan steps
 * @returns {string} Mermaid styling definitions
 */
function generateStyling(steps) {
  const stylingDefinitions = []
  const categoryColors = {
    generation: '#FF6A00',
    filesystem: '#10b981',
    validation: '#f59e0b',
    testing: '#3b82f6',
    documentation: '#8b5cf6',
    setup: '#ef4444',
    database: '#06b6d4',
    deployment: '#84cc16'
  }
  
  // Group steps by category for styling
  const categorizedSteps = {}
  steps.forEach(step => {
    const category = step.category || 'default'
    if (!categorizedSteps[category]) {
      categorizedSteps[category] = []
    }
    categorizedSteps[category].push(sanitizeId(step.id))
  })
  
  // Generate class definitions and assignments
  Object.entries(categorizedSteps).forEach(([category, stepIds]) => {
    const color = categoryColors[category] || '#6b7280'
    const className = `${category}Class`
    
    // Define class style
    stylingDefinitions.push(`    classDef ${className} fill:${color},stroke:#fff,stroke-width:2px,color:#fff`)
    
    // Assign class to nodes
    stepIds.forEach(stepId => {
      stylingDefinitions.push(`    class ${stepId} ${className}`)
    })
  })
  
  return stylingDefinitions.join('\n')
}

/**
 * Get node shape based on step type
 * 
 * @param {string} type - Step type or category
 * @returns {Object} Node shape definition
 */
function getNodeShape(type) {
  const shapes = {
    generation: { start: '[', end: ']' },      // Rectangle
    filesystem: { start: '(', end: ')' },      // Rounded rectangle
    validation: { start: '{', end: '}' },      // Rhombus
    testing: { start: '[[', end: ']]' },       // Subroutine
    documentation: { start: '>', end: ']' },   // Asymmetric
    setup: { start: '([', end: '])' },         // Stadium
    database: { start: '[(', end: ')]' },      // Cylindrical
    deployment: { start: '{{', end: '}}' },    // Hexagon
    default: { start: '[', end: ']' }          // Default rectangle
  }
  
  return shapes[type] || shapes.default
}

/**
 * Sanitize ID for Mermaid compatibility
 * 
 * @param {string} id - Original ID
 * @returns {string} Sanitized ID
 */
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

/**
 * Sanitize label for Mermaid compatibility
 * 
 * @param {string} label - Original label
 * @returns {string} Sanitized label
 */
function sanitizeLabel(label) {
  return label.replace(/"/g, '\\"').substring(0, 50)
}

/**
 * Generate error diagram when main generation fails
 * 
 * @param {string} errorMessage - Error message
 * @returns {string} Error diagram
 */
function generateErrorDiagram(errorMessage) {
  return `
graph TD
    ERROR["⚠️ Diagram Generation Failed"]
    MESSAGE["${sanitizeLabel(errorMessage)}"]
    ERROR --> MESSAGE
    classDef errorClass fill:#ef4444,stroke:#fff,stroke-width:2px,color:#fff
    class ERROR,MESSAGE errorClass
  `.trim()
}

/**
 * Generate Gantt chart from plan
 * 
 * @param {Object} plan - Plan object
 * @returns {string} Mermaid Gantt chart
 */
export function generateGanttChart(plan) {
  try {
    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      throw new Error('Invalid plan structure')
    }
    
    const ganttDefinitions = ['gantt', '    title Plan Timeline', '    dateFormat YYYY-MM-DD']
    
    // Calculate dates based on estimated durations
    let currentDate = new Date()
    const formatDate = (date) => date.toISOString().split('T')[0]
    
    plan.steps.forEach((step, index) => {
      const startDate = new Date(currentDate)
      const duration = step.estimatedDuration || 3600 // Default 1 hour
      const endDate = new Date(currentDate.getTime() + duration * 1000)
      
      const taskName = sanitizeLabel(step.name || `Step ${index + 1}`)
      const taskId = sanitizeId(step.id)
      
      ganttDefinitions.push(
        `    ${taskName} :${taskId}, ${formatDate(startDate)}, ${formatDate(endDate)}`
      )
      
      currentDate = endDate
    })
    
    return ganttDefinitions.join('\n')
    
  } catch (error) {
    console.error('Failed to generate Gantt chart:', error)
    return `gantt\n    title Error\n    Error generating chart : 2024-01-01, 2024-01-02`
  }
}

/**
 * Generate sequence diagram for plan execution flow
 * 
 * @param {Object} plan - Plan object
 * @returns {string} Mermaid sequence diagram
 */
export function generateSequenceDiagram(plan) {
  try {
    if (!plan || !plan.steps || !Array.isArray(plan.steps)) {
      throw new Error('Invalid plan structure')
    }
    
    const sequenceDefinitions = ['sequenceDiagram', '    participant User', '    participant System']
    
    plan.steps.forEach((step, index) => {
      const stepName = sanitizeLabel(step.name || `Step ${index + 1}`)
      
      sequenceDefinitions.push(`    User->>System: Execute ${stepName}`)
      sequenceDefinitions.push(`    System-->>User: ${stepName} Complete`)
      
      if (index < plan.steps.length - 1) {
        sequenceDefinitions.push(`    Note over System: Processing...`)
      }
    })
    
    return sequenceDefinitions.join('\n')
    
  } catch (error) {
    console.error('Failed to generate sequence diagram:', error)
    return 'sequenceDiagram\n    participant Error\n    Error->>Error: Generation Failed'
  }
}

/**
 * Generate mind map from brainstorming data
 * 
 * @param {Object} data - Brainstorming data with ideas and clusters
 * @returns {string} Mermaid mind map
 */
export function generateMindMap(data) {
  try {
    const { topic, ideas = [], clusters = [] } = data
    
    const mindMapDefinitions = ['mindmap', `  root((${sanitizeLabel(topic || 'Ideas')}))`]
    
    if (clusters.length > 0) {
      // Organized by clusters
      clusters.forEach(cluster => {
        mindMapDefinitions.push(`    ${sanitizeLabel(cluster.name)}`)
        
        cluster.ideas.forEach(idea => {
          mindMapDefinitions.push(`      ${sanitizeLabel(idea.content || idea.text || idea)}`)
        })
      })
    } else {
      // Flat list of ideas
      ideas.forEach(idea => {
        const ideaText = idea.content || idea.text || idea
        mindMapDefinitions.push(`    ${sanitizeLabel(ideaText)}`)
      })
    }
    
    return mindMapDefinitions.join('\n')
    
  } catch (error) {
    console.error('Failed to generate mind map:', error)
    return 'mindmap\n  root((Error))\n    Generation Failed'
  }
}

/**
 * Export diagram as different formats
 * 
 * @param {string} diagramCode - Mermaid diagram code
 * @param {string} format - Export format (svg, png, pdf)
 * @returns {Promise<Blob>} Exported diagram
 */
export async function exportDiagram(diagramCode, format = 'svg') {
  try {
    // This would integrate with Mermaid's export functionality
    // For now, return the code as text
    const blob = new Blob([diagramCode], { type: 'text/plain' })
    return blob
    
  } catch (error) {
    console.error('Failed to export diagram:', error)
    throw error
  }
}

/**
 * Validate Mermaid diagram syntax
 * 
 * @param {string} diagramCode - Mermaid diagram code
 * @returns {Object} Validation result
 */
export function validateDiagram(diagramCode) {
  try {
    // Basic syntax validation
    const lines = diagramCode.split('\n').filter(line => line.trim())
    const issues = []
    
    if (lines.length === 0) {
      issues.push('Diagram is empty')
    }
    
    const firstLine = lines[0].trim()
    const validTypes = ['graph', 'flowchart', 'sequenceDiagram', 'gantt', 'mindmap']
    
    if (!validTypes.some(type => firstLine.startsWith(type))) {
      issues.push('Invalid diagram type')
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      lineCount: lines.length
    }
    
  } catch (error) {
    return {
      isValid: false,
      issues: [error.message],
      lineCount: 0
    }
  }
}

export default {
  generateMermaidDiagram,
  generateGanttChart,
  generateSequenceDiagram,
  generateMindMap,
  exportDiagram,
  validateDiagram
}
