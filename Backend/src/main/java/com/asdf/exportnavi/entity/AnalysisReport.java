package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class AnalysisReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member; // 분석 요청한 회원

    @Column(nullable = false)
    private String productName; // 제품명

    private String reportTitle;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String productDescription; // 제품 상세 설명 (LLM 입력용)

    private String material;

    private String intendedUse;

    private String specifications;

    private String processingState;

    private String targetCountries;

    private String referenceUrl;

    private String specFileName;

    private String specFileType;

    @Column(columnDefinition = "TEXT")
    private String specFileText;

    private String confirmedHsCode; // 사용자가 최종 확정한 HS코드

    @Enumerated(EnumType.STRING)
    private OverallGrade overallGrade; // 종합 수출 적합도 (A~D)

    @Column(columnDefinition = "TEXT")
    private String reportSummary; // LLM이 생성한 종합 리포트 요약

    @Enumerated(EnumType.STRING)
    private DataStatus aiDataStatus;

    @Enumerated(EnumType.STRING)
    private DataStatus marketDataStatus;

    @Enumerated(EnumType.STRING)
    private DataStatus riskDataStatus;

    @Enumerated(EnumType.STRING)
    private DataStatus strategicDataStatus;

    private LocalDateTime dataRetrievedAt;

    @Column(columnDefinition = "TEXT")
    private String dataStatusMessage;

    @Column(columnDefinition = "TEXT")
    private String failureMessage;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AnalysisStatus status = AnalysisStatus.PENDING; // 분석 진행 상태

    @OneToMany(mappedBy = "analysisReport", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<HsCode> hsCodes = new ArrayList<>(); // HS코드 후보 목록

    @OneToMany(mappedBy = "analysisReport", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MarketRecommendation> marketRecommendations = new ArrayList<>(); // 유망시장 추천 목록

    @OneToMany(mappedBy = "analysisReport", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RiskAssessment> riskAssessments = new ArrayList<>(); // 국가 리스크 평가 목록

    @OneToOne(mappedBy = "analysisReport", cascade = CascadeType.ALL, orphanRemoval = true)
    private StrategicItem strategicItem; // 전략물자 판정 결과

    @OneToMany(mappedBy = "analysisReport", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<ActionChecklistItem> actionChecklist = new ArrayList<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now(); // 리포트 생성일시

    @Column(unique = true)
    private String shareToken;

    @Builder.Default
    private Boolean sharingEnabled = false;

    private LocalDateTime sharedAt;

    public enum OverallGrade {
        A, B, C, D
    }

    public enum AnalysisStatus {
        PENDING, HS_CODE_ESTIMATED, HS_CODE_CONFIRMED, ANALYZING, COMPLETED, FAILED
    }

    public void markHsCodeEstimated() {
        this.status = AnalysisStatus.HS_CODE_ESTIMATED;
    }

    public void markAiDataStatus(DataStatus status, LocalDateTime retrievedAt) {
        this.aiDataStatus = status;
        this.dataRetrievedAt = retrievedAt;
    }

    public void markExternalDataStatus(DataStatus marketStatus,
                                       DataStatus riskStatus,
                                       DataStatus strategicStatus,
                                       LocalDateTime retrievedAt,
                                       String message) {
        this.marketDataStatus = marketStatus;
        this.riskDataStatus = riskStatus;
        this.strategicDataStatus = strategicStatus;
        this.dataRetrievedAt = retrievedAt;
        this.dataStatusMessage = message;
    }

    public void confirmHsCode(String hsCode) {
        this.confirmedHsCode = hsCode;
        this.status = AnalysisStatus.HS_CODE_CONFIRMED;
    }

    public void startAnalyzing() {
        this.status = AnalysisStatus.ANALYZING;
        this.failureMessage = null;
    }

    public void complete(OverallGrade grade, String summary) {
        this.overallGrade = grade;
        this.reportSummary = summary;
        this.status = AnalysisStatus.COMPLETED;
    }

    public void fail(String message) {
        this.failureMessage = message;
        this.status = AnalysisStatus.FAILED;
    }

    public void setStrategicItem(StrategicItem strategicItem) {
        this.strategicItem = strategicItem;
    }

    public void rename(String reportTitle) {
        this.reportTitle = reportTitle.trim();
    }

    public void updateDraft(String reportTitle,
                            String productName,
                            String productDescription,
                            String material,
                            String intendedUse,
                            String specifications,
                            String processingState,
                            String targetCountries,
                            String referenceUrl,
                            String specFileName,
                            String specFileType,
                            String specFileText) {
        if (reportTitle != null && !reportTitle.isBlank()) {
            this.reportTitle = reportTitle.trim();
        }
        if (productName != null && !productName.isBlank()) {
            this.productName = productName.trim();
        }
        if (productDescription != null) {
            this.productDescription = productDescription;
        }
        if (material != null) this.material = material;
        if (intendedUse != null) this.intendedUse = intendedUse;
        if (specifications != null) this.specifications = specifications;
        if (processingState != null) this.processingState = processingState;
        if (targetCountries != null) this.targetCountries = targetCountries;
        if (referenceUrl != null) this.referenceUrl = referenceUrl;
        if (specFileName != null) this.specFileName = specFileName;
        if (specFileType != null) this.specFileType = specFileType;
        if (specFileText != null) this.specFileText = specFileText;
        if (this.reportTitle == null || this.reportTitle.isBlank()) {
            this.reportTitle = this.productName;
        }
    }

    public String getReportTitle() {
        return reportTitle == null || reportTitle.isBlank() ? productName : reportTitle;
    }

    public void resetAnalysisResults() {
        this.overallGrade = null;
        this.reportSummary = null;
        this.marketDataStatus = null;
        this.riskDataStatus = null;
        this.strategicDataStatus = null;
        this.dataStatusMessage = null;
        this.marketRecommendations.clear();
        this.riskAssessments.clear();
        this.actionChecklist.clear();
        this.strategicItem = null;
        this.status = AnalysisStatus.ANALYZING;
    }

    public void enableSharing(String token) {
        this.shareToken = token;
        this.sharingEnabled = true;
        this.sharedAt = LocalDateTime.now();
    }

    public void revokeSharing() {
        this.sharingEnabled = false;
        this.shareToken = null;
        this.sharedAt = null;
    }
}
