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
- The multi-model conference functionality is primarily handled by the `ConferenceTool` (internally named `multi_model_debate`) within the main autonomous agent.
- This agent is typically invoked via the `POST /execute-autonomous-task` endpoint. Users describe a task that requires a conference, and the agent utilizes the `ConferenceTool` with the specified parameters.
- The dedicated endpoint `POST /execute-conference-task` is **deprecated**. Calls to it will result in an error message advising to use the agent with the `ConferenceTool`.
- Parameters for the conference (e.g., main prompt/topic, model roles like 'Proponent', 'Skeptic', 'Synthesizer', number of rounds, and the LLM model name to be used by participants) are provided as input to the `ConferenceTool` when the main agent calls it.
- The `ConferenceTool` itself manages the turn-by-turn interaction, including building the context for each participant based on previous turns.
- Output, including individual model responses and the final arbiter response, is streamed back via the main agent's SSE connection and logged by the tool.

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

Status: **Implemented via Agent Tool**
Implemented: Multi-model conferences are functional through the `ConferenceTool` invoked by the main autonomous agent. This allows specifying the prompt, model roles, and number of rounds. The tool manages the debate flow and logs the outcome.
Required: UI enhancements for easier conference setup and advanced debate visualization are future considerations. Direct `history` injection into the tool at the start of a conference is not explicitly supported by the current tool's input; the tool builds history iteratively.
