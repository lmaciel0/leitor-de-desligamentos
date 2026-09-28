package com.lmaciel.desligamentos.controller;

import java.util.List;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.lmaciel.desligamentos.dto.DesligamentoRecord;
import com.lmaciel.desligamentos.dto.ProcessResponse;
import com.lmaciel.desligamentos.service.ExportService;
import com.lmaciel.desligamentos.service.ProcessingService;

@RestController
@RequestMapping("/api")
public class DesligamentoController {

    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    private final ProcessingService processingService;
    private final ExportService exportService;

    public DesligamentoController(ProcessingService processingService, ExportService exportService) {
        this.processingService = processingService;
        this.exportService = exportService;
    }

    @GetMapping("/saude")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("ok");
    }

    @PostMapping(value = "/processar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProcessResponse processar(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "ocrEnabled", defaultValue = "true") boolean ocrEnabled
    ) {
        if (files == null || files.isEmpty()) {
            throw new IllegalArgumentException("Envie ao menos um PDF.");
        }
        return processingService.process(files, ocrEnabled);
    }

    @PostMapping("/recalcular")
    public List<DesligamentoRecord> recalcular(@RequestBody List<DesligamentoRecord> records) {
        return processingService.refreshStatus(records);
    }

    @PostMapping("/exportar/csv")
    public ResponseEntity<byte[]> csv(@RequestBody List<DesligamentoRecord> records) {
        return file(exportService.toCsv(processingService.refreshStatus(records)), "desligamentos.csv", MediaType.parseMediaType("text/csv; charset=utf-8"));
    }

    @PostMapping("/exportar/xlsx")
    public ResponseEntity<byte[]> xlsx(@RequestBody List<DesligamentoRecord> records) {
        return file(exportService.toXlsx(processingService.refreshStatus(records)), "desligamentos.xlsx", XLSX);
    }

    @PostMapping("/exportar/xlsx-revisar")
    public ResponseEntity<byte[]> xlsxRevisar(@RequestBody List<DesligamentoRecord> records) {
        List<DesligamentoRecord> review = exportService.onlyReview(processingService.refreshStatus(records));
        return file(exportService.toXlsx(review), "desligamentos_revisar.xlsx", XLSX);
    }

    private static ResponseEntity<byte[]> file(byte[] content, String filename, MediaType mediaType) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .contentType(mediaType)
                .body(content);
    }
}
