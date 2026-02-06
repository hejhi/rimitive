import type { DocSection } from './types.js';

/**
 * Boundaries for section types based on line position in the embedded docs
 * These are approximate and based on the document structure
 */
const OVERVIEW_END = 200;
const GUIDE_END = 5907;
// After GUIDE_END is API reference

/**
 * Known package names to detect in section context
 */
const PACKAGES = [
  '@rimitive/core',
  '@rimitive/signals',
  '@rimitive/view',
  '@rimitive/router',
  '@rimitive/resource',
  '@rimitive/ssr',
  '@rimitive/react',
];

/**
 * Convert a title to a kebab-case ID
 */
function toKebabCase(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract explicit @tags from HTML comments
 * These are added via the SearchTags MDX component
 */
function extractSearchTags(content: string): string[] {
  const tags: string[] = [];
  const tagPattern = /<!--\s*@tags:\s*([^>]+)\s*-->/g;
  let match;

  while ((match = tagPattern.exec(content)) !== null) {
    const tagList = match[1];
    if (tagList) {
      const parsedTags = tagList.split(',').map((t) => t.trim().toLowerCase());
      tags.push(...parsedTags);
    }
  }

  return tags;
}

/**
 * Extract keywords from title and first paragraph
 */
function extractKeywords(title: string, content: string): string[] {
  const keywords: string[] = [];

  // First, extract explicit @tags (highest priority)
  const explicitTags = extractSearchTags(content);
  keywords.push(...explicitTags);

  // Add words from title
  const titleWords = title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w));
  keywords.push(...titleWords);

  // Extract first paragraph (up to first code block or blank line sequence)
  const firstParagraph = content.split(/\n\n|```/)[0] ?? '';

  // Extract significant words from first paragraph
  const paragraphWords = firstParagraph
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter(
      (w) =>
        ![
          'this',
          'that',
          'with',
          'from',
          'have',
          'will',
          'your',
          'when',
          'which',
        ].includes(w)
    );
  keywords.push(...paragraphWords);

  // Detect package references
  for (const pkg of PACKAGES) {
    if (content.includes(pkg)) {
      keywords.push(pkg);
      const shortName = pkg.split('/')[1];
      if (shortName) keywords.push(shortName);
    }
  }

  // Detect common API terms
  const apiTerms = [
    'signal',
    'computed',
    'effect',
    'batch',
    'compose',
    'module',
    'behavior',
    'mount',
    'match',
    'map',
    'portal',
    'load',
    'resource',
    'router',
    'navigate',
    'subscribe',
    'untrack',
  ];
  for (const term of apiTerms) {
    if (
      content.toLowerCase().includes(term) &&
      !keywords.includes(term.toLowerCase())
    ) {
      keywords.push(term);
    }
  }

  // Deduplicate
  return [...new Set(keywords)];
}

/**
 * Determine section type based on line number
 */
function getSectionType(lineNumber: number): 'overview' | 'guide' | 'api' {
  if (lineNumber < OVERVIEW_END) return 'overview';
  if (lineNumber < GUIDE_END) return 'guide';
  return 'api';
}

/**
 * Detect which package a section is about
 */
function detectPackage(content: string): string | undefined {
  // Look for explicit package references
  for (const pkg of PACKAGES) {
    // Check for import statements or explicit mentions
    if (
      content.includes(`from '${pkg}`) ||
      content.includes(`from "${pkg}`) ||
      content.includes(`\`${pkg}\``)
    ) {
      return pkg;
    }
  }

  // Check content patterns
  if (content.includes('signal(') || content.includes('SignalModule')) {
    return '@rimitive/signals';
  }
  if (
    content.includes('el(') ||
    content.includes('mount(') ||
    content.includes('ElModule')
  ) {
    return '@rimitive/view';
  }
  if (content.includes('router') || content.includes('navigate(')) {
    return '@rimitive/router';
  }
  if (content.includes('resource(') || content.includes('ResourceModule')) {
    return '@rimitive/resource';
  }
  if (content.includes('renderToString') || content.includes('hydrate')) {
    return '@rimitive/ssr';
  }
  if (content.includes('compose(') || content.includes('defineModule(')) {
    return '@rimitive/core';
  }

  return undefined;
}

/**
 * Parse embedded docs into structured sections
 */
export function parseDocs(content: string): DocSection[] {
  const lines = content.split('\n');
  const sections: DocSection[] = [];

  let currentSection: {
    title: string;
    startLine: number;
    lines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for ## header (level 2 = atomic section)
    if (line?.startsWith('## ')) {
      // Save previous section
      if (currentSection) {
        const sectionContent = currentSection.lines.join('\n').trim();
        if (sectionContent.length > 0) {
          sections.push({
            id: toKebabCase(currentSection.title),
            title: currentSection.title,
            content: sectionContent,
            type: getSectionType(currentSection.startLine),
            package: detectPackage(sectionContent),
            keywords: extractKeywords(currentSection.title, sectionContent),
          });
        }
      }

      // Start new section
      currentSection = {
        title: line.slice(3).trim(),
        startLine: i + 1, // 1-indexed
        lines: [],
      };
    } else if (currentSection) {
      currentSection.lines.push(line ?? '');
    }
  }

  // Don't forget the last section
  if (currentSection) {
    const sectionContent = currentSection.lines.join('\n').trim();
    if (sectionContent.length > 0) {
      sections.push({
        id: toKebabCase(currentSection.title),
        title: currentSection.title,
        content: sectionContent,
        type: getSectionType(currentSection.startLine),
        package: detectPackage(sectionContent),
        keywords: extractKeywords(currentSection.title, sectionContent),
      });
    }
  }

  return sections;
}
