import N3 from "n3";
import { stringN3ToRdf } from "../rdf/parse-rdf";
import {
  type LanguageString,
  type OwlClass,
  type OwlOntology,
  type OwlProperty,
  OwlPropertyType,
} from "./vocabulary-model";
import { OWL, RDF, RDFS, SCHEMAORG, SKOS, XSD_PREFIX } from "./vocabulary-terms";

const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_IS_DEFINED_BY = "http://www.w3.org/2000/01/rdf-schema#isDefinedBy";

/** Parses an RDFS/OWL vocabulary document into the copied lightweight OWL model. */
export async function parseVocabulary(rdfDocument: string): Promise<OwlOntology> {
  return parseVocabularyFromQuads(await stringN3ToRdf(rdfDocument));
}

/** Extracts vocabulary classes and properties from already parsed RDF quads. */
export function parseVocabularyFromQuads(quads: N3.Quad[]): OwlOntology {
  const quadsBySubject = indexQuadsBySubject(quads);
  const classIris = resourcesWithTypes(quads, [RDFS.Class, OWL.Class]);
  const propertyIris = resourcesWithTypes(quads, [
    RDF.property,
    OWL.ObjectProperty,
    OWL.DatatypeProperty,
  ]);

  for (const quad of quads) {
    if (quad.predicate.value === RDFS.subClassOf && quad.subject.termType === "NamedNode") {
      classIris.add(quad.subject.value);
    }
  }

  return {
    classes: [...classIris].map((iri) => createClass(iri, quadsBySubject)),
    properties: [...propertyIris].map((iri) => createProperty(iri, quadsBySubject)),
  };
}

function createClass(iri: string, index: Map<string, N3.Quad[]>): OwlClass {
  const quads = index.get(iri) ?? [];

  return {
    iri,
    name: firstLanguageString(quads, [RDFS_LABEL, SKOS.prefLabel]),
    description: firstLanguageString(quads, [RDFS_COMMENT, SKOS.definition]),
    isDefinedBy: firstNamedNodeValue(quads, [RDFS_IS_DEFINED_BY]) ?? "",
    subClassOf: namedNodeValues(quads, [RDFS.subClassOf]),
  };
}

function createProperty(iri: string, index: Map<string, N3.Quad[]>): OwlProperty {
  const quads = index.get(iri) ?? [];
  const range = firstNamedNodeValue(quads, [RDFS.range, SCHEMAORG.rangeIncludes]) ?? OWL.Thing;

  return {
    iri,
    name: firstLanguageString(quads, [RDFS_LABEL, SKOS.prefLabel]),
    description: firstLanguageString(quads, [RDFS_COMMENT, SKOS.definition]),
    isDefinedBy: firstNamedNodeValue(quads, [RDFS_IS_DEFINED_BY]) ?? "",
    subPropertyOf: namedNodeValues(quads, [RDFS.subPropertyOf]),
    domain: firstNamedNodeValue(quads, [RDFS.domain, SCHEMAORG.domainIncludes]) ?? OWL.Thing,
    range,
    type: propertyType(quads, range),
  };
}

function propertyType(quads: N3.Quad[], range: string): OwlPropertyType | null {
  const types = new Set(namedNodeValues(quads, [RDF.type]));

  if (types.has(OWL.DatatypeProperty)) return OwlPropertyType.DatatypeProperty;
  if (types.has(OWL.ObjectProperty)) return OwlPropertyType.ObjectProperty;
  if (isDatatype(range)) return OwlPropertyType.DatatypeProperty;
  return null;
}

function isDatatype(iri: string): boolean {
  return iri.startsWith(XSD_PREFIX) || iri === RDFS.Literal || iri === RDF.langString;
}

function indexQuadsBySubject(quads: N3.Quad[]): Map<string, N3.Quad[]> {
  const result = new Map<string, N3.Quad[]>();

  for (const quad of quads) {
    if (quad.subject.termType !== "NamedNode") continue;
    const subjectQuads = result.get(quad.subject.value) ?? [];
    subjectQuads.push(quad);
    result.set(quad.subject.value, subjectQuads);
  }

  return result;
}

function resourcesWithTypes(quads: N3.Quad[], types: string[]): Set<string> {
  const acceptedTypes = new Set(types);
  const result = new Set<string>();

  for (const quad of quads) {
    if (
      quad.predicate.value === RDF.type &&
      quad.subject.termType === "NamedNode" &&
      quad.object.termType === "NamedNode" &&
      acceptedTypes.has(quad.object.value)
    ) {
      result.add(quad.subject.value);
    }
  }

  return result;
}

function firstLanguageString(quads: N3.Quad[], predicates: string[]): LanguageString {
  for (const predicate of predicates) {
    const result: LanguageString = {};

    for (const quad of quads) {
      if (quad.predicate.value === predicate && quad.object.termType === "Literal") {
        result[quad.object.language || "und"] = quad.object.value;
      }
    }

    if (Object.keys(result).length > 0) return result;
  }

  return {};
}

function namedNodeValues(quads: N3.Quad[], predicates: string[]): string[] {
  const acceptedPredicates = new Set(predicates);

  return [
    ...new Set(
      quads
        .filter(
          (quad) =>
            acceptedPredicates.has(quad.predicate.value) && quad.object.termType === "NamedNode",
        )
        .map((quad) => quad.object.value),
    ),
  ];
}

function firstNamedNodeValue(quads: N3.Quad[], predicates: string[]): string | undefined {
  return namedNodeValues(quads, predicates)[0];
}
