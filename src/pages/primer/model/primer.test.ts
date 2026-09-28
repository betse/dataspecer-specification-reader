import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Specification } from "../../../data/model/specification";
import { normalizeSpecification } from "../../../data/normalization/normalize-specification";
import { rdfToDsv } from "../../../data/semantic/application-profile/parse-application-profile";
import {
  Cardinality,
  ClassProfileType,
  ClassRole,
  DatatypePropertyProfileType,
  RequirementLevel,
  type ApplicationProfile,
} from "../../../data/semantic/application-profile/application-profile-model";
import type { SemanticSpecification } from "../../../data/semantic/semantic-specification";
import { OwlPropertyType } from "../../../data/semantic/vocabulary/vocabulary-model";
import { createPrimer } from "./primer";

const dsvDapMetadataFixtureUrl = new URL(
  "../../../data/testing/fixtures/dsv-dap.jsonld",
  import.meta.url,
);
const dsvDapProfileFixtureUrl = new URL(
  "../../../data/testing/fixtures/dsv-dap.ttl",
  import.meta.url,
);
const dsvDapSourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";

test("creates a Primer from the real DSV-DAP publication", async () => {
  const metadataFixture = JSON.parse(await readFile(dsvDapMetadataFixtureUrl, "utf8"));
  const applicationProfiles = await rdfToDsv(await readFile(dsvDapProfileFixtureUrl, "utf8"));
  const specification = normalizeSpecification(metadataFixture, { sourceUrl: dsvDapSourceUrl });
  const semantic: SemanticSpecification = {
    vocabularies: [],
    applicationProfiles,
    sources: [
      {
        artifactId: dsvDapSourceUrl + "dsv.ttl",
        url: dsvDapSourceUrl + "dsv.ttl",
        kind: "application-profile",
      },
    ],
    warnings: [],
  };

  const primer = createPrimer(specification, semantic);

  assert.equal(
    primer.title,
    "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
  );
  assert.equal(primer.kindLabel, "Application Profile");
  assert.deepEqual(primer.statisticItems, [
    { label: "Class profiles", value: 25 },
    { label: "Property rules", value: 40 },
    { label: "Artifacts", value: 11 },
  ]);

  const resourceByTitle = new Map(primer.resources.map((resource) => [resource.title, resource]));
  assert.equal(
    resourceByTitle.get("Structural model description")?.description,
    "Structural model of the specification published in RDF/Turtle.",
  );
  assert.equal(
    resourceByTitle.get("Generator configuration")?.description,
    "Configuration used to generate specification outputs.",
  );
  assert.equal(resourceByTitle.get("JSON-LD context")?.formatLabel, "JSON-LD");

  const term = primer.classProfiles.find((profile) => profile.iri.endsWith("#Term"));
  assert.equal(term?.label, "Term");
  assert.equal(term?.roleLabel, "Supportive class");
  assert.ok(term?.propertyProfileIris.includes("https://w3id.org/dsv-dap#Term.isdefinedby"));

  const isDefinedBy = primer.propertyProfiles.find((profile) =>
    profile.iri.endsWith("#Term.isdefinedby"),
  );
  assert.equal(isDefinedBy?.label, "is defined by");
  assert.equal(isDefinedBy?.cardinalityLabel, "1..1");
  assert.equal(isDefinedBy?.requirementLabel, undefined);
  assert.deepEqual(isDefinedBy?.rangeIris, ["https://w3id.org/dsv-dap#Vocabulary"]);
});

test("creates a Primer from currently available specification data", () => {
  const specification: Specification = {
    metadata: {
      id: "https://example.com/profile",
      iri: "https://example.com/profile",
      sourceUrl: "https://example.com/profile/",
      title: { en: "Example profile" },
      description: { en: "An example application profile." },
      types: ["dsv:ApplicationProfile"],
      version: "1.0",
      publisher: { en: "Example publisher" },
    },
    artifacts: [
      {
        id: "diagram",
        title: { en: "Conceptual diagram" },
        type: "svg",
        mediaType: "image/svg+xml",
        url: "https://example.com/diagram.svg",
      },
      {
        id: "vocabulary",
        title: { en: "RDF vocabulary" },
        type: "rdf",
        mediaType: "text/turtle",
        url: "https://example.com/vocabulary.ttl",
      },
    ],
    relatedSpecifications: [],
  };

  const primer = createPrimer(specification);

  assert.equal(primer.title, "Example profile");
  assert.equal(primer.kindLabel, "Application Profile");
  assert.equal(primer.statistics.artifacts, 2);
  assert.deepEqual(primer.badges, [{ label: "Version 1.0" }, { label: "Example publisher" }]);
  assert.deepEqual(primer.diagram, {
    title: "Conceptual diagram",
    url: "https://example.com/diagram.svg",
  });
  assert.equal(primer.resources[1]?.formatLabel, "TTL");
  assert.equal(primer.statistics.concepts, undefined);
  assert.equal(primer.statistics.propertyRules, undefined);
});

test("projects vocabulary-only semantic data", () => {
  const semantic = createSemanticSpecification({ vocabulary: true });
  const primer = createPrimer(createSpecification(), semantic);

  assert.equal(primer.vocabularyClasses[0]?.label, "Dataset");
  assert.equal(primer.vocabularyProperties[0]?.kindLabel, "Datatype property");
  assert.deepEqual(primer.statisticItems, [
    { label: "Classes", value: 1 },
    { label: "Properties", value: 1 },
    { label: "Artifacts", value: 0 },
  ]);
});

test("projects application-profile-only semantic data", () => {
  const semantic = createSemanticSpecification({ profile: true });
  const primer = createPrimer(createSpecification(), semantic);

  assert.equal(primer.classProfiles[0]?.label, "Dataset profile");
  assert.equal(primer.classProfiles[0]?.roleLabel, "Main class");
  assert.deepEqual(primer.classProfiles[0]?.propertyProfileIris, [
    "https://example.com/profile/title",
  ]);
  assert.equal(primer.propertyProfiles[0]?.requirementLabel, "Mandatory");
  assert.equal(primer.propertyProfiles[0]?.cardinalityLabel, "1..1");
  assert.deepEqual(primer.statisticItems, [
    { label: "Class profiles", value: 1 },
    { label: "Property rules", value: 1 },
    { label: "Artifacts", value: 0 },
  ]);
});

test("uses vocabulary labels for unlabeled profiles in mixed semantic data", () => {
  const semantic = createSemanticSpecification({ vocabulary: true, profile: true });
  semantic.applicationProfiles[0]!.classProfiles[0]!.prefLabel = {};
  semantic.applicationProfiles[0]!.datatypePropertyProfiles[0]!.prefLabel = {};

  const primer = createPrimer(createSpecification(), semantic);

  assert.equal(primer.classProfiles[0]?.label, "Dataset");
  assert.equal(primer.propertyProfiles[0]?.label, "Title");
  assert.deepEqual(primer.statisticItems, [
    { label: "Classes and profiles", value: 2 },
    { label: "Properties and rules", value: 2 },
    { label: "Artifacts", value: 0 },
  ]);
});

function createSpecification(): Specification {
  return {
    metadata: {
      id: "https://example.com/specification",
      iri: "https://example.com/specification",
      title: { en: "Example specification" },
      description: {},
      types: [],
    },
    artifacts: [],
    relatedSpecifications: [],
  };
}

function createSemanticSpecification(options: {
  vocabulary?: boolean;
  profile?: boolean;
}): SemanticSpecification {
  return {
    vocabularies: options.vocabulary
      ? [
          {
            classes: [
              {
                iri: "https://example.com/vocabulary/Dataset",
                name: { en: "Dataset" },
                description: { en: "A published dataset." },
                isDefinedBy: "https://example.com/vocabulary",
                subClassOf: [],
              },
            ],
            properties: [
              {
                iri: "https://example.com/vocabulary/title",
                name: { en: "Title" },
                description: {},
                isDefinedBy: "https://example.com/vocabulary",
                subPropertyOf: [],
                domain: "https://example.com/vocabulary/Dataset",
                range: "http://www.w3.org/2001/XMLSchema#string",
                type: OwlPropertyType.DatatypeProperty,
              },
            ],
          },
        ]
      : [],
    applicationProfiles: options.profile ? [createApplicationProfile()] : [],
    sources: [],
    warnings: [],
  };
}

function createApplicationProfile(): ApplicationProfile {
  return {
    iri: "https://example.com/profile",
    externalDocumentationUrl: null,
    classProfiles: [
      {
        type: [ClassProfileType],
        iri: "https://example.com/profile/Dataset",
        prefLabel: { en: "Dataset profile" },
        definition: {},
        usageNote: {},
        profileOfIri: [],
        reusesPropertyValue: [],
        specializationOfIri: [],
        externalDocumentationUrl: null,
        profiledClassIri: ["https://example.com/vocabulary/Dataset"],
        classRole: ClassRole.main,
      },
    ],
    datatypePropertyProfiles: [
      {
        type: [DatatypePropertyProfileType],
        iri: "https://example.com/profile/title",
        prefLabel: { en: "Profile title" },
        definition: {},
        usageNote: {},
        profileOfIri: [],
        reusesPropertyValue: [],
        specializationOfIri: [],
        externalDocumentationUrl: null,
        cardinality: Cardinality.OneToOne,
        domainIri: "https://example.com/profile/Dataset",
        profiledPropertyIri: ["https://example.com/vocabulary/title"],
        requirementLevel: RequirementLevel.mandatory,
        rangeDataTypeIri: ["http://www.w3.org/2001/XMLSchema#string"],
      },
    ],
    objectPropertyProfiles: [],
  };
}
