package com.asdf.exportnavi.repository;

import com.asdf.exportnavi.entity.ActionChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ActionChecklistItemRepository extends JpaRepository<ActionChecklistItem, Long> {
    Optional<ActionChecklistItem> findByIdAndAnalysisReportIdAndAnalysisReportMemberEmail(
            Long id, Long reportId, String email);
}
