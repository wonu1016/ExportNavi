package com.asdf.exportnavi.service;

import com.asdf.exportnavi.config.RateLimitExceededException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiRateLimitServiceTests {

    @Test
    void rejectsRequestsOverHourlyLimit() {
        AiRateLimitService service = new AiRateLimitService(2);

        service.consume("user@example.com");
        service.consume("user@example.com");

        assertThatThrownBy(() -> service.consume("user@example.com"))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void tracksEachUserSeparately() {
        AiRateLimitService service = new AiRateLimitService(1);

        service.consume("first@example.com");
        service.consume("second@example.com");
    }
}
