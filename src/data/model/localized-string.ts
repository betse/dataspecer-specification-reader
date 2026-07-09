/**
 * Text value keyed by language tag.
 *
 * Dataspecer JSON-LD often publishes language maps such as
 * `{ "en": "Title", "cs": "Název" }`. This type preserves all available
 * language variants instead of choosing one during normalization.
 */
export type LocalizedString = Record<string, string>;

/** Language tag used when a string has no declared language. */
const fallbackLanguage = "und";

/** Default language priority used when the UI needs one display string. */
const defaultPreferredLanguages = ["en", "cs", fallbackLanguage];

/** Wraps a plain string in a localized value. */
export function localizedString(value: string, language = fallbackLanguage): LocalizedString {
  return { [language]: value };
}

/**
 * Chooses one display value from a localized string.
 *
 * The data model keeps all languages. This helper is only for presentation
 * places that need a single string, such as headings or list labels.
 */
export function selectLocalizedString(
  value: LocalizedString | undefined,
  preferredLanguages = defaultPreferredLanguages,
): string | undefined {
  if (!value) {
    return undefined;
  }

  for (const language of preferredLanguages) {
    if (value[language]) {
      return value[language];
    }
  }

  return Object.values(value)[0];
}
