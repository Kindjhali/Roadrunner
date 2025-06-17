<!--
  HelpModal.vue - Comprehensive help and documentation modal
  
  @version 1.0.0
  @author Roadrunner Autocoder System
-->

<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">
          <Icon name="help" size="md" />
          Roadrunner Autocoder - Help & Documentation
        </h3>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <!-- Quick Start -->
        <section class="help-section">
          <h4>🚀 Quick Start</h4>
          <p>Roadrunner Autocoder is an AI-powered development assistant that helps you plan, brainstorm, and execute code generation tasks using local LLM models.</p>
          
          <div class="quick-steps">
            <div class="step">
              <span class="step-number">1</span>
              <div>
                <strong>Start Ollama:</strong> Ensure Ollama is running with your preferred models
              </div>
            </div>
            <div class="step">
              <span class="step-number">2</span>
              <div>
                <strong>Plan:</strong> Describe your project in the Planning tab
              </div>
            </div>
            <div class="step">
              <span class="step-number">3</span>
              <div>
                <strong>Execute:</strong> Generate and refine code in the Execution tab
              </div>
            </div>
          </div>
        </section>

        <!-- Features Overview -->
        <section class="help-section">
          <h4>📋 Features Overview</h4>
          
          <div class="feature-grid">
            <div class="feature-card">
              <h5>📊 Planning & Strategy</h5>
              <ul>
                <li>AI-powered project planning</li>
                <li>Visual plan builder with drag-and-drop</li>
                <li>Step templates for common tasks</li>
                <li>Plan validation and optimization</li>
              </ul>
            </div>
            
            <div class="feature-card">
              <h5>💡 Brainstorming</h5>
              <ul>
                <li>Multi-agent idea generation</li>
                <li>Interactive idea canvas</li>
                <li>Collaborative AI sessions</li>
                <li>Export ideas to plans</li>
              </ul>
            </div>
            
            <div class="feature-card">
              <h5>⚡ Execution</h5>
              <ul>
                <li>Code generation and editing</li>
                <li>Batch file processing</li>
                <li>Terminal monitoring</li>
                <li>Multi-modal input support</li>
              </ul>
            </div>
            
            <div class="feature-card">
              <h5>⚙️ Configuration</h5>
              <ul>
                <li>Model selection and tuning</li>
                <li>LangChain agent configuration</li>
                <li>Tool and safety settings</li>
                <li>Import/export configurations</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- System Requirements -->
        <section class="help-section">
          <h4>💻 System Requirements</h4>
          <div class="requirements">
            <div class="req-category">
              <h6>Required:</h6>
              <ul>
                <li>Node.js 18+ and npm</li>
                <li>Ollama with at least one model installed</li>
                <li>8GB+ RAM (16GB+ recommended)</li>
                <li>Modern web browser</li>
              </ul>
            </div>
            <div class="req-category">
              <h6>Recommended Models:</h6>
              <ul>
                <li>Mistral Nemo (6.6GB) - Balanced performance</li>
                <li>Llama 3.1 (8B) - Code generation</li>
                <li>CodeLlama (7B) - Specialized coding</li>
                <li>Qwen2.5-Coder (7B) - Advanced coding</li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Usage Guide -->
        <section class="help-section">
          <h4>📖 Usage Guide</h4>
          
          <div class="usage-tabs">
            <div class="tab-content">
              <h6>Planning Tab</h6>
              <ol>
                <li>Select your preferred AI model</li>
                <li>Describe your project in the text area</li>
                <li>Click "Generate Plan" to create a structured plan</li>
                <li>Use the Visual Plan Builder for complex projects</li>
                <li>Drag step templates to build custom workflows</li>
              </ol>
            </div>
            
            <div class="tab-content">
              <h6>Execution Tab</h6>
              <ol>
                <li>Upload files or create new ones</li>
                <li>Use the code editor for manual editing</li>
                <li>Process multiple files with batch operations</li>
                <li>Monitor terminal output in real-time</li>
                <li>Save and export your generated code</li>
              </ol>
            </div>
          </div>
        </section>

        <!-- Keyboard Shortcuts -->
        <section class="help-section">
          <h4>⌨️ Keyboard Shortcuts</h4>
          <div class="shortcuts-grid">
            <div class="shortcut">
              <kbd>Ctrl</kbd> + <kbd>N</kbd>
              <span>New Plan</span>
            </div>
            <div class="shortcut">
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
              <span>Save Current Work</span>
            </div>
            <div class="shortcut">
              <kbd>Ctrl</kbd> + <kbd>E</kbd>
              <span>Execute Plan</span>
            </div>
            <div class="shortcut">
              <kbd>F1</kbd>
              <span>Show Help</span>
            </div>
            <div class="shortcut">
              <kbd>Ctrl</kbd> + <kbd>,</kbd>
              <span>Open Settings</span>
            </div>
            <div class="shortcut">
              <kbd>Esc</kbd>
              <span>Close Modal</span>
            </div>
          </div>
        </section>

        <!-- Troubleshooting -->
        <section class="help-section">
          <h4>🔧 Troubleshooting</h4>
          
          <div class="troubleshoot-item">
            <h6>Ollama Connection Issues</h6>
            <ul>
              <li>Ensure Ollama is running: <code>ollama serve</code></li>
              <li>Check if models are installed: <code>ollama list</code></li>
              <li>Verify Ollama URL in Configuration (default: http://localhost:11434)</li>
            </ul>
          </div>
          
          <div class="troubleshoot-item">
            <h6>Performance Issues</h6>
            <ul>
              <li>Use smaller models for faster responses</li>
              <li>Reduce max tokens in Configuration</li>
              <li>Close other resource-intensive applications</li>
              <li>Ensure adequate RAM and CPU resources</li>
            </ul>
          </div>
          
          <div class="troubleshoot-item">
            <h6>Generation Quality</h6>
            <ul>
              <li>Adjust temperature (0.7-1.0 for creativity)</li>
              <li>Provide more detailed prompts</li>
              <li>Use specialized models for specific tasks</li>
              <li>Enable conversation memory for context</li>
            </ul>
          </div>
        </section>

        <!-- Tips & Best Practices -->
        <section class="help-section">
          <h4>💡 Tips & Best Practices</h4>
          
          <div class="tips-grid">
            <div class="tip">
              <h6>🎯 Effective Prompting</h6>
              <p>Be specific about requirements, include examples, and specify the desired output format.</p>
            </div>
            
            <div class="tip">
              <h6>🔄 Iterative Development</h6>
              <p>Start with simple plans, test frequently, and refine based on results.</p>
            </div>
            
            <div class="tip">
              <h6>📁 File Organization</h6>
              <p>Use clear file names and organize projects in dedicated folders.</p>
            </div>
            
            <div class="tip">
              <h6>⚡ Performance</h6>
              <p>Use batch processing for multiple files and monitor system resources.</p>
            </div>
          </div>
        </section>

        <!-- About -->
        <section class="help-section">
          <h4>ℹ️ About Roadrunner</h4>
          <div class="about-content">
            <p><strong>Version:</strong> 1.0.0</p>
            <p><strong>Built with:</strong> Vue.js, Electron, LangChain, Tailwind CSS</p>
            <p><strong>License:</strong> MIT</p>
            <p><strong>Architecture:</strong> Modular agent-based system with local LLM integration</p>
            
            <div class="tech-stack">
              <h6>Technology Stack:</h6>
              <div class="tech-badges">
                <span class="tech-badge">Vue.js 3</span>
                <span class="tech-badge">Electron</span>
                <span class="tech-badge">LangChain</span>
                <span class="tech-badge">Ollama</span>
                <span class="tech-badge">Tailwind CSS</span>
                <span class="tech-badge">Node.js</span>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="openGitHub">
          <Icon name="external-link" size="sm" />
          GitHub Repository
        </button>
        <button class="btn btn-primary" @click="$emit('close')">
          Got it!
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import Icon from './Icon.vue'

export default {
  name: 'HelpModal',
  components: {
    Icon
  },
  emits: ['close'],
  methods: {
    openGitHub() {
      // Open GitHub repository in external browser
      if (window.electronAPI) {
        window.electronAPI.openExternal('https://github.com/roadrunner-autocoder/roadrunner')
      } else {
        window.open('https://github.com/roadrunner-autocoder/roadrunner', '_blank')
      }
    }
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 900px;
  width: 95%;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: white;
  transition: background-color 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.modal-body {
  padding: 0;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
}

.help-section {
  padding: 1.5rem;
  border-bottom: 1px solid #f3f4f6;
}

.help-section:last-child {
  border-bottom: none;
}

.help-section h4 {
  margin: 0 0 1rem 0;
  font-weight: 600;
  color: #1f2937;
  font-size: 1.1rem;
}

.help-section h5 {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: #374151;
  font-size: 1rem;
}

.help-section h6 {
  margin: 0 0 0.5rem 0;
  font-weight: 600;
  color: #4b5563;
  font-size: 0.9rem;
}

.quick-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1rem;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.step-number {
  background: #3b82f6;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 600;
  flex-shrink: 0;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.feature-card {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.feature-card ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
  list-style-type: disc;
}

.feature-card li {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.requirements {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
}

.req-category ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
}

.req-category li {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

.tab-content {
  background: #f9fafb;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.tab-content ol {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
}

.tab-content li {
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
  margin-top: 1rem;
}

.shortcut {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 0.875rem;
}

kbd {
  background: #374151;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: monospace;
}

.troubleshoot-item {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #fef3c7;
  border-radius: 8px;
  border-left: 4px solid #f59e0b;
}

.troubleshoot-item ul {
  margin: 0.5rem 0 0 0;
  padding-left: 1.25rem;
}

.troubleshoot-item li {
  margin: 0.25rem 0;
  font-size: 0.875rem;
}

code {
  background: #e5e7eb;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.875rem;
}

.tips-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.tip {
  background: #ecfdf5;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #d1fae5;
}

.tip p {
  margin: 0.5rem 0 0 0;
  font-size: 0.875rem;
  color: #065f46;
}

.about-content p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
}

.tech-stack {
  margin-top: 1rem;
}

.tech-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.tech-badge {
  background: #3b82f6;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.modal-footer {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

@media (max-width: 768px) {
  .modal-content {
    width: 98%;
    max-height: 95vh;
  }
  
  .feature-grid,
  .requirements,
  .shortcuts-grid,
  .tips-grid {
    grid-template-columns: 1fr;
  }
  
  .modal-header {
    padding: 1rem;
  }
  
  .modal-title {
    font-size: 1.1rem;
  }
  
  .help-section {
    padding: 1rem;
  }
}
</style>
