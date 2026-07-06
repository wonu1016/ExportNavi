package com.asdf.exportnavi.service;

import com.asdf.exportnavi.config.RateLimitExceededException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AiRateLimitService {

    private static final Duration WINDOW = Duration.ofHours(1);

    private final int maxRequestsPerHour;
    private final Map<String, Deque<Instant>> requests = new ConcurrentHashMap<>();

    public AiRateLimitService(
            @Value("${app.ai.max-requests-per-hour:20}") int maxRequestsPerHour) {
        this.maxRequestsPerHour = maxRequestsPerHour;
    }

    public void consume(String email) {
        Instant now = Instant.now();
        Deque<Instant> userRequests = requests.computeIfAbsent(email, key -> new ArrayDeque<>());

        synchronized (userRequests) {
            Instant cutoff = now.minus(WINDOW);
            while (!userRequests.isEmpty() && userRequests.peekFirst().isBefore(cutoff)) {
                userRequests.removeFirst();
            }
            if (userRequests.size() >= maxRequestsPerHour) {
                throw new RateLimitExceededException(
                        "AI 분석 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
            }
            userRequests.addLast(now);
        }
    }
}
