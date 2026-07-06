package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.AnalysisReport;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Builder
public class AnalysisResponseDto {
    private Long id;
    private String productName;
    private String reportTitle;
    private String productDescription;
    private String material;
    private String intendedUse;
    private String specifications;
    private String processingState;
    private String targetCountries;
    private String referenceUrl;
    private String specFileName;
    private String specFileType;
    private String specFileText;
    private String confirmedHsCode;
    private String overallGrade;
    private String reportSummary;
    private String status;
    private String failureMessage;
    private List<HsCodeDto> hsCodes;
    private List<MarketRecommendationDto> marketRecommendations;
    private List<RiskAssessmentDto> riskAssessments;
    private StrategicItemDto strategicItem;
    private List<ActionChecklistItemDto> actionChecklist;
    private LocalDateTime createdAt;
    private LocalDateTime dataRetrievedAt;
    private Boolean dataStale;
    private List<DataSourceStatusDto> dataSourceStatuses;
    private Boolean sharingEnabled;
    private String shareToken;
    private LocalDateTime sharedAt;

    // 안전 설계: 출처 표기 + 면책 문구
    private List<String> dataSources;
    private String disclaimer;

    private static final String DISCLAIMER_TEXT =
            "본 분석 결과는 공공데이터 기반의 참고용 안내이며, 법적 효력이 없습니다. "
            + "전략물자 해당 여부는 반드시 yesTrade 공식 자가판정 시스템을 통해 확인하시고, "
            + "HS코드는 관세청 품목분류 사전심사를 권장합니다. "
            + "최종 수출 의사결정은 전문가 상담을 병행해 주세요.";

    private static final List<String> DATA_SOURCE_LIST = List.of(
            "KOTRA 해외시장뉴스 Open API (유망시장 추천)",
            "한국무역보험공사 국가신용도 API (리스크 평가)",
            "전략물자관리원 yesTrade HSK 연계표 (전략물자 판정)",
            "OpenAI (HS코드 추정 및 종합 리포트 생성)"
    );

    public static AnalysisResponseDto from(AnalysisReport report) {
        boolean isCompleted = report.getStatus() == AnalysisReport.AnalysisStatus.COMPLETED;

        return AnalysisResponseDto.builder()
                .id(report.getId())
                .productName(report.getProductName())
                .reportTitle(report.getReportTitle())
                .productDescription(report.getProductDescription())
                .material(report.getMaterial())
                .intendedUse(report.getIntendedUse())
                .specifications(report.getSpecifications())
                .processingState(report.getProcessingState())
                .targetCountries(report.getTargetCountries())
                .referenceUrl(report.getReferenceUrl())
                .specFileName(report.getSpecFileName())
                .specFileType(report.getSpecFileType())
                .specFileText(report.getSpecFileText())
                .confirmedHsCode(report.getConfirmedHsCode())
                .overallGrade(report.getOverallGrade() != null ? report.getOverallGrade().name() : null)
                .reportSummary(report.getReportSummary())
                .status(report.getStatus().name())
                .failureMessage(report.getFailureMessage())
                .hsCodes(report.getHsCodes().stream().map(HsCodeDto::from).toList())
                .marketRecommendations(report.getMarketRecommendations().stream()
                        .map(MarketRecommendationDto::from).toList())
                .riskAssessments(report.getRiskAssessments().stream()
                        .map(RiskAssessmentDto::from).toList())
                .strategicItem(report.getStrategicItem() != null
                        ? StrategicItemDto.from(report.getStrategicItem()) : null)
                .actionChecklist(report.getActionChecklist().stream()
                        .map(ActionChecklistItemDto::from).toList())
                .createdAt(report.getCreatedAt())
                .dataRetrievedAt(report.getDataRetrievedAt())
                .dataStale(report.getDataRetrievedAt() != null
                        && report.getDataRetrievedAt().isBefore(LocalDateTime.now().minusDays(30)))
                .dataSourceStatuses(buildDataSourceStatuses(report, isCompleted))
                .sharingEnabled(report.getSharingEnabled())
                .shareToken(report.getShareToken())
                .sharedAt(report.getSharedAt())
                .dataSources(isCompleted ? DATA_SOURCE_LIST : List.of("OpenAI (HS코드 추정)"))
                .disclaimer(DISCLAIMER_TEXT)
                .build();
    }

    private static List<DataSourceStatusDto> buildDataSourceStatuses(
            AnalysisReport report, boolean isCompleted) {
        DataSourceStatusDto ai = DataSourceStatusDto.builder()
                .key("ai")
                .name("OpenAI")
                .url("https://openai.com/")
                .status(report.getAiDataStatus())
                .retrievedAt(report.getDataRetrievedAt())
                .message(report.getAiDataStatus() == com.asdf.exportnavi.entity.DataStatus.FAILED
                        ? "AI 분석을 완료하지 못했습니다." : null)
                .build();

        if (!isCompleted) {
            return List.of(ai);
        }

        return List.of(
                ai,
                source("market", "KOTRA", "https://www.kotra.or.kr/",
                        report.getMarketDataStatus(), report),
                source("risk", "한국무역보험공사", "https://www.ksure.or.kr/",
                        report.getRiskDataStatus(), report),
                source("strategic", "YesTrade", "https://www.yestrade.go.kr/",
                        report.getStrategicDataStatus(), report)
        );
    }

    private static DataSourceStatusDto source(String key, String name, String url,
                                               com.asdf.exportnavi.entity.DataStatus status,
                                               AnalysisReport report) {
        return DataSourceStatusDto.builder()
                .key(key)
                .name(name)
                .url(url)
                .status(status)
                .retrievedAt(report.getDataRetrievedAt())
                .message(status == com.asdf.exportnavi.entity.DataStatus.FAILED
                        ? report.getDataStatusMessage() : null)
                .build();
    }
}
