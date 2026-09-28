import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Specification } from "../../../data/model/specification";
import { normalizeSpecification } from "../../../data/normalization/normalize-specification";
import { createSpecificationOverview } from "./specification-overview";

const dsvDapFixtureUrl = new URL("../../../data/testing/fixtures/dsv-dap.jsonld", import.meta.url);
const dsvDapSourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";

test("creates an overview from the real DSV-DAP publication", async () => {
  const fixture = JSON.parse(await readFile(dsvDapFixtureUrl, "utf8"));
  const overview = createSpecificationOverview(
    normalizeSpecification(fixture, { sourceUrl: dsvDapSourceUrl }),
  );

  assert.equal(
    overview.title,
    "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
  );
  assert.deepEqual(overview.typeLabels, ["Application Profile", "Profile"]);
  assert.deepEqual(overview.statistics, {
    internalSpecifications: 1,
    externalSpecifications: 1,
    artifacts: 11,
  });

  const artifactByTitle = new Map(overview.artifacts.map((artifact) => [artifact.title, artifact]));
  assert.equal(artifactByTitle.get("Structural model description")?.formatLabel, "TTL");
  assert.equal(artifactByTitle.get("JSON Schema")?.formatLabel, "JSON");
  assert.equal(artifactByTitle.get("JSON-LD context")?.formatLabel, "JSON-LD");
  assert.deepEqual(
    overview.relatedSpecifications.map(({ title, kind }) => ({ title, kind })),
    [
      { title: "adms", kind: "external-resource" },
      { title: "dsv", kind: "published-specification" },
    ],
  );
});

test("creates display-ready overview values without using an IRI as a relation title", () => {
  const relationIri = "https://mff-uk.github.io/data-specification-vocabulary/dsv";
  const specification: Specification = {
    metadata: {
      id: "https://example.com/profile",
      iri: "https://example.com/profile",
      title: { en: "Example profile" },
      types: ["dsv:ApplicationProfile"],
    },
    artifacts: [
      {
        id: "artifact",
        title: { en: "Vocabulary" },
        type: "rdf",
        mediaType: "text/turtle",
        url: "https://example.com/vocabulary.ttl",
      },
    ],
    relatedSpecifications: [
      {
        id: relationIri,
        title: { und: relationIri },
        relation: "isProfileOf",
        targetIri: relationIri,
        kind: "published-specification",
      },
      {
        id: "http://purl.org/dc/terms/",
        title: { en: "Dublin Core Terms" },
        relation: "conformsTo",
        targetIri: "http://purl.org/dc/terms/",
        kind: "external-resource",
      },
    ],
  };

  const overview = createSpecificationOverview(specification);

  assert.equal(overview.statistics.artifacts, 1);
  assert.equal(overview.statistics.internalSpecifications, 1);
  assert.equal(overview.statistics.externalSpecifications, 1);
  assert.equal(overview.artifacts[0]?.formatLabel, "TTL");
  assert.equal(overview.relatedSpecifications[0]?.title, "dsv");
  assert.equal(overview.relatedSpecifications[0]?.relationLabel, "Profiles");
});
