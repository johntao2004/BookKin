// 枚举受控文件动作；对应预览、权限和恢复规则仍由服务层执行，PURGE 不等同于可恢复回收。
// Enumerates controlled file actions; services enforce preview, authorization and recovery, with PURGE distinct from recoverable trash.
package com.elexvx.bookkin.filemanagement;

public enum FileOperationType {
    RENAME,
    MOVE,
    TRASH,
    RESTORE,
    WRITE_METADATA,
    PURGE
}
