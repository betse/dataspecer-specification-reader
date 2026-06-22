import type { SpecificationArtifact } from "./artifact";
import type { ClassProfile } from "./class-profile";

export interface RelatedSpecification {
  id: string;
  title: string;
  relation: string;
  url?: string;
}

export interface SpecificationMetadata {
  id: string;
  title: string;
  description: string;
  iri?: string;
  version?: string;
  publisher?: string;
  license?: string;
}

export interface Specification {
  metadata: SpecificationMetadata;
  artifacts: SpecificationArtifact[];
  relatedSpecifications: RelatedSpecification[];
  classes: ClassProfile[];
}
