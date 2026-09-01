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
import type { SemanticSpecification } from "../../../data/semantic/semantic-specification";
import {
  OwlPropertyType,
  type OwlClass,
  type OwlProperty,
} from "../../../data/semantic/vocabulary/vocabulary-model";

export interface SpecificationExplorer {
  title: string;
  description: string;
  iri: string;
  classes: ExplorerClass[];
  properties: ExplorerProperty[];
  warnings: string[];
}

export interface ExplorerClass {
  iri: string;
  label: string;
  kind: ExplorerClassKind;
  role?: ExplorerClassRole;
  definition?: string;
  usageNote?: string;
  externalDocumentationUrl?: string;
  profiledClassIris: string[];
  profileOfIris: string[];
  specializationIris: string[];
  parentClassIris: string[];
  hierarchy: ExplorerHierarchyReference[];
  backwardsAssociations: ExplorerAssociation[];
  properties: ExplorerProperty[];
}

export type ExplorerClassKind = "class-profile" | "vocabulary-class";
export type ExplorerClassRole = "main" | "supportive";

export interface ExplorerHierarchyReference {
  relation: ExplorerHierarchyRelation;
  iri: string;
  label: string;
}

export type ExplorerHierarchyRelation = "profiles" | "specializes" | "profile-of" | "subclass-of";

export interface ExplorerAssociation {
  sourceClassIri: string;
  sourceClassLabel: string;
  propertyIri: string;
  propertyLabel: string;
}

export type ExplorerPropertyKind = "object" | "datatype" | "unknown";
export type ExplorerRequirement = "mandatory" | "recommended" | "optional";

export interface ExplorerProperty {
  iri: string;
  label: string;
  kind: ExplorerPropertyKind;
  definition?: string;
  usageNote?: string;
  externalDocumentationUrl?: string;
  domainIri?: string;
  domainLabel?: string;
  rangeIris: string[];
  rangeLabels: string[];
  cardinality?: string;
  requirement?: ExplorerRequirement;
  profiledPropertyIris: string[];
  specializationIris: string[];
  profileOfIris: string[];
  parentPropertyIris: string[];
}

export function createSpecificationExplorer(
  specification: Specification,
  semanticSpecification: SemanticSpecification,
): SpecificationExplorer {
  const vocabularyClasses = uniqueByIri(
    semanticSpecification.vocabularies.flatMap((vocabulary) => vocabulary.classes),
  );
  const vocabularyProperties = uniqueByIri(
    semanticSpecification.vocabularies.flatMap((vocabulary) => vocabulary.properties),
  );
  const classProfiles = uniqueByIri(
    semanticSpecification.applicationProfiles.flatMap((profile) => profile.classProfiles),
  );
  const propertyProfiles = uniqueByIri(
    semanticSpecification.applicationProfiles.flatMap((profile) => [
      ...profile.datatypePropertyProfiles,
      ...profile.objectPropertyProfiles,
    ]),
  );

  const vocabularyClassByIri = new Map(vocabularyClasses.map((value) => [value.iri, value]));
  const vocabularyPropertyByIri = new Map(vocabularyProperties.map((value) => [value.iri, value]));
  const labels = createLabelIndex(
    vocabularyClasses,
    vocabularyProperties,
    classProfiles,
    propertyProfiles,
  );
  const labelForIri = (iri: string) => labels.get(iri) ?? shortIriLabel(iri);

  const properties = [
    ...propertyProfiles.map((profile) =>
      createProfileProperty(profile, vocabularyPropertyByIri, labelForIri),
    ),
    ...vocabularyProperties.map((property) => createVocabularyProperty(property, labelForIri)),
  ];

  const classes = [
    ...classProfiles.map((profile) =>
      createProfileClass(profile, vocabularyClassByIri, labelForIri),
    ),
    ...vocabularyClasses.map((value) => createVocabularyClass(value, labelForIri)),
  ].map((value) => ({
    ...value,
    properties: properties.filter((property) => property.domainIri === value.iri),
  }));

  const classesWithAssociations = classes.map((value) => ({
    ...value,
    backwardsAssociations: properties.flatMap((property) =>
      property.kind === "object" &&
      property.domainIri !== undefined &&
      property.rangeIris.includes(value.iri)
        ? [
            {
              sourceClassIri: property.domainIri,
              sourceClassLabel: labelForIri(property.domainIri),
              propertyIri: property.iri,
              propertyLabel: property.label,
            },
          ]
        : [],
    ),
  }));

  return {
    title: selectLocalizedString(specification.metadata.title) ?? "Untitled specification",
    description: selectLocalizedString(specification.metadata.description) ?? "",
    iri:
      specification.metadata.iri ?? specification.metadata.sourceUrl ?? specification.metadata.id,
    classes: classesWithAssociations,
    properties,
    warnings: [...semanticSpecification.warnings],
  };
}

function createProfileClass(
  profile: ClassProfile,
  vocabularyClassByIri: Map<string, OwlClass>,
  labelForIri: (iri: string) => string,
): ExplorerClass {
  const vocabularyClass = firstReferenced(profile.profiledClassIri, vocabularyClassByIri);
  return {
    iri: profile.iri,
    label: selectLocalizedString(profile.prefLabel) ?? labelForIri(profile.iri),
    kind: "class-profile",
    role: classRole(profile.classRole),
    definition:
      selectLocalizedString(profile.definition) ??
      selectLocalizedString(vocabularyClass?.description),
    usageNote: selectLocalizedString(profile.usageNote),
    externalDocumentationUrl: profile.externalDocumentationUrl ?? undefined,
    profiledClassIris: [...profile.profiledClassIri],
    profileOfIris: [...profile.profileOfIri],
    specializationIris: [...profile.specializationOfIri],
    parentClassIris: [],
    hierarchy: [
      ...references("profiles", profile.profiledClassIri, labelForIri),
      ...references("profile-of", profile.profileOfIri, labelForIri),
      ...references("specializes", profile.specializationOfIri, labelForIri),
    ],
    backwardsAssociations: [],
    properties: [],
  };
}

function createVocabularyClass(
  value: OwlClass,
  labelForIri: (iri: string) => string,
): ExplorerClass {
  return {
    iri: value.iri,
    label: selectLocalizedString(value.name) ?? labelForIri(value.iri),
    kind: "vocabulary-class",
    definition: selectLocalizedString(value.description),
    profiledClassIris: [],
    profileOfIris: [],
    specializationIris: [],
    parentClassIris: [...value.subClassOf],
    hierarchy: references("subclass-of", value.subClassOf, labelForIri),
    backwardsAssociations: [],
    properties: [],
  };
}

function createProfileProperty(
  profile: PropertyProfile,
  vocabularyPropertyByIri: Map<string, OwlProperty>,
  labelForIri: (iri: string) => string,
): ExplorerProperty {
  const vocabularyProperty = firstReferenced(profile.profiledPropertyIri, vocabularyPropertyByIri);
  const rangeIris = isObjectPropertyProfile(profile)
    ? profile.rangeClassIri
    : isDatatypePropertyProfile(profile)
      ? profile.rangeDataTypeIri
      : [];

  return {
    iri: profile.iri,
    label: selectLocalizedString(profile.prefLabel) ?? labelForIri(profile.iri),
    kind: isObjectPropertyProfile(profile)
      ? "object"
      : isDatatypePropertyProfile(profile)
        ? "datatype"
        : "unknown",
    definition:
      selectLocalizedString(profile.definition) ??
      selectLocalizedString(vocabularyProperty?.description),
    usageNote: selectLocalizedString(profile.usageNote),
    externalDocumentationUrl: profile.externalDocumentationUrl ?? undefined,
    domainIri: profile.domainIri || undefined,
    domainLabel: profile.domainIri ? labelForIri(profile.domainIri) : undefined,
    rangeIris: [...rangeIris],
    rangeLabels: rangeIris.map(labelForIri),
    cardinality: cardinalityLabel(profile.cardinality),
    requirement: requirementLabel(profile.requirementLevel),
    profiledPropertyIris: [...profile.profiledPropertyIri],
    specializationIris: [...profile.specializationOfIri],
    profileOfIris: [...profile.profileOfIri],
    parentPropertyIris: [],
  };
}

function createVocabularyProperty(
  property: OwlProperty,
  labelForIri: (iri: string) => string,
): ExplorerProperty {
  const rangeIris = property.range ? [property.range] : [];
  return {
    iri: property.iri,
    label: selectLocalizedString(property.name) ?? labelForIri(property.iri),
    kind:
      property.type === OwlPropertyType.ObjectProperty
        ? "object"
        : property.type === OwlPropertyType.DatatypeProperty
          ? "datatype"
          : "unknown",
    definition: selectLocalizedString(property.description),
    domainIri: property.domain || undefined,
    domainLabel: property.domain ? labelForIri(property.domain) : undefined,
    rangeIris,
    rangeLabels: rangeIris.map(labelForIri),
    profiledPropertyIris: [],
    specializationIris: [],
    profileOfIris: [],
    parentPropertyIris: [...property.subPropertyOf],
  };
}

function createLabelIndex(
  classes: OwlClass[],
  properties: OwlProperty[],
  classProfiles: ClassProfile[],
  propertyProfiles: PropertyProfile[],
): Map<string, string> {
  const result = new Map<string, string>();
  for (const value of [...classes, ...properties]) {
    result.set(value.iri, selectLocalizedString(value.name) ?? shortIriLabel(value.iri));
  }
  for (const value of [...classProfiles, ...propertyProfiles]) {
    const referencedIri =
      "profiledClassIri" in value ? value.profiledClassIri[0] : value.profiledPropertyIri[0];
    result.set(
      value.iri,
      selectLocalizedString(value.prefLabel) ??
        (referencedIri ? result.get(referencedIri) : undefined) ??
        shortIriLabel(value.iri),
    );
  }
  return result;
}

function references(
  relation: ExplorerHierarchyRelation,
  iris: string[],
  labelForIri: (iri: string) => string,
): ExplorerHierarchyReference[] {
  return iris.map((iri) => ({ relation, iri, label: labelForIri(iri) }));
}

function classRole(role: ClassRole): ExplorerClassRole | undefined {
  if (role === ClassRole.main) return "main";
  if (role === ClassRole.supportive) return "supportive";
  return undefined;
}

function requirementLabel(level: RequirementLevel): ExplorerRequirement | undefined {
  if (level === RequirementLevel.mandatory) return "mandatory";
  if (level === RequirementLevel.recommended) return "recommended";
  if (level === RequirementLevel.optional) return "optional";
  return undefined;
}

function cardinalityLabel(cardinality: Cardinality | null): string | undefined {
  return cardinality?.replaceAll("n", "*").replace("-", "..");
}

function firstReferenced<T>(iris: string[], values: Map<string, T>): T | undefined {
  for (const iri of iris) {
    const value = values.get(iri);
    if (value !== undefined) return value;
  }
  return undefined;
}

function shortIriLabel(iri: string): string {
  const withoutTrailingSeparators = iri.replace(/[/#]+$/, "");
  return (
    withoutTrailingSeparators.slice(
      Math.max(
        withoutTrailingSeparators.lastIndexOf("/"),
        withoutTrailingSeparators.lastIndexOf("#"),
      ) + 1,
    ) || iri
  );
}

function uniqueByIri<T extends { iri: string }>(values: T[]): T[] {
  return [...new Map(values.map((value) => [value.iri, value])).values()];
}
