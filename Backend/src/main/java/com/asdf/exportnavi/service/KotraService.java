package com.asdf.exportnavi.service;

import com.asdf.exportnavi.entity.DataStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * KOTRA 유망시장 정보 조회 서비스.
 * 실제 OpenAPI 결과를 우선 사용한다. 응답을 해석할 수 없으면 예외를 던진다.
 */
@Slf4j
@Service
public class KotraService {

    private static final String DATASET_PATH = "/15151938/v1/uddi:2e2fcd05-b693-4137-82c1-fd859aeb6b89";

    private final OdcloudDatasetClient odcloudDatasetClient;

    @Value("${kotra.api.key:}")
    private String apiKey;

    public KotraService(OdcloudDatasetClient odcloudDatasetClient) {
        this.odcloudDatasetClient = odcloudDatasetClient;
    }

    public MarketResult getPromisingMarkets(String hsCode) {
        ensureApiKey();
        try {
            List<JsonNode> rows = odcloudDatasetClient.fetchAllItems(DATASET_PATH, apiKey, 5, 100);
            List<MarketData> data = buildMarketRecommendations(rows, hsCode);
            if (data.isEmpty()) {
                throw new IllegalStateException("KOTRA 응답에서 유망시장 데이터를 구성하지 못했습니다");
            }
            return new MarketResult(data, DataStatus.LIVE, null);
        } catch (Exception e) {
            log.error("KOTRA API 처리 실패", e);
            throw new IllegalStateException("KOTRA 유망시장 조회 실패: " + e.getMessage(), e);
        }
    }

    private void ensureApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("KOTRA 일반 인증키가 설정되지 않았습니다.");
        }
    }

    private List<MarketData> buildMarketRecommendations(List<JsonNode> rows, String hsCode) {
        if (rows == null || rows.isEmpty()) {
            return List.of();
        }

        Map<String, MarketBucket> buckets = new HashMap<>();
        String normalizedHs = hsCode == null ? "" : hsCode.trim();

        for (JsonNode row : rows) {
            String country = firstText(row, "국가", "국가명", "country", "countryName");
            if (country.isBlank()) {
                continue;
            }

            String question = firstText(row, "질의", "질문", "query", "title");
            String answer = firstText(row, "답변", "응답", "answer", "content");
            String queryPurpose = firstText(row, "질의 목적", "질의목적", "questionPurpose");
            String answerType = firstText(row, "답변 유형", "답변유형", "answerType");
            String recommendedQuery = firstText(row, "추천 질의", "추천질의", "recommendedQuery");
            String askedAt = firstText(row, "질의일자", "등록일", "createdAt", "date");

            String combined = String.join(" ", question, answer, queryPurpose, answerType, recommendedQuery);
            int relevance = scoreMarketText(combined, normalizedHs);
            if (relevance <= 0) {
                continue;
            }

            MarketBucket bucket = buckets.computeIfAbsent(country, MarketBucket::new);
            bucket.add(relevance, askedAt, question, answer, queryPurpose, answerType, recommendedQuery);
        }

        return buckets.values().stream()
                .map(bucket -> bucket.toMarketData(normalizedHs))
                .sorted(Comparator.comparingDouble(MarketData::score).reversed())
                .limit(3)
                .collect(Collectors.toList());
    }

    private int scoreMarketText(String text, String hsCode) {
        if (text == null) {
            return 0;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        int score = 0;
        if (normalized.contains("fta")) score += 15;
        if (normalized.contains("관세")) score += 10;
        if (normalized.contains("수출")) score += 10;
        if (normalized.contains("시장")) score += 8;
        if (normalized.contains("인증")) score += 6;
        if (normalized.contains("규제")) score += 5;
        if (normalized.contains("hs")) score += 6;
        if (hsCode != null && !hsCode.isBlank() && normalized.contains(hsCode.toLowerCase(Locale.ROOT))) {
            score += 20;
        }
        return score;
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

    private double inferTariffRate(String text) {
        if (text == null || text.isBlank()) {
            return 3.0;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        if (normalized.contains("무관세") || normalized.contains("0%") || normalized.contains("0.0%")) {
            return 0.0;
        }
        if (normalized.contains("fta") || normalized.contains("협정세율")) {
            return 1.0;
        }
        if (normalized.contains("관세")) {
            return 3.0;
        }
        return 5.0;
    }

    private boolean inferFtaApplied(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        return normalized.contains("fta")
                || normalized.contains("협정세율")
                || normalized.contains("무관세")
                || normalized.contains("자유무역");
    }

    private String countryCodeByName(String countryName) {
        if (countryName == null) {
            return "";
        }
        return switch (countryName.trim()) {
            case "미국" -> "US";
            case "베트남" -> "VN";
            case "독일" -> "DE";
            case "인도네시아" -> "ID";
            case "일본" -> "JP";
            case "중국" -> "CN";
            case "태국" -> "TH";
            case "말레이시아" -> "MY";
            case "싱가포르" -> "SG";
            case "인도" -> "IN";
            case "필리핀" -> "PH";
            case "한국" -> "KR";
            default -> {
                String normalized = countryName.trim();
                yield normalized.length() >= 2
                        ? normalized.substring(0, 2).toUpperCase(Locale.ROOT)
                        : normalized.toUpperCase(Locale.ROOT);
            }
        };
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String buildDescription(String country, String firstSnippet, String secondSnippet,
                                    String hsCode, String latestDate) {
        StringBuilder sb = new StringBuilder();
        if (!country.isBlank()) {
            sb.append(country).append(" 관련 KOTRA 질의응답 데이터입니다. ");
        }
        if (!hsCode.isBlank()) {
            sb.append("HS코드 ").append(hsCode).append(" 기준으로 참고할 수 있습니다. ");
        }
        if (!latestDate.isBlank()) {
            sb.append("최근 질의일: ").append(latestDate).append(". ");
        }
        if (!firstSnippet.isBlank()) {
            sb.append(firstSnippet).append(" ");
        }
        if (!secondSnippet.isBlank() && !secondSnippet.equals(firstSnippet)) {
            sb.append(secondSnippet).append(" ");
        }
        return sb.toString().trim();
    }

    private class MarketBucket {
        private final String country;
        private final List<String> snippets = new java.util.ArrayList<>();
        private int score;
        private String latestDate = "";

        private MarketBucket(String country) {
            this.country = country;
        }

        private void add(int baseScore, String askedAt, String question, String answer,
                         String queryPurpose, String answerType, String recommendedQuery) {
            snippets.add(buildSnippet(question, answer, queryPurpose, answerType, recommendedQuery));
            int boosted = baseScore;
            LocalDate date = parseDate(askedAt);
            if (date != null) {
                boosted += Math.min(8, Math.max(0, date.getYear() - 2020));
                if (latestDate.isBlank() || date.toString().compareTo(latestDate) > 0) {
                    latestDate = date.toString();
                }
            }
            score += boosted;
        }

        private String buildSnippet(String question, String answer, String queryPurpose,
                                    String answerType, String recommendedQuery) {
            return String.join(" / ",
                    Optional.ofNullable(question).orElse(""),
                    Optional.ofNullable(answer).orElse(""),
                    Optional.ofNullable(queryPurpose).orElse(""),
                    Optional.ofNullable(answerType).orElse(""),
                    Optional.ofNullable(recommendedQuery).orElse(""))
                    .replaceAll("\\s+", " ")
                    .trim();
        }

        private MarketData toMarketData(String hsCode) {
            String joined = String.join(" ", snippets);
            double tariffRate = inferTariffRate(joined);
            boolean ftaApplied = inferFtaApplied(joined);
            double normalizedScore = Math.min(99.0, Math.max(40.0,
                    (score / Math.max(1.0, snippets.size())) + (ftaApplied ? 5 : 0)));
            String description = buildDescription(
                    country,
                    snippets.isEmpty() ? "" : snippets.get(0),
                    snippets.size() > 1 ? snippets.get(1) : "",
                    hsCode,
                    latestDate
            );
            return new MarketData(country, countryCodeByName(country), normalizedScore, tariffRate, ftaApplied, description);
        }
    }

    public record MarketData(
            String countryName,
            String countryCode,
            Double score,
            Double tariffRate,
            Boolean ftaApplied,
            String description
    ) {}

    public record MarketResult(List<MarketData> data, DataStatus status, String message) {}
}
