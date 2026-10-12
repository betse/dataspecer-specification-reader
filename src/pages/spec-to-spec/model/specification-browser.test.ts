import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Specification } from "../../../data/model/specification";
import { normalizeSpecification } from "../../../data/normalization/normalize-specification";
import { createSpecificationBrowser } from "./specification-browser";

const dsvDapFixtureUrl = new URL("../../../data/testing/fixtures/dsv-dap.jsonld", import.meta.url);
const dsvDapSourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";

test("creates a specification graph from the real DSV-DAP publication", async () => {
  const fixture = JSON.parse(await readFile(dsvDapFixtureUrl, "utf8"));
  const browser = createSpecificationBrowser(
    normalizeSpecification(fixture, { sourceUrl: dsvDapSourceUrl }),
  );

  assert.deepEqual(browser.counts, { all: 2, published: 1, external: 1 });
  assert.equal(browser.nodes.length, 3);
  assert.equal(browser.edges.length, 2);
  assert.deepEqual(
    browser.nodes.map(({ graphLabel, kind }) => ({ graphLabel, kind })),
    [
      { graphLabel: "DSV-DAP", kind: "focal" },
      { graphLabel: "ADMS", kind: "external-resource" },
      { graphLabel: "DSV", kind: "published-specification" },
    ],
  );
  assert.ok(browser.edges.every((edge) => edge.label === "profiles"));
  assert.equal(browser.nodes[0]?.statistics?.artifacts, 11);
  assert.ok(browser.nodes.slice(1).every((node) => node.statistics === undefined));
});

test("creates compact graph labels without replacing full titles", () => {
  const missingTitleIri = "https://mff-uk.github.io/data-specification-vocabulary/dsv";
  const specification: Specification = {
    metadata: {
      id: "https://example.com/dsv-dap#",
      iri: "https://example.com/dsv-dap#",
      title: {
        en: "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
      },
      types: ["dsv:ApplicationProfile"],
    },
    artifacts: [],
    relatedSpecifications: [
      {
        id: "https://www.w3.org/ns/dcat",
        title: { en: "DCAT" },
        relation: "isProfileOf",
        targetIri: "https://www.w3.org/ns/dcat",
        kind: "external-resource",
      },
      {
        id: missingTitleIri,
        title: { und: missingTitleIri },
        relation: "isProfileOf",
        targetIri: missingTitleIri,
        kind: "external-resource",
      },
      {
        id: "https://mff-uk.github.io/specifications/dcat-dap#",
        title: { en: "DCAT 3 Default Application Profile" },
        relation: "isProfileOf",
        targetIri: "https://mff-uk.github.io/specifications/dcat-dap#",
        targetUrl: "https://mff-uk.github.io/specifications/dcat-dap/",
        kind: "published-specification",
      },
      {
        id: "https://example.com/eli",
        title: { en: "European Legislation Identifier" },
        label: { en: "ELI" },
        relation: "isProfileOf",
        targetIri: "https://example.com/eli",
        kind: "external-resource",
      },
    ],
  };

  const browser = createSpecificationBrowser(specification);

  assert.deepEqual(browser.nodes[0]?.statistics, {
    internalSpecifications: 1,
    externalSpecifications: 3,
    artifacts: 0,
  });
  assert.ok(browser.nodes.slice(1).every((node) => node.statistics === undefined));

  assert.deepEqual(
    browser.nodes.map(({ title, graphLabel }) => ({ title, graphLabel })),
    [
      {
        title: "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
        graphLabel: "DSV-DAP",
      },
      { title: "DCAT", graphLabel: "DCAT" },
      { title: missingTitleIri, graphLabel: "DSV" },
      { title: "DCAT 3 Default Application Profile", graphLabel: "DCAT-DAP" },
      { title: "European Legislation Identifier", graphLabel: "ELI" },
    ],
  );
});

test("uses only declared related-target types and preserves them through normalization", () => {
  const targets = [
    { "@id": "https://example.org/vocabulary", "@type": ["owl:Ontology", "prof:Profile"] },
    { "@id": "https://example.org/profile", "@type": "dsv:ApplicationProfile" },
    {
      "@id": "https://example.org/mixed",
      "@type": [
        "http://www.w3.org/2002/07/owl#Ontology",
        "https://w3id.org/dsv#ApplicationProfile",
      ],
    },
    { "@id": "https://example.org/application-profile-name-only" },
    { "@id": "https://example.org/generic", "@type": "prof:Profile" },
  ];
  const specification = normalizeSpecification({
    "@id": dsvDapSourceUrl,
    "@type": "dsv:ApplicationProfileSpecificationDocument",
    inSpecificationOf: {
      "@id": dsvDapSourceUrl + "#",
      "@type": ["owl:Ontology", "dsv:ApplicationProfile"],
      title: { en: "Test specification" },
      isProfileOf: targets.map((target) => ({
        ...target,
        hasResource: { hasArtifact: target["@id"] + "/" },
      })),
    },
  });
  assert.deepEqual(specification.relatedSpecifications[0]?.types, ["owl:Ontology", "prof:Profile"]);
  assert.equal(specification.relatedSpecifications[3]?.types, undefined);
  const browser = createSpecificationBrowser(specification);
  assert.deepEqual(
    browser.nodes.map((node) => node.kindLabel),
    [
      "Vocabulary & application profile",
      "Vocabulary",
      "Application profile",
      "Vocabulary & application profile",
      "Dataspecer specification",
      "Dataspecer specification",
    ],
  );
});
