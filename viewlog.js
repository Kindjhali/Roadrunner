import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Parse a Roadrunner JSON log file and return the structured data.
 * @param {string} filePath - Absolute path to the log file.
 * @returns {object} Parsed log contents.
 */
export function parseLogFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// ---- CLI Execution ----
const isCLI = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');
if (isCLI) {
  const logFilePath = process.argv[2];
  if (!logFilePath) {
    console.error('Usage: node viewlog.js <path_to_log_file.json>');
    process.exit(1);
  }

  let logData;
  try {
    logData = parseLogFile(logFilePath);
  } catch (error) {
    console.error('Error reading or parsing log file:', error.message);
    process.exit(1);
  }

// 3. Format and Print Output
const { input, responses, selected, justification, error: logError } = logData;

console.log(`\n--- Log Details for: ${logFilePath} ---`);
console.log("==========================================");

console.log("\n--- Input ---");
console.log(input || "N/A");

console.log("\n--- Responses ---");
if (responses && responses.length > 0) {
  responses.forEach((response, index) => {
    console.log(`\n  Response #${index + 1}:`);
    console.log(`    Agent:      ${response.agentID || response.agent || 'N/A'}`); // Handle both agentID and agent
    console.log(`    Proposal:   ${response.proposal || 'N/A'}`);
    console.log(`    Confidence: ${response.confidence !== undefined ? response.confidence.toFixed(2) : 'N/A'}`);
    console.log(`    Flags:      ${response.flags && response.flags.length > 0 ? response.flags.join(', ') : '(none)'}`);
  });
} else {
  console.log("No responses recorded.");
}

console.log("\n--- Selected ---");
if (selected) {
  console.log(`  Agent:      ${selected.agentID || selected.agent || 'N/A'}`); // Handle both agentID and agent
  console.log(`  Proposal:   ${selected.proposal || 'N/A'}`);
  console.log(`  Confidence: ${selected.confidence !== undefined ? selected.confidence.toFixed(2) : 'N/A'}`);
  console.log(`  Flags:      ${selected.flags && selected.flags.length > 0 ? selected.flags.join(', ') : '(none)'}`);
} else {
  console.log("None");
}

console.log("\n--- Justification ---");
console.log(justification || "N/A");

if (logError) {
  console.log("\n--- Error Recorded in Log ---");
  console.log(logError);
}

console.log("\n==========================================");
console.log("--- End of Log ---");
}
