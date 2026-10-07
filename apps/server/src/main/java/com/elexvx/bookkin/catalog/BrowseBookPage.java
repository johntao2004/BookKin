package com.elexvx.bookkin.catalog;

import java.util.List;

public record BrowseBookPage(List<BrowseBook> items, String nextCursor) {
}
