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
