import { PageContainer } from "../components/PageHeader";
import { CloudUploadOutlined } from "@/ui/icons";
import { Alert } from "@/ui/feedback";
import { Box } from "@/ui/primitives";
import { Button } from "@/ui/buttons";
import { Card } from "@/ui/cards";
import { CardContent } from "@/ui/primitives";
import { Chip } from "@/ui/feedback";
import { CircularProgress } from "@/ui/feedback";
import { FormControl } from "@/ui/primitives";
import { InputLabel } from "@/ui/primitives";
import { MenuItem } from "@/ui/primitives";
import { Select } from "@/ui/forms";
import { Snackbar } from "@/ui/primitives";
import { Stack } from "@/ui/primitives";
import { Switch } from "@/ui/forms";
import { TextField } from "@/ui/forms";
import { Typography } from "@/ui/primitives";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../api/client";
import { readerFontFamily } from "../components/readers/reader-fonts";
import type { ReaderFont } from "../domain/types";
import { tokens } from "../theme/generated-tokens";

const allowedExtensions = new Set(["woff2", "woff", "ttf", "otf"]);
const uploadActionWidth = tokens.layout.touchTarget * 5;

export function ReaderFontsPage() {
  const queryClient = useQueryClient();
  const fontsQuery = useQuery({ queryKey: ["reader-fonts", "admin"], queryFn: api.listReaderFontsForAdmin });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<ReaderFont["kind"]>("SERIF");
  const [licenseNote, setLicenseNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fonts = fontsQuery.data ?? [];
  const upload = async (file: File) => {
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension)) {
      setError("只支持 WOFF2、WOFF、TTF 和 OTF 字体文件。");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("字体文件不能超过 25 MB。");
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    try {
      const created = await api.createReaderFont({ displayName: displayName.trim() || file.name.replace(/\.[^.]+$/u, ""), kind, filename: file.name, sizeBytes: file.size, licenseNote: licenseNote.trim() || undefined });
      await api.uploadReaderFontContent(created.id, file, setUploadProgress);
      await queryClient.invalidateQueries({ queryKey: ["reader-fonts", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["reader-fonts"] });
      setDisplayName("");
      setLicenseNote("");
      if (inputRef.current) inputRef.current.value = "";
      setNotice("字体已上传并启用，阅读器可以立即选择。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "字体上传失败");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (font: ReaderFont) => {
    try {
      await api.setReaderFontStatus(font.id, font.status === "ENABLED" ? "DISABLED" : "ENABLED");
      await queryClient.invalidateQueries({ queryKey: ["reader-fonts", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["reader-fonts"] });
      setNotice(font.status === "ENABLED" ? "字体已停用；已有阅读设置会自动回退。" : "字体已启用。");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "字体状态更新失败");
    }
  };

  return (
    <PageContainer>
      {fonts.filter((font) => font.source === "CUSTOM" && font.contentUrl).map((font) => <style key={font.id}>{`@font-face { font-family: "${font.familyName}"; src: url("${font.contentUrl}") format("${font.format?.toLowerCase() ?? "woff2"}"); font-display: swap; }`}</style>)}

      <Card variant="outlined" sx={{ mb: 4, borderRadius: `${tokens.radius.xl}px`, bgcolor: "background.paper" }}>
        <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ alignItems: { md: "flex-end" } }}>
            <Stack spacing={2} sx={{ flex: 1, width: "100%" }}>
              <Typography variant="h5">上传自定义字体</Typography>
              <Typography variant="body2" color="text.secondary">上传前请确认字体许可允许在家庭成员之间使用；系统会校验扩展名、文件签名、大小和 SHA-256。</Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField label="展示名称（可选）" value={displayName} onChange={(event: any) => setDisplayName(event.target.value)} fullWidth />
                <FormControl sx={{ minWidth: { sm: 170 }, gap: `${tokens.spacing[2]}px` }}>
                  <InputLabel id="reader-font-kind-label">字体类型</InputLabel>
                  <Select labelId="reader-font-kind-label" label="字体类型" value={kind} onChange={(event: any) => setKind(event.target.value as ReaderFont["kind"])}>
                    <MenuItem value="SERIF">衬线字体</MenuItem>
                    <MenuItem value="SANS">无衬线字体</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
              <TextField label="来源 / 许可说明（可选）" value={licenseNote} onChange={(event: any) => setLicenseNote(event.target.value)} fullWidth />
            </Stack>
            <Stack sx={{ width: { xs: "100%", md: uploadActionWidth }, flexShrink: 0 }}>
              <input ref={inputRef} hidden type="file" accept=".woff2,.woff,.ttf,.otf" onChange={(event: any) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
              <Button variant="contained" size="large" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <CloudUploadOutlined />} disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? `上传中 ${uploadProgress}%` : "选择字体文件"}</Button>
            </Stack>
          </Stack>
          <Typography component="p" variant="caption" color="text.secondary" sx={{ mt: `${tokens.spacing[2]}px`, ml: "auto", width: { xs: "100%", md: uploadActionWidth }, textAlign: "center" }}>WOFF2 / WOFF / TTF / OTF · ≤ 25 MB</Typography>
        </CardContent>
      </Card>

      {fontsQuery.isError && <Alert severity="error" sx={{ mb: 3 }}>无法读取字体列表，请刷新后重试。</Alert>}
      <Stack spacing={2}>
        {fonts.map((font) => (
          <Card key={font.id} variant="outlined" sx={{ borderRadius: `${tokens.radius.xl}px`, opacity: font.status === "ENABLED" ? 1 : 0.62 }}>
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", gap: 0.75 }}><Typography variant="h5" sx={{ fontFamily: readerFontFamily(font) }}>{font.displayName}</Typography><Chip size="small" label={font.kind === "SERIF" ? "衬线" : "无衬线"} /><Chip size="small" variant="outlined" label={font.source === "PRESET" ? "预设" : "自定义"} color={font.status === "ENABLED" ? "success" : "default"} /></Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontFamily: readerFontFamily(font) }}>BookKin阅读正文预览：山高水长，文字应当顺着视线自然延续。</Typography>
                  {font.licenseNote && <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>{font.licenseNote}</Typography>}
                </Box>
                <Switch
                  checked={font.status === "ENABLED"}
                  onChange={() => void toggle(font)}
                  disabled={font.source === "PRESET"}
                  slotProps={{
                    input: {
                      "aria-label": font.source === "PRESET"
                        ? `${font.displayName}为预设字体，已启用`
                        : `${font.status === "ENABLED" ? "停用" : "启用"}${font.displayName}`,
                    },
                  }}
                />
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError("")}><Alert severity="error" onClose={() => setError("")}>{error}</Alert></Snackbar>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice("")} message={notice} />
    </PageContainer>
  );
}
