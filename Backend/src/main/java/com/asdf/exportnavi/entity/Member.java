package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @Column(nullable = false, unique = true)
    private String email; // Google OAuth 이메일

    @Column(nullable = false)
    private String name; // 사용자 이름

    private String passwordHash;

    private String profileImage; // 프로필 이미지 URL

    private String companyName;

    private String businessNumber;

    private String exportExperience;

    @Column(columnDefinition = "TEXT")
    private String mainProducts;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role; // 권한 (USER / ADMIN)

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now(); // 가입일시

    public Member updateProfile(String name, String profileImage) {
        this.name = name;
        this.profileImage = profileImage;
        return this;
    }

    public void updateBusinessProfile(String companyName, String businessNumber,
                                      String exportExperience, String mainProducts) {
        this.companyName = normalize(companyName);
        this.businessNumber = normalize(businessNumber);
        this.exportExperience = normalize(exportExperience);
        this.mainProducts = normalize(mainProducts);
    }

    private String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    public enum Role {
        USER, ADMIN
    }
}
