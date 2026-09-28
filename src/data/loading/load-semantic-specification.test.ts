import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SpecificationArtifact } from "../model/artifact";
import type { Specification } from "../model/specification";
import { loadSemanticSpecification } from "./load-semantic-specification";

const dsvVocabularyUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv/model.owl.ttl";
const dsvApplicationProfileUrl =
  "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/dsv.ttl";
const vocabularyFixtureUrl = new URL("../testing/fixtures/dsv-model.owl.ttl", import.meta.url);
const applicationProfileFixtureUrl = new URL("../testing/fixtures/dsv-dap.ttl", import.meta.url);

test("loads vocabulary artifact", async () => {
  const rdf = await readFile(vocabularyFixtureUrl, "utf8");
  const specification = createSpecification([
    rdfArtifact("dsv-vocabulary", "DSV vocabulary", dsvVocabularyUrl),
  ]);

  const result = await loadSemanticSpecification(specification, {
    fetch: mockSuccessfulFetch(dsvVocabularyUrl, rdf),
  });

  assert.equal(result.vocabularies.length, 1);
  assert.equal(result.vocabularies[0]?.classes.length, 10);
  assert.equal(result.vocabularies[0]?.properties.length, 15);
  assert.equal(result.applicationProfiles.length, 0);
  assert.deepEqual(result.sources, [
    { artifactId: "dsv-vocabulary", url: dsvVocabularyUrl, kind: "vocabulary" },
  ]);
  assert.deepEqual(result.warnings, []);
});

test("loads application-profile artifact", async () => {
  const rdf = await readFile(applicationProfileFixtureUrl, "utf8");
  const specification = createSpecification([
    rdfArtifact("dsv-dap-profile", "DSV-DAP application profile", dsvApplicationProfileUrl),
  ]);

  const result = await loadSemanticSpecification(specification, {
    fetch: mockSuccessfulFetch(dsvApplicationProfileUrl, rdf),
  });

  assert.equal(result.vocabularies.length, 0);
  assert.equal(result.applicationProfiles.length, 1);
  assert.equal(result.applicationProfiles[0]?.classProfiles.length, 25);
  assert.equal(
    (result.applicationProfiles[0]?.datatypePropertyProfiles.length ?? 0) +
      (result.applicationProfiles[0]?.objectPropertyProfiles.length ?? 0),
    40,
  );
  assert.deepEqual(result.sources, [
    {
      artifactId: "dsv-dap-profile",
      url: dsvApplicationProfileUrl,
      kind: "application-profile",
    },
  ]);
  assert.deepEqual(result.warnings, []);
});

test("reports a failed RDF artifact and does not request non-RDF resources", async () => {
  const requestedUrls: string[] = [];
  const specification = createSpecification([
    rdfArtifact("dsv-dap-profile", "DSV-DAP application profile", dsvApplicationProfileUrl),
    {
      id: "diagram",
      title: { en: "Diagram" },
      type: "svg",
      url: "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/626cb.svg",
    },
  ]);
  const fetchDocument = (async (input: string | URL | Request) => {
    requestedUrls.push(String(input));
    return new Response("Service unavailable", { status: 503 });
  }) as typeof fetch;

  const result = await loadSemanticSpecification(specification, { fetch: fetchDocument });

  assert.deepEqual(requestedUrls, [dsvApplicationProfileUrl]);
  assert.deepEqual(result.sources, [
    { artifactId: "dsv-dap-profile", url: dsvApplicationProfileUrl, kind: "unknown" },
  ]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /HTTP 503/);
});

function createSpecification(artifacts: SpecificationArtifact[]): Specification {
  return {
    metadata: {
      id: "semantic-loader-test",
      title: { en: "Semantic loader test" },
      types: [],
    },
    artifacts,
    relatedSpecifications: [],
  };
}

function rdfArtifact(id: string, title: string, url: string): SpecificationArtifact {
  return {
    id,
    title: { en: title },
    type: "rdf",
    mediaType: "filetype:RDF_TURTLE",
    url,
  };
}

function mockSuccessfulFetch(expectedUrl: string, content: string): typeof fetch {
  return (async (input: string | URL | Request) => {
    assert.equal(String(input), expectedUrl);
    return new Response(content, { status: 200 });
  }) as typeof fetch;
}
