// 公共排序选项由仓储映射成受控查询，不接收任意 SQL 排序表达式。
// Repository logic maps these public sort choices to controlled queries, not arbitrary SQL ordering expressions.
package com.elexvx.bookkin.catalog;

public enum BookSort {
    RECENT,
    TITLE,
    AUTHOR
}
