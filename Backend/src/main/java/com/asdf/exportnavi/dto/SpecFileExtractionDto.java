package com.asdf.exportnavi.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SpecFileExtractionDto {
    private String fileName;
    private String fileType;
    private String extractedText;
    private String suggestedProductName;
    private String suggestedProductDescription;
    private String suggestedMaterial;
    private String suggestedIntendedUse;
    private String suggestedSpecifications;
    private String suggestedProcessingState;
}
