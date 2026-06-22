export type ArtifactType =
  | "html"
  | "rdf"
  | "svg"
  | "shacl"
  | "json-schema"
  | "xml-schema"
  | "other";

export interface SpecificationArtifact {
  id: string;
  title: string;
  type: ArtifactType;
  url: string;
}
