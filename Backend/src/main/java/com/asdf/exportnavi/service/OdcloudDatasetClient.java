package com.asdf.exportnavi.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class OdcloudDatasetClient {

    private static final String HOST = "api.odcloud.kr";
    private static final String PREFIX = "/api";

    private final WebClient webClient;
    private final ObjectMapper objectMapper;

    public OdcloudDatasetClient(WebClient webClient, ObjectMapper objectMapper) {
        this.webClient = webClient;
        this.objectMapper = objectMapper;
    }

    public List<JsonNode> fetchAllItems(String datasetPath) {
        return fetchAllItems(datasetPath, "", 5, 100);
    }

    public List<JsonNode> fetchAllItems(String datasetPath, int maxPages, int perPage) {
        return fetchAllItems(datasetPath, "", maxPages, perPage);
    }

    public List<JsonNode> fetchAllItems(String datasetPath, String apiKey, int maxPages, int perPage) {
        List<JsonNode> all = new ArrayList<>();
        for (int page = 1; page <= maxPages; page++) {
            String json = fetchPage(datasetPath, apiKey, page, perPage);
            List<JsonNode> items = extractItems(json);
            if (items.isEmpty()) {
                break;
            }
            all.addAll(items);
            if (items.size() < perPage) {
                break;
            }
        }
        return all;
    }

    public String fetchPage(String datasetPath, String apiKey, int page, int perPage) {
        return webClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder
                            .scheme("https")
                            .host(HOST)
                            .path(PREFIX)
                            .path(datasetPath)
                            .queryParam("page", page)
                            .queryParam("perPage", perPage)
                            .queryParam("returnType", "json");
                    if (apiKey != null && !apiKey.isBlank()) {
                        builder.queryParam("serviceKey", apiKey);
                    }
                    return builder.build();
                })
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }

    public List<JsonNode> extractItems(String json) {
        List<JsonNode> result = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return result;
        }

        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode data = root.path("data");
            if (data.isArray()) {
                for (JsonNode node : data) {
                    result.add(node);
                }
                return result;
            }

            JsonNode legacyItems = root.path("response").path("body").path("items").path("item");
            if (legacyItems.isArray()) {
                for (JsonNode node : legacyItems) {
                    result.add(node);
                }
            } else if (!legacyItems.isMissingNode() && !legacyItems.isNull()) {
                result.add(legacyItems);
            }
        } catch (Exception e) {
            log.warn("ODcloud 응답 파싱 실패", e);
        }

        return result;
    }
}
