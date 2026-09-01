package io.github.johntao2004.bookkin.reading;

import io.github.johntao2004.bookkin.catalog.BookFormat;
import io.github.johntao2004.bookkin.common.ApiException;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

final class BookContentResponse {
    private static final int BUFFER_SIZE = 256 * 1024;

    private BookContentResponse() {}

    static ByteRange select(HttpServletResponse response, String header, long size) {
        if (size <= 0) throw ApiException.notFound("BOOK_FILE_NOT_FOUND", "书籍文件为空。");
        if (header == null || header.isBlank()) return new ByteRange(0, size - 1, false);
        String normalized = header.trim();
        int separator = normalized.indexOf('=');
        if (separator < 0 || !normalized.substring(0, separator).equalsIgnoreCase("bytes")
                || normalized.contains(",")) {
            throw invalidRange(response, size, "仅支持单段 HTTP Range。");
        }
        String[] parts = normalized.substring(separator + 1).split("-", -1);
        try {
            if (parts.length != 2) throw new NumberFormatException();
            long start;
            long end;
            if (parts[0].isBlank()) {
                long suffix = Long.parseLong(parts[1]);
                start = Math.max(0, size - suffix);
                end = size - 1;
            } else {
                start = Long.parseLong(parts[0]);
                end = parts[1].isBlank() ? size - 1 : Math.min(size - 1, Long.parseLong(parts[1]));
            }
            if (start < 0 || start > end || start >= size) throw new NumberFormatException();
            return new ByteRange(start, end, true);
        } catch (NumberFormatException exception) {
            throw invalidRange(response, size, "请求的字节范围无效。");
        }
    }

    static void write(HttpServletResponse response, Path path, BookFormat format,
                      ByteRange range, long totalSize, boolean headOnly) throws IOException {
        response.setStatus(range.partial() ? HttpStatus.PARTIAL_CONTENT.value() : HttpStatus.OK.value());
        response.setHeader(HttpHeaders.ACCEPT_RANGES, "bytes");
        response.setContentLengthLong(range.length());
        response.setContentType(format == BookFormat.EPUB ? "application/epub+zip" : MediaType.APPLICATION_PDF_VALUE);
        if (range.partial()) {
            response.setHeader(HttpHeaders.CONTENT_RANGE,
                    "bytes " + range.start() + "-" + range.end() + "/" + totalSize);
        }
        if (headOnly) {
            response.flushBuffer();
            return;
        }

        try (FileChannel channel = FileChannel.open(path, StandardOpenOption.READ)) {
            channel.position(range.start());
            ByteBuffer buffer = ByteBuffer.allocate(BUFFER_SIZE);
            OutputStream output = response.getOutputStream();
            long remaining = range.length();
            while (remaining > 0) {
                buffer.clear();
                buffer.limit((int) Math.min(buffer.capacity(), remaining));
                int read = channel.read(buffer);
                if (read < 0) break;
                output.write(buffer.array(), 0, read);
                remaining -= read;
            }
            response.flushBuffer();
        }
    }

    private static ApiException invalidRange(HttpServletResponse response, long size, String message) {
        response.setHeader(HttpHeaders.CONTENT_RANGE, "bytes */" + size);
        return new ApiException(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "INVALID_RANGE", message);
    }

    record ByteRange(long start, long end, boolean partial) {
        long length() { return end - start + 1; }
    }
}
