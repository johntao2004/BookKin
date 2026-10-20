// 游标是下一页定位信息，不是总条数；消费方应按相同筛选条件连续请求。
// The cursor locates the next page rather than reporting a total; consumers retain the same filters across pages.
package com.elexvx.bookkin.catalog;

import java.util.List;

public record BrowseBookPage(List<BrowseBook> items, String nextCursor) {
}
