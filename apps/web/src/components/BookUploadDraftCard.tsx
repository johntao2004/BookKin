import { BookCardPresentation } from "./BookCardPresentation";
import type { BookUpload } from "../domain/types";

/** A review-only upload card; staged content never becomes a readable catalog book. */
export function BookUploadDraftCard({ upload, onOpen }: { upload: BookUpload; onOpen: () => void }) {
  const metadata = upload.draftMetadata ?? upload.detectedMetadata;
  const title = metadata?.title.trim() || upload.originalFilename.replace(/\.[^.]+$/, "") || upload.originalFilename;
  const author = metadata?.authors.filter(Boolean).join(" / ") || "作者待完善";

  return <BookCardPresentation
    book={{ id: upload.id, title, author, coverUrl: upload.coverUrl }}
    status="草稿"
    onOpen={onOpen}
    showReadAction={false}
    actions={[{ label: "完善资料", onClick: onOpen }]}
  />;
}
