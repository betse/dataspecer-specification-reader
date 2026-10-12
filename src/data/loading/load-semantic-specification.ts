import type { SpecificationArtifact } from "../model/artifact";
import type { Specification } from "../model/specification";
import { rdfToDsv } from "../semantic/application-profile/parse-application-profile";
import type { SemanticSource, SemanticSpecification } from "../semantic/semantic-specification";
import { parseVocabulary } from "../semantic/vocabulary/parse-vocabulary";

import { loadSpecificationFromUrl } from "./load-specification-from-url";
import { resolveReusedValues } from "../semantic/resolve-reused-values";

export interface LoadSemanticSpecificationOptions {
  fetch?: typeof fetch;
}

interface ArtifactSemanticData {
  source: SemanticSource;
  vocabulary?: SemanticSpecification["vocabularies"][number];
  applicationProfiles: SemanticSpecification["applicationProfiles"];
  warnings: string[];
}

/**
 * Loads semantic vocabulary and application-profile data from the RDF
 * artifacts advertised by a specification.
 */
export async function loadSemanticSpecification(
  specification: Specification,
  options: LoadSemanticSpecificationOptions = {},
): Promise<SemanticSpecification> {
  const underlyingFetch = options.fetch ?? fetch;
  // Per-load caching avoids repeated requests without retaining failures across retries.
  const cache = new Map<string, Promise<Response>>();
  const fetchDocument: typeof fetch = async (input, init) => {
    const key = String(input);
    if (!cache.has(key)) cache.set(key, underlyingFetch(input, init));
    return (await cache.get(key)!).clone();
  };
  const documents = new Map<string, string>();
  const rdfArtifacts = specification.artifacts.filter(isCurrentSemanticArtifact);
  const artifactData = await Promise.all(
    rdfArtifacts.map((artifact) => loadArtifactData(artifact, fetchDocument, documents)),
  );

  const result: SemanticSpecification = {
    vocabularies: artifactData.flatMap((data) => (data.vocabulary ? [data.vocabulary] : [])),
    applicationProfiles: artifactData.flatMap((data) => data.applicationProfiles),
    sources: artifactData.map((data) => data.source),
    warnings: artifactData.flatMap((data) => data.warnings),
  };
  const hasReuse = result.applicationProfiles.some((profile) =>
    [
      ...profile.classProfiles,
      ...profile.datatypePropertyProfiles,
      ...profile.objectPropertyProfiles,
    ].some((term) => term.reusesPropertyValue.length > 0),
  );
  if (hasReuse) {
    const visited = new Set([specification.metadata.sourceUrl, specification.metadata.id]);
    const queue = [...specification.relatedSpecifications];
    let loaded = 0;
    for (let index = 0; index < queue.length; index++) {
      const relation = queue[index]!;
      if (relation.kind !== "published-specification") continue;
      const url = relation.targetUrl ?? relation.targetIri;
      if (visited.has(url) || visited.has(relation.targetIri)) continue;
      if (loaded >= 32) {
        result.warnings.push(
          "Internal dependency loading stopped at 32 publications; some reused values may be unavailable.",
        );
        break;
      }
      visited.add(url);
      visited.add(relation.targetIri);
      loaded++;
      try {
        const dependency = await loadSpecificationFromUrl(url, { fetch: fetchDocument });
        visited.add(dependency.metadata.id);
        const data = await Promise.all(
          dependency.artifacts
            .filter(isCurrentSemanticArtifact)
            .map((artifact) => loadArtifactData(artifact, fetchDocument, documents)),
        );
        result.warnings.push(...data.flatMap((item) => item.warnings));
        queue.push(...dependency.relatedSpecifications);
        // Dependencies provide values only: do not add their classes to the current specification.
      } catch (error) {
        result.warnings.push(
          "Unable to load internal specification " + url + ": " + errorMessage(error),
        );
      }
    }
  }
  resolveReusedValues(result, documents);
  return result;
}

/** Dataspecer's .ldes artifacts contain event versions, not current model terms. */
function isCurrentSemanticArtifact(artifact: SpecificationArtifact): boolean {
  if (artifact.type !== "rdf") return false;
  let path = artifact.url.split(/[?#]/)[0] ?? "";
  try {
    path = decodeURIComponent(new URL(artifact.url).pathname);
  } catch {
    // Retain the original path if the URL is relative or malformed.
  }
  const fileName = path.split("/").pop()?.toLowerCase() ?? "";
  return !fileName.includes(".ldes.");
}

async function loadArtifactData(
  artifact: SpecificationArtifact,
  fetchDocument: typeof fetch,
  documents: Map<string, string>,
): Promise<ArtifactSemanticData> {
  const warnings: string[] = [];
  let rdfDocument: string;

  try {
    const response = await fetchDocument(artifact.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rdfDocument = await response.text();
    documents.set(artifact.url, rdfDocument);
  } catch (error) {
    return {
      source: createSource(artifact, "unknown"),
      applicationProfiles: [],
      warnings: [`Unable to load RDF artifact ${artifact.url}: ${errorMessage(error)}`],
    };
  }

  const [vocabularyResult, profileResult] = await Promise.allSettled([
    parseVocabulary(rdfDocument),
    rdfToDsv(rdfDocument),
  ]);

  const vocabulary =
    vocabularyResult.status === "fulfilled" && hasVocabularyData(vocabularyResult.value)
      ? vocabularyResult.value
      : undefined;
  const applicationProfiles = profileResult.status === "fulfilled" ? profileResult.value : [];

  if (vocabularyResult.status === "rejected") {
    warnings.push(
      `Unable to parse vocabulary artifact ${artifact.url}: ${errorMessage(vocabularyResult.reason)}`,
    );
  }
  if (profileResult.status === "rejected") {
    warnings.push(
      `Unable to parse application-profile artifact ${artifact.url}: ${errorMessage(profileResult.reason)}`,
    );
  }

  const kind = sourceKind(Boolean(vocabulary), applicationProfiles.length > 0);
  if (kind === "unknown" && warnings.length === 0) {
    warnings.push(`No supported semantic data was found in RDF artifact ${artifact.url}.`);
  }

  return {
    source: createSource(artifact, kind),
    vocabulary,
    applicationProfiles,
    warnings,
  };
}

function hasVocabularyData(vocabulary: SemanticSpecification["vocabularies"][number]): boolean {
  return vocabulary.classes.length > 0 || vocabulary.properties.length > 0;
}

function sourceKind(
  hasVocabulary: boolean,
  hasApplicationProfile: boolean,
): SemanticSource["kind"] {
  if (hasVocabulary && hasApplicationProfile) return "mixed";
  if (hasVocabulary) return "vocabulary";
  if (hasApplicationProfile) return "application-profile";
  return "unknown";
}

function createSource(
  artifact: SpecificationArtifact,
  kind: SemanticSource["kind"],
): SemanticSource {
  return {
    artifactId: artifact.id,
    url: artifact.url,
    kind,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
