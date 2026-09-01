import type { SpecificationArtifact } from "../model/artifact";
import type { Specification } from "../model/specification";
import { rdfToDsv } from "../semantic/application-profile/parse-application-profile";
import type { SemanticSource, SemanticSpecification } from "../semantic/semantic-specification";
import { parseVocabulary } from "../semantic/vocabulary/parse-vocabulary";

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
  const fetchDocument = options.fetch ?? fetch;
  const rdfArtifacts = specification.artifacts.filter((artifact) => artifact.type === "rdf");
  const artifactData = await Promise.all(
    rdfArtifacts.map((artifact) => loadArtifactData(artifact, fetchDocument)),
  );

  return {
    vocabularies: artifactData.flatMap((data) => (data.vocabulary ? [data.vocabulary] : [])),
    applicationProfiles: artifactData.flatMap((data) => data.applicationProfiles),
    sources: artifactData.map((data) => data.source),
    warnings: artifactData.flatMap((data) => data.warnings),
  };
}

async function loadArtifactData(
  artifact: SpecificationArtifact,
  fetchDocument: typeof fetch,
): Promise<ArtifactSemanticData> {
  const warnings: string[] = [];
  let rdfDocument: string;

  try {
    const response = await fetchDocument(artifact.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    rdfDocument = await response.text();
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
