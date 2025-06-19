/**
 * IconUtils.js - Icon registry and management system
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
 * Icon Registry - Dynamic icon loading system
 * 
 * Uses bird taxonomy naming convention for unique identification:
 * - corvidae: Planning and intelligence (crows, ravens)
 * - accipiter: Execution and action (hawks, eagles)
 * - turdus: Communication and brainstorming (thrushes)
 * - tyrannidae: Interface and controls (flycatchers)
 * - passeriformes: General purpose (songbirds)
 * - piciformes: Tools and utilities (woodpeckers)
 * - furnariidae: Building and construction (ovenbirds)
 */
export const IconRegistry = {
  // Planning Icons (corvidae family)
  'corvidae-plan': () => import('../assets/icons/plan.svg'),
  'corvidae-strategy': () => import('../assets/icons/strategy.svg'),
  'corvidae-blueprint': () => import('../assets/icons/blueprint.svg'),
  'corvidae-roadmap': () => import('../assets/icons/roadmap.svg'),
  'corvidae-timeline': () => import('../assets/icons/timeline.svg'),
  'corvidae-validate': () => import('../assets/icons/validate.svg'),
  'corvidae-optimize': () => import('../assets/icons/optimize.svg'),
  'corvidae-analyze': () => import('../assets/icons/analyze.svg'),
  'corvidae-code': () => import('../assets/icons/code.svg'),
  'corvidae-template': () => import('../assets/icons/template.svg'),

  // Execution Icons (accipiter family)
  'accipiter-execute': () => import('../assets/icons/execute.svg'),
  'accipiter-run': () => import('../assets/icons/run.svg'),
  'accipiter-deploy': () => import('../assets/icons/deploy.svg'),
  'accipiter-build': () => import('../assets/icons/build.svg'),
  'accipiter-compile': () => import('../assets/icons/compile.svg'),
  'accipiter-test': () => import('../assets/icons/test.svg'),
  'accipiter-debug': () => import('../assets/icons/debug.svg'),
  'accipiter-monitor': () => import('../assets/icons/monitor.svg'),
  'accipiter-file': () => import('../assets/icons/file.svg'),
  'accipiter-folder': () => import('../assets/icons/folder.svg'),

  // Brainstorming Icons (turdus family)
  'turdus-brainstorm': () => import('../assets/icons/brainstorm.svg'),
  'turdus-idea': () => import('../assets/icons/idea.svg'),
  'turdus-creative': () => import('../assets/icons/creative.svg'),
  'turdus-collaborate': () => import('../assets/icons/collaborate.svg'),
  'turdus-discuss': () => import('../assets/icons/discuss.svg'),
  'turdus-mindmap': () => import('../assets/icons/mindmap.svg'),
  'turdus-cluster': () => import('../assets/icons/cluster.svg'),
  'turdus-synthesis': () => import('../assets/icons/synthesis.svg'),
  'turdus-export': () => import('../assets/icons/export.svg'),
  'turdus-conference': () => import('../assets/icons/conference.svg'),

  // Interface Controls (tyrannidae family)
  'tyrannidae-menu': () => import('../assets/icons/menu.svg'),
  'tyrannidae-close': () => import('../assets/icons/close.svg'),
  'tyrannidae-expand': () => import('../assets/icons/expand.svg'),
  'tyrannidae-collapse': () => import('../assets/icons/collapse.svg'),
  'tyrannidae-fullscreen': () => import('../assets/icons/fullscreen.svg'),
  'tyrannidae-minimize': () => import('../assets/icons/minimize.svg'),
  'tyrannidae-maximize': () => import('../assets/icons/maximize.svg'),
  'tyrannidae-drag': () => import('../assets/icons/drag.svg'),
  'tyrannidae-resize': () => import('../assets/icons/resize.svg'),
  'tyrannidae-grid': () => import('../assets/icons/grid.svg'),

  // General Purpose (passeriformes family)
  'passeriformes-save': () => import('../assets/icons/save.svg'),
  'passeriformes-load': () => import('../assets/icons/load.svg'),
  'passeriformes-new': () => import('../assets/icons/new.svg'),
  'passeriformes-edit': () => import('../assets/icons/edit.svg'),
  'passeriformes-delete': () => import('../assets/icons/delete.svg'),
  'passeriformes-copy': () => import('../assets/icons/copy.svg'),
  'passeriformes-paste': () => import('../assets/icons/paste.svg'),
  'passeriformes-undo': () => import('../assets/icons/undo.svg'),
  'passeriformes-redo': () => import('../assets/icons/redo.svg'),
  'passeriformes-search': () => import('../assets/icons/search.svg'),

  // Tools and Utilities (piciformes family)
  'piciformes-settings': () => import('../assets/icons/settings.svg'),
  'piciformes-config': () => import('../assets/icons/config.svg'),
  'piciformes-tools': () => import('../assets/icons/tools.svg'),
  'piciformes-plugin': () => import('../assets/icons/plugin.svg'),
  'piciformes-extension': () => import('../assets/icons/extension.svg'),
  'piciformes-api': () => import('../assets/icons/api.svg'),
  'piciformes-database': () => import('../assets/icons/database.svg'),
  'piciformes-server': () => import('../assets/icons/server.svg'),
  'piciformes-cloud': () => import('../assets/icons/cloud.svg'),
  'piciformes-terminal': () => import('../assets/icons/terminal.svg'),

  // Building and Construction (furnariidae family)
  'furnariidae-component': () => import('../assets/icons/component.svg'),
  'furnariidae-module': () => import('../assets/icons/module.svg'),
  'furnariidae-package': () => import('../assets/icons/package.svg'),
  'furnariidae-library': () => import('../assets/icons/library.svg'),
  'furnariidae-framework': () => import('../assets/icons/framework.svg'),
  'furnariidae-architecture': () => import('../assets/icons/architecture.svg'),
  'furnariidae-structure': () => import('../assets/icons/structure.svg'),
  'furnariidae-scaffold': () => import('../assets/icons/scaffold.svg'),
  'furnariidae-foundation': () => import('../assets/icons/foundation.svg'),
  'furnariidae-blueprint': () => import('../assets/icons/blueprint.svg'),

  // Navigation and Flow
  'arrow-up': () => import('../assets/icons/arrow-up.svg'),
  'arrow-down': () => import('../assets/icons/arrow-down.svg'),
  'arrow-left': () => import('../assets/icons/arrow-left.svg'),
  'arrow-right': () => import('../assets/icons/arrow-right.svg'),
  'chevron-up': () => import('../assets/icons/chevron-up.svg'),
  'chevron-down': () => import('../assets/icons/chevron-down.svg'),
  'chevron-left': () => import('../assets/icons/chevron-left.svg'),
  'chevron-right': () => import('../assets/icons/chevron-right.svg'),

  // Status and Feedback
  'check': () => import('../assets/icons/check.svg'),
  'cross': () => import('../assets/icons/cross.svg'),
  'warning': () => import('../assets/icons/warning.svg'),
  'error': () => import('../assets/icons/error.svg'),
  'info': () => import('../assets/icons/info.svg'),
  'success': () => import('../assets/icons/success.svg'),
  'loading': () => import('../assets/icons/loading.svg'),
  'progress': () => import('../assets/icons/progress.svg'),

  // Common Actions
  'plus': () => import('../assets/icons/plus.svg'),
  'minus': () => import('../assets/icons/minus.svg'),
  'refresh': () => import('../assets/icons/refresh.svg'),
  'sync': () => import('../assets/icons/sync.svg'),
  'upload': () => import('../assets/icons/upload.svg'),
  'download': () => import('../assets/icons/download.svg'),
  'share': () => import('../assets/icons/share.svg'),
  'link': () => import('../assets/icons/link.svg')
}

/**
 * Icon cache for loaded SVG content
 */
const iconCache = new Map()

/**
 * Load an icon by name
 * Question → Explore → Apply pattern
 * 
 * @param {string} iconName - Name of the icon to load
 * @returns {Promise<string>} SVG content
 */
export async function loadIcon(iconName) {
  try {
    // Question: Is the icon already cached?
    if (iconCache.has(iconName)) {
      return iconCache.get(iconName)
    }
    
    // Explore: Try to load from available icons first
    const availableIcons = {
      'piciformes-settings': 'settings',
      'settings': 'settings',
      'brain': 'brain',
      'turdus-brainstorm': 'brain',
      'corvidae-plan': 'blueprint',
      'accipiter-execute': 'build',
      'tyrannidae-menu': 'menu',
      'tyrannidae-close': 'close'
    }
    
    const actualIconName = availableIcons[iconName] || iconName
    
    // Try to fetch the SVG file directly
    try {
      const response = await fetch(`/src/assets/icons/${actualIconName}.svg`)
      if (response.ok) {
        const svgContent = await response.text()
        iconCache.set(iconName, svgContent)
        return svgContent
      }
    } catch (fetchError) {
      console.warn(`Could not fetch icon ${actualIconName}.svg:`, fetchError)
    }
    
    // Fallback to default icon
    const defaultSvg = getDefaultIcon()
    iconCache.set(iconName, defaultSvg)
    return defaultSvg
    
  } catch (error) {
    console.error(`Failed to load icon '${iconName}':`, error)
    return getDefaultIcon()
  }
}

/**
 * Get default fallback icon
 * 
 * @returns {string} Default SVG content
 */
function getDefaultIcon() {
  return `<svg viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10"/>
    <text x="12" y="16" text-anchor="middle" fill="white" font-size="12">?</text>
  </svg>`
}

/**
 * Preload commonly used icons
 * Input → Process → Output pattern
 * 
 * @param {Array} iconNames - Array of icon names to preload
 */
export async function preloadIcons(iconNames = []) {
  // Input: Default commonly used icons if none specified
  const iconsToLoad = iconNames.length > 0 ? iconNames : [
    'corvidae-plan',
    'accipiter-execute',
    'turdus-brainstorm',
    'tyrannidae-menu',
    'tyrannidae-close',
    'passeriformes-save',
    'piciformes-settings',
    'plus',
    'minus',
    'refresh',
    'check',
    'cross'
  ]
  
  // Process: Load all icons concurrently
  const loadPromises = iconsToLoad.map(iconName => loadIcon(iconName))
  
  try {
    // Output: Wait for all icons to load
    await Promise.all(loadPromises)
    console.log(`Preloaded ${iconsToLoad.length} icons`)
  } catch (error) {
    console.error('Failed to preload some icons:', error)
  }
}

/**
 * Get icon categories for organization
 * 
 * @returns {Object} Icon categories with their icons
 */
export function getIconCategories() {
  const categories = {
    planning: [],
    execution: [],
    brainstorming: [],
    interface: [],
    general: [],
    tools: [],
    building: [],
    navigation: [],
    status: [],
    actions: []
  }
  
  for (const iconName of Object.keys(IconRegistry)) {
    if (iconName.startsWith('corvidae-')) {
      categories.planning.push(iconName)
    } else if (iconName.startsWith('accipiter-')) {
      categories.execution.push(iconName)
    } else if (iconName.startsWith('turdus-')) {
      categories.brainstorming.push(iconName)
    } else if (iconName.startsWith('tyrannidae-')) {
      categories.interface.push(iconName)
    } else if (iconName.startsWith('passeriformes-')) {
      categories.general.push(iconName)
    } else if (iconName.startsWith('piciformes-')) {
      categories.tools.push(iconName)
    } else if (iconName.startsWith('furnariidae-')) {
      categories.building.push(iconName)
    } else if (iconName.includes('arrow') || iconName.includes('chevron')) {
      categories.navigation.push(iconName)
    } else if (['check', 'cross', 'warning', 'error', 'info', 'success', 'loading', 'progress'].includes(iconName)) {
      categories.status.push(iconName)
    } else {
      categories.actions.push(iconName)
    }
  }
  
  return categories
}

/**
 * Search icons by name or category
 * 
 * @param {string} query - Search query
 * @returns {Array} Matching icon names
 */
export function searchIcons(query) {
  const lowerQuery = query.toLowerCase()
  return Object.keys(IconRegistry).filter(iconName =>
    iconName.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Clear icon cache
 */
export function clearIconCache() {
  iconCache.clear()
}

/**
 * Get cache statistics
 * 
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
  return {
    totalIcons: Object.keys(IconRegistry).length,
    cachedIcons: iconCache.size,
    cacheHitRatio: iconCache.size / Object.keys(IconRegistry).length
  }
}

export default {
  IconRegistry,
  loadIcon,
  preloadIcons,
  getIconCategories,
  searchIcons,
  clearIconCache,
  getCacheStats
}
