// 查询 GPU 时间时不阻塞等待，不支持计时扩展的设备继续正常渲染。
// Poll GPU timers without waiting; rendering also works without the optional extension.
export function createVirtualLibraryGpuTiming(context: WebGLRenderingContext | WebGL2RenderingContext) {
  const gl = 'beginQuery' in context ? context : null;
  const ext = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
  const pending: WebGLQuery[] = [];
  let active: WebGLQuery | null = null;
  let milliseconds = 0;
  return {
    begin() {
      if (!ext || !gl) return;
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        pending.splice(0).forEach(query => gl.deleteQuery(query));
        milliseconds = 0;
        return;
      }
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift()!;
        milliseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
        gl.deleteQuery(query);
      }
      if (pending.length >= 8) return;
      active = gl.createQuery();
      if (active) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!ext || !gl || !active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    get milliseconds() { return ext ? milliseconds : null; },
    dispose() {
      if (ext && gl && active) { gl.endQuery(ext.TIME_ELAPSED_EXT); gl.deleteQuery(active); active = null; }
      pending.splice(0).forEach(query => gl?.deleteQuery(query));
    },
  };
}
