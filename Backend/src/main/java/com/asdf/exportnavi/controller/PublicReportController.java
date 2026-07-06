package com.asdf.exportnavi.controller;

import com.asdf.exportnavi.dto.AnalysisResponseDto;
import com.asdf.exportnavi.service.AnalysisService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/reports")
@RequiredArgsConstructor
public class PublicReportController {
    private final AnalysisService analysisService;

    @GetMapping("/{token}")
    public ResponseEntity<AnalysisResponseDto> getSharedReport(@PathVariable String token) {
        return ResponseEntity.ok(analysisService.getSharedReport(token));
    }
}
