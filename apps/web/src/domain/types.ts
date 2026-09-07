export type UserRole = "OWNER" | "ADMIN" | "MEMBER";
export type UserStatus = "ACTIVE" | "DISABLED";
export type BookFormat = "EPUB" | "PDF";
export type BookFileStatus = "AVAILABLE" | "OPERATING" | "TRASHED" | "MISSING" | "DELETED";
export type FileOperationType = "RENAME" | "MOVE" | "TRASH" | "RESTORE" | "WRITE_METADATA" | "PURGE";
export type FileOperationStatus = "PLANNED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "ROLLED_BACK";
export type AnnotationType = "HIGHLIGHT" | "NOTE" | "BOOKMARK";
export type AnnotationStyle = "HIGHLIGHT" | "UNDERLINE" | "BOLD";
export type HighlightColor = "YELLOW" | "GREEN" | "PINK" | "BLUE" | "ORANGE";
export type AnnotationColor = HighlightColor | "CORAL" | "GOLD" | "TEAL";
export type BookUploadStatus = "RECEIVING" | "INSPECTING" | "ENRICHING" | "READY_FOR_REVIEW" | "COMMITTING" | "SUCCEEDED" | "DUPLICATE" | "FAILED" | "CANCELLED" | "EXPIRED";
export type MetadataSource = "FILE" | "FILENAME" | "OPEN_LIBRARY" | "GOOGLE_BOOKS" | "AI" | "MANUAL";
export type CoverSource = "EMBEDDED" | "PDF_FIRST_PAGE" | "OPEN_LIBRARY" | "GOOGLE_BOOKS" | "CUSTOM" | "GENERATED";
export type ReaderFontSource = "PRESET" | "CUSTOM";
export type ReaderFontKind = "SERIF" | "SANS";
export type ReaderFontStatus = "ENABLED" | "DISABLED";
export type BooklistKind = "OFFICIAL" | "PERSONAL";
export type BooklistVisibility = "PRIVATE" | "MEMBERS" | "PUBLIC";

export interface ReaderFont {
  id: string;
  displayName: string;
  familyName: string;
  kind: ReaderFontKind;
  source: ReaderFontSource;
  status: ReaderFontStatus;
  format?: "WOFF2" | "WOFF" | "TTF" | "OTF";
  contentUrl?: string;
  licenseNote?: string;
  createdAt?: string;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface ManagedUser extends SessionUser {
  status: UserStatus;
  createdAt: string;
  lastLoginAt?: string;
}

export interface Book {
  id: string;
  fileId?: string;
  title: string;
  author: string;
  series?: string;
  description: string;
  format: BookFormat;
  coverUrl: string;
  progress: number;
  wordCount?: string;
  addedAt: string;
  libraryRoot: string;
  relativePath: string;
  fingerprint: string;
  status: BookFileStatus;
  tags: string[];
}

export interface BookPage {
  items: Book[];
  nextCursor?: string;
}

export interface DisplayBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  format?: BookFormat;
  coverUrl: string;
  available: boolean;
  sortOrder: number;
}

export interface DisplayBookPage {
  items: DisplayBook[];
  nextCursor?: string;
  revision: number;
}

export interface BrowseBook {
  id: string;
  title: string;
  author: string;
  description?: string;
  format?: BookFormat;
  coverUrl: string;
  available: boolean;
  addedAt: string;
}

export interface BrowseBookPage {
  items: BrowseBook[];
  nextCursor?: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  description?: string;
  bookCount: number;
  previewBooks: BrowseBook[];
  editable: boolean;
}

export type CategoryDetail = CategorySummary;

export interface CategoryList {
  items: CategorySummary[];
  editable: boolean;
}

export interface BooklistSummary {
  id: string;
  title: string;
  description?: string;
  kind: BooklistKind;
  visibility: BooklistVisibility;
  ownerDisplayName: string;
  bookCount: number;
  previewBooks: BrowseBook[];
  ownedByViewer: boolean;
  editable: boolean;
  revision: number;
  hiddenPublicBookCount: number;
  updatedAt: string;
}

export type BooklistDetail = BooklistSummary;

export interface BooklistList {
  items: BooklistSummary[];
}

export interface BookMetadata {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  translators: string[];
  language?: string;
  publisher?: string;
  publishedDate?: string;
  isbn?: string;
  description?: string;
  series?: string;
  seriesIndex?: number;
  tags: string[];
  coverCacheKey?: string;
  coverUrl?: string;
  sources: Record<string, MetadataSource>;
}

export interface BookMetadataDraft {
  title: string;
  subtitle?: string;
  authors: string[];
  translators: string[];
  language?: string;
  publisher?: string;
  publishedDate?: string;
  isbn?: string;
  description?: string;
  series?: string;
  seriesIndex?: number;
  tags: string[];
  pageCount?: number;
  wordCount?: number;
  sources: Record<string, MetadataSource>;
  targetPath: string;
}

export interface MetadataCandidate {
  id: string;
  provider: MetadataSource;
  providerLabel?: string;
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  isbn?: string;
  description?: string;
  tags?: string[];
  coverUrl?: string;
  confidence?: number;
  matchReason?: string;
  requiresReview?: boolean;
}

export interface AiProviderInfo {
  id: string;
  label: string;
  type: "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GEMINI";
  enabled: boolean;
  configured: boolean;
  available: boolean;
  model: string;
}

export interface AiProviderSetting {
  id: string;
  label: string;
  type: "OPENAI_COMPATIBLE" | "ANTHROPIC" | "GEMINI";
  enabled: boolean;
  baseUrl: string;
  model: string;
  configured: boolean;
  available: boolean;
  apiKeyConfigured: boolean;
  updatedAt?: string;
}

export interface AiSettings {
  enabled: boolean;
  autoMatch: boolean;
  maxCandidates: number;
  timeoutSeconds: number;
  providers: AiProviderSetting[];
  updatedAt?: string;
}

export interface AiSettingsInput {
  enabled: boolean;
  autoMatch: boolean;
  maxCandidates: number;
  timeoutSeconds: number;
  providers: AiProviderSettingInput[];
}

export interface AiProviderSettingInput {
  id: string;
  label: string;
  type: AiProviderSetting["type"];
  enabled: boolean;
  baseUrl: string;
  model: string;
  apiKey?: string;
  clearApiKey: boolean;
}

export interface BookUpload {
  id: string;
  libraryRootId: string;
  libraryRootName: string;
  originalFilename: string;
  format: BookFormat;
  declaredSizeBytes: number;
  receivedBytes: number;
  fingerprint?: string;
  status: BookUploadStatus;
  encrypted: boolean;
  drmProtected: boolean;
  digitallySigned: boolean;
  detectedMetadata?: BookMetadataDraft;
  draftMetadata?: BookMetadataDraft;
  metadataCandidates: MetadataCandidate[];
  coverUrl?: string;
  selectedCoverSource?: CoverSource;
  duplicateBookId?: string;
  similarBookIds: string[];
  targetPath?: string;
  errorCode?: string;
  errorDetail?: string;
  committedBookId?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileConflict {
  code: "TARGET_EXISTS" | "SOURCE_CHANGED" | "ROOT_READ_ONLY" | "INSUFFICIENT_SPACE" | "ACTIVE_LEASE";
  message: string;
  path?: string;
}

export interface FileOperationPreview {
  previewToken: string;
  type: FileOperationType;
  sourcePath: string;
  targetPath?: string;
  requiredBytes: number;
  expectedFingerprint: string;
  expiresAt: string;
  conflicts: FileConflict[];
  warnings: string[];
}

export interface FileOperation {
  id: string;
  type: FileOperationType;
  status: FileOperationStatus;
  sourcePath: string;
  targetPath?: string;
  createdAt: string;
  stage?: string;
}

export interface RecycleBinEntry {
  id: string;
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  format: BookFormat;
  coverUrl: string;
  originalPath: string;
  trashPath: string;
  sizeBytes: number;
  deletedBy: string;
  deletedAt: string;
  expiresAt: string;
  fingerprint: string;
}

export interface Annotation {
  id: string;
  bookId: string;
  bookTitle?: string;
  bookAuthor?: string;
  type: AnnotationType;
  quote?: string;
  note?: string;
  locator?: string;
  style: AnnotationStyle;
  color?: AnnotationColor;
  createdAt: string;
  updatedAt?: string;
}

export interface AnnotationBookSummary {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string;
  annotationCount: number;
  noteCount: number;
  highlightCount: number;
  underlineCount: number;
  boldCount: number;
  latestAt: string;
}

export interface AnnotationBookPage {
  items: AnnotationBookSummary[];
  nextCursor?: string;
}

export interface ReadingPosition {
  bookId: string;
  locator: string;
  progress: number;
  deviceId?: string;
  updatedAt?: string;
}

export interface DailyReadingTime {
  date: string;
  seconds: number;
}

export interface WeeklyReadingStats {
  weekStart: string;
  weekEnd: string;
  totalSeconds: number;
  previousWeekSeconds: number;
  days: DailyReadingTime[];
}

export interface LibraryRoot {
  id: string;
  name: string;
  configuredPath: string;
  canonicalPath?: string | null;
  status: "ONLINE" | "READ_ONLY" | "OFFLINE";
  canRead: boolean;
  canWrite: boolean;
  canAtomicMove: boolean;
  canStage: boolean;
  freeBytes?: number | null;
  lastCapabilityCheckAt?: string | null;
  lastScanAt?: string | null;
}
