// 异步世界未就绪时保留最新导航请求。
/** Keep the latest navigation request while the asynchronous world is unavailable. */
// 场景未就绪时只保留最后一个意图；挂载时消费一次，避免重放过时导航。
// Keep only the latest intent while the scene is unavailable; consume it once on attach instead of replaying stale navigation.
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
