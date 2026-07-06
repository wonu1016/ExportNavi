package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class RiskAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_report_id", nullable = false)
    private AnalysisReport analysisReport; // 소속 분석 리포트

    @Column(nullable = false)
    private String countryName; // 평가 대상 국가명

    private String countryCode; // ISO 국가코드

    private String riskGrade; // 리스크 등급 (무역보험공사 기준)

    private String creditRating; // 국가 신용등급

    @Column(columnDefinition = "TEXT")
    private String description; // 리스크 평가 상세 설명
}
