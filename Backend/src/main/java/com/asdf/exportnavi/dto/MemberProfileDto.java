package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.Member;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MemberProfileDto {
    private Long id;
    private String email;
    private String name;
    private String profileImage;
    private String role;
    private String companyName;
    private String businessNumber;
    private String exportExperience;
    private String mainProducts;

    public static MemberProfileDto from(Member member) {
        return MemberProfileDto.builder()
                .id(member.getId())
                .email(member.getEmail())
                .name(member.getName())
                .profileImage(member.getProfileImage())
                .role(member.getRole().name())
                .companyName(member.getCompanyName())
                .businessNumber(member.getBusinessNumber())
                .exportExperience(member.getExportExperience())
                .mainProducts(member.getMainProducts())
                .build();
    }
}
