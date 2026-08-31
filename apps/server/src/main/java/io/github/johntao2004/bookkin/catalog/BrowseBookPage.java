package io.github.johntao2004.bookkin.catalog;

import java.util.List;

public record BrowseBookPage(List<BrowseBook> items, String nextCursor) {
}
