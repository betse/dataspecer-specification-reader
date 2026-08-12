import type { ApplicationProfile } from "./application-profile/application-profile-model";
import type { OwlOntology } from "./vocabulary/vocabulary-model";

export interface SemanticSpecification {
  vocabularies: OwlOntology[];
  applicationProfiles: ApplicationProfile[];
  sources: SemanticSource[];
  warnings: string[];
}

export interface SemanticSource {
  artifactId: string;
  url: string;
  kind: "vocabulary" | "application-profile" | "mixed" | "unknown";
}
