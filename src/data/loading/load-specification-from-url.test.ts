import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import { loadSpecificationFromUrl } from "./load-specification-from-url";

const sourceUrl = "https://mff-uk.github.io/data-specification-vocabulary/dsv-dap/";
const fixtureUrl = new URL("../testing/fixtures/dsv-dap.jsonld", import.meta.url);

test("loads a published Dataspecer JSON-LD document", async (context) => {
  const jsonLd = await readFile(fixtureUrl, "utf8");
  mockFetch(context, new Response(publishedHtml(jsonLd), { status: 200 }));

  const specification = await loadSpecificationFromUrl(sourceUrl);

  assert.equal(specification.metadata.sourceUrl, sourceUrl);
  assert.equal(
    specification.metadata.title.en,
    "Data Specification Vocabulary - Default Application Profile (DSV-DAP)",
  );
  assert.ok(specification.artifacts.some((artifact) => artifact.url.endsWith("/dsv.ttl")));
  assert.ok(specification.artifacts.some((artifact) => artifact.url.endsWith("/context.jsonld")));
  assert.ok(specification.relatedSpecifications.length > 0);
});

test("reports an HTTP failure with the source URL and status", async (context) => {
  mockFetch(context, new Response("Unavailable", { status: 503 }));

  await assert.rejects(loadSpecificationFromUrl(sourceUrl), new RegExp(`${sourceUrl}: 503`));
});

test("rejects a page without embedded JSON-LD", async (context) => {
  mockFetch(context, new Response("<!doctype html><title>No metadata</title>", { status: 200 }));

  await assert.rejects(loadSpecificationFromUrl(sourceUrl), /No JSON-LD script/);
});

function publishedHtml(jsonLd: string): string {
  return `<!doctype html>
    <html lang="en">
      <head>
        <script type="application/ld+json">${jsonLd}</script>
      </head>
    </html>`;
}

function mockFetch(context: TestContext, response: Response): void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
}
