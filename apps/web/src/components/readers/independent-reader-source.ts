import type { ReactNode } from "react";
import type { Annotation, AnnotationStyle, BookFormat, AnnotationColor } from "../../domain/types";

export interface ReaderAnnotationDraft {
  type: Annotation["type"];
  quote: string;
  note: string;
  locator: string;
  style: AnnotationStyle;
  color: AnnotationColor;
}

/** Inject independent persistence into the existing book reader workspace. */
export interface IndependentReaderSource {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  contentUrl: string;
  flow?: "paginated" | "scrolled-doc";
  label: string;
  backLabel: string;
  initialLocator?: string;
  progress: number;
  annotations: Annotation[];
  error?: string;
  extraActions?: ReactNode;
  onBack: () => void;
  onPosition: (locator: string, progress: number) => void;
  createAnnotation: (draft: ReaderAnnotationDraft) => Promise<Annotation>;
  deleteAnnotation: (id: string) => Promise<void>;
}
