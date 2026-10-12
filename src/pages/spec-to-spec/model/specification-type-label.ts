/** Only explicit specification types establish the reader-facing kind. */
export function specificationTypeLabel(types: string[]): string | undefined {
  const vocabulary = types.some((type) =>
    ["owl:Ontology", "http://www.w3.org/2002/07/owl#Ontology"].includes(type),
  );
  const applicationProfile = types.some((type) =>
    ["dsv:ApplicationProfile", "https://w3id.org/dsv#ApplicationProfile"].includes(type),
  );
  if (vocabulary && applicationProfile) return "Vocabulary & application profile";
  if (vocabulary) return "Vocabulary";
  if (applicationProfile) return "Application profile";
  return undefined;
}
