const { generateContentFromSpec } = require('../codeGenerator.js'); // Adjust path if necessary
const fs = require('fs');
const path = require('path');

// Mock the fs.readFileSync for the template
jest.mock('fs');

const mockLlmGenerator = jest.fn();
const mockSendSseMessage = jest.fn();

// Read the actual template content once for all tests that use it
// This way, we are testing against the real template structure but mocking fs for isolation.
const actualTemplatePath = path.join(__dirname, '..', 'templates', 'vue_component_basic.template');
const actualTemplateContent = fs.readFileSync(actualTemplatePath, 'utf-8');


describe('codeGenerator.js Vue Component Generation', () => {
  beforeEach(() => {
    mockLlmGenerator.mockReset();
    mockSendSseMessage.mockReset();
    // Setup the mock for fs.readFileSync to return the actual template content
    fs.readFileSync.mockImplementation((filePath, options) => {
      if (filePath.endsWith('vue_component_basic.template')) {
        return actualTemplateContent;
      }
      // For any other file, you might want to throw an error or return something else
      throw new Error(`fs.readFileSync mock called with unexpected path: ${filePath}`);
    });
  });

  const fullCodeGenPlan = { modelPreference: 'test-model' };
  const itemDetails = {}; // Minimal itemDetails for these tests
  const moduleName = 'TestModule';

  it('should generate Vue Options API script block correctly', async () => {
    const specDetails = {
      componentName: 'MyOptsComponent',
      useCompositionApi: false,
      inputs: ['propA:String', 'propB:Number'],
      outputs: ['customEvent', 'anotherEvent'],
      methods: [{ methodName: 'doSomething', description: 'Adds propA and propB', bodyPrompt:'return this.propA + this.propB;' }],
      dataPrompt: 'return { msg: "Hello Initial" }',
      computedPrompt: 'myComputed() { return this.propA + " computed"; }',
      watchPrompt: 'propA(newVal, oldVal) { console.log(`propA changed from ${oldVal} to ${newVal}`); }',
      scriptLang: 'js'
    };

    mockLlmGenerator.mockImplementation(async (prompt) => {
      if (prompt.includes("dataPrompt") || prompt.includes("Hello Initial")) return 'msg: "Test Data from LLM"';
      if (prompt.includes("Adds propA and propB") || prompt.includes("return this.propA + this.propB;")) return 'console.log("LLM generated method body for doSomething");\nreturn this.propA + this.propB;';
      if (prompt.includes("myComputed() { return this.propA + \" computed\"; }")) return 'doubledB() {\n  return this.propB * 2;\n}';
      if (prompt.includes("watchPrompt")) return 'propB(newVal) {\n console.log(`propB is now ${newVal}`)\n}';
      if (specDetails.templatePrompt && prompt === specDetails.templatePrompt) return '<p>LLM Template</p>';
      return '// Fallback LLM content';
    });

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<script>");
    expect(content).toContain("name: 'MyOptsComponent'");
    expect(content).toContain("propA: { type: String, default: null }");
    expect(content).toContain("propB: { type: Number, default: null }");
    expect(content).toContain("emits: ['customEvent', 'anotherEvent']");
    expect(content).toContain("data() {");
    expect(content).toContain('msg: "Test Data from LLM"'); // From LLM
    expect(content).toContain("computed: {");
    expect(content).toContain("doubledB() {"); // From LLM
    expect(content).toContain("watch: {");
    expect(content).toContain("propB(newVal) {"); // From LLM
    expect(content).toContain("methods: {");
    expect(content).toContain("doSomething() {");
    expect(content).toContain('console.log("LLM generated method body for doSomething");'); // From LLM
    expect(content).toContain("</script>");
  });

  it('should generate Vue Composition API script block using propsPrompt', async () => {
    const specDetails = {
      componentName: 'MyCompComponent',
      useCompositionApi: true,
      propsPrompt: '/* LLM should generate full script setup */ import { ref, defineProps } from "vue"; const props = defineProps({ message: String }); const count = ref(0);',
      scriptLang: 'ts'
    };
    mockLlmGenerator.mockResolvedValueOnce('import {ref, defineProps} from "vue";\nconst props = defineProps({ message: String });\nconst greeting = ref("Hello from LLM for script setup");');

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<script setup lang=\"ts\">");
    expect(content).toContain('const greeting = ref("Hello from LLM for script setup");');
    expect(content).toContain("</script>");
    expect(mockLlmGenerator).toHaveBeenCalledWith(specDetails.propsPrompt, fullCodeGenPlan.modelPreference, null);
  });

  it('should generate Vue Composition API with defineProps, defineEmits, and logicPrompt', async () => {
    const specDetails = {
      componentName: 'MyPartsComponent',
      useCompositionApi: true,
      inputs: ['id:String', 'value:Number'],
      outputs: ['update', 'delete'],
      logicPrompt: 'const internalState = ref(props.value); function updateInternal() { emit("update", internalState.value); }',
      scriptLang: 'js'
    };
    // Mock for logicPrompt
    mockLlmGenerator.mockResolvedValueOnce('import { ref, watch } from "vue";\nconst localCount = ref(props.id.length + (props.value || 0));\nwatch(() => props.value, (newVal) => { localCount.value = (props.id.length || 0) + newVal; emit("update", newVal)});');

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<script setup>");
    expect(content).toContain("const props = defineProps({\n  id: String,\n  value: Number\n});");
    expect(content).toContain("const emit = defineEmits(['update', 'delete']);");
    expect(content).toContain("const localCount = ref(props.id.length + (props.value || 0));"); // From LLM for logicPrompt
    expect(content).toContain('watch(() => props.value, (newVal) => { localCount.value = (props.id.length || 0) + newVal; emit("update", newVal)});');
    expect(content).toContain("</script>");
    expect(mockLlmGenerator).toHaveBeenCalledWith(specDetails.logicPrompt, fullCodeGenPlan.modelPreference, null);
  });

  it('should generate Vue Composition API with default ref if no prompts and no inputs/outputs', async () => {
    const specDetails = {
      componentName: 'MyEmptySetupComponent',
      useCompositionApi: true,
      scriptLang: 'js'
      // No inputs, outputs, propsPrompt, or logicPrompt
    };
    // No LLM calls expected for script block if all prompts are empty

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<script setup>");
    expect(content).toContain(`import { ref } from 'vue';`);
    expect(content).toContain(`const exampleRef = ref('Example ref for MyEmptySetupComponent');`);
    expect(content).toContain("</script>");
    expect(mockLlmGenerator).not.toHaveBeenCalled(); // No LLM calls for script if all prompts for it are empty
  });


  it('should inject templateContent correctly from templatePrompt', async () => {
    const specDetails = {
      componentName: 'MyTemplateComponent',
      templatePrompt: '<!-- This is a prompt for the template --><div>{{ msg }}</div>',
      useCompositionApi: false, // Options API for simplicity, script block will be basic
      dataPrompt: 'return { msg: "Hello from data" }',
      scriptLang: 'js'
    };
    // LLM for templatePrompt
    mockLlmGenerator.mockImplementation(async (prompt) => {
      if (prompt === specDetails.templatePrompt) return '<h1>Injected Template via LLM</h1><p>{{ localMsg }}</p>';
      if (prompt === specDetails.dataPrompt) return 'return { localMsg: "Data message" }';
      return '';
    });

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<template>\n  <div class=\"my-template-component\">\n    <h1>Injected Template via LLM</h1><p>{{ localMsg }}</p>\n  </div>\n</template>");
  });

  it('should use default templateContent if templatePrompt is not provided or LLM fails', async () => {
    const specDetails = {
      componentName: 'MyDefaultTemplateComponent',
      // No templatePrompt
      useCompositionApi: false,
      scriptLang: 'js'
    };
    // LLM fails for templatePrompt (or it's not called if prompt is missing)
    mockLlmGenerator.mockResolvedValueOnce(null); // or mockImplementation to return null for templatePrompt if it were provided

    const content = await generateContentFromSpec('componentSpec', specDetails, itemDetails, moduleName, fullCodeGenPlan, mockLlmGenerator, mockSendSseMessage);

    expect(content).toContain("<template>\n  <div class=\"my-default-template-component\">\n    <!-- LLM-generated template for MyDefaultTemplateComponent -->\n<p>MyDefaultTemplateComponent works!</p>\n  </div>\n</template>");
  });
});
