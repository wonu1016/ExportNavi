package com.asdf.exportnavi.controller;

import com.asdf.exportnavi.dto.AuthResponseDto;
import com.asdf.exportnavi.dto.LoginRequestDto;
import com.asdf.exportnavi.dto.SignupRequestDto;
import com.asdf.exportnavi.entity.Member;
import com.asdf.exportnavi.security.JwtTokenProvider;
import com.asdf.exportnavi.service.MemberService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final MemberService memberService;
    private final JwtTokenProvider jwtTokenProvider;

    @Value("${app.auth.cookie.secure:false}")
    private boolean secureCookie;

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequestDto request,
                                    HttpServletResponse response) {
        try {
            Member member = memberService.createEmailMember(request);
            String token = issueToken(response, member.getEmail(), request.isRememberMe());
            return ResponseEntity.status(HttpStatus.CREATED).body(AuthResponseDto.of(token, member));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequestDto request,
                                   HttpServletResponse response) {
        try {
            Member member = memberService.authenticateEmailMember(request.getEmail(), request.getPassword());
            String token = issueToken(response, member.getEmail(), request.isRememberMe());
            return ResponseEntity.ok(AuthResponseDto.of(token, member));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("exportnavi_token", "")
                .httpOnly(true)
                .sameSite("Lax")
                .path("/")
                .maxAge(0)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.noContent().build();
    }

    private String issueToken(HttpServletResponse response, String email, boolean rememberMe) {
        String token = jwtTokenProvider.generateToken(email);
        ResponseCookie cookie = ResponseCookie.from("exportnavi_token", token)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .path("/")
                .maxAge(rememberMe ? 24 * 60 * 60 : -1)
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return token;
    }
}
