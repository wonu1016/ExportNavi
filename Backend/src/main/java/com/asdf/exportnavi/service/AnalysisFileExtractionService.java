package com.asdf.exportnavi.service;

import com.asdf.exportnavi.dto.SpecFileExtractionDto;
import lombok.extern.slf4j.Slf4j;
import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Slf4j
@Service
public class AnalysisFileExtractionService {

    private final Tika tika = new Tika();

    public SpecFileExtractionDto extract(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("업로드한 파일이 없습니다");
        }

        if (file.getSize() > 10 * 1024 * 1024L) {
            throw new IllegalArgumentException("파일은 10MB 이하여야 합니다");
        }

        String fileName = file.getOriginalFilename() == null ? "uploaded-file" : file.getOriginalFilename();
        String fileType = detectFileType(file);
        String extractedText = readText(file);
        String trimmedText = trimText(extractedText);

        return SpecFileExtractionDto.builder()
                .fileName(fileName)
                .fileType(fileType)
                .extractedText(trimmedText)
                .suggestedProductName(suggestProductName(fileName, trimmedText))
                .suggestedProductDescription(suggestProductDescription(trimmedText))
                .suggestedMaterial(suggestMaterial(trimmedText))
                .suggestedIntendedUse(suggestIntendedUse(trimmedText))
                .suggestedSpecifications(suggestSpecifications(trimmedText))
                .suggestedProcessingState(suggestProcessingState(trimmedText))
                .build();
    }

    private String detectFileType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && !contentType.isBlank()) {
            return contentType;
        }
        String name = file.getOriginalFilename();
        if (name == null) {
            return "application/octet-stream";
        }
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (lower.endsWith(".txt")) return "text/plain";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        return "application/octet-stream";
    }

    private String readText(MultipartFile file) {
        try {
            byte[] bytes = file.getBytes();
            if (bytes.length == 0) {
                return "";
            }

            String mimeType = tika.detect(bytes, file.getOriginalFilename());
            if (mimeType != null && mimeType.startsWith("text/")) {
                return new String(bytes, StandardCharsets.UTF_8);
            }

            try {
                return tika.parseToString(file.getInputStream());
            } catch (Exception ex) {
                log.warn("파일 텍스트 추출 실패, 파일명만 사용: {}", file.getOriginalFilename(), ex);
                return new String(bytes, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            throw new IllegalStateException("파일을 읽을 수 없습니다", e);
        }
    }

    private String trimText(String text) {
        if (text == null) {
            return "";
        }
        String normalized = text.replace("\u0000", " ").replaceAll("\\s+", " ").trim();
        if (normalized.length() <= 6000) {
            return normalized;
        }
        return normalized.substring(0, 6000);
    }

    private String suggestProductName(String fileName, String text) {
        String firstLine = text.lines().map(String::trim).filter(line -> !line.isBlank()).findFirst().orElse("");
        if (!firstLine.isBlank() && firstLine.length() <= 60) {
            return firstLine;
        }
        String base = fileName.replaceFirst("\\.[^.]+$", "");
        return base.replaceAll("[_-]+", " ").trim();
    }

    private String suggestProductDescription(String text) {
        if (text.isBlank()) {
            return "";
        }
        return text.length() <= 1200 ? text : text.substring(0, 1200);
    }

    private String suggestMaterial(String text) {
        return keywordAround(text, "재질", "소재", "material");
    }

    private String suggestIntendedUse(String text) {
        return keywordAround(text, "용도", "사용", "purpose");
    }

    private String suggestSpecifications(String text) {
        return keywordAround(text, "규격", "사양", "spec", "size", "capacity");
    }

    private String suggestProcessingState(String text) {
        return keywordAround(text, "완제품", "부품", "조립", "가공", "포장");
    }

    private String keywordAround(String text, String... keywords) {
        for (String keyword : keywords) {
            int idx = text.indexOf(keyword);
            if (idx >= 0) {
                int start = Math.max(0, idx - 30);
                int end = Math.min(text.length(), idx + 110);
                return text.substring(start, end).trim();
            }
        }
        return "";
    }
}
