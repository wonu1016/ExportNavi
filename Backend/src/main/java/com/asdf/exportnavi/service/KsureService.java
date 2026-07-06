package com.asdf.exportnavi.service;

import com.asdf.exportnavi.entity.DataStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * 한국무역보험공사(K-SURE) 국가 리스크 조회 서비스.
 * 실제 OpenAPI 결과를 우선 사용한다. 응답을 해석할 수 없으면 예외를 던진다.
 */
@Slf4j
@Service
public class KsureService {

    private static final String DATASET_PATH = "/3078608/v1/uddi:d0a38f3b-fd67-4807-a45a-9cea84dad0e2";

    private final OdcloudDatasetClient odcloudDatasetClient;

    @Value("${ksure.api.key:}")
    private String apiKey;

    private static final Map<String, RiskData> FALLBACK_COUNTRY_NAMES = Map.ofEntries(
            Map.entry("US", new RiskData("미국", "US", "", "", "")),
            Map.entry("VN", new RiskData("베트남", "VN", "", "", "")),
            Map.entry("DE", new RiskData("독일", "DE", "", "", "")),
            Map.entry("ID", new RiskData("인도네시아", "ID", "", "", "")),
            Map.entry("JP", new RiskData("일본", "JP", "", "", "")),
            Map.entry("CN", new RiskData("중국", "CN", "", "", "")),
            Map.entry("TH", new RiskData("태국", "TH", "", "", "")),
            Map.entry("MY", new RiskData("말레이시아", "MY", "", "", "")),
            Map.entry("SG", new RiskData("싱가포르", "SG", "", "", "")),
            Map.entry("IN", new RiskData("인도", "IN", "", "", "")),
            Map.entry("PH", new RiskData("필리핀", "PH", "", "", "")),
            Map.entry("KR", new RiskData("한국", "KR", "", "", ""))
    );

    public KsureService(OdcloudDatasetClient odcloudDatasetClient) {
        this.odcloudDatasetClient = odcloudDatasetClient;
    }

    public RiskResult getCountryRisk(String countryCode) {
        ensureApiKey();
        try {
            List<JsonNode> rows = odcloudDatasetClient.fetchAllItems(DATASET_PATH, apiKey, 5, 100);
            RiskData liveRisk = findLiveRisk(rows, countryCode)
                    .orElseThrow(() -> new IllegalStateException("K-SURE 응답에서 국가 리스크 정보를 찾지 못했습니다"));
            return new RiskResult(liveRisk, DataStatus.LIVE, null);
        } catch (Exception e) {
            log.error("K-SURE API 처리 실패", e);
            throw new IllegalStateException("K-SURE 국가 리스크 조회 실패: " + e.getMessage(), e);
        }
    }

    private void ensureApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("K-SURE 일반 인증키가 설정되지 않았습니다.");
        }
    }

    private Optional<RiskData> findLiveRisk(List<JsonNode> rows, String countryCode) {
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        String countryName = countryNameByCode(countryCode);
        List<String> aliases = countryAliases(countryName, countryCode);

        return rows.stream()
                .filter(row -> containsAny(row, aliases))
                .findFirst()
                .map(row -> toRiskData(row, countryCode, countryName));
    }

    private RiskData toRiskData(JsonNode row, String countryCode, String fallbackCountryName) {
        String countryName = firstText(row, "국가명", "국가", "countryName", "country");
        if (countryName.isBlank()) {
            countryName = fallbackCountryName;
        }
        String previousGrade = firstText(row, "이전 등급", "이전등급", "previousGrade", "전년도등급");
        String currentGrade = firstText(row, "현재등급", "현재 등급", "currentGrade", "등급");
        String riskGrade = normalizeRiskGrade(currentGrade, previousGrade);
        String creditRating = currentGrade.isBlank() ? previousGrade : currentGrade;
        String description = buildDescription(countryName, previousGrade, currentGrade, row);

        return new RiskData(countryName, countryCode, riskGrade, creditRating, description);
    }

    private String buildDescription(String countryName, String previousGrade, String currentGrade, JsonNode row) {
        String extra = firstText(row, "비고", "설명", "description", "메모", "주요내용");
        StringBuilder sb = new StringBuilder();
        if (!countryName.isBlank()) {
            sb.append(countryName).append("의 K-SURE 국가등급 정보입니다. ");
        }
        if (!previousGrade.isBlank() || !currentGrade.isBlank()) {
            sb.append("이전 등급 ").append(previousGrade.isBlank() ? "없음" : previousGrade)
                    .append(", 현재 등급 ").append(currentGrade.isBlank() ? "없음" : currentGrade).append(". ");
        }
        if (!extra.isBlank()) {
            sb.append(extra);
        }
        return sb.toString().trim();
    }

    private boolean containsAny(JsonNode row, List<String> aliases) {
        String haystack = row.toString().toLowerCase(Locale.ROOT);
        for (String alias : aliases) {
            if (!alias.isBlank() && haystack.contains(alias.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String firstText(JsonNode row, String... keys) {
        for (String key : keys) {
            String value = row.path(key).asText("");
            if (!value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String normalizeRiskGrade(String currentGrade, String previousGrade) {
        String base = !currentGrade.isBlank() ? currentGrade : previousGrade;
        if (base == null || base.isBlank()) {
            return "미평가";
        }

        String normalized = base.trim().toUpperCase(Locale.ROOT);
        if (normalized.matches("\\d+")) {
            int grade = Integer.parseInt(normalized);
            if (grade <= 2) return "낮음";
            if (grade <= 4) return "보통";
            return "높음";
        }

        if (normalized.startsWith("AAA") || normalized.startsWith("AA") || normalized.startsWith("A")) {
            return "낮음";
        }
        if (normalized.startsWith("BBB") || normalized.startsWith("BB") || normalized.startsWith("B")) {
            return "보통";
        }
        return "높음";
    }

    private String countryNameByCode(String countryCode) {
        if (countryCode == null || countryCode.isBlank()) {
            return "알 수 없음";
        }
        return switch (countryCode.toUpperCase(Locale.ROOT)) {
            case "US" -> "미국";
            case "VN" -> "베트남";
            case "DE" -> "독일";
            case "ID" -> "인도네시아";
            case "JP" -> "일본";
            case "CN" -> "중국";
            case "TH" -> "태국";
            case "MY" -> "말레이시아";
            case "SG" -> "싱가포르";
            case "IN" -> "인도";
            case "PH" -> "필리핀";
            case "KR" -> "한국";
            default -> countryCode;
        };
    }

    private List<String> countryAliases(String countryName, String countryCode) {
        String normalized = countryName == null ? "" : countryName.toLowerCase(Locale.ROOT);
        return switch (countryCode == null ? "" : countryCode.toUpperCase(Locale.ROOT)) {
            case "US" -> List.of(normalized, "usa", "united states", "미국", "u.s.", "us");
            case "VN" -> List.of(normalized, "vietnam", "viet nam", "베트남", "vn");
            case "DE" -> List.of(normalized, "germany", "독일", "de");
            case "ID" -> List.of(normalized, "indonesia", "인도네시아", "id");
            case "JP" -> List.of(normalized, "japan", "일본", "jp");
            case "CN" -> List.of(normalized, "china", "중국", "cn");
            case "TH" -> List.of(normalized, "thailand", "태국", "th");
            case "MY" -> List.of(normalized, "malaysia", "말레이시아", "my");
            case "SG" -> List.of(normalized, "singapore", "싱가포르", "sg");
            case "IN" -> List.of(normalized, "india", "인도", "in");
            case "PH" -> List.of(normalized, "philippines", "필리핀", "ph");
            default -> List.of(normalized, countryCode == null ? "" : countryCode.toLowerCase(Locale.ROOT));
        };
    }

    public record RiskData(
            String countryName,
            String countryCode,
            String riskGrade,
            String creditRating,
            String description
    ) {}

    public record RiskResult(RiskData data, DataStatus status, String message) {}
}
