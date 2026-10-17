interface ConceptCandidate {
  iri: string;
  role?: "main" | "supportive";
}

/** Main concepts first; diagram order then source order within each priority group. */
export function selectKeyConcepts<T extends ConceptCandidate>(
  concepts: T[],
  diagramIris: string[],
  limit: number,
): T[] {
  const byIri = new Map(concepts.map((concept) => [concept.iri, concept]));
  const order = [...new Set([...diagramIris, ...concepts.map((concept) => concept.iri)])];
  const ordered = order.flatMap((iri) => {
    const concept = byIri.get(iri);
    return concept ? [concept] : [];
  });
  return [
    ...ordered.filter((concept) => concept.role === "main"),
    ...ordered.filter((concept) => concept.role !== "main"),
  ].slice(0, Math.max(0, limit));
}
