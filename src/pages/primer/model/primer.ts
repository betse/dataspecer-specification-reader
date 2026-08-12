import type { ArtifactType, SpecificationArtifact } from "../../../data/model/artifact";
import { selectLocalizedString } from "../../../data/model/localized-string";
import type { Specification } from "../../../data/model/specification";
import {
  Cardinality,
  ClassRole,
  isDatatypePropertyProfile,
  isObjectPropertyProfile,
  RequirementLevel,
  type ClassProfile,
  type PropertyProfile,
} from "../../../data/semantic/application-profile/application-profile-model";
import type {
  SemanticSource,
  SemanticSpecification,
} from "../../../data/semantic/semantic-specification";
import type { OwlClass, OwlProperty } from "../../../data/semantic/vocabulary/vocabulary-model";

export interface Primer {
  title: string;
  description: string;
  kindLabel: string;
  sourceUrl?: string;
  badges: PrimerBadge[];
  statistics: PrimerStatistics;
  statisticItems: PrimerStatistic[];
  diagram?: PrimerDiagram;
  resources: PrimerResource[];
  vocabularyClasses: PrimerVocabularyClass[];
  vocabularyProperties: PrimerVocabularyProperty[];
  classProfiles: PrimerClassProfile[];
  propertyProfiles: PrimerPropertyProfile[];
  semanticSources: PrimerSemanticSource[];
  warnings: string[];
}

export interface PrimerBadge {
  label: string;
}

export interface PrimerStatistics {
  concepts?: number;
  properties?: number;
  propertyRules?: number;
  artifacts: number;
}

export interface PrimerStatistic {
  label: string;
  value: number | "—";
}

export interface PrimerVocabularyClass {
  iri: string;
  label: string;
  description?: string;
  definedBy?: string;
  parentIris: string[];
}

export interface PrimerVocabularyProperty {
  iri: string;
  label: string;
  description?: string;
  definedBy?: string;
  domainIri?: string;
  rangeIri?: string;
  parentIris: string[];
  kindLabel: string;
}

export interface PrimerClassProfile {
  iri: string;
  label: string;
  description?: string;
  profiledClassIris: string[];
  profileOfIris: string[];
  specializationOfIris: string[];
  roleLabel?: string;
  propertyProfileIris: string[];
  externalDocumentationUrl?: string;
}

export interface PrimerPropertyProfile {
  iri: string;
  label: string;
  description?: string;
  kindLabel: string;
  domainIri?: string;
  profiledPropertyIris: string[];
  rangeIris: string[];
  profileOfIris: string[];
  specializationOfIris: string[];
  requirementLabel?: string;
  cardinalityLabel?: string;
  externalDocumentationUrl?: string;
}

export interface PrimerSemanticSource extends SemanticSource {
  kindLabel: string;
}

export interface PrimerDiagram {
  title: string;
  url: string;
}

export interface PrimerResource {
  id: string;
  title: string;
  description: string;
  type: ArtifactType;
  formatLabel: string;
  mediaType?: string;
  url: string;
}

/** Creates the display-ready model consumed by the Primer page. */
export function createPrimer(
  specification: Specification,
  semanticSpecification?: SemanticSpecification,
): Primer {
  const metadata = specification.metadata;
  const resources = specification.artifacts.map(createResource);
  const diagramResource = resources.find((resource) => resource.type === "svg");
  const semantic = createSemanticContent(semanticSpecification);

  return {
    title: selectLocalizedString(metadata.title) ?? "Untitled specification",
    description:
      selectLocalizedString(metadata.description) ??
      "No description was provided by the specification metadata.",
    kindLabel: specificationKindLabel(metadata.types),
    sourceUrl: metadata.sourceUrl ?? metadata.iri,
    badges: [
      metadata.version ? { label: `Version ${metadata.version}` } : undefined,
      localizedBadge(metadata.publisher),
      metadata.license ? { label: metadata.license } : undefined,
    ].filter((badge): badge is PrimerBadge => badge !== undefined),
    statistics: {
      concepts: semanticSpecification
        ? semantic.vocabularyClasses.length + semantic.classProfiles.length
        : undefined,
      properties: semanticSpecification ? semantic.vocabularyProperties.length : undefined,
      propertyRules: semanticSpecification ? semantic.propertyProfiles.length : undefined,
      artifacts: resources.length,
    },
    statisticItems: createStatisticItems(
      semantic,
      resources.length,
      semanticSpecification !== undefined,
    ),
    diagram: diagramResource
      ? {
          title: diagramResource.title,
          url: diagramResource.url,
        }
      : undefined,
    resources,
    ...semantic,
  };
}

interface PrimerSemanticContent {
  vocabularyClasses: PrimerVocabularyClass[];
  vocabularyProperties: PrimerVocabularyProperty[];
  classProfiles: PrimerClassProfile[];
  propertyProfiles: PrimerPropertyProfile[];
  semanticSources: PrimerSemanticSource[];
  warnings: string[];
}

function createSemanticContent(
  semanticSpecification?: SemanticSpecification,
): PrimerSemanticContent {
  if (!semanticSpecification) {
    return {
      vocabularyClasses: [],
      vocabularyProperties: [],
      classProfiles: [],
      propertyProfiles: [],
      semanticSources: [],
      warnings: [],
    };
  }

  const classes = uniqueByIri(semanticSpecification.vocabularies.flatMap((item) => item.classes));
  const properties = uniqueByIri(
    semanticSpecification.vocabularies.flatMap((item) => item.properties),
  );
  const classProfiles = uniqueByIri(
    semanticSpecification.applicationProfiles.flatMap((item) => item.classProfiles),
  );
  const propertyProfiles = uniqueByIri(
    semanticSpecification.applicationProfiles.flatMap((item) => [
      ...item.datatypePropertyProfiles,
      ...item.objectPropertyProfiles,
    ]),
  );
  const classByIri = new Map(classes.map((item) => [item.iri, item]));
  const propertyByIri = new Map(properties.map((item) => [item.iri, item]));

  return {
    vocabularyClasses: classes.map(createVocabularyClass),
    vocabularyProperties: properties.map(createVocabularyProperty),
    classProfiles: classProfiles.map((profile) =>
      createClassProfile(profile, propertyProfiles, classByIri),
    ),
    propertyProfiles: propertyProfiles.map((profile) =>
      createPropertyProfile(profile, propertyByIri),
    ),
    semanticSources: semanticSpecification.sources.map((source) => ({
      ...source,
      kindLabel: semanticSourceKindLabel(source.kind),
    })),
    warnings: [...semanticSpecification.warnings],
  };
}

function createVocabularyClass(value: OwlClass): PrimerVocabularyClass {
  return {
    iri: value.iri,
    label: selectLocalizedString(value.name) ?? shortIriLabel(value.iri),
    description: selectLocalizedString(value.description),
    definedBy: value.isDefinedBy || undefined,
    parentIris: value.subClassOf,
  };
}

function createVocabularyProperty(value: OwlProperty): PrimerVocabularyProperty {
  return {
    iri: value.iri,
    label: selectLocalizedString(value.name) ?? shortIriLabel(value.iri),
    description: selectLocalizedString(value.description),
    definedBy: value.isDefinedBy || undefined,
    domainIri: value.domain || undefined,
    rangeIri: value.range || undefined,
    parentIris: value.subPropertyOf,
    kindLabel: value.type?.replace(/Property$/, " property") ?? "Property",
  };
}

function createClassProfile(
  profile: ClassProfile,
  propertyProfiles: PropertyProfile[],
  classByIri: Map<string, OwlClass>,
): PrimerClassProfile {
  const vocabularyClass = profile.profiledClassIri.map((iri) => classByIri.get(iri)).find(Boolean);

  return {
    iri: profile.iri,
    label:
      selectLocalizedString(profile.prefLabel) ??
      selectLocalizedString(vocabularyClass?.name) ??
      shortIriLabel(profile.iri),
    description:
      selectLocalizedString(profile.definition) ??
      selectLocalizedString(vocabularyClass?.description),
    profiledClassIris: profile.profiledClassIri,
    profileOfIris: profile.profileOfIri,
    specializationOfIris: profile.specializationOfIri,
    roleLabel: classRoleLabel(profile.classRole),
    propertyProfileIris: propertyProfiles
      .filter((property) => property.domainIri === profile.iri)
      .map((property) => property.iri),
    externalDocumentationUrl: profile.externalDocumentationUrl ?? undefined,
  };
}

function createPropertyProfile(
  profile: PropertyProfile,
  propertyByIri: Map<string, OwlProperty>,
): PrimerPropertyProfile {
  const vocabularyProperty = profile.profiledPropertyIri
    .map((iri) => propertyByIri.get(iri))
    .find(Boolean);

  return {
    iri: profile.iri,
    label:
      selectLocalizedString(profile.prefLabel) ??
      selectLocalizedString(vocabularyProperty?.name) ??
      shortIriLabel(profile.iri),
    description:
      selectLocalizedString(profile.definition) ??
      selectLocalizedString(vocabularyProperty?.description),
    kindLabel: isObjectPropertyProfile(profile) ? "Object property" : "Datatype property",
    domainIri: profile.domainIri || undefined,
    profiledPropertyIris: profile.profiledPropertyIri,
    rangeIris: isObjectPropertyProfile(profile)
      ? profile.rangeClassIri
      : isDatatypePropertyProfile(profile)
        ? profile.rangeDataTypeIri
        : [],
    profileOfIris: profile.profileOfIri,
    specializationOfIris: profile.specializationOfIri,
    requirementLabel: requirementLevelLabel(profile.requirementLevel),
    cardinalityLabel: cardinalityLabel(profile.cardinality),
    externalDocumentationUrl: profile.externalDocumentationUrl ?? undefined,
  };
}

function createStatisticItems(
  semantic: PrimerSemanticContent,
  artifactCount: number,
  hasSemanticResult: boolean,
): PrimerStatistic[] {
  if (!hasSemanticResult) {
    return [
      { label: "Key concepts", value: "—" },
      { label: "Property rules", value: "—" },
      { label: "Artifacts", value: artifactCount },
    ];
  }

  const hasVocabulary =
    semantic.vocabularyClasses.length > 0 || semantic.vocabularyProperties.length > 0;
  const hasProfiles = semantic.classProfiles.length > 0 || semantic.propertyProfiles.length > 0;

  if (hasVocabulary && !hasProfiles) {
    return [
      { label: "Classes", value: semantic.vocabularyClasses.length },
      { label: "Properties", value: semantic.vocabularyProperties.length },
      { label: "Artifacts", value: artifactCount },
    ];
  }
  if (hasProfiles && !hasVocabulary) {
    return [
      { label: "Class profiles", value: semantic.classProfiles.length },
      { label: "Property rules", value: semantic.propertyProfiles.length },
      { label: "Artifacts", value: artifactCount },
    ];
  }

  return [
    {
      label: "Classes and profiles",
      value: semantic.vocabularyClasses.length + semantic.classProfiles.length,
    },
    {
      label: "Properties and rules",
      value: semantic.vocabularyProperties.length + semantic.propertyProfiles.length,
    },
    { label: "Artifacts", value: artifactCount },
  ];
}

function uniqueByIri<T extends { iri: string }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.iri, value])).values()];
}

function shortIriLabel(iri: string): string {
  const withoutTrailingSlash = iri.replace(/\/$/, "");
  const fragment = withoutTrailingSlash.split(/[/#]/).pop();
  if (!fragment) return "Unnamed term";

  try {
    return decodeURIComponent(fragment).replace(/[-_]+/g, " ");
  } catch {
    return fragment.replace(/[-_]+/g, " ");
  }
}

function semanticSourceKindLabel(kind: SemanticSource["kind"]): string {
  const labels: Record<SemanticSource["kind"], string> = {
    vocabulary: "Vocabulary",
    "application-profile": "Application profile",
    mixed: "Vocabulary and application profile",
    unknown: "Unknown RDF content",
  };
  return labels[kind];
}

function classRoleLabel(role: ClassRole): string | undefined {
  if (role === ClassRole.main) return "Main class";
  if (role === ClassRole.supportive) return "Supportive class";
  return undefined;
}

function requirementLevelLabel(level: RequirementLevel): string | undefined {
  if (level === RequirementLevel.mandatory) return "Mandatory";
  if (level === RequirementLevel.optional) return "Optional";
  if (level === RequirementLevel.recommended) return "Recommended";
  return undefined;
}

function cardinalityLabel(cardinality: Cardinality | null): string | undefined {
  if (!cardinality) return undefined;
  const [minimum, maximum] = cardinality.split("-");
  return `${minimum === "n" ? "*" : minimum}..${maximum === "n" ? "*" : maximum}`;
}

function localizedBadge(
  value: Parameters<typeof selectLocalizedString>[0],
): PrimerBadge | undefined {
  const label = selectLocalizedString(value);
  return label ? { label } : undefined;
}

function createResource(artifact: SpecificationArtifact): PrimerResource {
  return {
    id: artifact.id,
    title: selectLocalizedString(artifact.title) ?? resourceTypeLabel(artifact.type),
    description: resourceDescription(artifact.type),
    type: artifact.type,
    formatLabel: artifactFormatLabel(artifact),
    mediaType: artifact.mediaType,
    url: artifact.url,
  };
}

function artifactFormatLabel(artifact: SpecificationArtifact): string {
  const value = `${artifact.mediaType ?? ""} ${artifact.url}`.toLowerCase();

  if (artifact.type === "rdf" && (value.includes("turtle") || value.endsWith(".ttl"))) {
    return "TTL";
  }
  if (artifact.type === "json-schema") return "JSON Schema";
  if (artifact.type === "xml-schema") return "XSD";
  return artifact.type.toUpperCase();
}

function resourceDescription(type: ArtifactType): string {
  const descriptions: Record<ArtifactType, string> = {
    html: "Human-readable specification document.",
    rdf: "Semantic RDF representation of the specification.",
    svg: "Visual diagram published with the specification.",
    shacl: "SHACL validation constraints.",
    "json-schema": "JSON Schema representation.",
    "xml-schema": "XML Schema representation.",
    other: "Additional resource published with the specification.",
  };

  return descriptions[type];
}

function resourceTypeLabel(type: ArtifactType): string {
  return type.replace(/-/g, " ").replace(/^./, (character) => character.toUpperCase());
}

function specificationKindLabel(types: string[]): string {
  if (types.some((type) => type.includes("ApplicationProfile"))) {
    return "Application Profile";
  }
  if (types.some((type) => type.includes("Vocabulary") || type.includes("Ontology"))) {
    return "Vocabulary";
  }
  return "Specification";
}
