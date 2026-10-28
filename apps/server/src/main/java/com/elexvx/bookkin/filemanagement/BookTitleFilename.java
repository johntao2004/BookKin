package com.elexvx.bookkin.filemanagement;

import com.elexvx.bookkin.catalog.BookFormat;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.Locale;

/** One portable filename policy for extracted, reviewed and subsequently edited book titles. */
public final class BookTitleFilename {
    private BookTitleFilename() {}

    public static String segment(String title) {
        String value = Normalizer.normalize(title == null ? "" : title, Normalizer.Form.NFC)
                .replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", " ").replaceAll("\\s+", " ").strip();
        value = value.replaceAll("[. ]+$", "");
        if (value.isBlank()) value = "未命名";
        // Prefix OS-reserved and internal names without changing the bibliographic title.
        String stem = value.split("\\.", 2)[0].toUpperCase(Locale.ROOT);
        if (stem.matches("CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9]") || value.startsWith(".bookkin-")) value = "_" + value;
        // Reserve room for the extension on filesystems with a 255-byte component limit.
        while (value.getBytes(StandardCharsets.UTF_8).length > 240) {
            value = value.substring(0, value.offsetByCodePoints(value.length(), -1));
        }
        value = value.replaceAll("[. ]+$", "");
        return value;
    }

    public static String inDirectory(String currentPath, String title, BookFormat format, PathPolicy paths) {
        String current = paths.normalizeRelative(currentPath);
        int slash = current.lastIndexOf('/');
        return paths.normalizeRelative((slash < 0 ? "" : current.substring(0, slash + 1))
                + segment(title) + "." + format.name().toLowerCase(Locale.ROOT));
    }
}
