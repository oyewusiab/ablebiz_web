import { jsPDF } from "jspdf";
import type { Checklist } from "../content/checklists";
import { site } from "../content/site";

function safeFilename(input: string) {
  return input
    .trim()
    .replace(/[^a-z0-9\-\s]/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s/g, "-")
    .toLowerCase();
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 6) {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((ln: string, idx: number) => {
    doc.text(ln, x, y + idx * lineHeight);
  });
  return y + lines.length * lineHeight;
}

export function downloadChecklistPdf(checklist: Checklist) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const marginX = 16;
  let y = 18;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("ABLEBIZ Business Services", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const headerRight = `${site.phoneDisplay} • ${site.email}`;
  const textW = doc.getTextWidth(headerRight);
  doc.text(headerRight, pageWidth - marginX - textW, y);

  y += 8;
  doc.setDrawColor(15, 77, 15);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageWidth - marginX, y);

  y += 10;

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  y = addWrappedText(doc, checklist.title, marginX, y, pageWidth - marginX * 2, 7);

  y += 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  y = addWrappedText(doc, checklist.description, marginX, y, pageWidth - marginX * 2, 6);

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Checklist", marginX, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const maxWidth = pageWidth - marginX * 2;

  checklist.bullets.forEach((b) => {
    const bullet = `• ${b}`;
    y = addWrappedText(doc, bullet, marginX, y, maxWidth, 6);
    y += 1;

    // New page if needed
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
  });

  if (checklist.notes?.length) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.text("Notes", marginX, y);
    y += 8;

    doc.setFont("helvetica", "normal");
    checklist.notes.forEach((n) => {
      y = addWrappedText(doc, `• ${n}`, marginX, y, maxWidth, 6);
      y += 1;
      if (y > 270) {
        doc.addPage();
        y = 18;
      }
    });
  }

  // Footer
  const footer = `Prepared by ABLEBIZ • ${site.location}`;
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(footer, marginX, 290);

  const filename = `ABLEBIZ-${safeFilename(checklist.title)}.pdf`;
  doc.save(filename);
}
