import { G6, type NetworkGraphOptions } from '@ant-design/graphs';
import { memo, useEffect, useRef, useState } from 'react';
import { _AntAlert as Alert } from '@/ui/antd';

/** Keep async layout alive until it settles, even during StrictMode or route cleanup. */
export const KnowledgeNetwork = memo(function KnowledgeNetwork({ options }: { options: NetworkGraphOptions }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let graph: InstanceType<typeof G6.Graph> | undefined;
    let rendering: Promise<void> | undefined;
    // StrictMode's probe cleanup cancels the first frame before creating a graph.
    const frame = requestAnimationFrame(() => {
      if (disposed || !container.current) return;
      const { onInit, onReady, onDestroy: _onDestroy, ...graphOptions } = options;
      void _onDestroy;
      try {
        graph = new G6.Graph({ ...graphOptions, container: container.current, autoResize: true } as ConstructorParameters<typeof G6.Graph>[0]);
        onInit?.(graph);
        rendering = graph.render();
        void rendering.then(() => { if (!disposed && graph) onReady?.(graph); }).catch(() => { if (!disposed) setFailed(true); });
      } catch { if (!disposed) setFailed(true); }
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      options.onDestroy?.();
      // Destroying during an in-flight force layout makes G6 draw into a destroyed renderer.
      if (graph) {
        const instance = graph;
        void Promise.resolve(rendering).catch(() => undefined).then(() => { if (!instance.destroyed) instance.destroy(); });
      }
    };
  }, [options]);
  return <div className="bk-knowledge-network">{failed && <Alert type="error" title="图谱画布加载失败，请刷新页面重试" />}<div ref={container} className="bk-knowledge-network-surface" /></div>;
});
