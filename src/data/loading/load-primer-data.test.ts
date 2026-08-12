import assert from "node:assert/strict";
import test from "node:test";
import type { Specification } from "../model/specification";
import { loadPrimerData } from "./load-primer-data";

const mixedRdf = `
  @prefix dct: <http://purl.org/dc/terms/> .
  @prefix dsv: <https://w3id.org/dsv#> .
  @prefix owl: <http://www.w3.org/2002/07/owl#> .
  @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
  @prefix ex: <https://example.com/> .

  ex:Person a owl:Class ; rdfs:label "Person"@en .
  ex:profile a dsv:ApplicationProfile .
  ex:PersonProfile
    a dsv:ClassProfile ;
    dct:isPartOf ex:profile ;
    dsv:class ex:Person .
`;

test("loads mixed Primer data while preserving an RDF artifact failure as a warning", async () => {
  const specification: Specification = {
    metadata: {
      id: "specification",
      title: { en: "Example" },
      types: [],
    },
    artifacts: [
      {
        id: "mixed",
        title: { en: "Semantic model" },
        type: "rdf",
        url: "https://example.com/model.ttl",
      },
      {
        id: "missing",
        title: { en: "Missing model" },
        type: "rdf",
        url: "https://example.com/missing.ttl",
      },
      {
        id: "diagram",
        title: { en: "Diagram" },
        type: "svg",
        url: "https://example.com/diagram.svg",
      },
    ],
    relatedSpecifications: [],
  };
  const requestedUrls: string[] = [];
  const fetchDocument = (async (input: string | URL | Request) => {
    const url = String(input);
    requestedUrls.push(url);

    if (url.endsWith("missing.ttl")) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(mixedRdf, { status: 200 });
  }) as typeof fetch;

  const result = await loadPrimerData(specification, { fetch: fetchDocument });

  assert.deepEqual(requestedUrls, [
    "https://example.com/model.ttl",
    "https://example.com/missing.ttl",
  ]);
  assert.equal(result.vocabularies.length, 1);
  assert.equal(result.vocabularies[0]?.classes[0]?.iri, "https://example.com/Person");
  assert.equal(result.applicationProfiles.length, 1);
  assert.equal(result.applicationProfiles[0]?.classProfiles.length, 1);
  assert.deepEqual(result.sources, [
    {
      artifactId: "mixed",
      url: "https://example.com/model.ttl",
      kind: "mixed",
    },
    {
      artifactId: "missing",
      url: "https://example.com/missing.ttl",
      kind: "unknown",
    },
  ]);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0] ?? "", /HTTP 404/);
});
