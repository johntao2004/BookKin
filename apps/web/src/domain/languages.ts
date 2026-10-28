const LANGUAGE_TAG = /^([a-z]{2,3})(?:-[a-z0-9]{1,8})*$/i;
const LANGUAGE_SEPARATORS = /[,，、;；|/\r\n]+/;
export const MAX_SERIALIZED_LANGUAGE_LENGTH = 1024;

const englishNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "language" })
  : undefined;
const chineseNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["zh-CN"], { type: "language" })
  : undefined;

const preferredCodes = [
  "zh", "en", "ja", "ko", "fr", "de", "es", "ru", "pt", "it", "ar", "hi", "bn", "ur", "fa", "he",
  "yi", "id", "ms", "th", "vi", "tr", "nl", "sv", "no", "da", "fi", "el", "pl", "cs", "uk", "ro", "hu",
];

const iso3Aliases: Record<string, string> = {
  ara: "ar", ben: "bn", bul: "bg", bur: "my", chi: "zh", cmn: "zh", ces: "cs", cze: "cs", deu: "de", ger: "de",
  ell: "el", gre: "el", eng: "en", fas: "fa", per: "fa", fin: "fi", fra: "fr", fre: "fr", heb: "he", hin: "hi",
  ind: "id", ita: "it", jpn: "ja", kor: "ko", may: "ms", msa: "ms", dut: "nl", nld: "nl", nor: "no", pol: "pl",
  por: "pt", ron: "ro", rum: "ro", rus: "ru", spa: "es", swa: "sw", swe: "sv", tha: "th", tur: "tr", ukr: "uk",
  urd: "ur", vie: "vi", yid: "yi", zho: "zh",
};

const nameAliases: Record<string, string> = {
  chinese: "zh", "chinese (simplified)": "zh", "chinese (traditional)": "zh", mandarin: "zh", 中文: "zh", 汉语: "zh", 漢語: "zh", 汉文: "zh", "中文（简体）": "zh", "中文（繁體）": "zh", "中文（繁体）": "zh", 普通话: "zh",
  english: "en", 英文: "en", 英语: "en",
};

const rareThreeLetterCodes = [
  "akk", "ang", "arc", "ave", "cop", "egy", "enm", "fro", "frm", "gez", "got", "grc", "hit", "jbo", "non",
  "pal", "peo", "phn", "pli", "pro", "sam", "sux", "syr", "tlh", "tok", "uga",
];

function displayName(displayNames: Intl.DisplayNames | undefined, code: string): string | undefined {
  if (!displayNames) return undefined;
  try {
    return displayNames.of(code) ?? undefined;
  } catch {
    return undefined;
  }
}

function nameKey(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function canonicalLocaleLanguage(code: string): string {
  try {
    return Intl.getCanonicalLocales(code)[0]?.split("-")[0].toLocaleLowerCase() ?? code;
  } catch {
    return code;
  }
}

function twoLetterEntries(): Array<{ code: string; englishName: string; label: string }> {
  const entries: Array<{ code: string; englishName: string; label: string }> = [];
  for (let first = 97; first <= 122; first += 1) {
    for (let second = 97; second <= 122; second += 1) {
      const code = String.fromCharCode(first, second);
      if (canonicalLocaleLanguage(code) !== code) continue;
      const englishName = displayName(englishNames, code);
      const chineseName = displayName(chineseNames, code);
      if (!englishName || !chineseName || englishName.toLocaleLowerCase() === code || chineseName.toLocaleLowerCase() === code) continue;
      entries.push({
        code,
        englishName,
        label: code === "zh" ? "中文" : code === "en" ? "英文" : chineseName,
      });
    }
  }
  const preferredIndex = new Map(preferredCodes.map((code, index) => [code, index]));
  return entries.sort((left, right) => {
    const leftIndex = preferredIndex.get(left.code);
    const rightIndex = preferredIndex.get(right.code);
    if (leftIndex !== undefined || rightIndex !== undefined) {
      if (leftIndex === undefined) return 1;
      if (rightIndex === undefined) return -1;
      return leftIndex - rightIndex;
    }
    return left.label.localeCompare(right.label, "zh-CN");
  });
}

const baseLanguages = twoLetterEntries();
const baseLanguageByCode = new Map(baseLanguages.map((language) => [language.code, language]));
const canonicalByName = new Map<string, string>();
for (const language of baseLanguages) {
  for (const name of [language.label, language.englishName]) {
    const key = nameKey(name);
    if (!canonicalByName.has(key)) canonicalByName.set(key, language.code);
  }
}
for (const [name, code] of Object.entries(nameAliases)) canonicalByName.set(nameKey(name), code);

const aliasesByCode = new Map<string, string[]>();
for (const [alias, code] of Object.entries(iso3Aliases)) {
  aliasesByCode.set(code, [...(aliasesByCode.get(code) ?? []), alias]);
}

export interface LanguageOption {
  value: string;
  label: string;
  searchText: string;
}

function optionFor(code: string, englishName: string, label: string): LanguageOption {
  return {
    value: code,
    label,
    searchText: [label, englishName, code, ...(aliasesByCode.get(code) ?? [])].join(" "),
  };
}

const optionsByCode = new Map<string, LanguageOption>();
for (const language of baseLanguages) {
  optionsByCode.set(language.code, optionFor(language.code, language.englishName, language.label));
}
for (const code of rareThreeLetterCodes) {
  const englishName = displayName(englishNames, code);
  const chineseName = displayName(chineseNames, code);
  if (!englishName || !chineseName || englishName.toLocaleLowerCase() === code || chineseName.toLocaleLowerCase() === code) continue;
  optionsByCode.set(code, optionFor(code, englishName, chineseName));
}
optionsByCode.set("und", { value: "und", label: "未指定语言", searchText: "未指定语言 und" });
for (const code of rareThreeLetterCodes) {
  const option = optionsByCode.get(code);
  if (!option) continue;
  for (const name of [option.label, displayName(englishNames, code)]) {
    if (name) canonicalByName.set(nameKey(name), code);
  }
}

export const languageOptions: LanguageOption[] = [...optionsByCode.values()];

function canonicalize(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized) return "";

  const alias = canonicalByName.get(nameKey(normalized));
  if (alias) return alias;

  const tag = normalized.replace(/_/g, "-").match(LANGUAGE_TAG);
  if (!tag) return normalized;

  const code = tag[1].toLocaleLowerCase();
  if (code === "und") return "und";
  if (iso3Aliases[code]) return iso3Aliases[code];
  const canonicalCode = canonicalLocaleLanguage(code);
  if (baseLanguageByCode.has(canonicalCode)) return canonicalCode;
  if (baseLanguageByCode.has(code)) return code;

  const englishName = displayName(englishNames, code);
  const localizedName = displayName(chineseNames, code);
  const canonicalName = englishName && canonicalByName.get(nameKey(englishName));
  if (canonicalName) return canonicalName;
  const canonicalLocalizedName = localizedName && canonicalByName.get(nameKey(localizedName));
  if (canonicalLocalizedName) return canonicalLocalizedName;
  if ((englishName && englishName.toLocaleLowerCase() !== code) || (localizedName && localizedName.toLocaleLowerCase() !== code)) return canonicalCode;
  return normalized;
}

/** Parse mixed legacy language values and normalize recognized names/codes. */
export function parseLanguages(value?: string): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  const languages: string[] = [];
  for (const part of value.split(LANGUAGE_SEPARATORS)) {
    const normalized = canonicalize(part);
    if (!normalized) continue;
    const key = nameKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    languages.push(normalized);
  }
  return languages;
}

function chineseLanguageName(value: string): string {
  const code = canonicalize(value);
  if (code === "zh") return "中文";
  if (code === "en") return "英文";
  if (code === "und") return "未指定语言";
  const existingOption = optionsByCode.get(code);
  if (existingOption) return existingOption.label;
  const localizedName = displayName(chineseNames, code);
  return localizedName && localizedName.toLocaleLowerCase() !== code ? localizedName : (LANGUAGE_TAG.test(code) || /^x-/i.test(code)) ? "未识别语言" : code;
}

/** Format recognized codes and custom language names without displaying unknown code tokens. */
export function formatLanguages(value?: string): string {
  return parseLanguages(value).map(chineseLanguageName).join("、");
}

/** Serialize all selected values for the existing comma-separated API field. */
export function serializeLanguages(values: string[]): string {
  const serialized = parseLanguages(values.join(",")).join(",");
  if (serialized.length > MAX_SERIALIZED_LANGUAGE_LENGTH) {
    throw new RangeError(`Serialized languages exceed ${MAX_SERIALIZED_LANGUAGE_LENGTH} characters`);
  }
  return serialized;
}

/** Localized option for a selected legacy value, including values outside the picker catalog. */
export function languageOption(value: string, sharedLabel?: string): LanguageOption {
  const normalized = value.normalize("NFKC").trim();
  const code = canonicalize(normalized);
  const knownOption = optionsByCode.get(code);
  const label = sharedLabel?.normalize("NFKC").trim();
  if (label) {
    const englishName = displayName(englishNames, code);
    return { value: code, label, searchText: [label, englishName ?? "", code, normalized].join(" ") };
  }
  if (knownOption) return knownOption;
  // A non-code legacy value is a custom language name, so preserve it for display.
  // Short-looking unknown codes stay generic instead of being shown as invented names.
  if (normalized && !LANGUAGE_TAG.test(normalized.replace(/_/g, "-"))) {
    return { value: code, label: normalized, searchText: [normalized, code].join(" ") };
  }
  const englishName = displayName(englishNames, code);
  const localizedName = chineseLanguageName(code);
  return {
    value: code,
    label: localizedName,
    searchText: localizedName === "未识别语言" ? localizedName : [localizedName, englishName ?? "", code].join(" "),
  };
}
