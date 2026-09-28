import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Cardinality, ClassRole, RequirementLevel } from "./application-profile-model";
import { rdfToDsv } from "./parse-application-profile";

const dsvDapFixtureUrl = new URL("../../testing/fixtures/dsv-dap.ttl", import.meta.url);

test("parses the real DSV-DAP application-profile artifact", async () => {
  const profiles = await rdfToDsv(await readFile(dsvDapFixtureUrl, "utf8"));

  assert.equal(profiles.length, 1);
  const profile = profiles[0];
  assert.equal(profile?.iri, "https://w3id.org/dsv-dap#");
  assert.equal(profile?.classProfiles.length, 25);
  assert.equal(profile?.datatypePropertyProfiles.length, 10);
  assert.equal(profile?.objectPropertyProfiles.length, 30);

  const termProfile = profile?.classProfiles.find(
    (item) => item.iri === "https://w3id.org/dsv-dap#TermProfile",
  );
  assert.deepEqual(termProfile?.profiledClassIri, ["https://w3id.org/dsv#TermProfile"]);
  assert.deepEqual(termProfile?.specializationOfIri, ["https://w3id.org/dsv-dap#Term"]);
  assert.equal(termProfile?.classRole, ClassRole.main);

  const isDefinedBy = profile?.objectPropertyProfiles.find(
    (item) => item.iri === "https://w3id.org/dsv-dap#Term.isdefinedby",
  );
  assert.equal(isDefinedBy?.domainIri, "https://w3id.org/dsv-dap#Term");
  assert.deepEqual(isDefinedBy?.profiledPropertyIri, [
    "http://www.w3.org/2000/01/rdf-schema#isDefinedBy",
  ]);
  assert.deepEqual(isDefinedBy?.rangeClassIri, ["https://w3id.org/dsv-dap#Vocabulary"]);
  assert.equal(isDefinedBy?.cardinality, Cardinality.OneToOne);
  assert.equal(isDefinedBy?.requirementLevel, RequirementLevel.undefined);
});

test("parses an application profile with class and property profiles", async () => {
  const profiles = await rdfToDsv(`
    @prefix dct: <http://purl.org/dc/terms/> .
    @prefix dsv: <https://w3id.org/dsv#> .
    @prefix requirement: <https://w3id.org/dsv/requirement-level#> .
    @prefix cardinality: <https://w3id.org/dsv/cardinality#> .
    @prefix role: <https://w3id.org/dsv/class-role#> .
    @prefix skos: <http://www.w3.org/2004/02/skos/core#> .
    @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
    @prefix ex: <https://example.com/> .

    ex:profile a dsv:ApplicationProfile .

    ex:PersonProfile
      a dsv:ClassProfile ;
      dct:isPartOf ex:profile ;
      dsv:class ex:Person ;
      dsv:classRole role:main ;
      skos:prefLabel "Person profile"@en .

    ex:nameProfile
      a dsv:DatatypePropertyProfile ;
      dct:isPartOf ex:profile ;
      dsv:domain ex:PersonProfile ;
      dsv:property ex:name ;
      dsv:datatypePropertyRange xsd:string ;
      dsv:cardinality cardinality:11 ;
      dsv:requirementLevel requirement:mandatory ;
      skos:prefLabel "name"@en .
  `);

  assert.equal(profiles.length, 1);
  assert.equal(profiles[0]?.iri, "https://example.com/profile");

  const classProfile = profiles[0]?.classProfiles[0];
  assert.equal(classProfile?.iri, "https://example.com/PersonProfile");
  assert.deepEqual(classProfile?.prefLabel, { en: "Person profile" });
  assert.deepEqual(classProfile?.profiledClassIri, ["https://example.com/Person"]);
  assert.equal(classProfile?.classRole, ClassRole.main);

  const propertyProfile = profiles[0]?.datatypePropertyProfiles[0];
  assert.equal(propertyProfile?.iri, "https://example.com/nameProfile");
  assert.equal(propertyProfile?.domainIri, "https://example.com/PersonProfile");
  assert.deepEqual(propertyProfile?.profiledPropertyIri, ["https://example.com/name"]);
  assert.deepEqual(propertyProfile?.rangeDataTypeIri, ["http://www.w3.org/2001/XMLSchema#string"]);
  assert.equal(propertyProfile?.cardinality, Cardinality.OneToOne);
  assert.equal(propertyProfile?.requirementLevel, RequirementLevel.mandatory);
});
