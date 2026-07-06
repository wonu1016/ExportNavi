package com.asdf.exportnavi.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class AnalysisDraftRequestDto {

    private String reportTitle;
    private String productName;
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
}
