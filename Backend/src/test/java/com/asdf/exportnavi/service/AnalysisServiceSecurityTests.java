package com.asdf.exportnavi.service;

import com.asdf.exportnavi.ai.ClaudeService;
import com.asdf.exportnavi.dto.AnalysisResponseDto;
import com.asdf.exportnavi.entity.ActionChecklistItem;
import com.asdf.exportnavi.entity.AnalysisReport;
import com.asdf.exportnavi.entity.Member;
import com.asdf.exportnavi.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalysisServiceSecurityTests {

    @Mock AnalysisReportRepository reportRepository;
    @Mock HsCodeRepository hsCodeRepository;
    @Mock MarketRecommendationRepository marketRepository;
    @Mock RiskAssessmentRepository riskRepository;
    @Mock StrategicItemRepository strategicRepository;
    @Mock ActionChecklistItemRepository checklistRepository;
    @Mock MemberService memberService;
    @Mock ClaudeService claudeService;
    @Mock KotraService kotraService;
    @Mock KsureService ksureService;
    @Mock YesTradeService yesTradeService;
    @Mock ObjectMapper objectMapper;

    @InjectMocks AnalysisService analysisService;

    @Test
    void ownerCanReadOwnReport() {
        AnalysisReport report = report(1L, "owner@example.com");
        when(reportRepository.findByIdAndMemberEmail(1L, "owner@example.com"))
                .thenReturn(Optional.of(report));

        AnalysisResponseDto response = analysisService.getReport("owner@example.com", 1L);

        assertThat(response.getId()).isEqualTo(1L);
        verify(reportRepository).findByIdAndMemberEmail(1L, "owner@example.com");
    }

    @Test
    void anotherUserCannotReadReportByChangingId() {
        when(reportRepository.findByIdAndMemberEmail(1L, "other@example.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> analysisService.getReport("other@example.com", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("리포트를 찾을 수 없습니다");
    }

    @Test
    void anotherUserCannotUpdateChecklistItem() {
        when(checklistRepository.findByIdAndAnalysisReportIdAndAnalysisReportMemberEmail(
                10L, 1L, "other@example.com"))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> analysisService.updateChecklistItem(
                "other@example.com", 1L, 10L, true))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("체크리스트 항목을 찾을 수 없습니다");
    }

    @Test
    void ownerCanUpdateChecklistItem() {
        AnalysisReport report = report(1L, "owner@example.com");
        ActionChecklistItem item = ActionChecklistItem.builder()
                .id(10L)
                .analysisReport(report)
                .category("HS_CODE")
                .title("HS코드 확인")
                .displayOrder(1)
                .build();
        when(checklistRepository.findByIdAndAnalysisReportIdAndAnalysisReportMemberEmail(
                10L, 1L, "owner@example.com"))
                .thenReturn(Optional.of(item));
        when(checklistRepository.save(item)).thenReturn(item);

        analysisService.updateChecklistItem("owner@example.com", 1L, 10L, true);

        assertThat(item.getCompleted()).isTrue();
    }

    private AnalysisReport report(Long id, String email) {
        Member member = Member.builder()
                .id(1L)
                .email(email)
                .name("사용자")
                .role(Member.Role.USER)
                .build();
        return AnalysisReport.builder()
                .id(id)
                .member(member)
                .reportTitle("테스트 리포트")
                .productName("테스트 제품")
                .productDescription("테스트 설명")
                .build();
    }
}
