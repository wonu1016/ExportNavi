package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.ActionChecklistItem;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class ActionChecklistItemDto {
    private Long id;
    private String category;
    private String title;
    private String description;
    private String officialUrl;
    private Boolean completed;
    private Integer displayOrder;

    public static ActionChecklistItemDto from(ActionChecklistItem item) {
        return ActionChecklistItemDto.builder()
                .id(item.getId())
                .category(item.getCategory())
                .title(item.getTitle())
                .description(item.getDescription())
                .officialUrl(item.getOfficialUrl())
                .completed(item.getCompleted())
                .displayOrder(item.getDisplayOrder())
                .build();
    }
}
