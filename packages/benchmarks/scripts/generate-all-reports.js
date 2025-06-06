#!/usr/bin/env node

/**
 * @fileoverview Generate all benchmark reports in multiple formats
 * 
 * Usage:
 *   node scripts/generate-all-reports.js
 * 
 * Generates HTML and Markdown reports for all available benchmark JSON files
 */

import { readdirSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { 
      stdio: 'inherit',
      cwd: rootDir 
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
}

async function generateReports() {
  console.log('🔍 Searching for benchmark JSON files...\n');
  
  // Find all benchmark JSON files
  const files = readdirSync(rootDir)
    .filter(file => file.startsWith('bench-') && file.endsWith('.json'))
    .filter(file => !file.includes('baseline')); // Skip baseline files
  
  if (files.length === 0) {
    console.log('No benchmark JSON files found. Run benchmarks first with:');
    console.log('  pnpm bench:ci');
    return;
  }
  
  console.log(`Found ${files.length} benchmark file(s):\n`);
  
  for (const file of files) {
    console.log(`📊 Processing ${file}...`);
    
    try {
      // Generate HTML report
      await runCommand('node', ['scripts/generate-html-report.js', file]);
      
      // Generate Markdown report
      await runCommand('node', ['scripts/generate-markdown-report.js', file]);
      
      console.log(`✅ Generated reports for ${file}\n`);
    } catch (error) {
      console.error(`❌ Failed to generate reports for ${file}: ${error.message}\n`);
    }
  }
  
  console.log('\n📋 Report Summary:');
  console.log('─'.repeat(50));
  
  files.forEach(file => {
    const htmlFile = file.replace('.json', '.html');
    const mdFile = file.replace('.json', '.md');
    
    console.log(`\n${file}:`);
    if (existsSync(join(rootDir, htmlFile))) {
      console.log(`  ✅ HTML: ${htmlFile}`);
    }
    if (existsSync(join(rootDir, mdFile))) {
      console.log(`  ✅ Markdown: ${mdFile}`);
    }
  });
  
  console.log('\n✨ All reports generated successfully!');
}

// Run the report generation
generateReports().catch(error => {
  console.error('Failed to generate reports:', error);
  process.exit(1);
});