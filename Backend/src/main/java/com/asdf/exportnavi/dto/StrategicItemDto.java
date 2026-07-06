package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.StrategicItem;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class StrategicItemDto {
    private Long id;
    private Boolean isStrategic;
    private String category;
    private String description;
    private String regulationDetail;

    public static StrategicItemDto from(StrategicItem entity) {
        return StrategicItemDto.builder()
                .id(entity.getId())
                .isStrategic(entity.getIsStrategic())
                .category(entity.getCategory())
                .description(entity.getDescription())
                .regulationDetail(entity.getRegulationDetail())
                .build();
    }
}
