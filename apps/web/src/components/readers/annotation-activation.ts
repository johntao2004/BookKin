import type { Annotation } from "../../domain/types";

/** Delegate activation so repainted annotation fragments never retain stale handlers. */
export function bindAnnotationNoteActivation(
  root: HTMLElement | Document,
  getAnnotation: (id: string) => Pick<Annotation, "id" | "note"> | undefined,
  onActivate: (id: string) => void,
): () => void {
  const document = root.nodeType === 9 ? root as Document : (root as HTMLElement).ownerDocument;
  const annotationId = (target: EventTarget | null) => {
    const node = target as Node | null;
    const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
    const marker = element?.closest<HTMLElement>("[data-annotation-id]");
    if (!marker || !root.contains(marker)) return undefined;
    const id = marker.dataset.annotationId;
    return id && getAnnotation(id)?.note?.trim() ? id : undefined;
  };
  const click = (event: Event) => {
    if (event.defaultPrevented || (event as MouseEvent).button !== 0) return;
    const selection = document.defaultView?.getSelection();
    if (selection?.isCollapsed === false && selection.toString().trim()) return;
    const id = annotationId(event.target);
    if (!id) return;
    event.preventDefault();
    event.stopPropagation();
    onActivate(id);
  };
  const keydown = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.defaultPrevented || key.repeat || (key.key !== "Enter" && key.key !== " ")) return;
    const id = annotationId(event.target);
    if (!id) return;
    key.preventDefault();
    key.stopPropagation();
    onActivate(id);
  };
  root.addEventListener("click", click, true);
  root.addEventListener("keydown", keydown, true);
  return () => {
    root.removeEventListener("click", click, true);
    root.removeEventListener("keydown", keydown, true);
  };
}
