import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSpecification } from "./normalize-specification";

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
  assert.deepEqual(result.relatedSpecifications, [
    {
      id: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
      title: { en: "prof" },
      relation: "isProfileOf",
      targetIri: "https://www.w3.org/TR/dx-prof/rdf/prof.ttl",
      label: undefined,
    },
  ]);
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
