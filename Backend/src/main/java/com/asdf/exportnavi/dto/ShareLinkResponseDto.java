package com.asdf.exportnavi.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ShareLinkResponseDto {
    private String token;
    private LocalDateTime sharedAt;
}
