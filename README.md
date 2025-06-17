# 🏃‍♂️ Roadrunner Autocoder

**AI-Powered Development Assistant for Local LLM Models**

Roadrunner Autocoder is a sophisticated development tool that leverages local Large Language Models (LLMs) to help you plan, brainstorm, and execute code generation tasks. Built with Vue.js, Electron, and LangChain, it provides a seamless interface for AI-assisted development.

![Roadrunner Autocoder](./src/assets/icons/brain.svg)

## 🚀 Features

### 📊 Planning & Strategy
- **AI-Powered Project Planning**: Generate structured development plans from natural language descriptions
- **Visual Plan Builder**: Drag-and-drop interface for creating complex workflows
- **Step Templates**: Pre-built templates for common development tasks
- **Plan Validation**: Automatic validation and optimization of generated plans

### 💡 Brainstorming
- **Multi-Agent Idea Generation**: Collaborative AI sessions with different agent perspectives
- **Interactive Idea Canvas**: Visual brainstorming with connected concepts
- **Export to Plans**: Convert brainstormed ideas directly into executable plans

### ⚡ Execution
- **Code Generation**: Automatic code generation based on descriptions
- **Batch Processing**: Process multiple instruction files simultaneously
- **Real-time Monitoring**: Live terminal output and execution logs
- **Multi-modal Input**: Support for text, files, and folder processing

### ⚙️ Configuration
- **Model Selection**: Choose from available Ollama models
- **LangChain Integration**: Advanced agent configuration options
- **Safety Controls**: Confirmation prompts for destructive operations
- **Import/Export**: Save and share configuration settings

## 💻 System Requirements

### Required
- **Node.js 18+** and npm
- **Ollama** with at least one model installed
- **8GB+ RAM** (16GB+ recommended for larger models)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)

### Recommended Models
- **Mistral Nemo (6.6GB)** - Balanced performance and quality
- **Llama 3.1 (8B)** - Excellent for code generation
- **CodeLlama (7B)** - Specialized for programming tasks
- **Qwen2.5-Coder (7B)** - Advanced coding capabilities

## 🛠️ Installation & Setup

### 1. Install Ollama
```bash
# macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 2. Install a Model
```bash
# Install Mistral Nemo (recommended)
ollama pull mistral-nemo

# Or install other models
ollama pull llama3.1:8b
ollama pull codellama:7b
ollama pull qwen2.5-coder:7b
```

### 3. Clone and Setup Roadrunner
```bash
git clone https://github.com/roadrunner-autocoder/roadrunner.git
cd roadrunner

# Install dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 4. Start the Application
```bash
# Development mode
npm run dev

# Or use the convenience scripts
./start-dev.sh    # Linux/macOS
start-dev.bat     # Windows
```

### 5. Build for Production
```bash
# Build web version
npm run build

# Build Electron app
npm run electron:build
```

## 📖 Usage Guide

### Quick Start
1. **Start Ollama**: Ensure Ollama is running with `ollama serve`
2. **Launch Roadrunner**: Run `npm run dev` or use the start scripts
3. **Select Model**: Choose your preferred AI model in the Planning or Execution tab
4. **Describe Task**: Write what you want to build in natural language
5. **Execute**: Click "Generate Plan" or "Start Autocoder" to begin

### Planning Tab
- Select your AI model from the dropdown
- Describe your project in the text area
- Click "Generate Plan" to create a structured development plan
- Use the Visual Plan Builder for complex multi-step projects
- Drag step templates to build custom workflows

### Execution Tab
- Choose between Single Task or Batch Folder modes
- Select your preferred AI model
- For single tasks: describe what you want to build
- For batch processing: select a folder with instruction files (.txt, .md)
- Enable Safety Mode for confirmation prompts
- Monitor progress in real-time

### Brainstorming Tab
- Start collaborative AI brainstorming sessions
- Use the interactive canvas to visualize ideas
- Connect related concepts and explore possibilities
- Export promising ideas to the Planning tab

## 🔧 Configuration

### Model Settings
- **Temperature**: Controls creativity (0.0 = deterministic, 1.0 = creative)
- **Max Tokens**: Maximum response length (100-8192)
- **Top P**: Nucleus sampling parameter (0.1-1.0)

### Agent Settings
- **Agent Type**: Choose reasoning strategy (Zero Shot React, Self Ask with Search, etc.)
- **Max Iterations**: Maximum reasoning steps (1-20)
- **Early Stopping**: When to halt agent execution
- **Verbose Logging**: Show detailed reasoning steps

### Tool Settings
- **File System Tools**: Allow reading/writing files
- **Code Execution Tools**: Allow running code snippets
- **Web Search Tools**: Enable internet searches (disabled by default)
- **Git Tools**: Allow git operations

### Safety & Performance
- **Safety Mode**: Require confirmation for destructive operations
- **Request Timeout**: Maximum wait time for responses (10-300 seconds)
- **Retry Attempts**: Number of retry attempts on failure (0-5)

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Plan |
| `Ctrl + S` | Save Current Work |
| `Ctrl + E` | Execute Plan |
| `F1` | Show Help |
| `Ctrl + ,` | Open Settings |
| `Esc` | Close Modal |

## 🔧 Troubleshooting

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check installed models: `ollama list`
- Verify Ollama URL in Configuration (default: http://localhost:11434)
- Try restarting Ollama service

### Performance Issues
- Use smaller models for faster responses
- Reduce max tokens in Configuration
- Close other resource-intensive applications
- Ensure adequate RAM and CPU resources
- Consider using GPU acceleration if available

### Generation Quality
- Adjust temperature (0.7-1.0 for more creativity)
- Provide more detailed and specific prompts
- Use specialized models for specific tasks (CodeLlama for coding)
- Enable conversation memory for better context

### Common Errors
- **"Model not found"**: Install the model with `ollama pull <model-name>`
- **"Connection refused"**: Start Ollama with `ollama serve`
- **"Out of memory"**: Use a smaller model or increase system RAM
- **"Timeout"**: Increase request timeout in Configuration

## 💡 Tips & Best Practices

### Effective Prompting
- Be specific about requirements and constraints
- Include examples of desired output format
- Specify programming languages and frameworks
- Break complex tasks into smaller steps

### Iterative Development
- Start with simple plans and gradually add complexity
- Test frequently and refine based on results
- Use the brainstorming feature to explore alternatives
- Save successful configurations for reuse

### File Organization
- Use clear, descriptive file names
- Organize projects in dedicated folders
- Keep instruction files (.txt, .md) for batch processing
- Maintain a consistent project structure

### Performance Optimization
- Use batch processing for multiple similar tasks
- Monitor system resources during execution
- Choose appropriate models for your hardware
- Enable safety mode for important operations

## 🏗️ Architecture

### Technology Stack
- **Frontend**: Vue.js 3, Tailwind CSS, Vite
- **Backend**: Node.js, Express, LangChain
- **Desktop**: Electron
- **AI Integration**: Ollama, Local LLMs
- **Testing**: Jest, Vue Test Utils

### Project Structure
```
roadrunner/
├── src/                    # Frontend source code
│   ├── components/         # Vue components
│   ├── stores/            # Pinia state management
│   ├── services/          # API services
│   ├── composables/       # Vue composables
│   ├── utils/             # Utility functions
│   └── styles/            # CSS styles
├── backend/               # Backend server
│   ├── langchain_tools/   # LangChain tool implementations
│   ├── config/           # Configuration files
│   └── tests/            # Backend tests
├── docs/                 # Documentation
└── tests/                # Frontend tests
```

### Core Components
- **AutocoderEngine**: Main execution engine
- **PlanValidator**: Plan validation and optimization
- **ModelManager**: AI model management
- **ExecutionService**: Task execution coordination
- **PlanningService**: Plan generation and management

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit your changes: `git commit -m 'Add amazing feature'`
5. Push to the branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style
- Use ESLint and Prettier for code formatting
- Follow Vue.js style guide
- Write comprehensive tests for new features
- Document all public APIs

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Ollama** for providing excellent local LLM infrastructure
- **LangChain** for powerful AI agent frameworks
- **Vue.js** for the reactive frontend framework
- **Electron** for cross-platform desktop capabilities
- The open-source community for inspiration and tools

## 📞 Support

- **Documentation**: [docs/README.md](docs/README.md)
- **Issues**: [GitHub Issues](https://github.com/roadrunner-autocoder/roadrunner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/roadrunner-autocoder/roadrunner/discussions)

---

**Built with ❤️ by the Roadrunner team**

*Empowering developers with AI-assisted coding*
