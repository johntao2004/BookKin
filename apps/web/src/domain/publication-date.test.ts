import { describe, expect, it } from "vitest";
import { formatPublicationDate, publicationMonth } from "./publication-date";

describe("publicationMonth", () => {
  it.each([
    ["2024-03", "2024-03"],
    ["2024-03-12", "2024-03"],
    ["2024-02-29", "2024-02"],
    ["2024-03-12T23:59:59+08:00", "2024-03"],
    ["2024-03-01T00:30:00-08:00", "2024-03"],
    ["2024-03-31T23:30:00+02:00", "2024-03"],
    ["2024年3月", "2024-03"],
    ["2024年2月29日", "2024-02"],
    ["0001-01", "0001-01"],
    ["9999-12", "9999-12"],
  ])("returns the known month for %s", (value, month) => {
    expect(publicationMonth(value)).toBe(month);
  });

  it.each([undefined, null, "", "2024", "2024年", "未知"])("returns no month for a value without a known month: %s", value => {
    expect(publicationMonth(value)).toBe("");
  });

  it.each([
    "0000-03",
    "10000-01",
    "2024-00",
    "2024-13",
    "2024-02-30",
    "2023-02-29",
    "1900-02-29",
    "2024-04-31",
    "2024-03-12Tnot-a-time",
    "2024年13月",
    "2024年2月30日",
  ])("rejects an invalid date: %s", value => {
    expect(publicationMonth(value)).toBe("");
  });
});

describe("formatPublicationDate", () => {
  it.each([
    ["2024-03", "2024年03月"],
    ["2024-03-12", "2024年03月"],
    ["2024-03-12T00:30:00Z", "2024年03月"],
    ["2024年3月", "2024年03月"],
    ["2024年2月29日", "2024年02月"],
    ["2024", "2024年"],
    ["2024年", "2024年"],
  ])("formats known precision for %s without inventing a month", (value, formatted) => {
    expect(formatPublicationDate(value)).toBe(formatted);
  });

  it.each([undefined, null, "", "   "])("formats an empty value as empty", value => {
    expect(formatPublicationDate(value)).toBe("");
  });

  it.each(["0000", "2024-13", "2024-02-30", "2024-03-12Tnot-a-time", "出版年份不详"])(
    "preserves an invalid or unknown legacy value: %s",
    value => {
      expect(formatPublicationDate(value)).toBe(value);
    },
  );
});
