package com.asdf.exportnavi.repository;

import com.asdf.exportnavi.entity.AnalysisReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AnalysisReportRepository extends JpaRepository<AnalysisReport, Long> {
    List<AnalysisReport> findByMemberIdOrderByCreatedAtDesc(Long memberId);

    List<AnalysisReport> findByMemberIdAndReportTitleContainingIgnoreCaseOrderByCreatedAtDesc(
            Long memberId, String reportTitle);

    Optional<AnalysisReport> findByIdAndMemberEmail(Long id, String email);

    Optional<AnalysisReport> findByShareTokenAndSharingEnabledTrue(String shareToken);
}
