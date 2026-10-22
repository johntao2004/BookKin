export function matchesThema(codes: readonly string[] | undefined, filter?: string) {
  return !filter || (filter === 'UNCLASSIFIED' ? !codes?.length : codes?.some(code => code.startsWith(filter))) || false;
}
