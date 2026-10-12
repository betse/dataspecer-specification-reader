/** Prefer the HTML declaration; URL language segments are only a fallback. */
export function publicationLanguage(html: string, url: string): string | undefined {
  const root = html.replace(/<!--[\s\S]*?-->/g, "").match(/<html\b[^>]*>/i)?.[0];
  const attribute = root?.match(/\s(?:lang|xml:lang)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const declared = languageTag(attribute?.[1] ?? attribute?.[2] ?? attribute?.[3]);
  if (declared) return declared;
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean).reverse();
    return segments
      .find((segment) =>
        /^(cs|en|sk|de|fr|es|it|pt|nl|pl|uk|ru|da|sv|no|fi)(-[a-z]{2})?$/i.test(segment),
      )
      ?.toLowerCase();
  } catch {
    return undefined;
  }
}

function languageTag(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    return Intl.getCanonicalLocales(value.trim())[0]?.toLowerCase();
  } catch {
    return undefined;
  }
}
