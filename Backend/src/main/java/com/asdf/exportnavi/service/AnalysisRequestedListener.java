package com.asdf.exportnavi.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnalysisRequestedListener {

    private final AnalysisService analysisService;

    @Async("analysisExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handle(AnalysisRequestedEvent event) {
        try {
            analysisService.executeAnalysis(event.email(), event.reportId(), event.hsCode());
        } catch (Exception e) {
            log.error("백그라운드 분석 실패 — reportId: {}", event.reportId(), e);
            String message = e.getMessage();
            analysisService.markAnalysisFailed(event.email(), event.reportId(),
                    (message == null || message.isBlank())
                            ? "외부 데이터 또는 AI 분석 중 오류가 발생했습니다. 입력 정보와 API 키를 확인해 주세요."
                            : "외부 데이터 또는 AI 분석 실패: " + message);
        }
    }
}
