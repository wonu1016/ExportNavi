package com.asdf.exportnavi.ai;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.asdf.exportnavi.dto.GuidedConversationTurnDto;
import com.asdf.exportnavi.dto.GuidedHsCodeRequestDto;
import com.asdf.exportnavi.dto.GuidedHsCodeResponseDto;
import com.asdf.exportnavi.dto.HsCodeDto;
import com.asdf.exportnavi.dto.StrategyReportResponseDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class ClaudeService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    @Value("${openai.api.key:}")
    private String apiKey;

    @Value("${openai.api.model:gpt-5.4-mini}")
    private String model;

    public ClaudeService(WebClient webClient, ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.objectMapper = objectMapper;
    }

    public boolean isConfigured() {
        return !apiKey.isBlank();
    }

    /**
     * 제품 설명으로 HS코드 후보를 추정한다.
     */
    public List<HsCodeEstimation> estimateHsCodes(String productName, String productDescription) {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("OpenAI API 키가 설정되지 않았습니다. HS코드 추정을 진행할 수 없습니다.");
        }

        String systemPrompt = """
                당신은 관세·무역 전문가입니다. 사용자가 제공하는 제품 정보를 분석하여 가장 적합한 HS코드 후보 3개를 추정하세요.

                중요 원칙:
                - 이것은 "추정"이지 확정이 아닙니다. 사용자가 직접 확인·선택해야 합니다.
                - 각 후보에 대해 왜 해당 코드를 추정했는지 근거를 description에 포함하세요.
                - confidence가 0.6 미만이면 "정확도가 낮아 관세청 품목분류 사전심사를 권장합니다"를 description에 추가하세요.
                - 모르겠으면 억지로 맞추지 말고, confidence를 낮게 잡고 그 이유를 밝히세요.

                각 후보에는 코드, 품목 설명과 추정 근거, 0~1 사이 신뢰도를 포함하세요.
                """;

        String userPrompt = "제품명: %s\n제품 설명: %s".formatted(productName, productDescription);

        String response = callOpenAi(systemPrompt, userPrompt,
                "hs_code_candidates", hsCodeSchema());
        return parseHsCodeResponse(response);
    }

    /**
     * 분석 데이터를 기반으로 종합 리포트를 생성한다.
     */
    public ReportResult generateReport(String productName, String hsCode,
                                       String marketDataJson, String riskDataJson,
                                       String strategicDataJson) {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("OpenAI API 키가 설정되지 않았습니다. 종합 리포트를 생성할 수 없습니다.");
        }

        String systemPrompt = """
                당신은 중소기업 수출 컨설턴트입니다. 3개 공공기관(KOTRA, 한국무역보험공사, 전략물자관리원)의 데이터를 **교차 해석**하여 종합 수출 안내를 작성하세요.

                핵심 원칙:
                1. 당신은 "판정"이 아니라 "안내"를 합니다. "수출 가능/불가"를 단정하지 마세요.
                2. 숫자·등급은 공공데이터 원본 그대로 인용하고, 당신은 이를 풀어서 해설하세요. 데이터를 지어내지 마세요.
                3. 데이터 간 교차 해석을 하세요. 예: "베트남은 유망시장(KOTRA 87점)이나 국가신용 BB(무역보험공사) → 신용장(L/C) 거래 권장"
                4. 전략물자 해당 시: 절대 "수출 가능"이라 하지 말고 "통제 가능성 있음 → yesTrade 공식 자가판정 필수"로 안내하세요.
                5. 데이터가 없거나 불확실하면 추측하지 말고 "해당 정보 없음"으로 처리하세요.
                6. 요약은 먼저 결론을 짧게 말하고, 그 다음 판단 근거와 주의사항, 다음 행동 순으로 정리하세요.

                등급 기준:
                - A: 유망시장 다수 + 리스크 낮음 + 전략물자 비해당 → "적극 검토 권장"
                - B: 유망시장 존재 + 리스크 보통 → "수출 가능하나 일부 주의 필요"
                - C: 시장 제한적 또는 리스크 높음 → "신중한 검토 필요"
                - D: 전략물자 해당 또는 고위험 → "수출 전 전문가 상담 필수"

                종합 등급은 A, B, C, D 중 하나이며, 한국어 요약은 1500자 이내로 작성하세요.
                output에는 overallGrade, summary, keyReasons, cautions, nextActions를 포함하세요.
                """;

        String userPrompt = """
                제품명: %s
                확정 HS코드: %s

                [유망시장 데이터]
                %s

                [국가 리스크 데이터]
                %s

                [전략물자 판정]
                %s
                """.formatted(productName, hsCode, marketDataJson, riskDataJson, strategicDataJson);

        String response = callOpenAi(systemPrompt, userPrompt,
                "export_analysis_report", reportSchema());
        return parseReportResponse(response);
    }

    public GuidedHsCodeResponseDto guideHsCode(GuidedHsCodeRequestDto request) {
        GuidedHsCodeResponseDto localValidation = validateGuidance(request);
        if (!localValidation.getReady()) {
            return localValidation;
        }

        if (apiKey.isBlank()) {
            return GuidedHsCodeResponseDto.builder()
                    .ready(false)
                    .nextQuestion("정보는 충분하지만 AI 키가 설정되지 않아 후보를 만들 수 없어. OpenAI 키를 먼저 넣어줘.")
                    .missingFields(List.of())
                    .hints(List.of("키가 설정되면 후보 3개와 신뢰도까지 보여줄 수 있어."))
                    .candidates(List.of())
                    .build();
        }

        String systemPrompt = """
                당신은 HS코드 판별을 돕는 대화형 관세 전문가입니다.
                사용자가 바로 정답을 듣기보다, 부족한 정보를 하나씩 질문해서 HS코드 판별 정확도를 높이세요.
                질문은 한 번에 하나만 하고, 가장 중요한 정보부터 물어보세요.
                질문 예시: 완제품인지 부품인지, 주요 소재가 무엇인지, 어떤 용도인지, 규격이나 전압/용량이 있는지.
                충분한 정보가 모이면 후보 3개를 제시하고, 각 후보의 근거와 신뢰도를 설명하세요.
                추측이 많으면 ready=false로 두고 다음 질문을 하세요.
                """;

        String userPrompt = """
                제품명: %s
                제품 설명: %s
                주요 소재: %s
                사용 목적: %s
                제품 사양: %s
                가공 상태: %s
                희망 수출국: %s
                참고 URL: %s
                사양서 텍스트: %s
                대화 기록: %s
                """.formatted(
                valueOrUnknown(request.getProductName()),
                valueOrUnknown(request.getProductDescription()),
                valueOrUnknown(request.getMaterial()),
                valueOrUnknown(request.getIntendedUse()),
                valueOrUnknown(request.getSpecifications()),
                valueOrUnknown(request.getProcessingState()),
                valueOrUnknown(request.getTargetCountries()),
                valueOrUnknown(request.getReferenceUrl()),
                valueOrUnknown(request.getSpecFileText()),
                toConversationText(request.getConversation()));

        String response = callOpenAi(systemPrompt, userPrompt,
                "guided_hs_flow", guidedSchema());
        return parseGuidedResponse(response);
    }

    public StrategyReportResponseDto generateStrategyReport(String productName, String hsCode,
                                                            String reportSummary,
                                                            String marketDataJson,
                                                            String riskDataJson,
                                                            String strategicDataJson) {
        if (apiKey.isBlank()) {
            return StrategyReportResponseDto.builder()
                    .title(productName + " 수출 전략 보고서")
                    .targetCountry("베트남")
                    .entryReason("관세 혜택과 유망시장 점수가 높아 초기 진출 후보로 적합")
                    .riskSummary("리스크는 보통 수준으로 결제 안전장치가 필요")
                    .paymentMethod("초기 거래는 L/C, 거래 안정화 후 T/T 검토")
                    .certifications(List.of("국가별 인증 확인", "원산지 증빙", "전략물자 재확인"))
                    .documents(List.of("상업송장", "패킹리스트", "원산지증명서"))
                    .thirtyDayPlan(List.of(
                            "1주차: HS코드와 인증 요건 재확인",
                            "2주차: 우선 진출 국가와 바이어 후보 정리",
                            "3주차: 견적서와 샘플 발송",
                            "4주차: 결제 조건과 수출보험 검토"))
                    .exportScore(78)
                    .summary(reportSummary == null ? "데이터 요약이 없습니다." : reportSummary)
                    .build();
        }

        String systemPrompt = """
                당신은 수출 컨설턴트입니다.
                분석 결과를 실무자가 바로 움직일 수 있는 전략 보고서로 바꾸세요.
                출력에는 title, targetCountry, entryReason, riskSummary, paymentMethod, certifications, documents, thirtyDayPlan, exportScore, summary를 포함하세요.
                exportScore는 0~100 정수로, 실제 실행 가능성이 높을수록 높게 주세요.
                """;

        String userPrompt = """
                제품명: %s
                HS코드: %s
                종합 요약: %s
                유망시장 데이터: %s
                국가 리스크 데이터: %s
                전략물자 데이터: %s
                """.formatted(productName, hsCode, reportSummary, marketDataJson, riskDataJson, strategicDataJson);

        String response = callOpenAi(systemPrompt, userPrompt,
                "strategy_report", strategySchema());
        return parseStrategyReport(response);
    }

    private String callOpenAi(String systemPrompt, String userPrompt,
                              String schemaName, Map<String, Object> schema) {
        Map<String, Object> body = Map.of(
                "model", model,
                "instructions", systemPrompt,
                "input", userPrompt,
                "max_output_tokens", 4096,
                "reasoning", Map.of("effort", "low"),
                "text", Map.of("format", Map.of(
                        "type", "json_schema",
                        "name", schemaName,
                        "schema", schema,
                        "strict", true
                ))
        );

        String response = webClient.post()
                .uri("https://api.openai.com/v1/responses")
                .header("Authorization", "Bearer " + apiKey)
                .header("content-type", "application/json")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        try {
            JsonNode root = objectMapper.readTree(response);
            for (JsonNode output : root.path("output")) {
                for (JsonNode content : output.path("content")) {
                    if ("output_text".equals(content.path("type").asText())) {
                        return content.path("text").asText();
                    }
                }
            }
            throw new IllegalStateException("OpenAI 응답에 텍스트가 없습니다");
        } catch (Exception e) {
            log.error("OpenAI 응답 파싱 실패", e);
            throw new RuntimeException("OpenAI API 응답 파싱 실패", e);
        }
    }

    private List<HsCodeEstimation> parseHsCodeResponse(String json) {
        try {
            JsonNode array = objectMapper.readTree(json).path("candidates");
            if (!array.isArray() || array.size() != 3) {
                throw new IllegalStateException("HS코드 후보는 정확히 3개여야 합니다");
            }
            List<HsCodeEstimation> result = new ArrayList<>();
            for (JsonNode node : array) {
                String code = node.path("code").asText();
                String description = node.path("description").asText();
                double confidence = node.path("confidence").asDouble(-1);
                if (!code.matches("^[0-9]{4}(\\.[0-9]{2,6})?$")
                        || description.isBlank() || confidence < 0 || confidence > 1) {
                    throw new IllegalStateException("유효하지 않은 HS코드 후보 응답");
                }
                result.add(new HsCodeEstimation(
                        code, description, confidence
                ));
            }
            return result;
        } catch (Exception e) {
            log.error("HS코드 응답 파싱 실패: {}", json, e);
            throw new IllegalStateException("OpenAI HS코드 응답 검증 실패", e);
        }
    }

    private ReportResult parseReportResponse(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            String grade = node.path("overallGrade").asText();
            String summary = node.path("summary").asText();
            List<String> keyReasons = readStringArray(node.path("keyReasons"));
            List<String> cautions = readStringArray(node.path("cautions"));
            List<String> nextActions = readStringArray(node.path("nextActions"));
            if (!grade.matches("^[ABCD]$") || summary.isBlank()) {
                throw new IllegalStateException("유효하지 않은 종합 리포트 응답");
            }
            return new ReportResult(
                    grade, formatReportSummary(summary, keyReasons, cautions, nextActions)
            );
        } catch (Exception e) {
            log.error("리포트 응답 파싱 실패: {}", json, e);
            throw new IllegalStateException("OpenAI 리포트 응답 검증 실패", e);
        }
    }

    private List<String> readStringArray(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (JsonNode item : node) {
            String text = item.asText("");
            if (!text.isBlank()) {
                result.add(text.trim());
            }
        }
        return result;
    }

    private String formatReportSummary(String summary, List<String> keyReasons,
                                       List<String> cautions, List<String> nextActions) {
        StringBuilder builder = new StringBuilder();
        builder.append("■ 종합 요약\n").append(summary.trim());
        if (!keyReasons.isEmpty()) {
            builder.append("\n\n■ 판단 근거");
            for (String reason : keyReasons) {
                builder.append("\n- ").append(reason);
            }
        }
        if (!cautions.isEmpty()) {
            builder.append("\n\n■ 주의사항");
            for (String caution : cautions) {
                builder.append("\n- ").append(caution);
            }
        }
        if (!nextActions.isEmpty()) {
            builder.append("\n\n■ 다음 행동");
            for (String action : nextActions) {
                builder.append("\n- ").append(action);
            }
        }
        return builder.toString();
    }

    private Map<String, Object> hsCodeSchema() {
        Map<String, Object> candidate = Map.of(
                "type", "object",
                "properties", Map.of(
                        "code", Map.of("type", "string"),
                        "description", Map.of("type", "string"),
                        "confidence", Map.of("type", "number", "minimum", 0, "maximum", 1)
                ),
                "required", List.of("code", "description", "confidence"),
                "additionalProperties", false
        );
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "candidates", Map.of(
                                "type", "array",
                                "items", candidate,
                                "minItems", 3,
                                "maxItems", 3
                        )
                ),
                "required", List.of("candidates"),
                "additionalProperties", false
        );
    }

    private Map<String, Object> reportSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "overallGrade", Map.of("type", "string", "enum", List.of("A", "B", "C", "D")),
                        "summary", Map.of("type", "string"),
                        "keyReasons", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string"),
                                "minItems", 2,
                                "maxItems", 5
                        ),
                        "cautions", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string"),
                                "minItems", 1,
                                "maxItems", 5
                        ),
                        "nextActions", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string"),
                                "minItems", 2,
                                "maxItems", 5
                        )
                ),
                "required", List.of("overallGrade", "summary", "keyReasons", "cautions", "nextActions"),
                "additionalProperties", false
        );
    }

    private Map<String, Object> guidedSchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "ready", Map.of("type", "boolean"),
                        "nextQuestion", Map.of("type", "string"),
                        "missingFields", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        ),
                        "hints", Map.of(
                                "type", "array",
                                "items", Map.of("type", "string")
                        ),
                        "candidates", Map.of(
                                "type", "array",
                                "items", Map.of(
                                        "type", "object",
                                        "properties", Map.of(
                                                "code", Map.of("type", "string"),
                                                "description", Map.of("type", "string"),
                                                "confidence", Map.of("type", "number", "minimum", 0, "maximum", 1)
                                        ),
                                        "required", List.of("code", "description", "confidence"),
                                        "additionalProperties", false
                                )
                        )
                ),
                "required", List.of("ready", "nextQuestion", "missingFields", "hints", "candidates"),
                "additionalProperties", false
        );
    }

    private Map<String, Object> strategySchema() {
        return Map.of(
                "type", "object",
                "properties", Map.of(
                        "title", Map.of("type", "string"),
                        "targetCountry", Map.of("type", "string"),
                        "entryReason", Map.of("type", "string"),
                        "riskSummary", Map.of("type", "string"),
                        "paymentMethod", Map.of("type", "string"),
                        "certifications", Map.of("type", "array", "items", Map.of("type", "string")),
                        "documents", Map.of("type", "array", "items", Map.of("type", "string")),
                        "thirtyDayPlan", Map.of("type", "array", "items", Map.of("type", "string")),
                        "exportScore", Map.of("type", "integer", "minimum", 0, "maximum", 100),
                        "summary", Map.of("type", "string")
                ),
                "required", List.of("title", "targetCountry", "entryReason", "riskSummary", "paymentMethod",
                        "certifications", "documents", "thirtyDayPlan", "exportScore", "summary"),
                "additionalProperties", false
        );
    }

    private GuidedHsCodeResponseDto parseGuidedResponse(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            boolean ready = node.path("ready").asBoolean(false);
            List<String> missingFields = readStringArray(node.path("missingFields"));
            List<String> hints = readStringArray(node.path("hints"));
            List<HsCodeDto> candidates = new ArrayList<>();
            JsonNode items = node.path("candidates");
            if (items.isArray()) {
                for (JsonNode item : items) {
                    candidates.add(HsCodeDto.builder()
                            .code(item.path("code").asText())
                            .description(item.path("description").asText())
                            .confidence(item.path("confidence").asDouble())
                            .build());
                }
            }
            return GuidedHsCodeResponseDto.builder()
                    .ready(ready)
                    .nextQuestion(node.path("nextQuestion").asText())
                    .missingFields(missingFields)
                    .hints(hints)
                    .candidates(candidates)
                    .build();
        } catch (Exception e) {
            log.error("가이드 응답 파싱 실패: {}", json, e);
            throw new IllegalStateException("HS 가이드 응답 검증 실패", e);
        }
    }

    private StrategyReportResponseDto parseStrategyReport(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            return StrategyReportResponseDto.builder()
                    .title(node.path("title").asText())
                    .targetCountry(node.path("targetCountry").asText())
                    .entryReason(node.path("entryReason").asText())
                    .riskSummary(node.path("riskSummary").asText())
                    .paymentMethod(node.path("paymentMethod").asText())
                    .certifications(readStringArray(node.path("certifications")))
                    .documents(readStringArray(node.path("documents")))
                    .thirtyDayPlan(readStringArray(node.path("thirtyDayPlan")))
                    .exportScore(node.path("exportScore").asInt(0))
                    .summary(node.path("summary").asText())
                    .build();
        } catch (Exception e) {
            log.error("전략 보고서 응답 파싱 실패: {}", json, e);
            throw new IllegalStateException("전략 보고서 응답 검증 실패", e);
        }
    }

    private GuidedHsCodeResponseDto validateGuidance(GuidedHsCodeRequestDto request) {
        List<String> missingFields = new ArrayList<>();
        List<String> hints = new ArrayList<>();

        String material = safe(request.getMaterial());
        String use = safe(request.getIntendedUse());
        String spec = safe(request.getSpecifications());
        String processing = safe(request.getProcessingState());
        String description = safe(request.getProductDescription());
        String fileText = safe(request.getSpecFileText());

        if (safe(request.getProductName()).isBlank()) {
            missingFields.add("productName");
            hints.add("제품명이 있어야 HS코드 분류를 더 정확하게 시작할 수 있어.");
        }
        if (description.isBlank() && fileText.isBlank()) {
            missingFields.add("productDescription");
            hints.add("제품 설명이나 사양서 텍스트 중 하나는 필요해.");
        }
        if (material.isBlank()) {
            missingFields.add("material");
            hints.add("주요 소재는 금속/플라스틱/섬유/전자부품처럼 적어줘.");
        }
        if (use.isBlank()) {
            missingFields.add("intendedUse");
            hints.add("완제품인지 부품인지, 어떤 용도인지가 중요해.");
        }
        if (processing.isBlank()) {
            missingFields.add("processingState");
            hints.add("조립 완료된 완제품인지, 반제품/부품인지 알려줘.");
        }
        if (spec.isBlank()) {
            missingFields.add("specifications");
            hints.add("전압, 용량, 크기, 무게 같은 수치가 있으면 좋아.");
        }

        boolean ready = missingFields.isEmpty();
        String nextQuestion;
        if (!ready) {
            nextQuestion = switch (missingFields.get(0)) {
                case "productName" -> "제품명이 빠졌어. 제품 이름을 먼저 적어줘.";
                case "productDescription" -> "제품 설명이나 사양서 텍스트를 넣어줘. 둘 중 하나는 꼭 필요해.";
                case "material" -> "주요 소재는 뭐야? 금속, 플라스틱, 섬유, 전자부품 중 가까운 걸 알려줘.";
                case "intendedUse" -> "이 제품은 어디에 쓰는 거야? 용도랑 완제품/부품 여부를 알려줘.";
                case "processingState" -> "가공 상태를 알려줘. 완제품, 부품, 반제품 중 어디에 가까워?";
                case "specifications" -> "규격 정보를 더 알려줘. 전압, 용량, 크기, 무게 같은 숫자가 있으면 좋아.";
                default -> "정보를 조금만 더 보완해줘.";
            };
        } else {
            nextQuestion = "정보가 충분해. 이제 HS코드 후보를 분석할 준비가 됐어.";
        }

        return GuidedHsCodeResponseDto.builder()
                .ready(ready)
                .nextQuestion(nextQuestion)
                .missingFields(missingFields)
                .hints(hints)
                .candidates(List.of())
                .build();
    }

    private String toConversationText(List<GuidedConversationTurnDto> conversation) {
        if (conversation == null || conversation.isEmpty()) {
            return "없음";
        }
        StringBuilder sb = new StringBuilder();
        for (GuidedConversationTurnDto turn : conversation) {
            if (turn == null) continue;
            sb.append('[').append(safe(turn.getRole())).append("] ")
                    .append(safe(turn.getMessage())).append('\n');
        }
        return sb.toString().trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String valueOrUnknown(String value) {
        return value == null || value.isBlank() ? "입력되지 않음" : value.trim();
    }

    public record HsCodeEstimation(String code, String description, Double confidence) {}
    public record ReportResult(String overallGrade, String summary) {}
}
