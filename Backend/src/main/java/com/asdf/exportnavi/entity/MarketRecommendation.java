package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class MarketRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_report_id", nullable = false)
    private AnalysisReport analysisReport; // 소속 분석 리포트

    @Column(nullable = false)
    private String countryName; // 추천 국가명

    private String countryCode; // ISO 국가코드 (예: US, VN)

    private Double score; // 유망도 점수 (KOTRA 기반)

    private Double tariffRate; // 해당 품목 관세율 (%)

    private Boolean ftaApplied; // FTA 적용 여부

    @Column(columnDefinition = "TEXT")
    private String description; // 시장 추천 사유 설명
}
