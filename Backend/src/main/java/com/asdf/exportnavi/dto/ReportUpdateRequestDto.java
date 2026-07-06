package com.asdf.exportnavi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class ReportUpdateRequestDto {
    @NotBlank(message = "리포트 이름은 필수입니다")
    @Size(max = 120, message = "리포트 이름은 120자 이하여야 합니다")
    private String reportTitle;
}
