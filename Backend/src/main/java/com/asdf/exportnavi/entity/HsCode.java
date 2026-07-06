package com.asdf.exportnavi.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Builder
@AllArgsConstructor
public class HsCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // PK

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "analysis_report_id", nullable = false)
    private AnalysisReport analysisReport; // 소속 분석 리포트

    @Column(nullable = false)
    private String code; // HS코드 번호 (예: 8471.30)

    @Column(nullable = false)
    private String description; // HS코드 품목 설명

    private Double confidence; // LLM 추정 신뢰도 (0.0~1.0)

    @Builder.Default
    private Boolean confirmed = false; // 사용자 확정 여부

    public void confirm() {
        this.confirmed = true;
    }

    public void unconfirm() {
        this.confirmed = false;
    }
}
