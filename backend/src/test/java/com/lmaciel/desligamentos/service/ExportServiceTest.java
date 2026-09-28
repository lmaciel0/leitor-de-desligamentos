package com.lmaciel.desligamentos.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.lmaciel.desligamentos.dto.DesligamentoRecord;

class ExportServiceTest {

    private final ExportService exportService = new ExportService();

    @Test
    void csvStartsWithBomAndHeader() {
        byte[] csv = exportService.toCsv(List.of(new DesligamentoRecord(
                1, "a.pdf", "17/09/2026", "CIDADE EXEMPLO", "00123456789", "000123456789",
                "MARIA DA SILVA", "OUTRO: Mudança", "OK", List.of()
        )));
        String text = new String(csv, StandardCharsets.UTF_8);
        assertThat(csv[0]).isEqualTo((byte) 0xEF);
        assertThat(text).startsWith("\uFEFFARQUIVO;Referencia;MUNICIPIO;CPF;NIS;NOME;MOTIVO;STATUS");
        assertThat(text).contains("00123456789");
    }

    @Test
    void xlsxIsZipContainer() {
        byte[] xlsx = exportService.toXlsx(List.of(new DesligamentoRecord(
                1, "a.pdf", "17/09/2026", "OUTRA CIDADE", "00123456789", "1", "ANA", "Motivo", "OK", List.of()
        )));
        assertThat(xlsx[0]).isEqualTo((byte) 'P');
        assertThat(xlsx[1]).isEqualTo((byte) 'K');
    }
}
