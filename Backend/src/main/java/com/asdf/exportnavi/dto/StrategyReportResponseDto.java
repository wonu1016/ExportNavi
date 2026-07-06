package com.asdf.exportnavi.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class StrategyReportResponseDto {
    private String title;
    private String targetCountry;
    private String entryReason;
    private String riskSummary;
    private String paymentMethod;
    private List<String> certifications;
    private List<String> documents;
    private List<String> thirtyDayPlan;
    private Integer exportScore;
    private String summary;
}
