package com.asdf.exportnavi.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class MemberProfileUpdateRequestDto {
    @Size(max = 120, message = "회사명은 120자 이하여야 합니다")
    private String companyName;

    @Size(max = 20, message = "사업자번호는 20자 이하여야 합니다")
    private String businessNumber;

    @Size(max = 50, message = "수출 경험은 50자 이하여야 합니다")
    private String exportExperience;

    @Size(max = 500, message = "주요 품목은 500자 이하여야 합니다")
    private String mainProducts;
}
