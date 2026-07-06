package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.MarketRecommendation;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MarketRecommendationDto {
    private Long id;
    private String countryName;
    private String countryCode;
    private Double score;
    private Double tariffRate;
    private Boolean ftaApplied;
    private String description;

    public static MarketRecommendationDto from(MarketRecommendation entity) {
        return MarketRecommendationDto.builder()
                .id(entity.getId())
                .countryName(entity.getCountryName())
                .countryCode(entity.getCountryCode())
                .score(entity.getScore())
                .tariffRate(entity.getTariffRate())
                .ftaApplied(entity.getFtaApplied())
                .description(entity.getDescription())
                .build();
    }
}
