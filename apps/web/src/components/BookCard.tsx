// 把受管书籍及可用操作映射到共享书卡，文件操作由上层流程处理。
// Maps managed books/actions to the shared card while parent workflows own file operations.
import { BookmarkAddOutlined, DeleteOutlined, DriveFileMoveOutlined, EditNoteRounded } from "@/ui/icons";
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
  const actions: BookCardAction[] = [];
  if (onAddToBooklist) actions.push({ label: "加入书单", icon: <BookmarkAddOutlined />, onClick: () => onAddToBooklist(book) });
  if (onEditMetadata) actions.push({ label: "编辑元信息", icon: <EditNoteRounded />, onClick: () => onEditMetadata(book) });
  if (onFileOperation) actions.push(
    { label: "移动", icon: <DriveFileMoveOutlined />, onClick: () => onFileOperation(book, "MOVE") },
    { label: "移入回收站", icon: <DeleteOutlined />, danger: true, onClick: () => onFileOperation(book, "TRASH") },
  );
  return <BookCardPresentation book={book} onOpen={() => onOpen(book)} onRead={() => onRead(book)} actions={actions} />;
}
