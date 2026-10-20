import { Box } from "@/ui/primitives";
import { bookGridSx } from "./bookGrid";

// 各目录页骨架与真实书卡保持相同封面和元数据几何尺寸。
/** Match BookCardPresentation's cover and metadata geometry on every catalog route. */
export function BookGridSkeleton({ label, count = 12 }: { label: string; count?: number }) {
  return (
    <Box role="status" aria-label={label} aria-busy="true">
      <Box sx={bookGridSx} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className="bk-book-skeleton" key={index}>
            <div className="bk-skeleton-block bk-book-skeleton-cover" />
            <div className="bk-book-skeleton-metadata">
              <div className="bk-skeleton-block bk-book-skeleton-title" />
              <div className="bk-skeleton-block bk-book-skeleton-author" />
            </div>
          </div>
        ))}
      </Box>
    </Box>
  );
}
