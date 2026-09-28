package com.lmaciel.desligamentos.parser;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

class FieldParserTest {

    private static final String TEXT = """
            MUNICÍPIO: CIDADE EXEMPLO
            CPF: 001.234.567-89
            NIS: 000123456789
            NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO: MARIA DA SILVA
            MOTIVO DO DESLIGAMENTO
            ( ) Mudança para outro Estado
            (X) OUTRO
            Mudança de renda da família
            """;

    @Test
    void parsePreservesIdentifiersAndOtherReason() {
        Map<String, String> record = FieldParser.parseText(TEXT);
        assertThat(record).containsExactlyInAnyOrderEntriesOf(Map.of(
                "MUNICIPIO", "CIDADE EXEMPLO",
                "CPF", "00123456789",
                "NIS", "000123456789",
                "NOME", "MARIA DA SILVA",
                "MOTIVO", "OUTRO: Mudança de renda da família"
        ));
        assertThat(FieldParser.statusFor(record)).isEqualTo("OK");
    }

    @Test
    void missingFieldRequiresReview() {
        assertThat(FieldParser.statusFor(Map.of("CPF", "123"))).isEqualTo("REVISAR");
    }

    @Test
    void invalidCpfLengthRequiresReviewEvenWhenOtherFieldsExist() {
        Map<String, String> record = Map.of(
                "MUNICIPIO", "OUTRA CIDADE",
                "CPF", "1234567890",
                "NIS", "123",
                "NOME", "ANA",
                "MOTIVO", "Mudança"
        );
        assertThat(FieldParser.inconsistencies(record)).contains("CPF inválido");
        assertThat(FieldParser.statusFor(record)).isEqualTo("REVISAR");
    }
}
