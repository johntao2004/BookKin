import type { Book, ManagedUser, RecycleBinEntry } from "../domain/types";

const covers = [
  "/covers/mountains-autumn.jpg",
  "/covers/lighthouse-stars.jpg",
  "/covers/botanical-window.jpg",
  "/covers/bell-tower.jpg",
  "/covers/fog-city.jpg",
  "/covers/whale-sky.jpg",
];

const sourceBooks = [
  ["山川与灯火", "顾远", "一趟徒步，一盏孤灯，照见人心的来路与归途。", "EPUB", "长篇小说 · 38.2万字"],
  ["夜航记", "林栖迟", "沿着星图和潮汐，寻找一座只在午夜亮起的灯塔。", "PDF", "旅行随笔"],
  ["夏日植物学", "苏与白", "在窗边记录叶片、气味和漫长夏日里细微的光。", "PDF", "自然笔记"],
  ["城与钟声", "言之", "钟楼敲响以前，每一条旧街都保存着自己的时间。", "EPUB", "城市随笔"],
  ["雾港信使", "北川", "穿过雾中的桥，把一封迟到了十年的信送到城里。", "EPUB", "幻想小说"],
  ["鲸落之时", "迟小椰", "关于海洋、迁徙与生命循环的温柔自然史。", "PDF", "自然科学"],
  ["灯塔以南", "沈知行", "在海风吹过的地方，重新学习等待。", "EPUB", "中篇小说"],
  ["微光标本", "周砚秋", "一本收集日常微光的图文笔记。", "PDF", "图文随笔"],
  ["纸上群山", "叶疏影", "从旧地图与家书中拼出远方山脉。", "EPUB", "历史随笔"],
  ["慢读手册", "陈默", "为数字时代重新设计一套不赶时间的阅读方法。", "EPUB", "阅读方法"],
  ["风从书页来", "温以宁", "十二次阅读与十二段季节的往返。", "EPUB", "散文集"],
  ["海岸线之外", "乔木", "从海岸到岛屿的地理观察。", "PDF", "地理随笔"],
] as const;

export const demoBooks: Book[] = sourceBooks.map((book, index) => ({
  id: `book-${index + 1}`,
  fileId: `book-${index + 1}`,
  title: book[0],
  author: book[1],
  series: index < 4 ? "灯火集" : undefined,
  description: book[2],
  format: book[3],
  coverUrl: covers[index % covers.length],
  progress: index < 2 ? [68, 42][index] : 0,
  wordCount: book[4],
  addedAt: new Date(Date.UTC(2026, 7, 18 - index)).toISOString(),
  libraryRoot: index % 3 === 0 ? "家庭藏书" : "主书库",
  relativePath: `${book[1]}/${book[0]}.${book[3].toLowerCase()}`,
  fingerprint: `sha256:${String(index + 1).padStart(2, "0")}d7c9a2e8b0f4a1c6e5b7d9f2a4c8e6b1d3f5a7c9e0`,
  status: "AVAILABLE",
  tags: index % 2 === 0 ? ["文学", "收藏"] : ["随笔"],
}));

export const demoUsers: ManagedUser[] = [
  {
    id: "user-owner",
    username: "owner",
    displayName: "林",
    role: "OWNER",
    status: "ACTIVE",
    mustChangePassword: false,
    createdAt: "2026-08-18T08:00:00Z",
    lastLoginAt: "2026-08-20T02:30:00Z",
  },
  {
    id: "user-admin",
    username: "curator",
    displayName: "书库管理员",
    role: "ADMIN",
    status: "ACTIVE",
    mustChangePassword: false,
    createdAt: "2026-08-18T09:00:00Z",
    lastLoginAt: "2026-08-19T13:12:00Z",
  },
  {
    id: "user-member",
    username: "reader",
    displayName: "家庭成员",
    role: "MEMBER",
    status: "ACTIVE",
    mustChangePassword: true,
    createdAt: "2026-08-19T11:20:00Z",
  },
];

export const demoRecycleBin: RecycleBinEntry[] = [
  {
    id: "trash-1",
    bookId: "book-4",
    bookTitle: "声之来信",
    bookAuthor: "顾安安",
    format: "EPUB",
    coverUrl: covers[3],
    originalPath: "主书库/顾安安/声之来信.epub",
    trashPath: ".bookkin-trash/4fa12d/声之来信.epub",
    sizeBytes: 4_821_938,
    deletedBy: "书库管理员",
    deletedAt: "2026-08-19T04:20:00Z",
    expiresAt: "2026-09-18T04:20:00Z",
    fingerprint: "sha256:86a92dc4d91fbd0321e5",
  },
];

export const demoChapter = [
  "黄昏从山脊落下来时，河面先暗了一层。远处最后一班渡船收起绳索，木桨在水里划出细长的纹路，像有人把一天的光慢慢折进书页。",
  "顾远沿着旧石阶往上走。背包里只有一册地图、一支铅笔和那封没有署名的信。他已经走了七天，仍不知道写信的人为何只留下三个字：去灯下。",
  "山里的灯并不多。每隔很远，才有一扇窗在暮色里亮起。那一点暖黄既不催促，也不挽留，只安静地告诉路上的人：这里有人生活过，今晚也仍会有人守着火。",
  "转过最后一道弯，他看见湖边的屋子。屋檐压得很低，枫叶落满台阶。一位老人站在门口，像已经等了许多年，又像只是刚刚听见脚步声。",
  "‘信带来了吗？’老人问。顾远点头，却没有立刻把信递出去。河谷里起了风，灯影在水面轻轻摇晃。他忽然明白，有些路不是为了抵达，而是让人终于愿意打开一直不敢读的那一页。",
];
