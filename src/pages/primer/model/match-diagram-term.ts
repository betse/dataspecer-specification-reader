export interface DiagramTerm {
  iri: string;
  label: string;
}

/** Match identity, never inheritance, property text, or a substring of a label. */
export function matchDiagramTerm<T extends DiagramTerm>(
  identifiers: string[],
  heading: string,
  terms: T[],
): T | undefined {
  const ids = new Set(identifiers.map((value) => value.trim()).filter(Boolean));
  const exact = terms.filter((term) => ids.has(term.iri));
  if (exact.length) return unique(exact);
  const label = normalizeLabel(heading);
  if (!label) return undefined;
  return unique(terms.filter((term) => normalizeLabel(term.label) === label));
}

function unique<T extends DiagramTerm>(terms: T[]): T | undefined {
  return new Set(terms.map((term) => term.iri)).size === 1 ? terms[0] : undefined;
}

function normalizeLabel(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}
