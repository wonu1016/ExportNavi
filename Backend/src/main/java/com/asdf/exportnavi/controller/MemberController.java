package com.asdf.exportnavi.controller;

import com.asdf.exportnavi.dto.MemberProfileDto;
import com.asdf.exportnavi.dto.MemberProfileUpdateRequestDto;
import com.asdf.exportnavi.entity.Member;
import com.asdf.exportnavi.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ResponseEntity<MemberProfileDto> getMe(Authentication auth) {
        Member member = memberService.findByEmail(auth.getName());
        return ResponseEntity.ok(MemberProfileDto.from(member));
    }

    @PatchMapping
    public ResponseEntity<MemberProfileDto> updateMe(
            Authentication auth,
            @Valid @RequestBody MemberProfileUpdateRequestDto request) {
        return ResponseEntity.ok(memberService.updateBusinessProfile(auth.getName(), request));
    }
}
