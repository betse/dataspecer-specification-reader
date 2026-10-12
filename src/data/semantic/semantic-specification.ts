import type { ApplicationProfile } from "./application-profile/application-profile-model";
import type { OwlOntology } from "./vocabulary/vocabulary-model";

import type { ReusedValueDetail } from "./resolve-reused-values";

export interface SemanticSpecification {
  reusedValues?: Record<string, ReusedValueDetail[]>;
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
