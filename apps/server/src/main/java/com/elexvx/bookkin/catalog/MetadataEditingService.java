package com.elexvx.bookkin.catalog;

import java.security.Principal;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MetadataEditingService {
    private final BookMetadataRepository metadata;
    private final DisplayCatalogService display;
    public MetadataEditingService(BookMetadataRepository metadata, DisplayCatalogService display) {
        this.metadata = metadata; this.display = display;
    }
    // 书目修改和公开状态在同一数据库事务中保存。
    /** Bibliographic edits and public visibility are saved as one database transaction. */
    // 数据库书目信息与公开状态一起提交；原文件写回走独立文件操作流程。
    // Bibliographic data and visibility commit together in the database; original-file writeback uses the separate file-operation flow.
    @Transactional
    public void update(UUID bookId, BookMetadataRepository.MetadataPatch patch, Boolean publiclyVisible, Principal principal) {
        metadata.update(bookId, patch);
        if (publiclyVisible != null) display.setVisibility(bookId, publiclyVisible, principal);
    }
}
