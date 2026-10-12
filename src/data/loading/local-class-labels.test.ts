import assert from "node:assert/strict";
import test from "node:test";
import { rdfToDsv } from "../semantic/application-profile/parse-application-profile";
import { resolveReusedValues } from "../semantic/resolve-reused-values";
import { createSpecificationExplorer } from "../../pages/spec-explorer/model/specification-explorer";
import type { SemanticSpecification } from "../semantic/semantic-specification";

test("keeps distinct local class names while resolving shared parent definitions", async () => {
  const base = "https://ofn.gov.cz/dcat-ap-cz-datová-rozhraní#";
  const parent = "https://ofn.gov.cz/dcat-ap-cz#Koncept";
  const names = ["Koncept", "TémaEuroVoc", "DatovéTéma", "Explicit"];
  const rdf = `@prefix dsv: <https://w3id.org/dsv#>.
    @prefix skos: <http://www.w3.org/2004/02/skos/core#>.
    @prefix dct: <http://purl.org/dc/terms/>.
    <${base}> a dsv:ApplicationProfile.
    ${names
      .map(
        (name) => `<${base + name}> a dsv:ClassProfile;
      dct:isPartOf <${base}>; dsv:class <${parent}>;
      dsv:reusesPropertyValue [dsv:reusedProperty skos:prefLabel; dsv:reusedFromResource <${parent}>],
      [dsv:reusedProperty skos:definition; dsv:reusedFromResource <${parent}>].`,
      )
      .join("\n")}
    <${base}Explicit> skos:prefLabel "Published local name"@en.`;
  const semantic: SemanticSpecification = {
    applicationProfiles: await rdfToDsv(rdf),
    vocabularies: [],
    sources: [],
    warnings: [],
  };
  resolveReusedValues(
    semantic,
    new Map([
      ["https://reader.test/current.ttl", rdf],
      [
        "https://reader.test/parent.ttl",
        `<${parent}> <http://www.w3.org/2004/02/skos/core#prefLabel> "Concept"@en;
      <http://www.w3.org/2004/02/skos/core#definition> "Inherited definition"@en.`,
      ],
    ]),
  );
  const model = createSpecificationExplorer(
    { metadata: { id: base, title: {}, types: [] }, artifacts: [], relatedSpecifications: [] },
    semantic,
  );
  for (const name of names) {
    const value = model.classes.find((item) => item.iri === base + name)!;
    assert.equal(value.label, name === "Explicit" ? "Published local name" : name);
    assert.equal(value.definition, "Inherited definition");
  }
  assert.equal(model.classes.length, names.length);
});
