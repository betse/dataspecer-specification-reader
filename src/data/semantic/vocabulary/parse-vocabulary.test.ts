import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { OwlPropertyType } from "./vocabulary-model";
import { parseVocabulary } from "./parse-vocabulary";

const dsvVocabularyFixtureUrl = new URL(
  "../../testing/fixtures/dsv-model.owl.ttl",
  import.meta.url,
);

test("parses the real DSV vocabulary artifact", async () => {
  const ontology = await parseVocabulary(await readFile(dsvVocabularyFixtureUrl, "utf8"));

  assert.equal(ontology.classes.length, 10);
  assert.equal(ontology.properties.length, 15);

  const classProfile = ontology.classes.find(
    (item) => item.iri === "https://w3id.org/dsv#ClassProfile",
  );
  assert.deepEqual(classProfile?.name, { cs: "Profil třídy", en: "Class Profile" });
  assert.deepEqual(classProfile?.subClassOf, ["https://w3id.org/dsv#TermProfile"]);
  assert.equal(classProfile?.isDefinedBy, "https://w3id.org/dsv#");

  const profileOf = ontology.properties.find(
    (item) => item.iri === "https://w3id.org/dsv#profileOf",
  );
  assert.equal(profileOf?.type, OwlPropertyType.ObjectProperty);
  assert.equal(profileOf?.domain, "https://w3id.org/dsv#TermProfile");
  assert.equal(profileOf?.range, "https://w3id.org/dsv#TermProfile");
});

test("parses RDFS and OWL classes and properties", async () => {
  const ontology = await parseVocabulary(`
    @prefix ex: <https://example.com/> .
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

    ex:Parent a owl:Class ; rdfs:label "Parent"@en .
    ex:Child a owl:Class ;
      rdfs:label "Child"@en ;
      rdfs:comment "A child class."@en ;
      rdfs:subClassOf ex:Parent .

    ex:name a owl:DatatypeProperty ;
      rdfs:label "name"@en ;
      rdfs:domain ex:Child ;
      rdfs:range xsd:string .
  `);

  assert.equal(ontology.classes.length, 2);
  assert.deepEqual(
    ontology.classes.find((item) => item.iri.endsWith("Child")),
    {
      iri: "https://example.com/Child",
      name: { en: "Child" },
      description: { en: "A child class." },
      isDefinedBy: "",
      subClassOf: ["https://example.com/Parent"],
    },
  );
  assert.deepEqual(ontology.properties, [
    {
      iri: "https://example.com/name",
      name: { en: "name" },
      description: {},
      isDefinedBy: "",
      subPropertyOf: [],
      domain: "https://example.com/Child",
      range: "http://www.w3.org/2001/XMLSchema#string",
      type: OwlPropertyType.DatatypeProperty,
    },
  ]);
});
