package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.RiskAssessment;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class RiskAssessmentDto {
    private Long id;
    private String countryName;
    private String countryCode;
    private String riskGrade;
    private String creditRating;
    private String description;

    public static RiskAssessmentDto from(RiskAssessment entity) {
        return RiskAssessmentDto.builder()
                .id(entity.getId())
                .countryName(entity.getCountryName())
                .countryCode(entity.getCountryCode())
                .riskGrade(entity.getRiskGrade())
                .creditRating(entity.getCreditRating())
                .description(entity.getDescription())
                .build();
    }
}
