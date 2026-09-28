package com.lmaciel.desligamentos.service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import com.lmaciel.desligamentos.dto.DesligamentoRecord;

@Service
public class ExportService {

    private static final String[] HEADERS = {
            "ARQUIVO", "Referencia", "MUNICIPIO", "CPF", "NIS", "NOME", "MOTIVO", "STATUS"
    };
    private static final byte[] UTF8_BOM = {(byte) 0xEF, (byte) 0xBB, (byte) 0xBF};

    public byte[] toCsv(List<DesligamentoRecord> records) {
        String body = Stream.concat(
                Stream.of(String.join(";", HEADERS)),
                records.stream().map(ExportService::csvRow)
        ).collect(Collectors.joining("\n"));
        byte[] content = body.getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[UTF8_BOM.length + content.length];
        System.arraycopy(UTF8_BOM, 0, withBom, 0, UTF8_BOM.length);
        System.arraycopy(content, 0, withBom, UTF8_BOM.length, content.length);
        return withBom;
    }

    public byte[] toXlsx(List<DesligamentoRecord> records) {
        try (XSSFWorkbook workbook = new XSSFWorkbook(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet("Desligamentos");
            CellStyle textStyle = workbook.createCellStyle();
            textStyle.setDataFormat(workbook.createDataFormat().getFormat("@"));
            Row header = sheet.createRow(0);
            for (int index = 0; index < HEADERS.length; index++) {
                header.createCell(index).setCellValue(HEADERS[index]);
            }
            int rowIndex = 1;
            for (DesligamentoRecord record : records) {
                Row row = sheet.createRow(rowIndex++);
                String[] values = {
                        empty(record.arquivo()),
                        empty(record.referencia()),
                        empty(record.municipio()),
                        empty(record.cpf()),
                        empty(record.nis()),
                        empty(record.nome()),
                        empty(record.motivo()),
                        empty(record.status())
                };
                for (int index = 0; index < values.length; index++) {
                    Cell cell = row.createCell(index);
                    cell.setCellStyle(textStyle);
                    cell.setCellValue(values[index]);
                }
            }
            for (int index = 0; index < HEADERS.length; index++) {
                sheet.autoSizeColumn(index);
            }
            workbook.write(buffer);
            return buffer.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Não foi possível gerar o XLSX", exception);
        }
    }

    public List<DesligamentoRecord> onlyReview(List<DesligamentoRecord> records) {
        return records.stream().filter(record -> "REVISAR".equals(record.status())).toList();
    }

    private static String csvRow(DesligamentoRecord record) {
        return String.join(";", List.of(
                escape(record.arquivo()),
                escape(record.referencia()),
                escape(record.municipio()),
                escape(record.cpf()),
                escape(record.nis()),
                escape(record.nome()),
                escape(record.motivo()),
                escape(record.status())
        ));
    }

    private static String escape(String value) {
        String text = empty(value);
        if (text.contains(";") || text.contains("\"") || text.contains("\n")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }

    private static String empty(String value) {
        return value == null ? "" : value;
    }
}
