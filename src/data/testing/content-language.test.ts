import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { publicationLanguage } from "../loading/publication-language";
import { loadSpecificationFromUrl } from "../loading/load-specification-from-url";
import { preferredContentLanguages, selectLocalizedString } from "../model/localized-string";
import { rdfToDsv } from "../semantic/application-profile/parse-application-profile";
import { parseVocabulary } from "../semantic/vocabulary/parse-vocabulary";
import { createPrimer } from "../../pages/primer/model/primer";
import { createSpecificationExplorer } from "../../pages/spec-explorer/model/specification-explorer";
import { createSpecificationOverview } from "../../pages/spec-to-spec/model/specification-overview";
import { createSpecificationBrowser } from "../../pages/spec-to-spec/model/specification-browser";

test("detects HTML language before URL hints and ignores unrelated attributes", () => {
  const url = "https://ofn.gov.cz/slovníky/2026-02-26/cs/";
  assert.equal(publicationLanguage('<html lang="en">', url), "en");
  assert.equal(publicationLanguage("<HTML LANG='cs-CZ'>", url), "cs-cz");
  assert.equal(publicationLanguage("<html lang=cs>", url), "cs");
  assert.equal(publicationLanguage('<html data-lang="en">', url), "cs");
  assert.equal(publicationLanguage('<html lang="not a language">', url), "cs");
  assert.equal(
    publicationLanguage("", "https://demo.dataspecer.com/api/preview/en/index.html?iri=123"),
    "en",
  );
  assert.equal(
    publicationLanguage("", "https://mff-uk.github.io/specifications/dcat-ap/"),
    undefined,
  );
});

test("selects regional and case-insensitive translations with nonempty fallbacks", () => {
  const value = { en: "Vocabulary", CS: "Slovník" };
  assert.equal(selectLocalizedString(value, preferredContentLanguages("cs-CZ")), "Slovník");
  assert.equal(selectLocalizedString(value, preferredContentLanguages()), "Vocabulary");
  assert.equal(
    selectLocalizedString({ cs: "", en: "Vocabulary" }, preferredContentLanguages("cs")),
    "Vocabulary",
  );
  assert.equal(
    selectLocalizedString({ und: "Unlabelled language" }, preferredContentLanguages("cs")),
    "Unlabelled language",
  );
  assert.equal(
    selectLocalizedString({ fr: "Vocabulaire" }, preferredContentLanguages("cs")),
    "Vocabulaire",
  );
});

test("publication language reaches all UI models without discarding translations", async () => {
  // Real publication and RDF structure, with controlled bilingual labels for assertions.
  const json = await readFile(new URL("./fixtures/dsv-dap.jsonld", import.meta.url), "utf8");
  const specification = await loadSpecificationFromUrl("https://example.org/en/", {
    fetch: async () =>
      new Response(`<html lang="cs"><script type="application/ld+json">${json}</script></html>`),
  });
  assert.equal(specification.metadata.language, "cs");
  const fallback = await loadSpecificationFromUrl("https://example.org/cs/", {
    fetch: async () => new Response(`<script type="application/ld+json">${json}</script>`),
  });
  assert.equal(fallback.metadata.language, "cs");
  specification.metadata.title = { cs: "Slovník", en: "Vocabulary" };
  specification.metadata.description = { cs: "Popis", en: "Description" };
  specification.artifacts[0]!.title = { cs: "Zdroj", en: "Resource" };
  specification.relatedSpecifications[0]!.title = {
    cs: "Související slovník",
    en: "Related vocabulary",
  };
  const profiles = await rdfToDsv(
    await readFile(new URL("./fixtures/dsv-dap.ttl", import.meta.url), "utf8"),
  );
  const profile = profiles.flatMap((value) => value.classProfiles)[0]!;
  profile.prefLabel = { cs: "Profil", en: "Profile" };
  profile.definition = { cs: "Definice profilu", en: "Profile definition" };
  const property = profiles.flatMap((value) => value.objectPropertyProfiles)[0]!;
  property.domainIri = profile.iri;
  property.rangeClassIri = [profile.iri];
  property.prefLabel = { cs: "Vlastnost", en: "Property" };
  property.usageNote = { cs: "Poznámka", en: "Usage note" };
  const vocabulary = await parseVocabulary(`
    @prefix owl: <http://www.w3.org/2002/07/owl#> .
    @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
    <urn:class> a owl:Class; rdfs:label "Třída"@cs, "Class"@en.
    <urn:property> a owl:ObjectProperty; rdfs:label "Odkaz"@cs, "Link"@en;
      rdfs:domain <urn:class>; rdfs:range <urn:class>.
  `);
  const semantic = {
    applicationProfiles: profiles,
    vocabularies: [vocabulary],
    sources: [],
    warnings: [],
  };
  const before = JSON.stringify({ specification, semantic });
  const explorer = createSpecificationExplorer(specification, semantic);
  const primer = createPrimer(specification, semantic);
  const overview = createSpecificationOverview(specification);
  const browser = createSpecificationBrowser(specification);
  assert.equal(explorer.title, "Slovník");
  assert.equal(primer.title, "Slovník");
  assert.equal(overview.title, "Slovník");
  assert.equal(browser.nodes[0]!.title, "Slovník");
  assert.equal(explorer.description, "Popis");
  assert.equal(overview.artifacts[0]!.title, "Zdroj");
  assert.equal(primer.resources[0]!.title, "Zdroj");
  assert.equal(browser.nodes[1]!.title, "Související slovník");
  assert.equal(explorer.classes.find((value) => value.iri === profile.iri)!.label, "Profil");
  const projected = explorer.properties.find((value) => value.iri === property.iri)!;
  assert.equal(projected.label, "Vlastnost");
  assert.equal(projected.usageNote, "Poznámka");
  assert.equal(projected.domainLabel, "Profil");
  assert.deepEqual(projected.rangeLabels, ["Profil"]);
  assert.equal(
    explorer.properties.find((value) => value.iri === "urn:property")!.domainLabel,
    "Třída",
  );
  assert.equal(primer.vocabularyClasses[0]!.label, "Třída");
  assert.equal(
    primer.classProfiles.find((value) => value.iri === profile.iri)!.description,
    "Definice profilu",
  );
  assert.equal(JSON.stringify({ specification, semantic }), before);
  const english = { ...specification, metadata: { ...specification.metadata, language: "en" } };
  assert.equal(createSpecificationExplorer(english, semantic).title, "Vocabulary");
  assert.equal(createSpecificationExplorer(specification, semantic).title, "Slovník");
});
