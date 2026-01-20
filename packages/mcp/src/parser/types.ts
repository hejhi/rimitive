/**
 * A section of documentation parsed from llms-full.txt
 */
export interface DocSection {
  /** Kebab-case identifier derived from the title */
  id: string;
  /** Original header text */
  title: string;
  /** Full section content including code blocks */
  content: string;
  /** Type of documentation section */
  type: 'overview' | 'guide' | 'api';
  /** Package this section relates to, if any */
  package?: string;
  /** Keywords extracted for search */
  keywords: string[];
}

/**
 * Result from searching documentation
 */
export interface SearchResult {
  /** The matching section */
  section: DocSection;
  /** Relevance score (higher is better) */
  score: number;
  /** Brief excerpt showing the match */
  excerpt: string;
}
