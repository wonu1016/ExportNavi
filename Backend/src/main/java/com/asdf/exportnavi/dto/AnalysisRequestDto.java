package com.asdf.exportnavi.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class AnalysisRequestDto {

    @NotBlank(message = "제품명은 필수입니다")
    @Size(max = 120, message = "제품명은 120자 이하여야 합니다")
    private String productName;

    @NotBlank(message = "제품 설명은 필수입니다")
    @Size(max = 3000, message = "제품 설명은 3000자 이하여야 합니다")
    private String productDescription;

    @Size(max = 500, message = "주요 소재는 500자 이하여야 합니다")
    private String material;

    @Size(max = 500, message = "사용 목적은 500자 이하여야 합니다")
    private String intendedUse;

    @Size(max = 1000, message = "제품 사양은 1000자 이하여야 합니다")
    private String specifications;

    @Size(max = 300, message = "가공 상태는 300자 이하여야 합니다")
    private String processingState;

    @Size(max = 500, message = "희망 수출국은 500자 이하여야 합니다")
    private String targetCountries;

    @Size(max = 1000, message = "참고 URL은 1000자 이하여야 합니다")
    private String referenceUrl;

    @Size(max = 255, message = "첨부 파일명은 255자 이하여야 합니다")
    private String specFileName;

    @Size(max = 120, message = "첨부 파일 형식은 120자 이하여야 합니다")
    private String specFileType;

    @Size(max = 20000, message = "첨부 파일 본문은 20000자 이하여야 합니다")
    private String specFileText;
}
