package com.asdf.exportnavi.dto;

import com.asdf.exportnavi.entity.Member;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AuthResponseDto {

    private String token;
    private MemberProfileDto member;

    public static AuthResponseDto of(String token, Member member) {
        return AuthResponseDto.builder()
                .token(token)
                .member(MemberProfileDto.from(member))
                .build();
    }
}
