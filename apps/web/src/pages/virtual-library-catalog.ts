import type { Book } from "../domain/types";
import { LONG_ROOM_LIVE_SHELF_SECTION_COUNT } from "./virtual-library-model/longRoomLayout";

export interface LibrarySubcategory {
  id: string;
  /** Thema 1.6 subject code persisted with the book metadata. */
  code: string;
  label: string;
  subtitle: string;
  keywords: readonly string[];
}

export interface LibraryCategory {
  id: string;
  /** A readable shelf zone. Books are assigned the more specific child code. */
  code: string;
  label: string;
  /** Full English heading from the Thema 1.6 hierarchy for edit surfaces. */
  themaLabel: string;
  subtitle: string;
  description: string;
  keywords: readonly string[];
  subcategories: readonly [LibrarySubcategory, ...LibrarySubcategory[]];
}

export interface CatalogClassification {
  category: LibraryCategory;
  subcategory: LibrarySubcategory;
}

export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = [
  {
    id: "literature",
    code: "F",
    label: "小说",
    themaLabel: "Fiction",
    subtitle: "FICTION · F",
    description: "Thema F：小说与叙事文学",
    keywords: ["文学", "小说", "散文", "随笔", "诗", "戏剧", "幻想", "故事", "叙事"],
    subcategories: [
      { id: "fiction", code: "FB", label: "文学与一般小说", subtitle: "LITERARY & GENERAL · FB", keywords: ["文学", "小说", "故事", "长篇", "中篇", "短篇", "叙事"] },
      { id: "essays", code: "FD", label: "推想小说", subtitle: "SPECULATIVE · FD", keywords: ["幻想", "科幻", "奇幻", "推想", "未来", "异世界"] },
      { id: "poetry", code: "FF", label: "犯罪与悬疑小说", subtitle: "CRIME & MYSTERY · FF", keywords: ["悬疑", "推理", "犯罪", "侦探", "案件"] },
    ],
  },
  {
    id: "humanities",
    code: "J",
    label: "社会与社会科学",
    themaLabel: "Society and Social Sciences",
    subtitle: "SOCIETY · J",
    description: "Thema J：社会、教育与公共生活",
    keywords: ["历史", "传记", "哲学", "思想", "社会", "文化", "人文", "阅读", "方法", "政治", "教育"],
    subcategories: [
      { id: "history", code: "JB", label: "社会与文化", subtitle: "SOCIETY & CULTURE · JB", keywords: ["历史", "传记", "家书", "旧地图", "社会", "文化", "人文"] },
      { id: "thought", code: "JN", label: "教育与教育学", subtitle: "EDUCATION · JN", keywords: ["思想", "阅读", "方法", "写作", "教育", "学习"] },
      { id: "reading", code: "JP", label: "政治与公共治理", subtitle: "POLITICS & GOVERNMENT · JP", keywords: ["政治", "政府", "公共", "治理", "社会观察"] },
    ],
  },
  {
    id: "nature",
    code: "P",
    label: "数学与科学",
    themaLabel: "Mathematics and Science",
    subtitle: "SCIENCE · P",
    description: "Thema P：数学、生命科学与自然观察",
    keywords: ["自然", "科学", "地理", "植物", "动物", "海洋", "生命", "天文", "技术", "数学", "物理", "化学"],
    subcategories: [
      { id: "life", code: "PS", label: "生物与生命科学", subtitle: "BIOLOGY & LIFE SCIENCES · PS", keywords: ["自然", "植物", "动物", "生命", "海洋", "生物", "生态"] },
      { id: "geography", code: "PH", label: "物理科学", subtitle: "PHYSICS · PH", keywords: ["物理", "天文", "宇宙", "光", "力学"] },
      { id: "science", code: "PD", label: "科学通论", subtitle: "GENERAL SCIENCE · PD", keywords: ["科学", "技术", "数学", "化学", "地理", "旅行", "海岸", "山川", "城市"] },
    ],
  },
  {
    id: "arts",
    code: "A",
    label: "艺术",
    themaLabel: "The Arts",
    subtitle: "THE ARTS · A",
    description: "Thema A：视觉艺术、建筑与表演艺术",
    keywords: ["艺术", "设计", "图文", "摄影", "建筑", "音乐", "生活", "美学", "绘画"],
    subcategories: [
      { id: "visual-arts", code: "AF", label: "艺术形式", subtitle: "ART FORMS · AF", keywords: ["艺术", "图文", "摄影", "绘画", "音乐"] },
      { id: "design", code: "AM", label: "建筑", subtitle: "ARCHITECTURE · AM", keywords: ["设计", "建筑", "城市", "空间"] },
      { id: "lifestyle", code: "AT", label: "表演艺术", subtitle: "PERFORMING ARTS · AT", keywords: ["表演", "戏剧", "音乐", "舞蹈", "生活", "美学", "手作", "饮食"] },
    ],
  },
  {
    id: "reference",
    code: "G",
    label: "参考与信息",
    themaLabel: "Reference, Information and Interdisciplinary subjects",
    subtitle: "REFERENCE · G",
    description: "Thema G：参考工具、信息科学与跨学科研究",
    keywords: ["文献", "档案", "工具", "收藏", "手册", "资料", "年鉴", "参考", "百科", "研究"],
    subcategories: [
      { id: "collections", code: "GB", label: "百科与参考著作", subtitle: "ENCYCLOPAEDIAS & REFERENCE · GB", keywords: ["收藏", "珍贵", "善本", "百科", "参考"] },
      { id: "archives", code: "GL", label: "图书馆、信息与博物馆学", subtitle: "LIBRARY & INFORMATION · GL", keywords: ["档案", "文献", "资料", "年鉴", "图书馆", "信息", "博物馆"] },
      { id: "reference-books", code: "GP", label: "研究与信息（通用）", subtitle: "RESEARCH & INFORMATION · GP", keywords: ["工具", "手册", "指南", "研究", "方法"] },
    ],
  },
] as const;

/** A real-book holding area, never written as a Thema subject code. */
export const UNCLASSIFIED_CATEGORY: LibraryCategory = {
  id: "unclassified",
  code: "",
  label: "待分类",
  themaLabel: "尚未指定 Thema 主题",
  subtitle: "PENDING",
  description: "等待主人或管理员核对主题的真实藏书",
  keywords: [],
  subcategories: [{ id: "pending", code: "", label: "待分类", subtitle: "SUBJECT PENDING", keywords: [] }],
};

export const SHELF_CATEGORIES: readonly LibraryCategory[] = [...LIBRARY_CATEGORIES, UNCLASSIFIED_CATEGORY];

function searchableBookText(book: Pick<Book, "title" | "author" | "series" | "description" | "tags" | "wordCount">) {
  return [book.title, book.author, book.series, book.description, book.wordCount, ...book.tags]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

function keywordScore(text: string, keywords: readonly string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword.toLocaleLowerCase("zh-CN")) ? 1 : 0), 0);
}

export function classifyCatalogBook(book: Book): CatalogClassification {
  const explicitCode = (book.subjectCodes ?? []).find((code) =>
    LIBRARY_CATEGORIES.some((category) => category.subcategories.some((subcategory) => subcategory.code === code)),
  );
  if (explicitCode) {
    for (const category of LIBRARY_CATEGORIES) {
      const subcategory = category.subcategories.find((candidate) => candidate.code === explicitCode);
      if (subcategory) return { category, subcategory };
    }
  }
  const text = searchableBookText(book);
  const rankedCategories = LIBRARY_CATEGORIES
    .map((category, index) => ({ category, index, score: keywordScore(text, category.keywords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  if (!rankedCategories[0]?.score) {
    return { category: UNCLASSIFIED_CATEGORY, subcategory: UNCLASSIFIED_CATEGORY.subcategories[0] };
  }
  const category = rankedCategories[0].category;
  const rankedSubcategories = category.subcategories
    .map((subcategory, index) => ({ subcategory, index, score: keywordScore(text, subcategory.keywords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  return {
    category,
    subcategory: rankedSubcategories[0]?.subcategory ?? category.subcategories[0],
  };
}

export function sortCatalogBooksByClassification(books: readonly Book[]) {
  const categoryOrder = new Map(SHELF_CATEGORIES.map((category, index) => [category.id, index]));
  return books
    .map((book, originalIndex) => {
      const classification = classifyCatalogBook(book);
      return {
        book,
        originalIndex,
        classification,
        subcategoryScore: keywordScore(searchableBookText(book), classification.subcategory.keywords),
      };
    })
    .sort((left, right) => {
      const categoryDifference = (categoryOrder.get(left.classification.category.id) ?? 0)
        - (categoryOrder.get(right.classification.category.id) ?? 0);
      if (categoryDifference !== 0) return categoryDifference;
      const leftSubcategory = left.classification.category.subcategories.findIndex(
        (subcategory) => subcategory.id === left.classification.subcategory.id,
      );
      const rightSubcategory = right.classification.category.subcategories.findIndex(
        (subcategory) => subcategory.id === right.classification.subcategory.id,
      );
      return leftSubcategory - rightSubcategory || right.subcategoryScore - left.subcategoryScore || left.originalIndex - right.originalIndex;
    });
}

export function defaultCategoryForShelf(sectionId: number) {
  return LIBRARY_CATEGORIES[Math.abs(sectionId) % LIBRARY_CATEGORIES.length];
}

/** Reserve separate bookcases per category; the scene consumes the same sorted order. */
export function longRoomCatalogSectionCounts(books: readonly Book[]) {
  const counts: number[] = [];
  let previousCategory = '';
  for (const {classification} of sortCatalogBooksByClassification(books)) {
    if (classification.category.id !== previousCategory || counts[counts.length - 1] === 120) counts.push(0);
    counts[counts.length - 1]++;
    previousCategory = classification.category.id;
  }
  if (counts.length > LONG_ROOM_LIVE_SHELF_SECTION_COUNT) throw new Error('Long Room catalog category capacity exceeded');
  return counts;
}
