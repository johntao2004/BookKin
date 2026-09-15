/** Keep the latest navigation request while the asynchronous world is unavailable. */
export function createDeferredSceneAction<T>() {
  let handler: ((value: T) => void) | undefined;
  let pending: { value: T } | undefined;
  return {
    request(value: T) {
      if (handler) handler(value);
      else pending = { value };
    },
    attach(next: (value: T) => void) {
      handler = next;
      const request = pending;
      pending = undefined;
      if (request) next(request.value);
    },
    detach() {
      handler = undefined;
    },
  };
}
