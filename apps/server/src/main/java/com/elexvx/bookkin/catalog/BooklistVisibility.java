// 书单可见范围与所有权、可编辑性分别判断，PUBLIC 不允许泄露非公开书籍。
// Booklist visibility is distinct from ownership/editability; PUBLIC does not authorize disclosure of private books.
package com.elexvx.bookkin.catalog;

public enum BooklistVisibility {
    PRIVATE,
    MEMBERS,
    PUBLIC
}
