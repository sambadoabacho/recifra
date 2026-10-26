import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use a consistent version for all external resources
const VERSION = '5.6.205'; 
const CMAP_URL = `https://unpkg.com/pdfjs-dist@${VERSION}/cmaps/`;
const STANDARD_FONTS_URL = `https://unpkg.com/pdfjs-dist@${VERSION}/standard_fonts/`;

// Set worker path
GlobalWorkerOptions.workerSrc = pdfjsWorker;

export type PDFQuality = 'low' | 'medium' | 'high';

const QUALITY_SCALES = {
  low: 1.0,
  medium: 1.5,
  high: 2.5
};

export async function convertPDFToImages(file: File | ArrayBuffer, quality: PDFQuality = 'medium'): Promise<string[]> {
  try {
    const data = file instanceof File ? await file.arrayBuffer() : file;
    
    // Validate data
    if (!data || data.byteLength === 0) {
      throw new Error('O arquivo PDF está vazio ou corrompido.');
    }

    const loadingTask = getDocument({ 
      data,
      cMapUrl: CMAP_URL,
      cMapPacked: true,
      standardFontDataUrl: STANDARD_FONTS_URL,
      useSystemFonts: true,
      isEvalSupported: false,
      // Attempt to load wasm from unpkg if needed by the worker
      // Although wasm usually is inferred from worker directory
    });
    
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    const imageUrls: string[] = [];

    const scale = QUALITY_SCALES[quality] || 1.5;

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Não foi possível criar o contexto do canvas.');

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport,
        intent: 'display'
      } as any).promise;

      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
      if (!blob) throw new Error(`Falha ao converter página ${i} em imagem.`);
      
      // Upload to Firebase Storage
      const fileName = `songs/pdfs/${Date.now()}_page_${i}.jpg`;
      const storageRef = ref(storage, fileName);
      const metadata = {
        contentType: 'image/jpeg',
      };
      
      await uploadBytes(storageRef, blob, metadata);
      const downloadUrl = await getDownloadURL(storageRef);
      
      imageUrls.push(downloadUrl);
    }

    return imageUrls;
  } catch (error: any) {
    console.error('Erro na conversão do PDF:', error);
    throw new Error(`Erro no processamento do PDF: ${error.message}`);
  }
}
