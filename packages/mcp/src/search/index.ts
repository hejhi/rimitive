import type { DocSection, SearchResult } from '../parser/types.js';

/**
 * Scoring weights for different match types
 */
const WEIGHTS = {
  titleExact: 100,
  titleWord: 20,
  keywordExact: 15,
  keywordWord: 8,
  contentExact: 5,
  contentWord: 2,
};

/**
 * Tokenize a string into lowercase words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Create a brief excerpt showing the match context
 */
function createExcerpt(content: string, query: string, maxLength = 150): string {
  const lowerContent = content.toLowerCase();

  // Find the first occurrence of any query word
  const queryWords = tokenize(query);
  let bestIndex = -1;

  for (const word of queryWords) {
    const idx = lowerContent.indexOf(word);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
    }
  }

  if (bestIndex === -1) {
    // No match found, return start of content
    return content.slice(0, maxLength).trim() + (content.length > maxLength ? '...' : '');
  }

  // Find sentence or paragraph boundaries
  const start = Math.max(0, bestIndex - 50);
  const end = Math.min(content.length, bestIndex + maxLength - 50);

  let excerpt = content.slice(start, end);

  // Clean up boundaries
  if (start > 0) {
    excerpt = '...' + excerpt.replace(/^[^\s]*\s/, '');
  }
  if (end < content.length) {
    excerpt = excerpt.replace(/\s[^\s]*$/, '') + '...';
  }

  return excerpt.trim();
}

/**
 * Calculate match score between a query and a section
 */
function scoreSection(section: DocSection, query: string): number {
  const queryLower = query.toLowerCase();
  const queryWords = tokenize(query);
  let score = 0;

  // Title scoring
  const titleLower = section.title.toLowerCase();
  if (titleLower.includes(queryLower)) {
    score += WEIGHTS.titleExact;
  }
  for (const word of queryWords) {
    if (titleLower.includes(word)) {
      score += WEIGHTS.titleWord;
    }
  }

  // Keyword scoring
  for (const keyword of section.keywords) {
    const keywordLower = keyword.toLowerCase();
    if (keywordLower === queryLower || queryLower.includes(keywordLower)) {
      score += WEIGHTS.keywordExact;
    }
    for (const word of queryWords) {
      if (keywordLower.includes(word)) {
        score += WEIGHTS.keywordWord;
      }
    }
  }

  // Content scoring
  const contentLower = section.content.toLowerCase();
  if (contentLower.includes(queryLower)) {
    score += WEIGHTS.contentExact;
  }
  for (const word of queryWords) {
    // Count occurrences (max 5 to avoid over-weighting)
    const occurrences = Math.min(
      5,
      (contentLower.match(new RegExp(word, 'g')) ?? []).length
    );
    score += occurrences * WEIGHTS.contentWord;
  }

  return score;
}

/**
 * Search documentation sections for a query
 */
export function search(
  query: string,
  sections: DocSection[],
  limit = 5
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const section of sections) {
    const score = scoreSection(section, query);
    if (score > 0) {
      results.push({
        section,
        score,
        excerpt: createExcerpt(section.content, query),
      });
    }
  }

  // Sort by score descending, then by title for ties
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.section.title.localeCompare(b.section.title);
  });

  return results.slice(0, limit);
}

/**
 * Find a section by exact ID or title match
 */
export function findSection(
  identifier: string,
  sections: DocSection[]
): DocSection | undefined {
  const identifierLower = identifier.toLowerCase();

  // Try exact ID match first
  const byId = sections.find((s) => s.id === identifierLower);
  if (byId) return byId;

  // Try exact title match
  const byTitle = sections.find(
    (s) => s.title.toLowerCase() === identifierLower
  );
  if (byTitle) return byTitle;

  // Try partial title match
  return sections.find((s) =>
    s.title.toLowerCase().includes(identifierLower)
  );
}

/**
 * Find sections related to a specific module or function name
 */
export function findModuleSection(
  name: string,
  sections: DocSection[]
): DocSection | undefined {
  const nameLower = name.toLowerCase();

  // Common aliases
  const aliases: Record<string, string[]> = {
    signal: ['signal', 'signals', 'signalmodule'],
    computed: ['computed', 'computedmodule'],
    effect: ['effect', 'effectmodule'],
    batch: ['batch', 'batchmodule'],
    compose: ['compose', 'composition'],
    el: ['el', 'element', 'createelmodule'],
    map: ['map', 'lists', 'rendering lists'],
    match: ['match', 'conditional', 'conditional rendering'],
    portal: ['portal', 'portals'],
    resource: ['resource', 'loading data'],
    router: ['router', 'routing', 'adding routing'],
    module: ['module', 'custom modules', 'definemodule'],
    behavior: ['behavior', 'behaviors', 'creating a behavior'],
  };

  // Find which group of aliases the name matches
  for (const [, terms] of Object.entries(aliases)) {
    if (terms.includes(nameLower)) {
      // Search for sections that match these terms
      for (const section of sections) {
        const titleLower = section.title.toLowerCase();
        if (terms.some((term) => titleLower.includes(term))) {
          return section;
        }
      }
    }
  }

  // Fall back to generic search
  return findSection(name, sections);
}

/**
 * Extract code examples from a section's content
 */
export function extractExamples(content: string): string[] {
  const examples: string[] = [];
  const codeBlockRegex = /```(?:typescript|ts|javascript|js)?\n([\s\S]*?)```/g;

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[1];
    if (code && code.trim().length > 0) {
      examples.push(code.trim());
    }
  }

  return examples;
}
