// 撤销会话的确认界面说明保存窗口，确认后由服务器标记目标会话。
// Session-revocation confirmation explains the save window before the server marks target sessions.
import { useState } from "react";
import { api } from "../api/client";
import { Button } from "../ui/buttons";
import { Alert } from "../ui/feedback";
import { Dialog, DialogActions, DialogContent, DialogTitle } from "../ui/overlays";
import { Typography } from "../ui/primitives";
export function RevokeSessionsDialog({target,onClose,onRevoked}:{target:{id:string;displayName:string}|null;onClose:()=>void;onRevoked:()=>void}) {
 const [busy,setBusy]=useState(false); const [error,setError]=useState("");
 return <Dialog open={Boolean(target)} onClose={()=>{if(!busy){setError("");onClose();}}} fullWidth maxWidth="sm">
  <DialogTitle>退出全部会话</DialogTitle>
  <DialogContent><Typography>确认退出“{target?.displayName}”的全部会话？在线设备将先保存阅读数据，再退出登录；离线设备重新连接后需要登录。</Typography>{error && <Alert severity="error">{error}</Alert>}</DialogContent>
  <DialogActions><Button disabled={busy} onClick={onClose}>取消</Button><Button variant="contained" disabled={busy} onClick={async()=>{
   if(!target)return;setBusy(true);setError("");try{await api.revokeUserSessions(target.id);onRevoked();onClose();}catch(e){setError(e instanceof Error?e.message:"退出失败，请重试。");}finally{setBusy(false);}
  }}>{busy?"正在处理…":"确认退出全部会话"}</Button></DialogActions>
 </Dialog>;
}
