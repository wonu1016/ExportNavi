package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class StrategicItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_report_id", nullable = false)
    private AnalysisReport analysisReport; // 소속 분석 리포트

    @Builder.Default
    private Boolean isStrategic = false; // 전략물자 해당 여부

    private String category; // 전략물자 분류 (예: 이중용도, 군용 등)

    @Column(columnDefinition = "TEXT")
    private String description; // 판정 결과 요약 설명

    @Column(columnDefinition = "TEXT")
    private String regulationDetail; // 관련 규제 상세 내용 (수출통제 근거)
}
