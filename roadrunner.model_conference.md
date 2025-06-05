# Roadrunner: Multi-Model Conferencing Protocol

## 📌 Purpose
To enable Roadrunner to simulate a debate or discussion between multiple LLMs — having two models respond to a user-defined question, and a third model act as a judge to determine the best answer or synthesize a combined response.

## 🔧 Feature Summary
This protocol allows:
- Role-based responses from multiple models (e.g., Logical Reasoner vs. Creative Thinker)
- Arbitration by a third model to resolve disagreements or merge perspectives
- Logging of all intermediate and final results

## 🧠 Use Case
This system is ideal for tasks that benefit from multiple perspectives — such as strategy, code review, ethical dilemmas, or writing styles — where one model alone may not yield the most balanced answer.

---

## ⚙️ How It Works (Execution Flow)
1. **User provides a single prompt/question** (e.g., "What is the best strategy to reduce technical debt?")
2. **Model A** is assigned a role (e.g., "logical reasoner") and asked to respond.
3. **Model B** is assigned a contrasting role (e.g., "creative problem solver") and responds independently.
4. **Model C (the arbiter)** receives both answers and is prompted to:
   - Compare both
   - Choose the better response or
   - Synthesize a unified answer
5. **Result is logged** to `roadrunner_workspace/conferences.json`

---

## 🧩 Integration with Roadrunner
### 🔄 Backend
- Uses existing Ollama interface (e.g., direct HTTP calls to Ollama, or `exec('ollama run ...')`) already employed by Roadrunner.
- **The backend API endpoint `POST /execute-conference-task` is now live on the Roadrunner server (localhost:3030).** It accepts a JSON body with a `prompt` field and returns the arbiter's response.
- The functionality is currently exposed as a direct API endpoint rather than a specific "step type" within the existing Roadrunner task execution flow.
- Output is compatible with existing `taskContext` or log storage structures.

### 💻 Frontend
- Can be triggered via a new UI element or button (e.g. “Run Model Conference”)
- Optional: model and role selection dropdowns for configuring agent roles
- Output appears in the log window as a streamed or final response

### 📂 Storage
- Adds a `conferences.json` or similar log file under `roadrunner_workspace/`
- Can be expanded later into a UI viewer for replaying model discussions

---

## 📅 Roadmap Phase Alignment
- **Roadrunner Phase 8: Multi-Model Support**【24†source】
- Fulfills planned feature for "routing task types to specialized models"
- Can later be extended for dynamic model assignment per task

## 🧪 Future Enhancements
- Debate-style iteration (multiple back-and-forth rounds)
- Weighted arbitration (e.g., assign confidences to agents)
- UI visualisation of debate tree (who said what, when)
- Add OpenAI or Claude models for remote arbitration via Owlcore【25†source】

---

## 🧭 Summary
The Multi-Model Conferencing Protocol enhances Roadrunner by injecting comparative intelligence — using multiple model perspectives and final synthesis for better results. It integrates cleanly into the existing LLM pipeline, and sets the foundation for future agent-based debates and arbitration layers.

Status: **Partially Implemented**
Implemented: **Backend Only (API endpoint available at `/execute-conference-task` on localhost:3030)**
Required: **Roadrunner frontend UI for direct conference interaction (optional); Toko32 frontend integration for triggering conferences and displaying results (in progress/done). Full integration as a Roadrunner "step type" is pending.**
