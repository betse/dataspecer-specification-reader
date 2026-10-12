import assert from "node:assert/strict";
import test from "node:test";
import { loadSemanticSpecification } from "./load-semantic-specification";
import type { Specification } from "../model/specification";

const root = "https://reader.test/root/";
const parent = "https://reader.test/parent/";
const prefixes = `@prefix dsv: <https://w3id.org/dsv#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.
@prefix dct: <http://purl.org/dc/terms/>.`;
const rdf = `${prefixes}
<${root}> a dsv:ApplicationProfile.
<${root}Class> a dsv:ClassProfile; dct:isPartOf <${root}>;
 dsv:class <${parent}Class>;
 dsv:reusesPropertyValue [dsv:reusedProperty skos:definition; dsv:reusedFromResource <${parent}Class>],
 [dsv:reusedProperty skos:prefLabel; dsv:reusedFromResource <https://external.test/Term>].`;
function specification(): Specification {
  return {
    metadata: { id: root, sourceUrl: root, title: { en: "Root" }, types: [] },
    artifacts: [{ id: "rdf", title: {}, type: "rdf", url: root + "dsv.ttl" }],
    relatedSpecifications: [
      {
        id: parent,
        targetIri: parent,
        targetUrl: parent,
        title: {},
        relation: "isProfileOf",
        kind: "published-specification",
      },
      {
        id: "external",
        targetIri: "https://external.test/",
        title: {},
        relation: "isProfileOf",
        kind: "external-resource",
      },
    ],
  };
}
function parentHtml() {
  return (
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@id": parent,
      "@type": "dsv:ApplicationProfileSpecificationDocument",
      hasArtifact: "",
      inSpecificationOf: {
        "@id": parent,
        title: "Parent",
        hasResource: [
          { hasArtifact: "dsv.ttl", format: "filetype:RDF_TURTLE" },
          { hasArtifact: "dsv.ldes.ttl", format: "filetype:RDF_TURTLE" },
        ],
        isProfileOf: [{ "@id": root, hasResource: { hasArtifact: root } }],
      },
    }) +
    "</script>"
  );
}

test("resolves chained internal reuse, handles publication cycles and never fetches external terms", async () => {
  const requests: string[] = [];
  const documents = new Map([
    [root + "dsv.ttl", rdf],
    [parent, parentHtml()],
    [
      parent + "dsv.ttl",
      `${prefixes}
      <${parent}> a dsv:ApplicationProfile.
      <${parent}Class> a dsv:ClassProfile; dct:isPartOf <${parent}>;
        dsv:reusesPropertyValue [dsv:reusedProperty skos:definition; dsv:reusedFromResource <${parent}Source>].
      <${parent}Source> skos:definition "Inherited definition"@en, "Definice"@cs.`,
    ],
  ]);
  const result = await loadSemanticSpecification(specification(), {
    fetch: (async (input) => {
      const url = String(input);
      requests.push(url);
      assert.ok(documents.has(url), "Unexpected request: " + url);
      return new Response(documents.get(url));
    }) as typeof fetch,
  });
  assert.deepEqual(result.applicationProfiles[0]?.classProfiles[0]?.definition, {
    en: "Inherited definition",
    cs: "Definice",
  });
  assert.equal(result.applicationProfiles.length, 1);
  assert.equal(result.applicationProfiles[0]?.classProfiles.length, 1);
  assert.equal(new Set(requests).size, requests.length);
  assert.equal(requests.length, 3);
  assert.equal(
    result.reusedValues?.[root + "Class"]?.find((value) => value.field === "prefLabel")?.resolved,
    false,
  );
});

test("keeps the current specification usable and exposes internal loading failures", async () => {
  const result = await loadSemanticSpecification(specification(), {
    fetch: (async (input) =>
      String(input) === root + "dsv.ttl"
        ? new Response(rdf)
        : new Response("Unavailable", { status: 503 })) as typeof fetch,
  });
  assert.equal(result.applicationProfiles[0]?.classProfiles.length, 1);
  assert.ok(
    result.warnings.some(
      (warning) => warning.includes("internal specification") && warning.includes("503"),
    ),
  );
  assert.ok(result.reusedValues?.[root + "Class"]?.every((value) => !value.resolved));
});

test("terminates reuse cycles and preserves explicit profile definitions", async () => {
  const spec = specification();
  spec.relatedSpecifications = [];
  const document =
    rdf +
    `
    <${parent}Class> dsv:reusesPropertyValue [dsv:reusedProperty skos:definition; dsv:reusedFromResource <${root}Class>].`;
  const unresolved = await loadSemanticSpecification(spec, {
    fetch: (async () => new Response(document)) as typeof fetch,
  });
  assert.equal(
    unresolved.reusedValues?.[root + "Class"]?.find((value) => value.field === "definition")
      ?.resolved,
    false,
  );
  const explicit = await loadSemanticSpecification(spec, {
    fetch: (async () =>
      new Response(
        document + `\n<${root}Class> skos:definition "Local definition"@en.`,
      )) as typeof fetch,
  });
  assert.equal(
    explicit.applicationProfiles[0]?.classProfiles[0]?.definition.en,
    "Local definition",
  );
});
