/** Readability fallback only; this does not retrieve or translate a published label. */
export function propertyLabelFromIri(iri: string, domainIri?: string): string {
  const localName = (value: string) => {
    const trimmed = value.replace(/[/#]+$/, "");
    const local = trimmed.slice(Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("#")) + 1);
    try {
      return decodeURIComponent(local);
    } catch {
      return local;
    }
  };
  let name = localName(iri);
  const owner = domainIri ? localName(domainIri) : undefined;
  if (owner && name.startsWith(owner + ".")) name = name.slice(owner.length + 1);
  return (
    name
      .replace(/([\p{Lu}]+)([\p{Lu}][\p{Ll}])/gu, "$1 $2")
      .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word) => (/^\p{Lu}{2,}$/u.test(word) ? word : word.toLowerCase()))
      .join(" ")
      .trim() || iri
  );
}
