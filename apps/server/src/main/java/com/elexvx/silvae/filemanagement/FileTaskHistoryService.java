package com.elexvx.silvae.filemanagement;

import com.elexvx.silvae.filemanagement.FileTaskHistoryModels.Entry;
import com.elexvx.silvae.filemanagement.FileTaskHistoryModels.Page;
import com.elexvx.silvae.ingestion.upload.BookUploadTaskHistoryModels.UploadSummary;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.BiFunction;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FileTaskHistoryService {
    private static final int CHUNK = 100;
    private final FileOperationTaskHistoryGateway operations;
    private final com.elexvx.silvae.ingestion.upload.BookUploadTaskHistoryGateway uploads;

    public FileTaskHistoryService(FileOperationTaskHistoryGateway operations,
                                  com.elexvx.silvae.ingestion.upload.BookUploadTaskHistoryGateway uploads) {
        this.operations = operations;
        this.uploads = uploads;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Page page(int page, int pageSize) {
        long skip = (long) page * pageSize;
        long total = operations.count() + uploads.count();
        if (skip >= total) return new Page(List.of(), total);
        long wanted = Math.min(total, skip + pageSize);
        var result = new ArrayList<Entry>(pageSize);
        var fileCursor = new Cursor<Entry>(operations::page, wanted);
        var uploadCursor = new Cursor<UploadSummary>(uploads::page, wanted);
        for (long index = 0; index < wanted; index++) {
            Entry file = fileCursor.peek();
            UploadSummary upload = uploadCursor.peek();
            if (file == null && upload == null) break;
            if (upload == null || (file != null && compare(file.createdAt(), file.type(), file.id(),
                    upload.createdAt(), "BOOK_UPLOAD", upload.id()) >= 0)) {
                fileCursor.take();
                if (index >= skip) result.add(file);
            } else {
                uploadCursor.take();
                if (index >= skip) result.add(new Entry(upload.id(), "BOOK_UPLOAD", null, upload.status(), null,
                        upload.title() == null || upload.title().isBlank() ? upload.originalFilename() : upload.title(),
                        upload.originalFilename(), upload.createdAt(), upload.updatedAt()));
            }
        }
        return new Page(result, total);
    }

    private static int compare(OffsetDateTime at, String atype, UUID aid, OffsetDateTime bt, String btype, UUID bid) {
        int time = at.compareTo(bt); // positive means left row sorts first (newer first)
        if (time != 0) return time;
        int type = atype.compareTo(btype);
        return type != 0 ? type : aid.toString().compareTo(bid.toString());
    }

    private static final class Cursor<T> {
        private final BiFunction<Integer, Long, List<T>> loader;
        private final long maximum;
        private long offset;
        private List<T> buffer = List.of();
        private int index;
        private boolean exhausted;
        Cursor(BiFunction<Integer, Long, List<T>> loader, long maximum) { this.loader = loader; this.maximum = maximum; }
        T peek() {
            if (index >= buffer.size() && !exhausted && offset < maximum) {
                buffer = loader.apply((int) Math.min(CHUNK, maximum - offset), offset);
                if (buffer.isEmpty() || buffer.size() < CHUNK) exhausted = true;
                offset += buffer.size(); index = 0;
            }
            return index < buffer.size() ? buffer.get(index) : null;
        }
        T take() { T value = peek(); if (value != null) index++; return value; }
    }
}
