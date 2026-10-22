/** Shared diagnostic model independent of transport and authentication contexts. */
export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string,
    public readonly traceId?: string) { super(message); }
}
