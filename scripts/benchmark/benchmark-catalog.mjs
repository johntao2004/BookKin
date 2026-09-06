const baseUrl = process.env.BOOKKIN_BENCHMARK_URL ?? "http://127.0.0.1:8080/api/v1";
const username = process.env.BOOKKIN_BENCHMARK_USERNAME;
const password = process.env.BOOKKIN_BENCHMARK_PASSWORD;
const iterations = Number(process.env.BOOKKIN_BENCHMARK_ITERATIONS ?? 60);

if (!username || !password) {
  console.error("Set BOOKKIN_BENCHMARK_USERNAME and BOOKKIN_BENCHMARK_PASSWORD for a local benchmark account.");
  process.exit(2);
}

const cookies = new Map();
let csrf;

function absorbCookies(response) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function call(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookies.size ? { cookie: cookieHeader() } : {}),
      ...(csrf ? { [csrf.headerName]: csrf.token } : {}),
      ...init.headers,
    },
  });
  absorbCookies(response);
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: HTTP ${response.status}`);
  return response;
}

async function authenticate() {
  const response = await call("/auth/csrf");
  csrf = await response.json();
  await call("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
}

async function measure(path) {
  const samples = [];
  for (let index = 0; index < iterations + 10; index += 1) {
    const started = performance.now();
    const response = await call(path);
    await response.arrayBuffer();
    const elapsed = performance.now() - started;
    if (index >= 10) samples.push(elapsed);
  }
  return { p50: percentile(samples, 0.5), p95: percentile(samples, 0.95), max: Math.max(...samples) };
}

await authenticate();
const list = await measure("/books?limit=60");
const search = await measure(`/books?limit=60&q=${encodeURIComponent("基准藏书 050")}`);

console.table({
  list: Object.fromEntries(Object.entries(list).map(([key, value]) => [key, `${value.toFixed(1)} ms`])),
  search: Object.fromEntries(Object.entries(search).map(([key, value]) => [key, `${value.toFixed(1)} ms`])),
});

if (list.p95 > 250 || search.p95 > 500) {
  console.error(`Threshold failed: list p95=${list.p95.toFixed(1)} ms, search p95=${search.p95.toFixed(1)} ms`);
  process.exit(1);
}
