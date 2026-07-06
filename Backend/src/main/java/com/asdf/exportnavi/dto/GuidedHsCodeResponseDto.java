package com.asdf.exportnavi.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class GuidedHsCodeResponseDto {
    private Boolean ready;
    private String nextQuestion;
    private List<String> missingFields;
    private List<String> hints;
    private List<HsCodeDto> candidates;
}
