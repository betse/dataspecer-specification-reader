import { DataFactory, Parser, Store } from "n3";
import type { TermProfile } from "./application-profile/application-profile-model";
import type { SemanticSpecification } from "./semantic-specification";

const SKOS = "http://www.w3.org/2004/02/skos/core#";
const DSV = "https://w3id.org/dsv#";
const fields = {
  prefLabel: SKOS + "prefLabel",
  definition: SKOS + "definition",
  usageNote: SKOS + "scopeNote",
} as const;

export interface ReusedValueDetail {
  field: string;
  sourceIri: string;
  resolved: boolean;
}

/** Resolves exact RDF predicates, including reuse chains, without fetching term IRIs. */
export function resolveReusedValues(
  semantic: SemanticSpecification,
  documents: Map<string, string>,
): void {
  const store = new Store();
  for (const [url, text] of documents) {
    try {
      // Separate parsers give blank nodes distinct identifiers across documents.
      store.addQuads(new Parser({ baseIRI: url }).parse(text));
    } catch {
      // Artifact loading reports parse failures; never invent values from invalid RDF.
    }
  }
  function resolve(iri: string, predicate: string, visited: Set<string>): Record<string, string> {
    const key = JSON.stringify([iri, predicate]);
    if (visited.has(key)) return {};
    const next = new Set(visited).add(key);
    const subject = DataFactory.namedNode(iri);
    const direct: Record<string, string> = {};
    for (const quad of store.getQuads(subject, DataFactory.namedNode(predicate), null, null)) {
      if (quad.object.termType === "Literal" && quad.object.value.trim()) {
        direct[quad.object.language || "und"] = quad.object.value;
      }
    }
    if (Object.keys(direct).length) return direct;
    const result: Record<string, string> = {};
    for (const reuse of store.getObjects(
      subject,
      DataFactory.namedNode(DSV + "reusesPropertyValue"),
      null,
    )) {
      const property = store.getObjects(
        reuse,
        DataFactory.namedNode(DSV + "reusedProperty"),
        null,
      )[0]?.value;
      const asProperty =
        store.getObjects(reuse, DataFactory.namedNode(DSV + "reusedAsProperty"), null)[0]?.value ??
        property;
      const source = store.getObjects(
        reuse,
        DataFactory.namedNode(DSV + "reusedFromResource"),
        null,
      )[0];
      if (asProperty === predicate && property && source?.termType === "NamedNode") {
        Object.assign(result, resolve(source.value, property, next));
      }
    }
    return result;
  }
  semantic.reusedValues = {};
  for (const application of semantic.applicationProfiles) {
    const terms: TermProfile[] = [
      ...application.classProfiles,
      ...application.datatypePropertyProfiles,
      ...application.objectPropertyProfiles,
    ];
    for (const term of terms) {
      const details: ReusedValueDetail[] = [];
      for (const [field, predicate] of Object.entries(fields) as [keyof typeof fields, string][]) {
        if (Object.values(term[field] ?? {}).some((value) => value.trim())) continue;
        const values: Record<string, string> = {};
        for (const reuse of term.reusesPropertyValue) {
          if (reuse.reusedAsPropertyIri !== predicate) continue;
          const value = resolve(
            reuse.propertyReusedFromResourceIri,
            reuse.reusedPropertyIri,
            new Set(),
          );
          Object.assign(values, value);
          details.push({
            field,
            sourceIri: reuse.propertyReusedFromResourceIri,
            resolved: Object.keys(value).length > 0,
          });
        }
        // Preserve local class names; inherited labels must not replace IRI fallbacks.
        const preserveClassLabel =
          field === "prefLabel" && application.classProfiles.some((profile) => profile === term);
        if (Object.keys(values).length && !preserveClassLabel) term[field] = values;
      }
      if (details.length) semantic.reusedValues[term.iri] = details;
    }
  }
}
