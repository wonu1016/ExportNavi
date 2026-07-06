package com.asdf.exportnavi.service;

import com.asdf.exportnavi.dto.MemberProfileDto;
import com.asdf.exportnavi.dto.MemberProfileUpdateRequestDto;
import com.asdf.exportnavi.dto.SignupRequestDto;
import com.asdf.exportnavi.entity.Member;
import com.asdf.exportnavi.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 서비스.
 * Google OAuth 로그인 시 회원 정보를 저장/업데이트한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MemberService {

    private final MemberRepository memberRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * OAuth 로그인 성공 시 — 구글 프로필 정보로 회원 생성 또는 업데이트
     */
    @Transactional
    public Member getOrCreateOAuthMember(String email, String name, String picture) {
        return memberRepository.findByEmail(email)
                .map(member -> member.updateProfile(name, picture))
                .orElseGet(() -> memberRepository.save(
                        Member.builder()
                                .email(email)
                                .name(name)
                                .profileImage(picture)
                                .role(Member.Role.USER)
                                .build()
                ));
    }

    @Transactional
    public Member createEmailMember(SignupRequestDto request) {
        String email = normalizeRequired(request.getEmail()).toLowerCase();
        if (memberRepository.findByEmail(email).isPresent()) {
            throw new IllegalStateException("이미 가입된 이메일입니다");
        }
        return memberRepository.save(
                Member.builder()
                        .email(email)
                        .name(normalizeRequired(request.getName()))
                        .passwordHash(passwordEncoder.encode(request.getPassword()))
                        .role(Member.Role.USER)
                        .build()
        );
    }

    public Member authenticateEmailMember(String email, String password) {
        Member member = memberRepository.findByEmail(normalizeRequired(email).toLowerCase())
                .orElseThrow(() -> new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다"));
        if (member.getPasswordHash() == null || !passwordEncoder.matches(password, member.getPasswordHash())) {
            throw new IllegalArgumentException("이메일 또는 비밀번호가 올바르지 않습니다");
        }
        return member;
    }

    /**
     * 이메일로 회원 조회 (JWT에서 추출한 이메일 기반)
     */
    public Member findByEmail(String email) {
        return memberRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("회원을 찾을 수 없습니다: " + email));
    }

    @Transactional
    public MemberProfileDto updateBusinessProfile(String email,
                                                   MemberProfileUpdateRequestDto request) {
        Member member = findByEmail(email);
        member.updateBusinessProfile(
                request.getCompanyName(), request.getBusinessNumber(),
                request.getExportExperience(), request.getMainProducts());
        return MemberProfileDto.from(memberRepository.save(member));
    }

    private String normalizeRequired(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("필수 입력값이 누락되었습니다");
        }
        return value.trim();
    }
}
