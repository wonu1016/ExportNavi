package com.asdf.exportnavi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class HsCodeConfirmRequestDto {

    @NotBlank(message = "HS코드는 필수입니다")
    @Pattern(regexp = "^[0-9]{4}(\\.[0-9]{2,6})?$",
            message = "HS코드는 4자리 숫자 또는 소수점 뒤 2~6자리 숫자 형식이어야 합니다")
    private String hsCode;
}
