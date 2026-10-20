import { randomId } from "../../utils/random-id";
import { useState } from "react";
import {
  _AntButton as Button,
  _AntCard as Card,
  Input,
  Tag,
} from "../../ui/antd";
import { type ReadingState, type Entry } from "./api";
export function IndependentNotes({
  state,
  selection,
  change,
  onJump,
}: {
  state: ReadingState;
  selection: { quote: string; locator: string } | null;
  change: (fn: (s: ReadingState) => ReadingState) => void;
  onJump: (locator: string) => void;
}) {
  const [note, setNote] = useState("");
  const add = (type: Entry["type"]) => {
    const entry: Entry = {
      id: randomId(),
      type,
      quote: selection?.quote ?? "",
      note,
      locator: selection?.locator ?? state.locator,
      createdAt: new Date().toISOString(),
    };
    change((s) => ({ ...s, annotations: [...s.annotations, entry] }));
    setNote("");
  };
  return (
    <Card title="独立阅读笔记">
      <div className="bk-content-stack">
        <p>
          本区阅读时间：{Math.floor(state.seconds / 60)} 分{" "}
          {Math.floor(state.seconds % 60)} 秒 · 进度{" "}
          {Math.round(state.progress * 100)}%
        </p>
        {selection?.quote && <blockquote>{selection.quote}</blockquote>}
        <Input.TextArea
          aria-label="阅读笔记"
          placeholder="记录笔记"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="bk-content-tools">
          <Button disabled={!selection?.quote} onClick={() => add("HIGHLIGHT")}>
            高亮所选文字
          </Button>
          <Button disabled={!note.trim()} onClick={() => add("NOTE")}>
            保存笔记
          </Button>
          <Button onClick={() => add("BOOKMARK")}>添加书签</Button>
        </div>
        {state.annotations.map((entry) => (
          <Card size="small" key={entry.id}>
            <Tag>
              {entry.type === "NOTE"
                ? "笔记"
                : entry.type === "BOOKMARK"
                  ? "书签"
                  : "高亮"}
            </Tag>
            <p className="bk-content-note">{entry.quote}</p>
            <p className="bk-content-note">{entry.note}</p>
            <div className="bk-content-tools">
              <Button size="small" onClick={() => onJump(entry.locator)}>
                回到原文
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  change((s) => ({
                    ...s,
                    annotations: s.annotations.filter((x) => x.id !== entry.id),
                  }))
                }
              >
                删除
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}
