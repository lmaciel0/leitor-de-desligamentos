package com.lmaciel.desligamentos.dto;

import java.util.List;

public record DesligamentoRecord(
        int id,
        String arquivo,
        String referencia,
        String municipio,
        String cpf,
        String nis,
        String nome,
        String motivo,
        String status,
        List<String> inconsistencias
) {
    public DesligamentoRecord withStatus(String newStatus, List<String> issues) {
        return new DesligamentoRecord(
                id,
                arquivo,
                referencia,
                municipio,
                cpf,
                nis,
                nome,
                motivo,
                newStatus,
                issues
        );
    }
}
