export interface AnnotationGroupItem {
  id: string;
  type: "HIGHLIGHT" | "NOTE" | "BOOKMARK";
  quote?: string;
  locator?: string;
  note?: string;
  bookId?: string;
  createdAt: string;
  updatedAt?: string;
  style?: unknown;
  color?: unknown;
}

export interface AnnotationGroup<T> {
  annotation: T;
  ids: string[];
  notes: string[];
}

export interface AnnotationSelectionIdentity {
  quote?: string;
  locator?: string;
  bookId?: string;
}

export function annotationSelectionKey(item: AnnotationSelectionIdentity): string | undefined {
  const quote = item.quote?.trim();
  if (!item.locator?.trim() || !quote) return undefined;
  return JSON.stringify([selectionLocatorKey(item.locator), quote, item.bookId ?? null]);
}

export function sameAnnotationSelection(
  left: AnnotationSelectionIdentity,
  right: AnnotationSelectionIdentity,
): boolean {
  const leftKey = annotationSelectionKey(left);
  return leftKey !== undefined && leftKey === annotationSelectionKey(right);
}

function selectionKey(item: AnnotationGroupItem): string | undefined {
  return annotationSelectionKey(item);
}

function selectionLocatorKey(locator: string): string {
  const match = /^epubcfi\((.*)\)$/.exec(locator);
  if (!match) return locator;

  const body = match[1];
  const delimiters: number[] = [];
  let assertionDepth = 0;
  let escaped = false;
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "^") {
      escaped = true;
      continue;
    }
    if (character === "[") {
      assertionDepth += 1;
      continue;
    }
    if (character === "]") {
      assertionDepth -= 1;
      if (assertionDepth < 0) return locator;
      continue;
    }
    if (character === "," && assertionDepth === 0) delimiters.push(index);
  }
  if (escaped || assertionDepth !== 0 || delimiters.length !== 2) return locator;

  const [first, second] = delimiters;
  const common = body.slice(0, first);
  const start = body.slice(first + 1, second);
  const end = body.slice(second + 1);
  if (!common || !start || !end) return locator;
  return JSON.stringify(["epubcfi-range", common, start]);
}

function timestamp(item: AnnotationGroupItem): number {
  const parsed = Date.parse(item.updatedAt ?? item.createdAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function preferAnnotation<T extends AnnotationGroupItem>(current: T, candidate: T): T {
  if (current.type !== candidate.type) {
    return candidate.type === "NOTE" ? candidate : current;
  }
  return timestamp(candidate) > timestamp(current) ? candidate : current;
}

function noteValues<T extends AnnotationGroupItem>(items: readonly T[]): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const note = item.note?.trim();
    if (note && !seen.has(note)) {
      seen.add(note);
      notes.push(note);
    }
  }
  return notes;
}

/** Groups annotations at the same located passage while keeping bookmarks independent. */
export function groupAnnotations<T extends AnnotationGroupItem>(
  items: readonly T[],
): AnnotationGroup<T>[] {
  const groups: Array<{ key?: string; members: T[]; annotation: T }> = [];
  const byKey = new Map<string, (typeof groups)[number]>();

  for (const item of items) {
    const key = item.type === "BOOKMARK" ? undefined : selectionKey(item);
    const group = key === undefined ? undefined : byKey.get(key);
    if (group) {
      group.members.push(item);
      group.annotation = preferAnnotation(group.annotation, item);
      continue;
    }

    const created = { key, members: [item], annotation: item };
    groups.push(created);
    if (key !== undefined) byKey.set(key, created);
  }

  return groups.map(({ members, annotation }) => ({
    annotation,
    ids: members.map((item) => item.id),
    notes: noteValues(members),
  }));
}

export interface ArticleAnnotationUpsert<T> {
  annotations: T[];
  annotation: T;
  /** IDs whose persisted values changed; used to restore only this operation on failure. */
  affectedIds: string[];
  /** All records at the selected passage, for group-scoped rollback. */
  groupIds: string[];
}

function withPresentation<T extends AnnotationGroupItem>(existing: T, incoming: T): T {
  const updated = { ...existing } as T & { style?: unknown; color?: unknown };
  if (incoming.style !== undefined) updated.style = incoming.style;
  if (incoming.color !== undefined) updated.color = incoming.color;
  return updated;
}

/**
 * Upserts a reader action into one article's private reading state. The caller owns
 * content/user scoping; bookmarks and unlocated selections always remain separate.
 */
export function upsertArticleAnnotation<T extends AnnotationGroupItem>(
  annotations: readonly T[],
  incoming: T,
): ArticleAnnotationUpsert<T> {
  const current = [...annotations];
  const key = incoming.type === "BOOKMARK" ? undefined : selectionKey(incoming);
  if (key === undefined) {
    return {
      annotations: [...current, incoming],
      annotation: incoming,
      affectedIds: [incoming.id],
      groupIds: [incoming.id],
    };
  }

  const matching = current.filter((item) =>
    item.type !== "BOOKMARK" && selectionKey(item) === key,
  );
  if (matching.length === 0) {
    return {
      annotations: [...current, incoming],
      annotation: incoming,
      affectedIds: [incoming.id],
      groupIds: [...matching.map((item) => item.id), incoming.id],
    };
  }

  if (incoming.type === "NOTE") {
    const representative = groupAnnotations(matching)[0]?.annotation ?? matching[0];
    const updated = {
      ...withPresentation(representative, incoming),
      type: "NOTE",
      quote: incoming.quote ?? representative.quote,
      locator: incoming.locator ?? representative.locator,
      note: incoming.note ?? representative.note ?? "",
    } as T;
    return {
      annotations: current.flatMap((item) => {
        if (item.id === representative.id) return [updated];
        if (matching.some((member) => member.id === item.id)) return [];
        return [item];
      }),
      annotation: updated,
      affectedIds: matching.map((item) => item.id),
      groupIds: matching.map((item) => item.id),
    };
  }

  // A highlight action may refresh a passage's style, but never changes a NOTE's
  // type or content. The group representative is the newest NOTE when one exists.
  const representative = groupAnnotations(matching)[0]?.annotation ?? matching[0];
  const updated = {
    ...withPresentation(representative, incoming),
    quote: incoming.quote ?? representative.quote,
    locator: incoming.locator ?? representative.locator,
  } as T;
  return {
    annotations: current.map((item) => item.id === representative.id ? updated : item),
    annotation: updated,
    affectedIds: [representative.id],
    groupIds: matching.map((item) => item.id),
  };
}
