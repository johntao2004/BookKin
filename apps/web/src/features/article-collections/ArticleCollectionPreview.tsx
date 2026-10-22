import { Box, Stack, Typography } from "@/ui/primitives";
import { FolderOutlined } from "@/ui/icons";
import type { ArticleSummary } from "../content/api";
import { tokens } from "../../theme/generated-tokens";

export function ArticleCollectionPreview({ articles, title, emptyLabel = "还没有文章" }: {
  articles: ArticleSummary[];
  title: string;
  emptyLabel?: string;
}) {
  const visible = articles.slice(0, 4);
  return <Box role="img" aria-label={`${title}文章封面预览`} sx={{ aspectRatio: "2.35 / 1", minWidth: 0, display: "grid", gridTemplateColumns: visible.length > 1 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gridTemplateRows: visible.length > 2 ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)", gap: `${tokens.spacing[1]}px`, overflow: "hidden", borderRadius: `${tokens.radius.lg}px`, bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
    {visible.length ? visible.map((article) => <Box key={article.id} sx={{ minWidth: 0, minHeight: 0, overflow: "hidden", bgcolor: "background.default" }}>
      {article.cover_url ? <Box component="img" src={article.cover_url} alt="" loading="lazy" decoding="async" sx={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : <Stack sx={{ width: "100%", height: "100%", alignItems: "center", justifyContent: "center", px: `${tokens.spacing[2]}px` }}><Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{article.title}</Typography></Stack>}
    </Box>) : <Stack sx={{ gridColumn: "1 / -1", alignItems: "center", justifyContent: "center", color: "text.disabled", gap: `${tokens.spacing[2]}px` }}><FolderOutlined /><Typography variant="caption">{emptyLabel}</Typography></Stack>}
  </Box>;
}

