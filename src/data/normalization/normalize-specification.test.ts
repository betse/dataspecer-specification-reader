import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { normalizeSpecification } from "./normalize-specification";

const dsvDapFixtureUrl = new URL("../testing/fixtures/dsv-dap.jsonld", import.meta.url);

test("normalizes real DSV-DAP publication metadata", async () => {
  const fixture = JSON.parse(await readFile(dsvDapFixtureUrl, "utf8"));
  const sourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";

  const result = normalizeSpecification(fixture, { sourceUrl });

  assert.equal(result.metadata.id, "https://w3id.org/dsv-dap#");
  assert.equal(
    result.metadata.title.en,
    "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
  );
  assert.deepEqual(result.metadata.types, ["dsv:ApplicationProfile", "prof:Profile"]);

  const artifactByFile = new Map(
    result.artifacts.map((artifact) => [artifact.url.split("/").pop(), artifact]),
  );
  assert.equal(artifactByFile.get("structure.ttl")?.title.und, "Structural model description");
  assert.equal(
    artifactByFile.get("generator-configuration.ttl")?.title.und,
    "Generator configuration",
  );
  assert.equal(artifactByFile.get("schema.json")?.type, "json-schema");
  assert.equal(artifactByFile.get("context.jsonld")?.type, "json-ld");

  assert.deepEqual(
    result.relatedSpecifications.map((relation) => relation.kind),
    ["external-resource", "published-specification"],
  );
});

test("normalizes a Dataspecer application profile JSON-LD document", () => {
  const result = normalizeSpecification(
    {
      "@id": "https://example.com/specifications/dcat-ap/",
      "@type": "dsv:ApplicationProfileSpecificationDocument",
      hasRole: "role:specification",
      format: "text/html",
      hasArtifact: "",
      inSpecificationOf: {
        "@id": "https://example.com/specifications/dcat-ap",
        "@type": "dsv:ApplicationProfile",
        title: {
          en: "DCAT Application Profile",
        },
        description: "Application profile for data catalogs.",
        publisher: {
          name: "Example Publisher",
        },
        license: {
          "@id": "https://creativecommons.org/licenses/by/4.0/",
        },
        hasResource: [
          {
            "@id": "resource-shacl",
            hasRole: "role:constraints",
            format: "application/shacl+turtle",
            hasArtifact: "shacl.ttl",
          },
          {
            "@id": "resource-diagram",
            hasRole: "role:guidance",
            format: "image/svg+xml",
            hasArtifact: "diagram.svg",
          },
        ],
        isProfileOf: {
          "@id": "https://www.w3.org/ns/dcat",
          title: "DCAT",
        },
      },
    },
    { sourceUrl: "https://example.com/specifications/dcat-ap/" },
  );

  assert.deepEqual(result.metadata, {
    id: "https://example.com/specifications/dcat-ap",
    sourceUrl: "https://example.com/specifications/dcat-ap/",
    iri: "https://example.com/specifications/dcat-ap",
    title: { en: "DCAT Application Profile" },
    description: { und: "Application profile for data catalogs." },
    types: ["dsv:ApplicationProfile"],
    version: undefined,
    publisher: { und: "Example Publisher" },
    license: "https://creativecommons.org/licenses/by/4.0/",
  });

  assert.deepEqual(result.artifacts, [
    {
      id: "resource-shacl",
      title: { und: "SHACL constraints" },
      type: "shacl",
      mediaType: "application/shacl+turtle",
      url: "https://example.com/specifications/dcat-ap/shacl.ttl",
    },
    {
      id: "resource-diagram",
      title: { und: "Diagram" },
      type: "svg",
      mediaType: "image/svg+xml",
      url: "https://example.com/specifications/dcat-ap/diagram.svg",
    },
    {
      id: "https://example.com/specifications/dcat-ap/",
      title: { und: "Specification document" },
      type: "html",
      mediaType: "text/html",
      url: "https://example.com/specifications/dcat-ap/",
    },
  ]);

  assert.deepEqual(result.relatedSpecifications, [
    {
      id: "https://www.w3.org/ns/dcat",
      title: { und: "DCAT" },
      relation: "isProfileOf",
      targetIri: "https://www.w3.org/ns/dcat",
      targetUrl: undefined,
      kind: "external-resource",
      label: undefined,
    },
  ]);
});

test("normalizes a Dataspecer vocabulary JSON-LD document", () => {
  const result = normalizeSpecification(
    {
      "@id": "https://w3id.org/dsv/",
      "@type": [
        "dsv:VocabularySpecificationDocument",
        "adms:AssetDistribution",
        "prof:ResourceDescriptor",
      ],
      hasArtifact: "",
      hasRole: "role:specification",
      format: "filetype:HTML",
      inSpecificationOf: [
        {
          "@id": "https://w3id.org/dsv#",
          "@type": ["owl:Ontology", "prof:Profile"],
          title: {
            en: "Data Specification Vocabulary (DSV)",
          },
          description: {
            en: "This specification defines terms needed to describe application profiles,",
          },
          isProfileOf: [
            {
              title: {
                en: "prof",
              },
              hasResource: {
                hasArtifact: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
              },
            },
          ],
          hasResource: [
            {
              hasArtifact: "./model.owl.ttl",
              hasRole: "role:vocabulary",
              format: "filetype:RDF_TURTLE",
            },
            {
              hasArtifact: "./c5d2ee2e-32c6-4c12-abb3-b80410162920.svg",
              hasRole: "role:guidance",
              format: "filetype:SVG",
            },
          ],
        },
      ],
    },
    { sourceUrl: "https://mff-uk.github.io/data-specification-vocabulary/dsv/" },
  );

  assert.equal(result.metadata.id, "https://w3id.org/dsv#");
  assert.deepEqual(result.metadata.title, { en: "Data Specification Vocabulary (DSV)" });
  assert.deepEqual(result.metadata.description, {
    en: "This specification defines terms needed to describe application profiles,",
  });
  assert.deepEqual(result.metadata.types, ["owl:Ontology", "prof:Profile"]);
  assert.deepEqual(
    result.artifacts.map((artifact) => artifact.type),
    ["rdf", "svg", "html"],
  );
  assert.equal(result.artifacts[0]?.title.und, "Vocabulary");
  assert.deepEqual(result.relatedSpecifications, [
    {
      id: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
      title: { en: "prof" },
      relation: "isProfileOf",
      targetIri: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
      targetUrl: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
      kind: "external-resource",
      label: undefined,
    },
  ]);
});

test("distinguishes published specifications from external relation resources", () => {
  const result = normalizeSpecification({
    "@id": "https://example.com/profile/",
    "@type": "dsv:ApplicationProfileSpecificationDocument",
    hasRole: "role:specification",
    hasArtifact: "https://example.com/profile/",
    inSpecificationOf: {
      "@id": "https://example.com/profile#",
      title: "Example profile",
      isProfileOf: [
        {
          "@id": "https://example.com/base#",
          title: "Published base profile",
          hasResource: {
            hasArtifact: "https://example.com/base/",
          },
        },
        {
          title: "External vocabulary",
          hasResource: {
            hasArtifact: "https://example.com/vocabulary.ttl",
          },
        },
      ],
    },
  });

  assert.deepEqual(
    result.relatedSpecifications.map(({ targetIri, targetUrl, kind }) => ({
      targetIri,
      targetUrl,
      kind,
    })),
    [
      {
        targetIri: "https://example.com/base#",
        targetUrl: "https://example.com/base/",
        kind: "published-specification",
      },
      {
        targetIri: "https://example.com/vocabulary.ttl",
        targetUrl: "https://example.com/vocabulary.ttl",
        kind: "external-resource",
      },
    ],
  );
});

test("throws when JSON-LD does not provide a specification title", () => {
  assert.throws(
    () =>
      normalizeSpecification({
        "@id": "https://example.com/specifications/untitled",
        "@type": "dsv:ApplicationProfileSpecificationDocument",
      }),
    /missing a title/,
  );
});
