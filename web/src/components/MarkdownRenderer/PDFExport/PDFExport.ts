import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface IPDFExportOptions {
  filename?: string;
  title?: string;
  quality?: number;
  scale?: number;
}

export const exportToPDF = async (
  element: HTMLElement,
  options: IPDFExportOptions = {}
): Promise<void> => {
  const {
    filename = 'document.pdf',
    title = 'Document',
    quality = 1,
    scale = 2
  } = options;

  try {
    // Create canvas from the element
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff', // White background for PDF
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png', quality);
    
    // Calculate dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(190 / imgWidth, 277 / imgHeight); // A4 size with margins
    const imgScaledWidth = imgWidth * ratio;
    const imgScaledHeight = imgHeight * ratio;
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Add title if provided
    if (title) {
      pdf.setFontSize(16);
      pdf.text(title, 10, 15);
    }
    
    // Calculate number of pages needed
    const pageHeight = 297; // A4 height in mm
    const margin = title ? 25 : 10; // Top margin
    const availableHeight = pageHeight - margin - 10; // Bottom margin
    
    let yPosition = margin;
    let remainingHeight = imgScaledHeight;
    
    while (remainingHeight > 0) {
      const currentPageHeight = Math.min(remainingHeight, availableHeight);
      
      // Add image to current page
      pdf.addImage(
        imgData,
        'PNG',
        10, // x position
        yPosition,
        imgScaledWidth,
        currentPageHeight,
        undefined,
        'FAST'
      );
      
      remainingHeight -= currentPageHeight;
      
      if (remainingHeight > 0) {
        pdf.addPage();
        yPosition = 10; // Reset top margin for new pages
      }
    }
    
    // Save the PDF
    pdf.save(filename);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
};