#!/usr/bin/env node

/**
 * @fileoverview Convenience script to generate both HTML and Markdown reports
 * 
 * Usage:
 *   node scripts/generate-reports.js [input.json]
 */

import { readFileSync } from 'fs';
import { spawn } from 'child_process';
import { basename, dirname, join } from 'path';

const runCommand = (command, args) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
  });
};

async function generateReports(inputFile) {
  const scriptPath = join(dirname(import.meta.url.replace('file://', '')), 'generate-report.js');
  const baseOutput = inputFile.replace('.json', '');
  
  console.log(`\n📊 Generating reports for ${basename(inputFile)}...\n`);
  
  try {
    // Generate HTML report
    console.log('📝 Generating HTML report...');
    await runCommand('node', [scriptPath, inputFile, 'html', `${baseOutput}.html`]);
    
    // Generate Markdown report
    console.log('📝 Generating Markdown report...');
    await runCommand('node', [scriptPath, inputFile, 'markdown', `${baseOutput}.md`]);
    
    console.log('\n✅ All reports generated successfully!\n');
  } catch (error) {
    console.error(`\n❌ Error generating reports: ${error.message}\n`);
    process.exit(1);
  }
}

// Main
const inputFile = process.argv[2] || 'bench-results.json';
generateReports(inputFile);