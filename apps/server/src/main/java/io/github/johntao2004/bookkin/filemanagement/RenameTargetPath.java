package io.github.johntao2004.bookkin.filemanagement;

import io.github.johntao2004.bookkin.catalog.BookFile;
import io.github.johntao2004.bookkin.common.ApiException;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;

final class RenameTargetPath {
    private static final Set<String> BOOK_EXTENSIONS = Set.of(".epub", ".pdf");

    private RenameTargetPath() {}

    static String resolve(BookFile file, String requestedName, PathPolicy pathPolicy) {
        if (requestedName == null || requestedName.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TARGET_REQUIRED", "重命名必须指定书名。");
        }
        String rawName = requestedName.strip();
        if (rawName.indexOf('/') >= 0 || rawName.indexOf('\\') >= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "RENAME_NAME_ONLY", "重命名只需要书名，不需要目录路径。");
        }

        String name = pathPolicy.normalizeRelative(rawName);
        String expectedExtension = "." + file.format().name().toLowerCase(Locale.ROOT);
        int lastDot = name.lastIndexOf('.');
        if (lastDot > 0) {
            String typedExtension = name.substring(lastDot).toLowerCase(Locale.ROOT);
            if (BOOK_EXTENSIONS.contains(typedExtension) && !typedExtension.equals(expectedExtension)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "FORMAT_EXTENSION_MISMATCH",
                        "扩展名由原文件格式自动保留为 " + expectedExtension + "，无需填写扩展名。");
            }
        }
        if (name.toLowerCase(Locale.ROOT).endsWith(expectedExtension)) {
            name = name.substring(0, name.length() - expectedExtension.length());
        }
        if (name.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "TARGET_REQUIRED", "重命名必须指定书名。");
        }

        String sourceRelative = pathPolicy.normalizeRelative(file.relativePath());
        int slash = sourceRelative.lastIndexOf('/');
        String parent = slash < 0 ? "" : sourceRelative.substring(0, slash);
        return (parent.isEmpty() ? "" : parent + "/") + name + expectedExtension;
    }
}
