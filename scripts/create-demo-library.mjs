import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const targetRoot = resolve(process.argv[2] ?? join(projectDirectory, ".local/library"));
const coverDirectory = join(projectDirectory, "apps/web/public/covers");

const chapter = [
  "黄昏从山脊落下来时，河面先暗了一层。远处最后一班渡船收起绳索，木桨在水里划出细长的纹路，像有人把一天的光慢慢折进书页。",
  "顾远沿着旧石阶往上走。背包里只有一册地图、一支铅笔和那封没有署名的信。他已经走了七天，仍不知道写信的人为何只留下三个字：去灯下。",
  "山里的灯并不多。每隔很远，才有一扇窗在暮色里亮起。那一点暖黄既不催促，也不挽留，只安静地告诉路上的人：这里有人生活过，今晚也仍会有人守着火。",
  "转过最后一道弯，他看见湖边的屋子。屋檐压得很低，枫叶落满台阶。一位老人站在门口，像已经等了许多年，又像只是刚刚听见脚步声。",
  "信带来了吗？老人问。顾远点头，却没有立刻把信递出去。河谷里起了风，灯影在水面轻轻摇晃。他忽然明白，有些路不是为了抵达，而是让人终于愿意打开一直不敢读的那一页。",
];

// The default demo catalog only contains books with polished, embedded covers.
// Text-only PDF fixtures render their first white page as a cover and must not be seeded here.
const books = [
  ["山川与灯火", "顾远", "EPUB", "一趟徒步，一盏孤灯，照见人心的来路与归途。", "文学,收藏", "mountains-autumn.jpg", "灯火集"],
  ["城与钟声", "言之", "EPUB", "钟楼敲响以前，每一条旧街都保存着自己的时间。", "城市,随笔", "bell-tower.jpg", "灯火集"],
  ["雾港信使", "北川", "EPUB", "穿过雾中的桥，把一封迟到了十年的信送到城里。", "文学,幻想", "fog-city.jpg"],
  ["灯塔以南", "沈知行", "EPUB", "在海风吹过的地方，重新学习等待。", "文学,小说", "lighthouse-stars.jpg"],
].map(([title, author, format, description, tagText, cover, series], index) => ({
  title,
  author,
  format,
  description,
  tags: tagText.split(","),
  cover,
  series,
  isbn: `978-7-0000-${String(index + 1).padStart(4, "0")}-0`,
  published: `202${index % 6}-0${(index % 8) + 1}-18`,
}));

if (books.length !== 4 || new Set(books.map((book) => book.cover)).size !== books.length) {
  throw new Error("默认演示书必须保持 4 本，并分别使用不同的正式封面");
}

const xml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function createEpub(book, target) {
  if (await exists(target)) return "kept";
  const staging = await mkdtemp(join(tmpdir(), "bookkin-demo-epub-"));
  try {
    await mkdir(join(staging, "META-INF"), { recursive: true });
    await mkdir(join(staging, "OEBPS"), { recursive: true });
    await writeFile(join(staging, "mimetype"), "application/epub+zip", "utf8");
    await writeFile(join(staging, "META-INF/container.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`, "utf8");
    await writeFile(join(staging, "OEBPS/content.opf"), `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${xml(book.isbn)}</dc:identifier>
    <dc:title>${xml(book.title)}</dc:title>
    <dc:creator>${xml(book.author)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:publisher>BookKin演示出版</dc:publisher>
    <dc:date>${xml(book.published)}</dc:date>
    <dc:description>${xml(book.description)}</dc:description>
    ${book.tags.map((tag) => `<dc:subject>${xml(tag)}</dc:subject>`).join("\n    ")}
    <meta name="cover" content="cover-image"/>
    ${book.series ? `<meta name="calibre:series" content="${xml(book.series)}"/>` : ""}
  </metadata>
  <manifest>
    <item id="cover-image" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="chapter"/></spine>
</package>`, "utf8");
    await writeFile(join(staging, "OEBPS/nav.xhtml"), `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">
  <head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="chapter.xhtml">第一章 灯下</a></li></ol></nav></body>
</html>`, "utf8");
    await writeFile(join(staging, "OEBPS/chapter.xhtml"), `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">
  <head><title>${xml(book.title)}</title><style>body{font-family:serif;line-height:1.9;margin:8%;}h1{text-align:center;}p{text-indent:2em;}</style></head>
  <body><h1>${xml(book.title)}</h1><p>${xml(book.description)}</p>${chapter.map((paragraph) => `<p>${xml(paragraph)}</p>`).join("")}</body>
</html>`, "utf8");
    await copyFile(join(coverDirectory, book.cover), join(staging, "OEBPS/cover.jpg"));
    await mkdir(dirname(target), { recursive: true });
    execFileSync("/usr/bin/zip", ["-X0", target, "mimetype"], { cwd: staging, stdio: "ignore" });
    execFileSync("/usr/bin/zip", ["-Xr9", target, "META-INF", "OEBPS"], { cwd: staging, stdio: "ignore" });
    return "created";
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

await mkdir(targetRoot, { recursive: true });
const result = [];
for (const book of books) {
  if (book.format !== "EPUB") throw new Error(`默认演示书必须带正式内嵌封面：${book.title}`);
  const extension = book.format.toLowerCase();
  const target = join(targetRoot, book.author, `${book.title}.${extension}`);
  const status = await createEpub(book, target);
  result.push({ title: book.title, format: book.format, path: target, status });
}
await writeFile(join(targetRoot, ".bookkin-demo-library.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), books: result }, null, 2)}\n`, "utf8");
process.stdout.write(`演示书库已准备：${result.filter((item) => item.status === "created").length} 本新建，${result.filter((item) => item.status === "kept").length} 本保留。\n${targetRoot}\n`);
