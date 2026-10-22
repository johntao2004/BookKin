export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const acceptsHtml = request.headers.get("accept")?.includes("text/html");

    if (response.status !== 404 || !acceptsHtml || !["GET", "HEAD"].includes(request.method)) {
      const url = new URL(request.url);
      const hashedModule = /^\/assets\/hogwarts-library\/(?:modules\/[\w-]+\.glb|materials\.gltf)$/.test(url.pathname)
        && [...url.searchParams.keys()].length === 1 && /^[a-f\d]{16}$/.test(url.searchParams.get('v') ?? '');
      const hashedTexture = /^\/assets\/hogwarts-library\/textures\/[a-f\d]{64}\.png$/.test(url.pathname) && !url.search;
      if (response.ok && ['GET', 'HEAD'].includes(request.method) && (hashedModule || hashedTexture)) {
        const headers = new Headers(response.headers); headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        return new Response(response.body, {status: response.status, headers});
      }
      return response;
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    indexUrl.search = "";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  },
};
