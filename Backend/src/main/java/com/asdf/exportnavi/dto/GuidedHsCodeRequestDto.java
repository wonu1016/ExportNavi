package com.asdf.exportnavi.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class GuidedHsCodeRequestDto {

    @Size(max = 120)
    private String productName;

    @Size(max = 3000)
    private String productDescription;

    @Size(max = 500)
    private String material;

    @Size(max = 500)
    private String intendedUse;

    @Size(max = 1000)
    private String specifications;

    @Size(max = 300)
    private String processingState;

    @Size(max = 500)
    private String targetCountries;

    @Size(max = 1000)
    private String referenceUrl;

    @Size(max = 20000)
    private String specFileText;

    private List<GuidedConversationTurnDto> conversation;
}
