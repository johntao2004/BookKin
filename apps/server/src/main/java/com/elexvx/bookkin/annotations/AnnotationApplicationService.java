package com.elexvx.bookkin.annotations;

import com.elexvx.bookkin.annotations.AnnotationRepository.Annotation;
import com.elexvx.bookkin.annotations.AnnotationRepository.AnnotationStyle;
import com.elexvx.bookkin.annotations.AnnotationRepository.AnnotationType;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnnotationApplicationService {
    private final AnnotationRepository annotations;

    public AnnotationApplicationService(AnnotationRepository annotations) {
        this.annotations = annotations;
    }

    @Transactional
    public Annotation create(UUID userId, UUID bookId, AnnotationType type, String locator, String quote, String note,
                             AnnotationStyle style, String color) {
        return annotations.create(userId, bookId, type, locator, quote, note, style, color);
    }
}
