package com.asdf.exportnavi.service;

import com.asdf.exportnavi.ai.ClaudeService;
import com.asdf.exportnavi.dto.AnalysisRequestDto;
import com.asdf.exportnavi.dto.AnalysisDraftRequestDto;
import com.asdf.exportnavi.dto.AnalysisResponseDto;
import com.asdf.exportnavi.dto.ActionChecklistItemDto;
import com.asdf.exportnavi.dto.GuidedHsCodeRequestDto;
import com.asdf.exportnavi.dto.GuidedHsCodeResponseDto;
import com.asdf.exportnavi.dto.HsCodeConfirmRequestDto;
import com.asdf.exportnavi.dto.ReportUpdateRequestDto;
import com.asdf.exportnavi.dto.ShareLinkResponseDto;
import com.asdf.exportnavi.dto.StrategyReportResponseDto;
import com.asdf.exportnavi.entity.*;
import com.asdf.exportnavi.repository.*;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.UUID;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalysisService {

    private final AnalysisReportRepository reportRepository;
    private final HsCodeRepository hsCodeRepository;
    private final MarketRecommendationRepository marketRepository;
    private final RiskAssessmentRepository riskRepository;
    private final StrategicItemRepository strategicRepository;
    private final ActionChecklistItemRepository checklistRepository;

    private final MemberService memberService;
    private final ClaudeService claudeService;
    private final KotraService kotraService;
    private final KsureService ksureService;
    private final YesTradeService yesTradeService;
    private final AiRateLimitService aiRateLimitService;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * 1단계: 분석 요청 → AI가 HS코드 후보 추정
     */
    @Transactional
    public AnalysisResponseDto createAnalysis(String email, AnalysisRequestDto request) {
        aiRateLimitService.consume(email);
        Member member = memberService.findByEmail(email);

        // 리포트 생성
        AnalysisReport report = AnalysisReport.builder()
                .member(member)
                .productName(request.getProductName())
                .reportTitle(request.getProductName())
                .productDescription(request.getProductDescription())
                .material(request.getMaterial())
                .intendedUse(request.getIntendedUse())
                .specifications(request.getSpecifications())
                .processingState(request.getProcessingState())
                .targetCountries(request.getTargetCountries())
                .referenceUrl(request.getReferenceUrl())
                .specFileName(request.getSpecFileName())
                .specFileType(request.getSpecFileType())
                .specFileText(request.getSpecFileText())
                .build();
        report = reportRepository.save(report);

        // AI: HS코드 추정
        List<ClaudeService.HsCodeEstimation> estimations =
                claudeService.estimateHsCodes(request.getProductName(), buildProductPrompt(request));

        report.markAiDataStatus(DataStatus.LIVE, LocalDateTime.now());

        for (ClaudeService.HsCodeEstimation est : estimations) {
            HsCode hsCode = HsCode.builder()
                    .analysisReport(report)
                    .code(est.code())
                    .description(est.description())
                    .confidence(est.confidence())
                    .build();
            hsCodeRepository.save(hsCode);
            report.getHsCodes().add(hsCode);
        }

        report.markHsCodeEstimated();
        reportRepository.save(report);

        log.info("분석 요청 생성 완료 — reportId: {}, HS코드 후보 {}개", report.getId(), estimations.size());
        return AnalysisResponseDto.from(report);
    }

    @Transactional
    public AnalysisResponseDto saveDraft(String email, AnalysisDraftRequestDto request) {
        Member member = memberService.findByEmail(email);
        AnalysisReport report = AnalysisReport.builder()
                .member(member)
                .productName(safeText(request.getProductName(), "초안"))
                .reportTitle(safeText(request.getReportTitle(), safeText(request.getProductName(), "초안")))
                .productDescription(safeText(request.getProductDescription(), ""))
                .material(request.getMaterial())
                .intendedUse(request.getIntendedUse())
                .specifications(request.getSpecifications())
                .processingState(request.getProcessingState())
                .targetCountries(request.getTargetCountries())
                .referenceUrl(request.getReferenceUrl())
                .specFileName(request.getSpecFileName())
                .specFileType(request.getSpecFileType())
                .specFileText(request.getSpecFileText())
                .build();
        reportRepository.save(report);
        return AnalysisResponseDto.from(report);
    }

    @Transactional
    public AnalysisResponseDto updateDraft(String email, Long reportId, AnalysisDraftRequestDto request) {
        AnalysisReport report = findOwnedReport(email, reportId);
        report.updateDraft(
                request.getReportTitle(),
                request.getProductName(),
                request.getProductDescription(),
                request.getMaterial(),
                request.getIntendedUse(),
                request.getSpecifications(),
                request.getProcessingState(),
                request.getTargetCountries(),
                request.getReferenceUrl(),
                request.getSpecFileName(),
                request.getSpecFileType(),
                request.getSpecFileText());
        return AnalysisResponseDto.from(reportRepository.save(report));
    }

    /**
     * 2단계: HS코드 확정 → 유망시장 + 리스크 + 전략물자 조회 → 종합 리포트 생성
     */
    @Transactional
    public AnalysisResponseDto confirmAndAnalyze(String email, Long reportId,
                                                  HsCodeConfirmRequestDto request) {
        aiRateLimitService.consume(email);
        AnalysisReport report = findOwnedReport(email, reportId);

        // HS코드 확정
        report.confirmHsCode(request.getHsCode());
        report.startAnalyzing();

        // 해당 HS코드의 HsCode 엔티티도 confirmed 처리
        report.getHsCodes().forEach(HsCode::unconfirm);
        report.getHsCodes().stream()
                .filter(hs -> hs.getCode().equals(request.getHsCode()))
                .findFirst()
                .ifPresentOrElse(HsCode::confirm,
                        () -> addManualHsCode(report, request.getHsCode()));

        reportRepository.save(report);
        eventPublisher.publishEvent(new AnalysisRequestedEvent(
                report.getId(), email, request.getHsCode()));
        return AnalysisResponseDto.from(report);
    }

    @Transactional
    public AnalysisResponseDto executeAnalysis(String email, Long reportId, String hsCode) {
        AnalysisReport report = findOwnedReport(email, reportId);

        // 유망시장 조회 (KOTRA)
        KotraService.MarketResult marketResult = kotraService.getPromisingMarkets(hsCode);
        List<KotraService.MarketData> markets = marketResult.data();
        for (KotraService.MarketData m : markets) {
            MarketRecommendation rec = MarketRecommendation.builder()
                    .analysisReport(report)
                    .countryName(m.countryName())
                    .countryCode(m.countryCode())
                    .score(m.score())
                    .tariffRate(m.tariffRate())
                    .ftaApplied(m.ftaApplied())
                    .description(m.description())
                    .build();
            marketRepository.save(rec);
            report.getMarketRecommendations().add(rec);
        }

        // 국가 리스크 조회 (K-SURE) — 추천 국가들에 대해
        DataStatus riskStatus = DataStatus.LIVE;
        StringBuilder dataMessages = new StringBuilder();
        appendMessage(dataMessages, marketResult.message());
        for (KotraService.MarketData m : markets) {
            KsureService.RiskResult riskResult = ksureService.getCountryRisk(m.countryCode());
            KsureService.RiskData risk = riskResult.data();
            if (riskResult.status() != DataStatus.LIVE) {
                riskStatus = riskResult.status();
            }
            appendMessage(dataMessages, riskResult.message());
            RiskAssessment assessment = RiskAssessment.builder()
                    .analysisReport(report)
                    .countryName(risk.countryName())
                    .countryCode(risk.countryCode())
                    .riskGrade(risk.riskGrade())
                    .creditRating(risk.creditRating())
                    .description(risk.description())
                    .build();
            riskRepository.save(assessment);
            report.getRiskAssessments().add(assessment);
        }

        // 전략물자 판정 (yesTrade)
        YesTradeService.StrategicResult strategicResult = yesTradeService.checkStrategicItem(hsCode);
        YesTradeService.StrategicData strategic = strategicResult.data();
        appendMessage(dataMessages, strategicResult.message());
        StrategicItem item = StrategicItem.builder()
                .analysisReport(report)
                .isStrategic(strategic.isStrategic())
                .category(strategic.category())
                .description(strategic.description())
                .regulationDetail(strategic.regulationDetail())
                .build();
        strategicRepository.save(item);
        report.setStrategicItem(item);

        report.markExternalDataStatus(
                marketResult.status(), riskStatus, strategicResult.status(),
                LocalDateTime.now(), dataMessages.toString());

        createActionChecklist(report, hsCode, strategic);

        // AI: 종합 리포트 생성
        ClaudeService.ReportResult result = claudeService.generateReport(
                report.getProductName(),
                hsCode,
                toJson(markets),
                toJson(report.getRiskAssessments().stream()
                        .map(r -> new KsureService.RiskData(
                                r.getCountryName(), r.getCountryCode(),
                                r.getRiskGrade(), r.getCreditRating(), r.getDescription()))
                        .toList()),
                toJson(strategic)
        );

        AnalysisReport.OverallGrade grade = AnalysisReport.OverallGrade.valueOf(result.overallGrade());
        report.complete(grade, result.summary());
        reportRepository.save(report);

        log.info("분석 완료 — reportId: {}, 등급: {}", report.getId(), grade);
        return AnalysisResponseDto.from(report);
    }

    /**
     * 분석 리포트 단건 조회
     */
    public AnalysisResponseDto getReport(String email, Long reportId) {
        return AnalysisResponseDto.from(findOwnedReport(email, reportId));
    }

    /**
     * 회원의 분석 리포트 목록 조회
     */
    public List<AnalysisResponseDto> getMyReports(String email, String query) {
        Member member = memberService.findByEmail(email);
        List<AnalysisReport> reports = query == null || query.isBlank()
                ? reportRepository.findByMemberIdOrderByCreatedAtDesc(member.getId())
                : reportRepository.findByMemberIdAndReportTitleContainingIgnoreCaseOrderByCreatedAtDesc(
                        member.getId(), query.trim());
        return reports
                .stream()
                .map(AnalysisResponseDto::from)
                .toList();
    }

    @Transactional
    public AnalysisResponseDto renameReport(String email, Long reportId,
                                             ReportUpdateRequestDto request) {
        AnalysisReport report = findOwnedReport(email, reportId);
        report.rename(request.getReportTitle());
        return AnalysisResponseDto.from(reportRepository.save(report));
    }

    @Transactional
    public void deleteReport(String email, Long reportId) {
        reportRepository.delete(findOwnedReport(email, reportId));
    }

    @Transactional
    public ShareLinkResponseDto enableSharing(String email, Long reportId) {
        AnalysisReport report = findOwnedReport(email, reportId);
        if (!Boolean.TRUE.equals(report.getSharingEnabled()) || report.getShareToken() == null) {
            report.enableSharing(UUID.randomUUID().toString().replace("-", ""));
            reportRepository.save(report);
        }
        return ShareLinkResponseDto.builder()
                .token(report.getShareToken())
                .sharedAt(report.getSharedAt())
                .build();
    }

    @Transactional
    public void revokeSharing(String email, Long reportId) {
        AnalysisReport report = findOwnedReport(email, reportId);
        report.revokeSharing();
        reportRepository.save(report);
    }

    public AnalysisResponseDto getSharedReport(String token) {
        AnalysisReport report = reportRepository.findByShareTokenAndSharingEnabledTrue(token)
                .orElseThrow(() -> new IllegalArgumentException("공유 리포트를 찾을 수 없습니다"));
        return AnalysisResponseDto.from(report);
    }

    public GuidedHsCodeResponseDto guideHsCode(GuidedHsCodeRequestDto request) {
        return claudeService.guideHsCode(request);
    }

    public StrategyReportResponseDto buildStrategyReport(String email, Long reportId) {
        AnalysisReport report = findOwnedReport(email, reportId);
        return claudeService.generateStrategyReport(
                report.getProductName(),
                report.getConfirmedHsCode(),
                report.getReportSummary(),
                toJson(report.getMarketRecommendations().stream()
                        .map(r -> new KotraService.MarketData(
                                r.getCountryName(), r.getCountryCode(), r.getScore(),
                                r.getTariffRate(), r.getFtaApplied(), r.getDescription()))
                        .toList()),
                toJson(report.getRiskAssessments().stream()
                        .map(r -> new KsureService.RiskData(
                                r.getCountryName(), r.getCountryCode(),
                                r.getRiskGrade(), r.getCreditRating(), r.getDescription()))
                        .toList()),
                toJson(report.getStrategicItem() == null
                        ? null
                        : new YesTradeService.StrategicData(
                                report.getStrategicItem().getIsStrategic(),
                                report.getStrategicItem().getCategory(),
                                report.getStrategicItem().getDescription(),
                                report.getStrategicItem().getRegulationDetail()
                        ))
        );
    }

    @Transactional
    public AnalysisResponseDto reanalyze(String email, Long reportId) {
        aiRateLimitService.consume(email);
        AnalysisReport report = findOwnedReport(email, reportId);
        if (report.getConfirmedHsCode() == null || report.getConfirmedHsCode().isBlank()) {
            throw new IllegalArgumentException("확정된 HS코드가 없어 재분석할 수 없습니다");
        }

        if (report.getStrategicItem() != null) {
            strategicRepository.delete(report.getStrategicItem());
            strategicRepository.flush();
        }
        report.resetAnalysisResults();
        reportRepository.save(report);
        eventPublisher.publishEvent(new AnalysisRequestedEvent(
                report.getId(), email, report.getConfirmedHsCode()));
        return AnalysisResponseDto.from(report);
    }

    @Transactional
    public void markAnalysisFailed(String email, Long reportId, String message) {
        AnalysisReport report = findOwnedReport(email, reportId);
        report.fail(message);
        reportRepository.save(report);
    }

    @Transactional
    public ActionChecklistItemDto updateChecklistItem(String email, Long reportId,
                                                       Long itemId, boolean completed) {
        ActionChecklistItem item = checklistRepository
                .findByIdAndAnalysisReportIdAndAnalysisReportMemberEmail(itemId, reportId, email)
                .orElseThrow(() -> new IllegalArgumentException("체크리스트 항목을 찾을 수 없습니다: " + itemId));
        item.updateCompleted(completed);
        return ActionChecklistItemDto.from(checklistRepository.save(item));
    }

    private AnalysisReport findOwnedReport(String email, Long reportId) {
        return reportRepository.findByIdAndMemberEmail(reportId, email)
                .orElseThrow(() -> new IllegalArgumentException("리포트를 찾을 수 없습니다: " + reportId));
    }

    private void addManualHsCode(AnalysisReport report, String hsCodeValue) {
        HsCode hsCode = HsCode.builder()
                .analysisReport(report)
                .code(hsCodeValue)
                .description("사용자가 직접 입력한 HS코드")
                .confidence(null)
                .confirmed(true)
                .build();
        hsCodeRepository.save(hsCode);
        report.getHsCodes().add(hsCode);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JacksonException e) {
            return obj.toString();
        }
    }

    private String buildProductPrompt(AnalysisRequestDto request) {
        return """
                제품 설명: %s
                주요 소재: %s
                사용 목적: %s
                제품 사양: %s
                가공 상태: %s
                희망 수출국: %s
                참고 URL: %s
                사양서 텍스트: %s
                """.formatted(
                valueOrUnknown(request.getProductDescription()),
                valueOrUnknown(request.getMaterial()),
                valueOrUnknown(request.getIntendedUse()),
                valueOrUnknown(request.getSpecifications()),
                valueOrUnknown(request.getProcessingState()),
                valueOrUnknown(request.getTargetCountries()),
                valueOrUnknown(request.getReferenceUrl()),
                valueOrUnknown(request.getSpecFileText()));
    }

    private String valueOrUnknown(String value) {
        return value == null || value.isBlank() ? "입력되지 않음" : value.trim();
    }

    private void createActionChecklist(AnalysisReport report, String hsCode,
                                       YesTradeService.StrategicData strategic) {
        addChecklist(report, "HS_CODE", "HS코드 전문가 확인",
                "선택한 HS코드 " + hsCode + "의 정확성을 관세사 또는 관세청 품목분류 사전심사로 확인하세요.",
                "https://unipass.customs.go.kr/", 1);
        addChecklist(report, "MARKET", "목표 국가와 거래 조건 확정",
                "추천 국가 중 실제 진출 국가를 정하고 가격, 최소 주문수량, 인코텀즈 조건을 작성하세요.",
                "https://www.kotra.or.kr/", 2);
        addChecklist(report, "FTA", "FTA 원산지 기준과 관세 확인",
                "협정세율 적용 가능 여부와 원산지증명서 발급 조건을 확인하세요.",
                "https://www.customs.go.kr/ftaportalkor/main.do", 3);
        addChecklist(report, "CERTIFICATION", "국가별 필수 인증 확인",
                "제품 안전, 전기·전자, 식품, 화학 등 품목별 필수 인증과 표시 기준을 확인하세요.",
                "https://www.tradenavi.or.kr/", 4);
        addChecklist(report, "COMPLIANCE", "전략물자 공식 판정",
                strategic.isStrategic()
                        ? "통제 가능성이 있으므로 YesTrade 전문판정과 수출허가 절차를 우선 진행하세요."
                        : "현재 결과는 참고용입니다. YesTrade에서 자가판정 또는 전문판정을 완료하세요.",
                "https://www.yestrade.go.kr/", 5);
        addChecklist(report, "PAYMENT", "결제 방식과 환율 위험 결정",
                "바이어 신용도에 맞춰 T/T, L/C 등 결제 방식을 정하고 필요하면 환헤지를 검토하세요.",
                "https://www.ksure.or.kr/", 6);
        addChecklist(report, "INSURANCE", "수출보험·바이어 신용조사 검토",
                "한국무역보험공사의 국외기업 신용조사와 단기수출보험 지원 여부를 확인하세요.",
                "https://www.ksure.or.kr/", 7);
    }

    private void addChecklist(AnalysisReport report, String category, String title,
                              String description, String url, int order) {
        ActionChecklistItem item = ActionChecklistItem.builder()
                .analysisReport(report)
                .category(category)
                .title(title)
                .description(description)
                .officialUrl(url)
                .displayOrder(order)
                .build();
        checklistRepository.save(item);
        report.getActionChecklist().add(item);
    }

    private void appendMessage(StringBuilder builder, String message) {
        if (message == null || message.isBlank() || builder.indexOf(message) >= 0) {
            return;
        }
        if (!builder.isEmpty()) {
            builder.append(" ");
        }
        builder.append(message);
    }

    private String safeText(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
