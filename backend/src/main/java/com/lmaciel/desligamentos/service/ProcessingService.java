package com.lmaciel.desligamentos.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.lmaciel.desligamentos.dto.DesligamentoRecord;
import com.lmaciel.desligamentos.dto.ProcessResponse;
import com.lmaciel.desligamentos.parser.FieldParser;
import com.lmaciel.desligamentos.parser.FieldParser.DesligamentoFields;

@Service
public class ProcessingService {

    private static final DateTimeFormatter REFERENCE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PdfExtractor pdfExtractor;

    public ProcessingService(PdfExtractor pdfExtractor) {
        this.pdfExtractor = pdfExtractor;
    }

    public ProcessResponse process(List<MultipartFile> uploads, boolean ocrEnabled) {
        List<DesligamentoRecord> rows = new ArrayList<>();
        List<ProcessResponse.Issue> issues = new ArrayList<>();
        int id = 1;
        for (MultipartFile upload : uploads) {
            String filename = originalName(upload);
            String referencia = LocalDate.now().format(REFERENCE);
            try {
                DesligamentoRecord record = extractRecord(id, upload, filename, referencia, ocrEnabled);
                rows.add(record);
                if (!record.inconsistencias().isEmpty()) {
                    issues.add(new ProcessResponse.Issue(filename, String.join(", ", record.inconsistencias())));
                }
            } catch (Exception exception) {
                DesligamentoRecord failed = emptyRecord(id, filename, referencia, "erro de processamento: " + exception.getMessage());
                rows.add(failed);
                issues.add(new ProcessResponse.Issue(filename, failed.inconsistencias().getFirst()));
            }
            id++;
        }
        return new ProcessResponse(rows, issues);
    }

    public List<DesligamentoRecord> refreshStatus(List<DesligamentoRecord> records) {
        List<DesligamentoRecord> refreshed = new ArrayList<>();
        for (DesligamentoRecord record : records) {
            DesligamentoFields fields = new DesligamentoFields(
                    nullToEmpty(record.municipio()),
                    nullToEmpty(record.cpf()),
                    nullToEmpty(record.nis()),
                    nullToEmpty(record.nome()),
                    nullToEmpty(record.motivo())
            );
            List<String> issues = FieldParser.inconsistencies(fields);
            refreshed.add(record.withStatus(issues.isEmpty() ? "OK" : "REVISAR", issues));
        }
        return refreshed;
    }

    private DesligamentoRecord extractRecord(int id, MultipartFile upload, String filename, String referencia, boolean ocrEnabled)
            throws IOException {
        Path tempFile = Files.createTempFile("leitor_desligamentos_", ".pdf");
        try {
            upload.transferTo(tempFile);
            Map<String, String> parsed = FieldParser.parseText(pdfExtractor.extract(tempFile, ocrEnabled));
            DesligamentoFields fields = new DesligamentoFields(
                    parsed.getOrDefault("MUNICIPIO", ""),
                    parsed.getOrDefault("CPF", ""),
                    parsed.getOrDefault("NIS", ""),
                    parsed.getOrDefault("NOME", ""),
                    parsed.getOrDefault("MOTIVO", "")
            );
            List<String> issues = FieldParser.inconsistencies(fields);
            return new DesligamentoRecord(
                    id,
                    filename,
                    referencia,
                    fields.municipio(),
                    fields.cpf(),
                    fields.nis(),
                    fields.nome(),
                    fields.motivo(),
                    issues.isEmpty() ? "OK" : "REVISAR",
                    issues
            );
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }

    private static DesligamentoRecord emptyRecord(int id, String filename, String referencia, String error) {
        return new DesligamentoRecord(id, filename, referencia, "", "", "", "", "", "REVISAR", List.of(error));
    }

    private static String originalName(MultipartFile upload) {
        String name = upload.getOriginalFilename();
        return (name == null || name.isBlank()) ? "arquivo.pdf" : Path.of(name).getFileName().toString();
    }

    private static String nullToEmpty(String value) {
        return Objects.requireNonNullElse(value, "");
    }
}
