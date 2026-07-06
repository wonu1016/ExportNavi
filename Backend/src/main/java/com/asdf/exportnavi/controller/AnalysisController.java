package com.asdf.exportnavi.controller;

import com.asdf.exportnavi.dto.AnalysisRequestDto;
import com.asdf.exportnavi.dto.AnalysisDraftRequestDto;
import com.asdf.exportnavi.dto.AnalysisResponseDto;
import com.asdf.exportnavi.dto.GuidedHsCodeRequestDto;
import com.asdf.exportnavi.dto.GuidedHsCodeResponseDto;
import com.asdf.exportnavi.dto.HsCodeConfirmRequestDto;
import com.asdf.exportnavi.dto.ActionChecklistItemDto;
import com.asdf.exportnavi.dto.ChecklistUpdateRequestDto;
import com.asdf.exportnavi.dto.ReportUpdateRequestDto;
import com.asdf.exportnavi.dto.ShareLinkResponseDto;
import com.asdf.exportnavi.dto.SpecFileExtractionDto;
import com.asdf.exportnavi.dto.StrategyReportResponseDto;
import com.asdf.exportnavi.service.AnalysisService;
import com.asdf.exportnavi.service.AnalysisFileExtractionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;
    private final AnalysisFileExtractionService analysisFileExtractionService;

    /**
     * 1단계: 분석 요청 (제품 정보 입력 → AI가 HS코드 후보 추정)
     */
    @PostMapping
    public ResponseEntity<AnalysisResponseDto> createAnalysis(
            Authentication auth,
            @Valid @RequestBody AnalysisRequestDto request) {
        String email = auth.getName();
        return ResponseEntity.ok(analysisService.createAnalysis(email, request));
    }

    @PostMapping("/draft")
    public ResponseEntity<AnalysisResponseDto> saveDraft(
            Authentication auth,
            @RequestBody AnalysisDraftRequestDto request) {
        return ResponseEntity.ok(analysisService.saveDraft(auth.getName(), request));
    }

    @PatchMapping("/{id}/draft")
    public ResponseEntity<AnalysisResponseDto> updateDraft(
            @PathVariable Long id,
            Authentication auth,
            @RequestBody AnalysisDraftRequestDto request) {
        return ResponseEntity.ok(analysisService.updateDraft(auth.getName(), id, request));
    }

    @PostMapping(value = "/extract", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SpecFileExtractionDto> extractSpecFile(
            @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(analysisFileExtractionService.extract(file));
    }

    @PostMapping("/guided-hs")
    public ResponseEntity<GuidedHsCodeResponseDto> guideHsCode(
            @Valid @RequestBody GuidedHsCodeRequestDto request) {
        return ResponseEntity.ok(analysisService.guideHsCode(request));
    }

    /**
     * 2단계: HS코드 확정 → 유망시장 + 리스크 + 전략물자 분석 → 종합 리포트
     */
    @PostMapping("/{id}/confirm")
    public ResponseEntity<AnalysisResponseDto> confirmAndAnalyze(
            @PathVariable Long id,
            Authentication auth,
            @Valid @RequestBody HsCodeConfirmRequestDto request) {
        return ResponseEntity.ok(analysisService.confirmAndAnalyze(auth.getName(), id, request));
    }

    /**
     * 분석 리포트 단건 조회
     */
    @GetMapping("/{id}")
    public ResponseEntity<AnalysisResponseDto> getReport(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(analysisService.getReport(auth.getName(), id));
    }

    /**
     * 내 분석 리포트 목록 조회 (JWT에서 사용자 식별)
     */
    @GetMapping
    public ResponseEntity<List<AnalysisResponseDto>> getMyReports(
            Authentication auth,
            @RequestParam(required = false) String query) {
        String email = auth.getName();
        return ResponseEntity.ok(analysisService.getMyReports(email, query));
    }

    @PatchMapping("/{id}/checklist/{itemId}")
    public ResponseEntity<ActionChecklistItemDto> updateChecklistItem(
            @PathVariable Long id,
            @PathVariable Long itemId,
            Authentication auth,
            @Valid @RequestBody ChecklistUpdateRequestDto request) {
        return ResponseEntity.ok(analysisService.updateChecklistItem(
                auth.getName(), id, itemId, request.getCompleted()));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<AnalysisResponseDto> renameReport(
            @PathVariable Long id,
            Authentication auth,
            @Valid @RequestBody ReportUpdateRequestDto request) {
        return ResponseEntity.ok(analysisService.renameReport(auth.getName(), id, request));
    }

    @PostMapping("/{id}/reanalyze")
    public ResponseEntity<AnalysisResponseDto> reanalyze(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(analysisService.reanalyze(auth.getName(), id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReport(
            @PathVariable Long id,
            Authentication auth) {
        analysisService.deleteReport(auth.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<ShareLinkResponseDto> enableSharing(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(analysisService.enableSharing(auth.getName(), id));
    }

    @DeleteMapping("/{id}/share")
    public ResponseEntity<Void> revokeSharing(
            @PathVariable Long id,
            Authentication auth) {
        analysisService.revokeSharing(auth.getName(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/strategy")
    public ResponseEntity<StrategyReportResponseDto> buildStrategyReport(
            @PathVariable Long id,
            Authentication auth) {
        return ResponseEntity.ok(analysisService.buildStrategyReport(auth.getName(), id));
    }
}
