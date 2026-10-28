package com.elexvx.bookkin.catalog;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class ThemaSubjectsTest {
    @Test void validatesFullDepthCodesAndRejectsQualifiersUnknownRootsAndTooMany() {
        assertEquals(List.of("RNKH2", "AKH", "UM", "PSPF"), ThemaSubjects.validate(List.of("RNKH2", "AKH", "UM", "PSPF")));
        for (var codes : List.of(List.of("P"), List.of("INVALID"), List.of("1FPC"), List.of("PS", "PH", "PN", "UM", "AKH"))) {
            assertThrows(com.elexvx.bookkin.common.ApiException.class, () -> ThemaSubjects.validate(codes));
        }
        assertEquals(List.of("PS"), ThemaSubjects.validate(List.of("PS", "PS")));
        assertEquals("P", ThemaSubjects.filter("P"));
        assertEquals("UNCLASSIFIED", ThemaSubjects.filter("UNCLASSIFIED"));
        assertThrows(com.elexvx.bookkin.common.ApiException.class, () -> ThemaSubjects.filter("P%"));
        assertEquals(List.of("RNKH2"), ThemaSubjects.extract(List.of("rnkh2", "unknown", "1FPC")));
    }

    @Test void exposesAnImmutableBoundedRootCatalog() {
        assertEquals(20, ThemaSubjects.roots().size());
        assertTrue(ThemaSubjects.catalog().size() > 3000);
        assertTrue(ThemaSubjects.underRoots(List.of("P", "invalid")).stream().allMatch(subject -> subject.code().startsWith("P")));
        assertFalse(ThemaSubjects.underRoots(List.of("P")).stream().anyMatch(subject -> subject.code().startsWith("Y")));
        assertThrows(UnsupportedOperationException.class, () -> ThemaSubjects.roots().add(new ThemaSubjects.Subject("Z", "bad", null)));
    }
}
