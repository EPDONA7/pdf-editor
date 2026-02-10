const express = require('express');
const cors = require('cors');
const multer = require('multer');
const PDFParser = require('pdf2json');
const fs = require('fs-extra');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Configure storage
const upload = multer({ dest: 'uploads/' });

// API Route: Upload and Parse PDF
app.post('/api/parse-pdf', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send("No file uploaded");

    const pdfParser = new PDFParser();

    pdfParser.on("pdfParser_dataError", errData => {
        console.error(errData.parserError);
        res.status(500).send("Error parsing PDF");
    });

    pdfParser.on("pdfParser_dataReady", pdfData => {
        // We only take the first page for this MVP website
        const page1 = pdfData.Pages[0];
        
        // Convert raw PDF data to simple JSON for the frontend
        const parsedData = {
            width: page1.Width, // PDF Units
            height: page1.Height,
            texts: page1.Texts.map(t => ({
                text: decodeURIComponent(t.R[0].T),
                x: t.x,
                y: t.y,
                fontSize: t.R[0].TS[1],
                color: '#000000'
            }))
        };

        // Clean up temp file
        fs.unlinkSync(req.file.path);
        
        res.json(parsedData);
    });

    pdfParser.loadPDF(req.file.path);
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));