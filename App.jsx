import React, { useState, useEffect, useRef } from 'react';
import { fabric } from 'fabric';
import jsPDF from 'jspdf';
import * as pdfjsLib from 'pdfjs-dist';

// 1. Set up the PDF worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

function App() {
  const [canvas, setCanvas] = useState(null);
  const canvasRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = async function() {
      const typedarray = new Uint8Array(this.result);

      // A. Load the PDF
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      const page = await pdf.getPage(1);
      
      // B. Setup Viewport (Scale 1.5 is good for clear text)
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      // C. Render PDF as Background Image
      const hiddenCanvas = document.createElement('canvas');
      hiddenCanvas.width = viewport.width;
      hiddenCanvas.height = viewport.height;
      const context = hiddenCanvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const bgImageURL = hiddenCanvas.toDataURL('image/png');

      // D. Extract Text Coordinates (The Magic Part)
      const textContent = await page.getTextContent();
      
      // E. Initialize Editor
      initCanvas(bgImageURL, viewport, textContent);
    };
    fileReader.readAsArrayBuffer(file);
  };

  const initCanvas = (bgUrl, viewport, textContent) => {
    if (canvas) canvas.dispose();

    const newCanvas = new fabric.Canvas(canvasRef.current, {
      height: viewport.height,
      width: viewport.width,
    });

    // 1. Set Background
    fabric.Image.fromURL(bgUrl, (img) => {
      newCanvas.setBackgroundImage(img, newCanvas.renderAll.bind(newCanvas), {
        scaleX: viewport.width / img.width,
        scaleY: viewport.height / img.height,
      });
    });

    // 2. Overlay Text
    // PDF.js returns coordinates: [scaleX, skewY, skewX, scaleY, x, y]
    textContent.items.forEach((item) => {
      // Helper to convert PDF math to Canvas Pixels
      const tx = pdfjsLib.Util.transform(
        viewport.transform,
        item.transform
      );

      // tx[4] is X, tx[5] is Y
      // NOTE: PDF coordinates start from Bottom-Left. Canvas starts Top-Left.
      // pdfjsLib.Util.transform handles the Y-flip automatically!
      
      const fontSize = Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1]);
      const scaledFontSize = fontSize * viewport.scale;

      // Adjust Y position (PDF renders at baseline, Fabric renders at Top-Left)
      // We subtract mostly to align the font "box"
      const finalX = tx[4];
      const finalY = tx[5] - scaledFontSize; 

      const textString = item.str;
      // Skip empty spaces
      if (!textString.trim()) return;

      // A. White Patch (Hides original)
      const textWidth = item.width * viewport.scale;
      const whitePatch = new fabric.Rect({
          left: finalX,
          top: finalY,
          width: textWidth, 
          height: scaledFontSize * 1.2, // slightly taller
          fill: 'white',
          selectable: false,
          evented: false,
      });

      // B. Editable Text
      const editableText = new fabric.IText(textString, {
          left: finalX,
          top: finalY,
          fontSize: scaledFontSize,
          fontFamily: 'Helvetica', // PDF fonts are hard to match, this is safest
          fill: '#000',
          selectable: true
      });

      newCanvas.add(whitePatch);
      newCanvas.add(editableText);
    });

    setCanvas(newCanvas);
  };

  const downloadPDF = () => {
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1 });
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'l' : 'p',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(dataURL, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save("edited-document.pdf");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-10">
      <div className="bg-white p-6 rounded shadow-xl">
        <div className="flex gap-4 mb-4">
          <label className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer">
            Upload PDF
            <input type="file" className="hidden" accept=".pdf" onChange={handleUpload} />
          </label>
          <button onClick={downloadPDF} className="bg-green-600 text-white px-4 py-2 rounded">
            Download
          </button>
        </div>
        <div className="border border-gray-300">
          <canvas ref={canvasRef} />
        </div>
      </div>
    </div>
  );
}

export default App;