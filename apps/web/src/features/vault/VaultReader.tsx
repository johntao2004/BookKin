import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { PDFDataRangeTransport } from "pdfjs-dist";
import {
  _AntAlert as Alert,
  _AntButton as Button,
  Skeleton,
} from "../../ui/antd";
import {
  type UnlockedObject,
  decryptChunk,
  decryptFile,
  privateEpub,
} from "./files";
import { CHUNK_SIZE, sealJson } from "./crypto";
import { vaultApi } from "./api";
import { useIndependentReading } from "../content/useIndependentReading";
import { IndependentNotes } from "../content/IndependentNotes";
import { type ReadingState } from "../content/api";
import { type Annotation } from "../../domain/types";
import { tokens } from "../../theme/generated-tokens";
import { type ReaderSelection } from "../../components/readers/types";
const Epub = lazy(() => import("../../components/readers/EpubDocumentReader"));
const Pdf = lazy(() => import("../../components/readers/PdfDocumentReader"));
const noNavigation = () => {};
const theme = {
  background: tokens.color.semantic.canvas,
  foreground: tokens.color.semantic.textPrimary,
  muted: tokens.color.semantic.textSecondary,
};
export function VaultReader({
  item,
  master,
  onClose,
  onState,
}: {
  item: UnlockedObject;
  master: Uint8Array;
  onClose: () => void;
  onState: (state: ReadingState, revision: number) => void;
}) {
  const savingKey = useRef(new Uint8Array(master));
  const revision = useRef(item.revision);
  const observer = useRef(onState);
  useEffect(() => {
    observer.current = onState;
  }, [onState]);
  const save = useCallback(
    async (s: ReadingState) => {
      await vaultApi.state(
        item.id,
        await sealJson(savingKey.current, s, `state:${item.id}`),
        revision.current,
      );
      revision.current++;
      observer.current(s, revision.current);
    },
    [item.id, master],
  );
  const {
    state,
    change,
    flush,
    error: saveError,
  } = useIndependentReading(item.reading, save);
  useEffect(() => {
    const local = new Uint8Array(master);
    savingKey.current = local;
    return () => {
      void flush()
        .catch(() => undefined)
        .finally(() => local.fill(0));
    };
  }, [flush, master]);
  const [selection, setSelection] = useState<ReaderSelection | null>(null),
    [target, setTarget] = useState(item.reading.locator || undefined);
  const [url, setUrl] = useState(""),
    [range, setRange] = useState<PDFDataRangeTransport>(),
    [error, setError] = useState("");
  useEffect(() => {
    let disposed = false,
      objectUrl = "";
    const controller = new AbortController();
    const chunks = new Map<number, Uint8Array>();
    let transport: PDFDataRangeTransport | undefined;
    const load = async () => {
      if (item.metadata.format === "EPUB") {
        const original = await decryptFile(item, master, controller.signal);
        let cleaned: Uint8Array | undefined;
        try {
          cleaned = await privateEpub(original);
          if (disposed) return;
          objectUrl = URL.createObjectURL(
            new Blob([new Uint8Array(cleaned)], {
              type: "application/epub+zip",
            }),
          );
          setUrl(objectUrl);
        } finally {
          original.fill(0);
          cleaned?.fill(0);
        }
      } else {
        const initial = await decryptChunk(item, master, 0, controller.signal);
        if (disposed) {
          initial.fill(0);
          return;
        }
        chunks.set(0, initial);
        transport = new PDFDataRangeTransport(
          item.metadata.size,
          new Uint8Array(initial),
          false,
        );
        transport.requestDataRange = (begin, end) => {
          void (async () => {
            const bytes = new Uint8Array(end - begin);
            for (
              let index = Math.floor(begin / CHUNK_SIZE);
              index < Math.ceil(end / CHUNK_SIZE);
              index++
            ) {
              let part = chunks.get(index);
              if (!part) {
                part = await decryptChunk(
                  item,
                  master,
                  index,
                  controller.signal,
                );
                chunks.set(index, part);
              }
              const from = Math.max(begin, index * CHUNK_SIZE),
                to = Math.min(end, (index + 1) * CHUNK_SIZE);
              bytes.set(
                part.subarray(
                  from - index * CHUNK_SIZE,
                  to - index * CHUNK_SIZE,
                ),
                from - begin,
              );
            }
            if (!disposed) transport?.onDataRange(begin, bytes);
            while (chunks.size > 4) {
              const oldest = chunks.keys().next().value!;
              const old=chunks.get(oldest);if(old?.byteLength)old.fill(0);
              chunks.delete(oldest);
            }
          })().catch((e) => {
            if (!disposed)
              setError(e instanceof Error ? e.message : "解密失败");
          });
        };
        transport.abort = () => controller.abort();
        setRange(transport);
      }
    };
    void load().catch((e) => {
      if (!disposed) setError(e instanceof Error ? e.message : "解密失败");
    });
    return () => {
      disposed = true;
      controller.abort();
      transport?.abort();
      for (const bytes of chunks.values()) if (bytes.byteLength) bytes.fill(0);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.id, item.metadata.format, item.metadata.size, master]);
  const annotations = useMemo<Annotation[]>(
    () =>
      state.annotations.map((x) => ({
        ...x,
        bookId: item.id,
        style: "HIGHLIGHT",
        color: "YELLOW",
      })),
    [item.id, state.annotations],
  );
  const position = useCallback(
    (locator: string, progress: number) =>
      change((s) => ({ ...s, locator, progress })),
    [change],
  );
  const props = {
    bookId: item.id,
    annotations,
    theme,
    fontSize: 19,
    fontFamily: '"Noto Serif SC", serif',
    readOnly: true,
    pageTurnEnabled: false,
    target,
    onSelect: setSelection,
    onPosition: position,
  };
  return (
    <div className="bk-content-stack">
      <div className="bk-content-tools">
        <Button
          onClick={() =>
            void flush()
              .then(onClose)
              .catch((e) => setError(e.message))
          }
        >
          保存并返回专区
        </Button>
        <Button onClick={() => void flush().catch((e) => setError(e.message))}>
          保存加密记录
        </Button>
      </div>
      {(error || saveError) && (
        <Alert type="error" title={error || saveError} />
      )}
      {!error && (
        <div className="bk-private-reader">
          <Suspense fallback={<Skeleton active />}>
            {item.metadata.format === "EPUB" ? (
              url ? (
                <Epub {...props} contentUrl={url} onNavigation={noNavigation} />
              ) : (
                <Skeleton active />
              )
            ) : range ? (
              <Pdf {...props} dataRange={range} />
            ) : (
              <Skeleton active />
            )}
          </Suspense>
        </div>
      )}
      <IndependentNotes
        state={state}
        change={change}
        selection={selection}
        onJump={setTarget}
      />
    </div>
  );
}
