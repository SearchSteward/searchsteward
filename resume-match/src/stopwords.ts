/** Common English stopwords, lowercased. Used by the resume-match engine to
 * drop noise tokens before scoring. Intentionally small and dependency-free. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by",
  "for", "from", "had", "has", "have", "he", "her", "his", "i", "in", "into",
  "is", "it", "its", "of", "on", "or", "our", "she", "so", "such", "that",
  "the", "their", "them", "then", "there", "these", "they", "this", "to",
  "was", "we", "were", "what", "when", "which", "who", "will", "with", "would",
  "you", "your", "about", "above", "after", "again", "all", "am", "any",
  "because", "before", "below", "between", "both", "can", "did", "do", "does",
  "doing", "down", "during", "each", "few", "further", "here", "how", "if",
  "more", "most", "no", "nor", "not", "now", "off", "once", "only", "other",
  "out", "over", "own", "same", "should", "some", "than", "too", "under",
  "until", "up", "very", "while", "why",
]);

/** Generic JD scaffolding stripped from the scored keyword set. NOT domain
 *  terms — genuine jargon a candidate lacks should still register as missing. */
export const JD_FILLER: ReadonlySet<string> = new Set([
  "experience", "experienced", "ability", "able", "year", "years", "preferred",
  "required", "require", "plus", "including", "include", "related", "strong",
  "excellent", "etc", "eg", "ie", "work", "working", "role", "roles", "team",
  "teams", "environment", "responsibilities", "responsibility", "skill", "skills",
  "knowledge", "understanding", "proficiency", "demonstrated", "proven", "must",
  "will", "you", "your", "our", "we", "us", "the", "and", "or", "with", "within",
  "across", "other", "others", "new", "using", "use", "used", "help", "various",
]);
