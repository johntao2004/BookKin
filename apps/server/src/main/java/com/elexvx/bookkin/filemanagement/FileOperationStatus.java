// 任务状态区分成功、失败和显式回滚，排队或运行中不能被视为文件操作完成。
// Separates success, failure and explicit rollback; planned/running work is not completed file mutation.
package com.elexvx.bookkin.filemanagement;

public enum FileOperationStatus {
    PLANNED,
    RUNNING,
    SUCCEEDED,
    FAILED,
    ROLLED_BACK
}
