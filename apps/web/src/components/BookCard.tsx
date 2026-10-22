import { usePermissions } from "../auth/permissions";
// 把受管书籍及可用操作映射到共享书卡，文件操作由上层流程处理。
// Maps managed books/actions to the shared card while parent workflows own file operations.
import { BookCardPresentation, type BookCardAction } from "./BookCardPresentation";
import type { Book, FileOperationType } from "../domain/types";

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  onRead: (book: Book) => void;
  onEditMetadata?: (book: Book) => void;
  onFileOperation?: (book: Book, type: FileOperationType) => void;
  onAddToBooklist?: (book: Book) => void;
}

export function BookCard({ book, onOpen, onRead, onEditMetadata, onFileOperation, onAddToBooklist }: BookCardProps) {
  const { can, canVisit } = usePermissions();
  const actions: BookCardAction[] = [];
  if (onAddToBooklist) actions.push({ label: "加入书目", onClick: () => onAddToBooklist(book) });
  if (onEditMetadata) actions.push({ label: "编辑元信息", onClick: () => onEditMetadata(book) });
  if (onFileOperation && can("library.trash")) actions.push({ label: "移入回收站", danger: true, onClick: () => onFileOperation(book, "TRASH") });
  return <BookCardPresentation book={book} onOpen={() => onOpen(book)} onRead={canVisit(`/reader/${book.id}`) ? () => onRead(book) : undefined} actions={actions} />;
}
