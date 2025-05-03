// Capture console output to display in the UI
const originalConsoleLog = console.log;
const consoleOutput = document.getElementById(
  'console-output'
) as HTMLPreElement;

console.log = function (...args) {
  originalConsoleLog.apply(console, args);

  // Display in the UI
  if (consoleOutput) {
    consoleOutput.textContent +=
      args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(' ') + '\n';
  }
};

// Import the demo to run it
import './demo';
