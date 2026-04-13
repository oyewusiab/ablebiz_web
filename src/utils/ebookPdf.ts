import jsPDF from "jspdf";
import { site } from "../content/site";

export function downloadAblebizEbookPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const margin = 48;
  let y = 64;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ABLEBIZ Starter Guide", margin, y);

  y += 18;
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Business Registration in Nigeria (Quick Checklist)", margin, y);

  y += 22;
  doc.setDrawColor(16, 122, 16);
  doc.setLineWidth(2);
  doc.line(margin, y, pageWidth - margin, y);

  y += 26;
  doc.setFont("helvetica", "bold");
  doc.text("Inside this guide:", margin, y);

  y += 18;
  doc.setFont("helvetica", "normal");

  const bullets = [
    "Business Name vs Company: how to choose the right structure",
    "Common CAC requirements you should prepare ahead",
    "Typical timelines and how to avoid delays",
    "Compliance add-ons (SCUML, NSITF, trademark) — when they apply",
    "A simple action plan to start today",
  ];

  for (const b of bullets) {
    const lines = doc.splitTextToSize(`• ${b}`, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 14 + 6;
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Need help?", margin, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      `ABLEBIZ Business Services — ${site.location}. WhatsApp/Call: ${site.phoneDisplay} | Email: ${site.email}`,
      pageWidth - margin * 2
    ),
    margin,
    y
  );

  y += 32;
  doc.setFont("helvetica", "bold");
  doc.text("CTA:", margin, y);

  y += 18;
  doc.setFont("helvetica", "normal");
  doc.text(
    doc.splitTextToSize(
      "Chat with us on WhatsApp to start your CAC registration with a fast and transparent process.",
      pageWidth - margin * 2
    ),
    margin,
    y
  );

  doc.save("ABLEBIZ-Starter-Guide.pdf");
}
