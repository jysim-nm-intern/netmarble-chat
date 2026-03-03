package com.netmarble.chat.architecture;

import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;

/**
 * 모듈 간 의존성 방향 규칙 검증 (ArchUnit)
 * - domain 레이어는 infrastructure에 의존하지 않는다.
 * - presentation(controller)은 repository를 직접 호출하지 않는다.
 * - application 레이어는 presentation에 의존하지 않는다.
 */
class ModuleDependencyTest {

    private JavaClasses classes;

    @BeforeEach
    void setUp() {
        classes = new ClassFileImporter()
            .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
            .importPackages("com.netmarble.chat");
    }

    @Test
    @DisplayName("도메인 레이어는 인프라(JPA/MongoDB/Redis) 패키지에 의존하지 않아야 한다")
    void domainLayerShouldNotDependOnInfrastructure() {
        ArchRule rule = noClasses()
            .that().resideInAPackage("com.netmarble.chat.domain..")
            .should().dependOnClassesThat()
            .resideInAnyPackage(
                "jakarta.persistence..",
                "org.springframework.data.mongodb..",
                "org.springframework.data.redis..",
                "com.netmarble.chat.infrastructure.."
            );

        rule.check(classes);
    }

    @Test
    @DisplayName("컨트롤러(presentation)는 Repository를 직접 호출하지 않아야 한다")
    void controllerShouldNotAccessRepositoryDirectly() {
        ArchRule rule = noClasses()
            .that().resideInAPackage("com.netmarble.chat.presentation..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.netmarble.chat.domain.repository..");

        rule.check(classes);
    }

    @Test
    @DisplayName("application 레이어는 presentation 레이어에 의존하지 않아야 한다")
    void applicationLayerShouldNotDependOnPresentation() {
        ArchRule rule = noClasses()
            .that().resideInAPackage("com.netmarble.chat.application..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.netmarble.chat.presentation..");

        rule.check(classes);
    }

    @Test
    @DisplayName("Entity가 직접 API 응답으로 반환되지 않아야 한다 (컨트롤러 메서드 반환 타입 검증)")
    void controllerShouldNotReturnEntitiesDirectly() {
        ArchRule rule = noClasses()
            .that().resideInAPackage("com.netmarble.chat.presentation..")
            .should().dependOnClassesThat()
            .resideInAPackage("com.netmarble.chat.infrastructure.jpa.entity..");

        rule.check(classes);
    }
}
