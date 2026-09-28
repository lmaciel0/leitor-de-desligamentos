package com.lmaciel.desligamentos.service;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import net.sourceforge.tess4j.Tesseract;

@Service
public class PdfExtractor {

    private static final Logger LOGGER = LoggerFactory.getLogger(PdfExtractor.class);
    private static final float OCR_DPI = 300f;

    public String extract(Path pdfPath, boolean ocrEnabled) {
        try (PDDocument document = Loader.loadPDF(pdfPath.toFile())) {
            String text = nativeText(document);
            if (!text.isBlank() || !ocrEnabled) {
                return text;
            }
            return ocrText(document);
        } catch (IOException exception) {
            LOGGER.error("Falha na extração nativa de {}", pdfPath.getFileName(), exception);
            return "";
        }
    }

    private static String nativeText(PDDocument document) throws IOException {
        PDFTextStripper stripper = new PDFTextStripper();
        return stripper.getText(document);
    }

    private static String ocrText(PDDocument document) {
        try {
            Tesseract tesseract = new Tesseract();
            tesseract.setLanguage("por");
            String datapath = System.getenv("TESSDATA_PREFIX");
            if (datapath != null && !datapath.isBlank()) {
                tesseract.setDatapath(datapath);
            }
            PDFRenderer renderer = new PDFRenderer(document);
            List<String> pages = new ArrayList<>();
            for (int page = 0; page < document.getNumberOfPages(); page++) {
                BufferedImage image = renderer.renderImageWithDPI(page, OCR_DPI);
                pages.add(tesseract.doOCR(image));
            }
            return String.join("\n", pages);
        } catch (Exception exception) {
            LOGGER.error("Falha no OCR", exception);
            return "";
        }
    }
}
