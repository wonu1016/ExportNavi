package com.asdf.exportnavi.service;

import com.asdf.exportnavi.entity.DataStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * yesTrade 전략물자 판정 서비스.
 * 실제 OpenAPI 결과를 우선 사용한다. 응답을 해석할 수 없으면 예외를 던진다.
 */
@Slf4j
@Service
public class YesTradeService {

    private static final String DATASET_PATH = "/15022170/v1/uddi:23ed66fa-a56c-4c2d-acad-dabc001a3c29_201910161358";

    private final OdcloudDatasetClient odcloudDatasetClient;

    @Value("${yestrade.api.key:}")
    private String apiKey;

    public YesTradeService(OdcloudDatasetClient odcloudDatasetClient) {
        this.odcloudDatasetClient = odcloudDatasetClient;
    }

    public StrategicResult checkStrategicItem(String hsCode) {
        ensureApiKey();
        try {
            List<JsonNode> rows = odcloudDatasetClient.fetchAllItems(DATASET_PATH, apiKey, 5, 100);
            StrategicData liveData = findLiveStrategicData(rows, hsCode)
                    .orElseThrow(() -> new IllegalStateException("YesTrade 응답에서 전략물자 정보를 찾지 못했습니다"));
            return new StrategicResult(liveData, DataStatus.LIVE, null);
        } catch (Exception e) {
            log.error("yesTrade API 처리 실패", e);
            throw new IllegalStateException("YesTrade 전략물자 조회 실패: " + e.getMessage(), e);
        }
    }

    private void ensureApiKey() {
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("YesTrade 일반 인증키가 설정되지 않았습니다.");
        }
    }

    private Optional<StrategicData> findLiveStrategicData(List<JsonNode> rows, String hsCode) {
        if (rows == null || rows.isEmpty()) {
            return Optional.empty();
        }

        String normalizedHs = hsCode == null ? "" : hsCode.trim();
        JsonNode best = rows.stream()
                .filter(row -> matchesHsCode(row, normalizedHs))
                .max(Comparator.comparingInt(row -> scoreStrategicRow(row, normalizedHs)))
                .orElse(rows.get(0));

        return Optional.of(toStrategicData(best, normalizedHs));
    }

    private StrategicData toStrategicData(JsonNode row, String hsCode) {
        String category = firstText(row, "분류", "구분", "category", "품목군");
        String description = firstText(row, "설명", "내용", "description", "비고", "품목명", "title");
        String regulation = firstText(row, "규제내용", "regulationDetail", "근거", "주요내용", "비고");
        boolean strategic = inferStrategic(row, description, regulation);

        if (description.isBlank()) {
            description = "HS코드 " + hsCode + "와 관련된 전략물자 데이터입니다.";
        }
        if (regulation.isBlank()) {
            regulation = "전략물자 여부는 품목 사양과 기술 특성에 따라 달라질 수 있으니 공식 자가판정으로 최종 확인해야 합니다.";
        }

        return new StrategicData(strategic, category, description, regulation);
    }

    private boolean matchesHsCode(JsonNode row, String hsCode) {
        String haystack = row.toString().toLowerCase(Locale.ROOT);
        if (hsCode == null || hsCode.isBlank()) {
            return true;
        }
        String normalized = hsCode.toLowerCase(Locale.ROOT);
        String prefix = normalized.substring(0, Math.min(4, normalized.length()));
        return haystack.contains(normalized) || (!prefix.isBlank() && haystack.contains(prefix));
    }

    private int scoreStrategicRow(JsonNode row, String hsCode) {
        String haystack = row.toString().toLowerCase(Locale.ROOT);
        int score = 0;
        if (hsCode != null && !hsCode.isBlank() && haystack.contains(hsCode.toLowerCase(Locale.ROOT))) score += 20;
        if (haystack.contains("전략")) score += 15;
        if (haystack.contains("허가")) score += 10;
        if (haystack.contains("통제")) score += 10;
        if (haystack.contains("hs")) score += 6;
        return score;
    }

    private boolean inferStrategic(JsonNode row, String description, String regulation) {
        String haystack = (row.toString() + " " + description + " " + regulation).toLowerCase(Locale.ROOT);
        if (haystack.contains("해당없음") || haystack.contains("비해당")) {
            return false;
        }
        if (haystack.contains("전략") || haystack.contains("통제") || haystack.contains("허가")) {
            return true;
        }
        if (haystack.contains("군용") || haystack.contains("핵") || haystack.contains("미사일") || haystack.contains("화학")) {
            return true;
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

    public record StrategicData(
            Boolean isStrategic,
            String category,
            String description,
            String regulationDetail
    ) {}

    public record StrategicResult(StrategicData data, DataStatus status, String message) {}
}
