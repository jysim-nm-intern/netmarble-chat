# ====================================
# 빌드 스테이지 (JDK 17 + Gradle)
# ====================================
FROM eclipse-temurin:17-jdk-alpine AS builder

WORKDIR /app

# Gradle 래퍼 및 설정 파일 먼저 복사 (의존성 캐시 레이어 최적화)
COPY gradlew .
COPY gradle gradle
COPY build.gradle .
COPY settings.gradle .
COPY gradle.properties .

RUN chmod +x gradlew && sed -i 's/\r$//' gradlew

# 의존성 다운로드 (소스 변경 시 재다운로드 방지)
RUN ./gradlew dependencies --no-daemon 2>/dev/null || true

# 소스 복사 및 빌드 (테스트 제외)
COPY src src
RUN ./gradlew bootJar -x test --no-daemon

# ====================================
# 런타임 스테이지 (JRE만 포함)
# ====================================
FROM eclipse-temurin:17-jre-alpine AS runtime

WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS} -jar app.jar"]
