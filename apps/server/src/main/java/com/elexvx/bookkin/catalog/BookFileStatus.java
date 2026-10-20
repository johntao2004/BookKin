// 描述目录中的文件状态，不等同于此刻的文件系统可用性；执行操作前仍需重新检查。
// Describes catalog file state, not guaranteed current filesystem availability; operations must recheck their inputs.
package com.elexvx.bookkin.catalog;

public enum BookFileStatus {
    AVAILABLE,
    OPERATING,
    TRASHED,
    MISSING,
    DELETED
}
