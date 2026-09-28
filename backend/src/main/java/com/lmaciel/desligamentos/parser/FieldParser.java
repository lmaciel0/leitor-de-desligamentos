package com.lmaciel.desligamentos.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extração dos campos dos formulários de desligamento, equivalente ao parser.py da versão web.
 */
public final class FieldParser {

    public static final List<String> FIELDS = List.of("MUNICIPIO", "CPF", "NIS", "NOME", "MOTIVO");

    private static final int REGEX_FLAGS = Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE;
    private static final Pattern TOKEN = Pattern.compile("[\\wÀ-ÿ]+|\\([^)]*\\)");
    private static final Pattern NAME_LABEL = Pattern.compile(
            labelPattern("NOME DO RESPONSÁVEL FAMILIAR (RF) A SER DESLIGADO") + "\\s*:\\s*([^\\r\\n]*)",
            REGEX_FLAGS
    );
    private static final Pattern REASON_HEADING = Pattern.compile("MOTIVO\\s+DO\\s+DESLIGAMENTO", REGEX_FLAGS);
    private static final Pattern REASON_END = Pattern.compile(
            "\\n\\s*(?:ASSINATURA|OBSERVA[CÇ]ÕES?|DATA\\s*:|MUNIC[IÍ]PIO\\s*:)",
            REGEX_FLAGS
    );
    private static final Pattern CHECKED_BOX = Pattern.compile("\\(\\s*[xX]\\s*\\)");
    private static final Pattern ANY_CHECKBOX = Pattern.compile("\\(\\s*[xX ]\\s*\\)");
    private static final Pattern TRAILING_NAME_NOISE = Pattern.compile("[\\d()\\-]+$");
    private static final Pattern TRAILING_MUNICIPALITY_NUMBER = Pattern.compile("\\s+\\d+\\s*$");
    private static final Pattern NON_DIGITS = Pattern.compile("\\D");

    private FieldParser() {
    }

    public static Map<String, String> parseText(String text) {
        String municipality = TRAILING_MUNICIPALITY_NUMBER.matcher(valueAfterLabel(text, "MUNIC[IÍ]PIO")).replaceFirst("").strip();
        Map<String, String> record = new LinkedHashMap<>();
        record.put("MUNICIPIO", municipality);
        record.put("CPF", firstDigits(valueAfterLabel(text, "CPF"), 11));
        record.put("NIS", NON_DIGITS.matcher(valueAfterLabel(text, "NIS")).replaceAll(""));
        record.put("NOME", extractName(text));
        record.put("MOTIVO", extractReason(text));
        return record;
    }

    public static List<String> inconsistencies(Map<String, String> record) {
        List<String> missing = new ArrayList<>();
        for (String field : FIELDS) {
            if (blank(record.get(field))) {
                missing.add(field);
            }
        }
        String cpf = record.getOrDefault("CPF", "");
        if (!blank(cpf) && cpf.strip().length() != 11) {
            missing.add("CPF inválido");
        }
        return missing;
    }

    public static List<String> inconsistencies(DesligamentoFields fields) {
        Map<String, String> record = new LinkedHashMap<>();
        record.put("MUNICIPIO", fields.municipio());
        record.put("CPF", fields.cpf());
        record.put("NIS", fields.nis());
        record.put("NOME", fields.nome());
        record.put("MOTIVO", fields.motivo());
        return inconsistencies(record);
    }

    public static String statusFor(Map<String, String> record) {
        return inconsistencies(record).isEmpty() ? "OK" : "REVISAR";
    }

    public static String statusFor(DesligamentoFields fields) {
        return inconsistencies(fields).isEmpty() ? "OK" : "REVISAR";
    }

    public record DesligamentoFields(String municipio, String cpf, String nis, String nome, String motivo) {
    }

    static String clean(String value) {
        if (value == null) {
            return "";
        }
        return trimCharset(value.replaceAll("\\s+", " "), " \t:;");
    }

    private static String valueAfterLabel(String text, String labelRegex) {
        Pattern pattern = Pattern.compile(labelRegex + "\\s*:\\s*([^\\r\\n]*)", REGEX_FLAGS);
        Matcher match = pattern.matcher(text == null ? "" : text);
        if (!match.find()) {
            return "";
        }
        String value = clean(match.group(1));
        if (!value.isEmpty()) {
            return value;
        }
        String rest = text.substring(match.end());
        for (String line : rest.split("\\R", -1)) {
            value = clean(line);
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private static String extractName(String text) {
        Matcher match = NAME_LABEL.matcher(text == null ? "" : text);
        if (!match.find()) {
            return "";
        }
        String value = sanitizeName(clean(match.group(1)));
        if (!value.isEmpty()) {
            return value;
        }
        String rest = text.substring(match.end());
        for (String line : rest.split("\\R", -1)) {
            value = sanitizeName(clean(line));
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private static String extractReason(String text) {
        Matcher heading = REASON_HEADING.matcher(text == null ? "" : text);
        if (!heading.find()) {
            return "";
        }
        String section = REASON_END.split(text.substring(heading.end()), 2)[0];
        String[] lines = section.split("\\R", -1);
        for (int index = 0; index < lines.length; index++) {
            if (!CHECKED_BOX.matcher(lines[index]).find()) {
                continue;
            }
            String reason = clean(CHECKED_BOX.matcher(lines[index]).replaceAll(""));
            if (reason.isEmpty()) {
                continue;
            }
            if (reason.regionMatches(true, 0, "outro", 0, 5)) {
                for (int following = index + 1; following < lines.length; following++) {
                    String detail = clean(lines[following]);
                    if (detail.isEmpty() || ANY_CHECKBOX.matcher(detail).find()) {
                        continue;
                    }
                    reason = reason + ": " + detail;
                    break;
                }
            }
            return reason;
        }
        return "";
    }

    private static String sanitizeName(String value) {
        return TRAILING_NAME_NOISE.matcher(value).replaceFirst("").strip();
    }

    private static String firstDigits(String value, int maxLength) {
        String digits = NON_DIGITS.matcher(value).replaceAll("");
        return digits.length() <= maxLength ? digits : digits.substring(0, maxLength);
    }

    private static String labelPattern(String label) {
        Matcher matcher = TOKEN.matcher(label);
        List<String> tokens = new ArrayList<>();
        while (matcher.find()) {
            tokens.add(Pattern.quote(matcher.group()));
        }
        return String.join("\\s+", tokens);
    }

    private static String trimCharset(String value, String charset) {
        int start = 0;
        int end = value.length();
        while (start < end && charset.indexOf(value.charAt(start)) >= 0) {
            start++;
        }
        while (end > start && charset.indexOf(value.charAt(end - 1)) >= 0) {
            end--;
        }
        return value.substring(start, end);
    }

    private static boolean blank(String value) {
        return value == null || value.strip().isEmpty();
    }
}
