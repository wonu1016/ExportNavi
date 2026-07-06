package com.asdf.exportnavi.service;

public record AnalysisRequestedEvent(Long reportId, String email, String hsCode) {
}
