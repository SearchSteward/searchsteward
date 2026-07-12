/**
 * Lightweight, intentionally-aggressive suffix stripper for fuzzy keyword
 * matching. Not linguistically perfect — its job is to group meaning-preserving
 * variants (requirements≈requirement, managed≈management) so the resume↔JD
 * matcher credits real overlap. Dependency-free.
 */
export function stem(token: string): string {
  let w = token.toLowerCase();
  if (w.length < 4) return w;

  // plurals
  if (w.endsWith("ies") && w.length > 4) w = w.slice(0, -3) + "y";
  else if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (/(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);

  // verb endings
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);

  // nominalizers
  if (w.endsWith("ment") && w.length > 6) w = w.slice(0, -4);
  if (w.endsWith("ity") && w.length > 5) w = w.slice(0, -3);
  if (w.endsWith("ly") && w.length > 4) w = w.slice(0, -2);

  // trailing 'e' (manage->manag so it unifies with managed->manag)
  if (w.endsWith("e") && w.length > 4) w = w.slice(0, -1);

  // collapse doubled trailing consonant (plann->plan, runn->run)
  if (/([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);

  return w;
}
