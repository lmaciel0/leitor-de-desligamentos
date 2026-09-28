package com.lmaciel.desligamentos.dto;

import java.util.List;

public record ProcessResponse(
        List<DesligamentoRecord> registros,
        List<Issue> inconsistenciasIniciais
) {
    public record Issue(String arquivo, String inconsistencias) {
    }
}
