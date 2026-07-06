package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.HsCode;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class HsCodeDto {
    private Long id;
    private String code;
    private String description;
    private Double confidence;
    private Boolean confirmed;

    public static HsCodeDto from(HsCode entity) {
        return HsCodeDto.builder()
                .id(entity.getId())
                .code(entity.getCode())
                .description(entity.getDescription())
                .confidence(entity.getConfidence())
                .confirmed(entity.getConfirmed())
                .build();
    }
}
