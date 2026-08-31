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

const books = [
  ["山川与灯火", "顾远", "EPUB", "一趟徒步，一盏孤灯，照见人心的来路与归途。", "文学,收藏", "mountains-autumn.jpg", "灯火集"],
  ["夜航记", "林栖迟", "PDF", "沿着星图和潮汐，寻找一座只在午夜亮起的灯塔。", "旅行,随笔", "lighthouse-stars.jpg", "灯火集"],
  ["夏日植物学", "苏与白", "PDF", "在窗边记录叶片、气味和漫长夏日里细微的光。", "自然,笔记", "botanical-window.jpg", "灯火集"],
  ["城与钟声", "言之", "EPUB", "钟楼敲响以前，每一条旧街都保存着自己的时间。", "城市,随笔", "bell-tower.jpg", "灯火集"],
  ["雾港信使", "北川", "EPUB", "穿过雾中的桥，把一封迟到了十年的信送到城里。", "文学,幻想", "fog-city.jpg"],
  ["鲸落之时", "迟小椰", "PDF", "关于海洋、迁徙与生命循环的温柔自然史。", "自然,科学", "whale-sky.jpg"],
  ["灯塔以南", "沈知行", "EPUB", "在海风吹过的地方，重新学习等待。", "文学,小说", "lighthouse-stars.jpg"],
  ["微光标本", "周砚秋", "PDF", "一本收集日常微光的图文笔记。", "图文,随笔", "botanical-window.jpg"],
  ["纸上群山", "叶疏影", "EPUB", "从旧地图与家书中拼出远方山脉。", "历史,随笔", "mountains-autumn.jpg"],
  ["慢读手册", "陈默", "EPUB", "为数字时代重新设计一套不赶时间的阅读方法。", "阅读,方法", "bell-tower.jpg"],
  ["风从书页来", "温以宁", "EPUB", "十二次阅读与十二段季节的往返。", "文学,散文", "fog-city.jpg"],
  ["海岸线之外", "乔木", "PDF", "从海岸到岛屿的地理观察。", "地理,随笔", "whale-sky.jpg"],
  ["声之来信", "顾安安", "EPUB", "一封被潮声保存了十年的信。", "文学,书信", "lighthouse-stars.jpg"],
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

function utf16Hex(value) {
  const bytes = [0xfe, 0xff];
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code <= 0xffff) {
      bytes.push(code >> 8, code & 0xff);
    } else {
      const adjusted = code - 0x10000;
      const high = 0xd800 + (adjusted >> 10);
      const low = 0xdc00 + (adjusted & 0x3ff);
      bytes.push(high >> 8, high & 0xff, low >> 8, low & 0xff);
    }
  }
  return Buffer.from(bytes).toString("hex").toUpperCase();
}

function pdfString(value) {
  return `<${utf16Hex(value)}>`;
}

async function createPdf(book, target) {
  if (await exists(target)) return "kept";
  const lines = [
    "BOOKKIN DEMO LIBRARY",
    `Demo volume: ${String(books.indexOf(book) + 1).padStart(2, "0")}`,
    "This is a real, parseable PDF stored in the local NAS library.",
    "Its title, author, subject and keywords are embedded in PDF metadata.",
    "The first page is rendered by the server as the library cover.",
  ];
  const stream = lines.map((line, index) => `BT /F1 ${index === 0 ? 24 : 12} Tf 72 ${730 - index * 42} Td (${line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    `<< /Title ${pdfString(book.title)} /Author ${pdfString(book.author)} /Subject ${pdfString(book.description)} /Keywords ${pdfString(book.tags.join(","))} /Creator ${pdfString("BookKin演示数据生成器")} >>`,
  ];
  let body = "%PDF-1.7\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(body, "latin1"));
  return "created";
}

await mkdir(targetRoot, { recursive: true });
const result = [];
for (const book of books) {
  const extension = book.format.toLowerCase();
  const target = join(targetRoot, book.author, `${book.title}.${extension}`);
  const status = book.format === "EPUB" ? await createEpub(book, target) : await createPdf(book, target);
  result.push({ title: book.title, format: book.format, path: target, status });
}
await writeFile(join(targetRoot, ".bookkin-demo-library.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), books: result }, null, 2)}\n`, "utf8");
process.stdout.write(`演示书库已准备：${result.filter((item) => item.status === "created").length} 本新建，${result.filter((item) => item.status === "kept").length} 本保留。\n${targetRoot}\n`);
