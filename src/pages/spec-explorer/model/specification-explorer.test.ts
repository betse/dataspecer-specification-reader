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
  ObjectPropertyProfileType,
  RequirementLevel,
  type ApplicationProfile,
} from "../../../data/semantic/application-profile/application-profile-model";
import type { SemanticSpecification } from "../../../data/semantic/semantic-specification";
import {
  OwlPropertyType,
  type OwlOntology,
} from "../../../data/semantic/vocabulary/vocabulary-model";
import { createSpecificationExplorer } from "./specification-explorer";

const dsvDapMetadataFixtureUrl = new URL(
  "../../../data/testing/fixtures/dsv-dap.jsonld",
  import.meta.url,
);
const dsvDapProfileFixtureUrl = new URL(
  "../../../data/testing/fixtures/dsv-dap.ttl",
  import.meta.url,
);
const dsvDapSourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";

test("creates an Explorer model from the real DSV-DAP publication", async () => {
  const metadataFixture = JSON.parse(await readFile(dsvDapMetadataFixtureUrl, "utf8"));
  const applicationProfiles = await rdfToDsv(await readFile(dsvDapProfileFixtureUrl, "utf8"));
  const input = normalizeSpecification(metadataFixture, { sourceUrl: dsvDapSourceUrl });
  const explorer = createSpecificationExplorer(
    input,
    semanticSpecification({ applicationProfiles }),
  );

  assert.equal(
    explorer.title,
    "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
  );
  assert.equal(explorer.iri, "https://w3id.org/dsv-dap#");
  assert.equal(explorer.classes.length, 25);
  assert.equal(explorer.properties.length, 40);

  const vocabularyProfile = explorer.classes.find(
    (value) => value.iri === "https://w3id.org/dsv-dap#Vocabulary",
  );
  assert.ok(vocabularyProfile);
  assert.equal(vocabularyProfile.kind, "class-profile");
  assert.equal(vocabularyProfile.role, "main");
  assert.deepEqual(vocabularyProfile.specializationIris, [
    "https://w3id.org/dsv-dap#SemanticDataSpecification",
  ]);
  assert.deepEqual(
    vocabularyProfile.properties.map((property) => property.iri),
    ["https://w3id.org/dsv-dap#Vocabulary.hasSpecification"],
  );
  assert.deepEqual(vocabularyProfile.backwardsAssociations, [
    {
      sourceClassIri: "https://w3id.org/dsv-dap#Term",
      sourceClassLabel: "Term",
      propertyIri: "https://w3id.org/dsv-dap#Term.isdefinedby",
      propertyLabel: "is defined by",
    },
  ]);

  const isDefinedBy = explorer.properties.find(
    (property) => property.iri === "https://w3id.org/dsv-dap#Term.isdefinedby",
  );
  assert.equal(isDefinedBy?.kind, "object");
  assert.equal(isDefinedBy?.cardinality, "1..1");
  assert.equal(isDefinedBy?.requirement, undefined);
  assert.deepEqual(isDefinedBy?.rangeLabels, ["Vocabulary"]);
});

const datasetIri = "https://example.com/vocabulary#Dataset";
const catalogIri = "https://example.com/vocabulary#Catalog";
const titleIri = "https://example.com/vocabulary#title";
const datasetPropertyIri = "https://example.com/vocabulary#dataset";
const datasetProfileIri = "https://example.com/profile/Dataset";
const titleProfileIri = "https://example.com/profile/title";

test("creates class and property profile views with vocabulary fallbacks", () => {
  const explorer = createSpecificationExplorer(
    specification(),
    semanticSpecification({
      vocabularies: [vocabulary()],
      applicationProfiles: [applicationProfile()],
      warnings: ["Example warning"],
    }),
  );

  assert.equal(explorer.title, "Example specification");
  assert.equal(explorer.iri, "https://example.com/specification");
  assert.deepEqual(explorer.warnings, ["Example warning"]);

  const datasetProfile = explorer.classes.find((value) => value.iri === datasetProfileIri);
  assert.ok(datasetProfile);
  assert.equal(datasetProfile.label, "Dataset");
  assert.equal(datasetProfile.definition, "A collection of data.");
  assert.equal(datasetProfile.usageNote, "Use this profile for published datasets.");
  assert.equal(datasetProfile.role, "main");
  assert.deepEqual(datasetProfile.hierarchy, [
    { relation: "profiles", iri: datasetIri, label: "Dataset" },
  ]);

  assert.equal(datasetProfile.properties.length, 1);
  assert.deepEqual(datasetProfile.properties[0], {
    iri: titleProfileIri,
    label: "Title",
    labelDerivedFromIri: false,
    kind: "datatype",
    definition: "A name given to a resource.",
    usageNote: undefined,
    externalDocumentationUrl: undefined,
    domainIri: datasetProfileIri,
    domainLabel: "Dataset",
    rangeIris: ["http://www.w3.org/2001/XMLSchema#string"],
    rangeLabels: ["string"],
    cardinality: "1..*",
    requirement: "mandatory",
    profiledPropertyIris: [titleIri],
    specializationIris: [],
    profileOfIris: [],
    parentPropertyIris: [],
  });
});

test("creates vocabulary hierarchy and backward object-property associations", () => {
  const explorer = createSpecificationExplorer(
    specification(),
    semanticSpecification({ vocabularies: [vocabulary()] }),
  );
  const catalog = explorer.classes.find((value) => value.iri === catalogIri);
  const dataset = explorer.classes.find((value) => value.iri === datasetIri);

  assert.ok(catalog);
  assert.ok(dataset);
  assert.equal(catalog.kind, "vocabulary-class");
  assert.deepEqual(
    catalog.properties.map((value) => value.iri),
    [datasetPropertyIri],
  );
  assert.deepEqual(dataset.hierarchy, [
    {
      relation: "subclass-of",
      iri: "https://example.com/vocabulary#Resource",
      label: "Resource",
    },
  ]);
  assert.deepEqual(dataset.backwardsAssociations, [
    {
      sourceClassIri: catalogIri,
      sourceClassLabel: "Catalog",
      propertyIri: datasetPropertyIri,
      propertyLabel: "dataset",
    },
  ]);
});

test("uses stable fallbacks when descriptive metadata is missing", () => {
  const input = specification();
  input.metadata.title = {};
  input.metadata.description = undefined;
  input.metadata.iri = undefined;

  const explorer = createSpecificationExplorer(
    input,
    semanticSpecification({
      applicationProfiles: [
        {
          ...applicationProfile(),
          classProfiles: [
            {
              ...applicationProfile().classProfiles[0],
              iri: "https://example.com/profile/UnlabelledClass",
              prefLabel: {},
              profiledClassIri: [],
            },
          ],
          datatypePropertyProfiles: [],
        },
      ],
    }),
  );

  assert.equal(explorer.title, "Untitled specification");
  assert.equal(explorer.description, "");
  assert.equal(explorer.iri, "https://example.com/source");
  assert.equal(explorer.classes[0].label, "UnlabelledClass");
});

function specification(): Specification {
  return {
    metadata: {
      id: "example",
      sourceUrl: "https://example.com/source",
      iri: "https://example.com/specification",
      title: { en: "Example specification" },
      description: { en: "An example." },
      types: [],
    },
    artifacts: [],
    relatedSpecifications: [],
  };
}

function semanticSpecification(
  overrides: Partial<SemanticSpecification> = {},
): SemanticSpecification {
  return {
    vocabularies: [],
    applicationProfiles: [],
    sources: [],
    warnings: [],
    ...overrides,
  };
}

function vocabulary(): OwlOntology {
  return {
    classes: [
      {
        iri: catalogIri,
        name: { en: "Catalog" },
        description: {},
        isDefinedBy: "https://example.com/vocabulary",
        subClassOf: [],
      },
      {
        iri: datasetIri,
        name: { en: "Dataset" },
        description: { en: "A collection of data." },
        isDefinedBy: "https://example.com/vocabulary",
        subClassOf: ["https://example.com/vocabulary#Resource"],
      },
    ],
    properties: [
      {
        iri: titleIri,
        name: { en: "Title" },
        description: { en: "A name given to a resource." },
        isDefinedBy: "https://example.com/vocabulary",
        subPropertyOf: [],
        domain: datasetIri,
        range: "http://www.w3.org/2001/XMLSchema#string",
        type: OwlPropertyType.DatatypeProperty,
      },
      {
        iri: datasetPropertyIri,
        name: { en: "dataset" },
        description: {},
        isDefinedBy: "https://example.com/vocabulary",
        subPropertyOf: [],
        domain: catalogIri,
        range: datasetIri,
        type: OwlPropertyType.ObjectProperty,
      },
    ],
  };
}

function applicationProfile(): ApplicationProfile {
  return {
    iri: "https://example.com/profile",
    externalDocumentationUrl: null,
    classProfiles: [
      {
        type: [ClassProfileType],
        iri: datasetProfileIri,
        prefLabel: {},
        definition: {},
        usageNote: { en: "Use this profile for published datasets." },
        profileOfIri: [],
        reusesPropertyValue: [],
        specializationOfIri: [],
        externalDocumentationUrl: null,
        profiledClassIri: [datasetIri],
        classRole: ClassRole.main,
      },
    ],
    datatypePropertyProfiles: [
      {
        type: [DatatypePropertyProfileType],
        iri: titleProfileIri,
        prefLabel: {},
        definition: {},
        usageNote: {},
        profileOfIri: [],
        reusesPropertyValue: [],
        specializationOfIri: [],
        externalDocumentationUrl: null,
        cardinality: Cardinality.OneToMany,
        domainIri: datasetProfileIri,
        profiledPropertyIri: [titleIri],
        requirementLevel: RequirementLevel.mandatory,
        rangeDataTypeIri: ["http://www.w3.org/2001/XMLSchema#string"],
      },
    ],
    objectPropertyProfiles: [
      {
        type: [ObjectPropertyProfileType],
        iri: "https://example.com/profile/dataset",
        prefLabel: { en: "dataset" },
        definition: {},
        usageNote: {},
        profileOfIri: [],
        reusesPropertyValue: [],
        specializationOfIri: [],
        externalDocumentationUrl: null,
        cardinality: Cardinality.ZeroToMany,
        domainIri: catalogIri,
        profiledPropertyIri: [datasetPropertyIri],
        requirementLevel: RequirementLevel.optional,
        rangeClassIri: [datasetProfileIri],
      },
    ],
  };
}

test("derives readable property labels across classes without changing IRIs or class labels", () => {
  const ap = applicationProfile();
  const base = "https://mff-uk.github.io/specifications/dcat-ap#";
  const cases = [
    ["Catalogue", "dataset", "dataset"],
    ["Catalogue", "applicableLegislation", "applicable legislation"],
    ["Catalogue", "homepage", "homepage"],
    ["Catalogue", "record", "record"],
    ["Catalogue", "service", "service"],
    ["DataService", "endpointURL", "endpoint URL"],
    ["Distribution", "access_url", "access url"],
  ];
  ap.classProfiles = [...new Set(cases.map(([owner]) => owner))].map((owner) => ({
    ...ap.classProfiles[0]!,
    iri: base + owner,
    prefLabel: {},
  }));
  const original = ap.objectPropertyProfiles[0]!;
  ap.objectPropertyProfiles = cases.map(([owner, property]) => ({
    ...original,
    iri: base + owner + "." + property,
    domainIri: base + owner,
    prefLabel: {},
    profiledPropertyIri: [],
  }));
  const semantic = semanticSpecification({ applicationProfiles: [ap] });
  const before = JSON.stringify(semantic);
  const model = createSpecificationExplorer(specification(), semantic);
  for (const [owner, property, label] of cases) {
    const iri = base + owner + "." + property;
    const result = model.properties.find((p) => p.iri === iri)!;
    assert.equal(result.label, label);
    assert.equal(result.labelDerivedFromIri, true);
    assert.ok(
      model.classes
        .find((c) => c.iri === base + owner)!
        .properties.some((p) => p.iri === iri && p.label === label),
    );
  }
  assert.equal(model.classes.find((c) => c.iri === base + "DataService")!.label, "DataService");
  assert.equal(JSON.stringify(semantic), before);
  ap.objectPropertyProfiles[0]!.prefLabel = { en: "Published label: Catalogue.dataset" };
  const labelled = createSpecificationExplorer(specification(), semantic).properties.find(
    (p) => p.iri === ap.objectPropertyProfiles[0]!.iri,
  )!;
  assert.equal(labelled.label, "Published label: Catalogue.dataset");
  assert.equal(labelled.labelDerivedFromIri, false);
});
