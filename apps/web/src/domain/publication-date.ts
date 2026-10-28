type ParsedPublicationDate = {
  year: string;
  month?: string;
};

function parseYear(value: string): number | undefined {
  if (!/^\d{4}$/.test(value)) return undefined;
  const year = Number(value);
  return year >= 1 && year <= 9999 ? year : undefined;
}

function parseCalendarDate(yearValue: string, monthValue?: string, dayValue?: string): ParsedPublicationDate | undefined {
  const year = parseYear(yearValue);
  if (year === undefined) return undefined;

  if (monthValue === undefined) return { year: yearValue };

  if (!/^\d{1,2}$/.test(monthValue)) return undefined;
  const month = Number(monthValue);
  if (month < 1 || month > 12) return undefined;

  if (dayValue !== undefined) {
    if (!/^\d{1,2}$/.test(dayValue)) return undefined;
    const day = Number(dayValue);
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]!;
    if (day < 1 || day > daysInMonth) return undefined;
  }

  return { year: yearValue, month: String(month).padStart(2, "0") };
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isValidIsoTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return false;

  const [, hour, minute, second, , offsetHour, offsetMinute] = match;
  if (Number(hour) > 23 || Number(minute) > 59 || (second !== undefined && Number(second) > 59)) return false;
  if (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59)) return false;
  return true;
}

function parsePublicationDate(value: string): ParsedPublicationDate | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;

  const yearOnly = /^(\d{4})$/.exec(normalized) ?? /^(\d{4})年$/.exec(normalized);
  if (yearOnly) return parseCalendarDate(yearOnly[1]!);

  const isoYearMonth = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (isoYearMonth) return parseCalendarDate(isoYearMonth[1]!, isoYearMonth[2]!);

  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})T(.+)$/.exec(normalized);
  if (isoDateTime && isValidIsoTime(isoDateTime[4]!)) {
    return parseCalendarDate(isoDateTime[1]!, isoDateTime[2]!, isoDateTime[3]!);
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoDate) return parseCalendarDate(isoDate[1]!, isoDate[2]!, isoDate[3]!);

  const chineseDate = /^(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?$/.exec(normalized);
  if (chineseDate) return parseCalendarDate(chineseDate[1]!, chineseDate[2], chineseDate[3]);

  return undefined;
}

/** Returns a normalized YYYY-MM only when the source contains a valid month. */
export function publicationMonth(value?: string | null): string {
  if (value == null) return "";
  const parsed = parsePublicationDate(value);
  return parsed?.month ? `${parsed.year}-${parsed.month}` : "";
}

/** Formats known publication precision for display and leaves unknown legacy text intact. */
export function formatPublicationDate(value?: string | null): string {
  if (value == null || !value.trim()) return "";
  const parsed = parsePublicationDate(value);
  if (!parsed) return value;
  return parsed.month ? `${parsed.year}年${parsed.month}月` : `${parsed.year}年`;
}
