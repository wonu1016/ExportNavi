package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.DataStatus;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class DataSourceStatusDto {
    private String key;
    private String name;
    private String url;
    private DataStatus status;
    private LocalDateTime retrievedAt;
    private String message;
}
