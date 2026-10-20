// 测试构建期间只保留最后意图，取消或销毁的场景不能接收过时导航。
// Checks construction retains only the latest intent and cancelled/disposed scenes cannot receive stale navigation.
import { createDeferredSceneAction } from './virtual-library-deferred-action';

describe('scene navigation during construction', () => {
  it('applies only the latest early category request once the scene is ready', () => {
    const action = createDeferredSceneAction<string>();
    const focus = vi.fn();
    action.request('history');
    action.request('literature');
    action.attach(focus);
    expect(focus.mock.calls).toEqual([['literature']]);
    action.request('science');
    expect(focus.mock.calls).toEqual([['literature'], ['science']]);
  });

  it('never calls a disposed scene and carries requests across cancelled builds', () => {
    const action = createDeferredSceneAction<string>();
    const oldScene = vi.fn();
    const newScene = vi.fn();
    action.attach(oldScene);
    action.detach();
    action.request('history');
    action.detach();
    action.request('literature');
    action.attach(newScene);
    expect(oldScene).not.toHaveBeenCalled();
    expect(newScene.mock.calls).toEqual([['literature']]);
    action.detach();
    action.attach(vi.fn());
    expect(newScene).toHaveBeenCalledTimes(1);
  });
});
