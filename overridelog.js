const fs = require('fs');
const path = require('path');
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const originalLogFilePath = process.argv[2];

// 1. Validate Input
if (!originalLogFilePath) {
  console.error('Usage: node overridelog.js <path_to_original_log_file.json>');
  readline.close();
  process.exit(1);
}

// 2. Read and Parse Original Log File
let logData;
try {
  if (!fs.existsSync(originalLogFilePath)) {
    console.error(`Error: Log file not found at ${originalLogFilePath}`);
    readline.close();
    process.exit(1);
  }
  const logFileContent = fs.readFileSync(originalLogFilePath, 'utf-8');
  logData = JSON.parse(logFileContent);
} catch (error) {
  console.error('Error reading or parsing log file:', error.message);
  readline.close();
  process.exit(1);
}

// Check if already an override
if (logData.justification && logData.justification.startsWith('Manual override')) {
  console.log('This log file is already a result of a manual override. Further override is not supported by this script.');
  readline.close();
  process.exit(0);
}

// 3. Display Information and Prompt for Override
console.log("\n--- Original Log Information ---");
console.log(`Input: ${logData.input || 'N/A'}`);

console.log("\n--- Available Responses ---");
if (!logData.responses || !Array.isArray(logData.responses) || logData.responses.length === 0) {
  console.log("No responses available to select from in this log file.");
  readline.close();
  process.exit(0);
}

logData.responses.forEach((response, index) => {
  console.log(`\n(${index + 1}). Agent: ${response.agentID || response.agent || 'N/A'}`); // Handle agentID or agent
  console.log(`    Proposal: ${response.proposal || 'N/A'}`);
  console.log(`    Confidence: ${response.confidence !== undefined ? response.confidence.toFixed(2) : 'N/A'}`);
  console.log(`    Flags: ${response.flags && response.flags.length > 0 ? response.flags.join(', ') : '(none)'}`);
});

if (logData.selected) {
    console.log("\n--- Currently Selected ---");
    console.log(`  Agent:      ${logData.selected.agentID || logData.selected.agent || 'N/A'}`);
    console.log(`  Proposal:   ${logData.selected.proposal || 'N/A'}`);
    console.log(`  Confidence: ${logData.selected.confidence !== undefined ? logData.selected.confidence.toFixed(2) : 'N/A'}`);
    console.log(`  Flags:      ${logData.selected.flags && logData.selected.flags.length > 0 ? logData.selected.flags.join(', ') : '(none)'}`);
    console.log(`  Justification: ${logData.justification || 'N/A'}`);
} else {
    console.log("\n--- Currently Selected ---");
    console.log("None");
    console.log(`  Justification: ${logData.justification || 'N/A'}`);
}


readline.question('\nEnter the number of the response to select as the new outcome (or type "cancel" to exit): ', (answer) => {
  if (answer.toLowerCase() === 'cancel') {
    console.log('Override cancelled.');
    readline.close();
    process.exit(0);
  }

  const selectedIndex = parseInt(answer, 10) - 1;

  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= logData.responses.length) {
    console.error('Invalid selection. Please enter a valid number from the list.');
    readline.close();
    process.exit(1);
  }

  const newSelectedResponse = logData.responses[selectedIndex];
  const newLogData = { ...logData }; // Shallow copy

  newLogData.selected = newSelectedResponse;
  newLogData.justification = `Manual override by user. Original justification: ${logData.justification || 'N/A'}`;
  if (logData.error) { // Preserve error if it existed
    newLogData.error = logData.error;
  }


  const originalFileParsedPath = path.parse(originalLogFilePath);
  const originalFileNameWithoutExt = originalFileParsedPath.name;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS

  const overrideFileName = `${originalFileNameWithoutExt}_override_${dateStr}_${timeStr}.json`;
  const newLogDirPath = originalFileParsedPath.dir; // Assumes new log goes in same dir
  const newLogFilePath = path.join(newLogDirPath, overrideFileName);

  try {
    fs.writeFileSync(newLogFilePath, JSON.stringify(newLogData, null, 2));
    console.log(`\nOverride log saved successfully to: ${newLogFilePath}`);
  } catch (error) {
    console.error('Error writing new log file:', error.message);
    readline.close();
    process.exit(1);
  }

  readline.close();
});
