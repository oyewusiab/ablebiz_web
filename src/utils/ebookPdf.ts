import jsPDF from "jspdf";
import { site } from "../content/site";

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

export async function downloadAblebizEbookPdf() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 48;
  let y = 64;

  // 🎨 Colors
  const primaryGreen: [number, number, number] = [16, 122, 16];
  const lightGreen: [number, number, number] = [220, 245, 220];
  const darkText: [number, number, number] = [40, 40, 40];

  const logo = await loadImage("/images/ablebiz-logo.png");

  // =========================
  // HELPERS
  // =========================

  const addWatermark = () => {
    doc.setFontSize(40);
    doc.setTextColor(200);
    doc.text(
      "ABLEBIZ BUSINESS SERVICES",
      pageWidth / 2,
      pageHeight / 2,
      { angle: 45, align: "center" }
    );
    doc.setTextColor(0);
  };

  const addPage = () => {
    doc.addPage();
    y = 64;
    addWatermark();
    doc.addImage(logo, "PNG", margin, 20, 40, 40);

    // footer
    doc.setFontSize(10);
    doc.text("ABLEBIZ BUSINESS SERVICES", margin, pageHeight - 20);
  };

  const addText = (text: string, font = "normal", size = 12, spacing = 16) => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);

    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);

    for (let line of lines) {
      if (y > pageHeight - 60) addPage();
      doc.text(line, margin, y);
      y += spacing;
    }
  };

  const addSectionHeader = (title: string) => {
    if (y > pageHeight - 100) addPage();

    doc.setFillColor(...primaryGreen);
    doc.rect(margin, y - 18, pageWidth - margin * 2, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, margin + 10, y);

    doc.setTextColor(...darkText);
    y += 30;
  };

  const addHighlightBox = (text: string) => {
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2 - 20);
    const boxHeight = lines.length * 16 + 16;

    if (y + boxHeight > pageHeight - 60) addPage();

    doc.setFillColor(...lightGreen);
    doc.roundedRect(margin, y - 12, pageWidth - margin * 2, boxHeight, 6, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.text("Pro Tip:", margin + 10, y);

    doc.setFont("helvetica", "normal");

    let innerY = y + 14;
    for (let line of lines) {
      doc.text(line, margin + 10, innerY);
      innerY += 14;
    }

    y += boxHeight + 10;
  };

  const addDivider = () => {
    doc.setDrawColor(...primaryGreen);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
  };

  // =========================
  // COVER PAGE
  // =========================

  addWatermark();
  doc.addImage(logo, "PNG", margin, 20, 40, 40);

  y = 140;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("START SMART", margin, y);

  y += 30;
  addText("The Ultimate Guide to Business Registration & Compliance in Nigeria");
  y += 10;
  addText(
    "A Practical Handbook for Entrepreneurs Who Want to Start Right and Grow Fast",
    "italic"
  );

  y += 20;
  addText(`${site.location} | ${site.phoneDisplay} | ${site.email}`);

  // =========================
  // CHAPTER 1
  // =========================

  addPage();

  doc.setFontSize(18);
  doc.text("CHAPTER 1", margin, y);
  y += 22;

  addSectionHeader("Introduction");

  addText(
    "Starting a business in Nigeria is one of the most powerful steps you can take toward financial independence and long-term stability."
  );

  addText(
    "However, many entrepreneurs either delay starting or begin without proper structure, legal backing, or clear direction."
  );

  addText(
    "This guide was created to give you a practical, clear roadmap to start right and grow with confidence."
  );

  addHighlightBox(
    "Registration is not the final step—it is the foundation of a successful business."
  );

  // =========================
  // CHAPTER 2
  // =========================

  addPage();

  doc.text("CHAPTER 2", margin, y);
  y += 22;

  addSectionHeader("Why You Should Register Your Business");

  addText("1. Legal Protection – Your business becomes recognized by law.");
  addText("2. Credibility – Customers trust registered businesses more.");
  addText("3. Access to funding and partnerships.");
  addText("4. Ability to open a business bank account.");

  addHighlightBox(
    "If you are serious about your business, registration is not optional—it is essential."
  );

  // =========================
  // CHAPTER 3
  // =========================

  addPage();

  doc.text("CHAPTER 3", margin, y);
  y += 22;

  addSectionHeader("Business Name vs Company");

  addText(
    "A Business Name is simple and affordable, while a Limited Company provides more protection and credibility."
  );

  addDivider();

  addText("Business Name – best for small startups and individuals.");
  addText("Limited Company – best for growth, investors, and protection.");

  addHighlightBox(
    "If you plan to grow big, it is better to start with a structure that supports your vision."
  );

  // =========================
  // CHAPTER 4
  // =========================

  addPage();

  doc.text("CHAPTER 4", margin, y);
  y += 22;

  addSectionHeader("Preparing for Registration");

  addText("Choose a strong and unique business name.");
  addText("Ensure your personal details match your ID.");
  addText("Prepare a valid business address.");

  addHighlightBox(
    "Most registration delays are caused by avoidable mistakes—prepare properly."
  );

  // =========================
  // CHAPTER 5
  // =========================

  addPage();

  doc.text("CHAPTER 5", margin, y);
  y += 22;

  addSectionHeader("CAC Registration Process");

  addText(
    "Registering your business in Nigeria follows a structured process handled by the Corporate Affairs Commission (CAC)."
  );

  addDivider();

  addText("Step 1: Conduct a business name search.");
  addText("Step 2: Reserve your approved name.");
  addText("Step 3: Fill in your registration details.");
  addText("Step 4: Upload required documents.");
  addText("Step 5: Make payment.");
  addText("Step 6: Wait for approval and certificate issuance.");

  addText(
    "Each step must be completed carefully to avoid rejection or delays."
  );

  addHighlightBox(
    "Take your time to review every detail before submission. Small mistakes can delay your approval."
  );

  // =========================
  // CHAPTER 6
  // =========================

  addPage();

  doc.text("CHAPTER 6", margin, y);
  y += 22;

  addSectionHeader("Timelines, Delays & How to Avoid Them");

  addText(
    "Business registration timelines in Nigeria can vary depending on accuracy and system conditions."
  );

  addDivider();

  addText("Typical timeline:");
  addText("• Name approval: 1–3 working days");
  addText("• Full registration: 3–10 working days");

  addText("Common causes of delays include:");
  addText("• Incorrect personal details");
  addText("• Poor name selection");
  addText("• Incomplete document uploads");
  addText("• System or payment issues");

  addHighlightBox(
    "Most delays are preventable. Proper preparation is the fastest way to get approved."
  );

  // =========================
  // CHAPTER 7
  // =========================

  addPage();

  doc.text("CHAPTER 7", margin, y);
  y += 22;

  addSectionHeader("What To Do After Registration");

  addText(
    "Once your business is registered, the next steps determine how successful it will become."
  );

  addDivider();

  addText("Open a business bank account immediately.");
  addText("Create a simple brand identity (logo, colors, name consistency).");
  addText("Set up WhatsApp Business and social media pages.");
  addText("Start tracking your income and expenses.");

  addText(
    "Taking action immediately after registration helps you build momentum."
  );

  addHighlightBox(
    "A registered business without action will not grow. Start implementing immediately."
  );

  // =========================
  // CHAPTER 8
  // =========================

  addPage();

  doc.text("CHAPTER 8", margin, y);
  y += 22;

  addSectionHeader("Compliance & Add-ons Explained");

  addText(
    "Some businesses require additional compliance depending on their activities and structure."
  );

  addDivider();

  addText("SCUML – Required for certain regulated industries.");
  addText("NSITF – Applies when you have employees.");
  addText("Trademark – Protects your brand identity.");
  addText("TIN – Required for tax and financial operations.");

  addText(
    "Understanding what applies to your business helps you avoid unnecessary expenses."
  );

  addHighlightBox(
    "Do not rush to register everything. Focus on what your business actually needs at its current stage."
  );

  // =========================
  // CHAPTER 9
  // =========================

  addPage();

  doc.text("CHAPTER 9", margin, y);
  y += 22;

  addSectionHeader("Setting Up Your Business Properly");

  addText(
    "Proper structure is what separates a serious business from an informal hustle."
  );

  addDivider();

  addText("Separate your personal and business finances.");
  addText("Keep simple but consistent financial records.");
  addText("Clearly define what your business offers.");
  addText("Market your business consistently.");

  addText(
    "Even small businesses can operate professionally when structure is applied early."
  );

  addHighlightBox(
    "The earlier you build structure, the easier it is to grow your business."
  );
  // =========================
  // CHAPTER 10
  // =========================

  addPage();

  doc.text("CHAPTER 10", margin, y);
  y += 22;

  addSectionHeader("Common Mistakes to Avoid");

  addDivider();

  addText("Choosing the wrong business structure.");
  addText("Ignoring compliance requirements.");
  addText("Mixing personal and business finances.");
  addText("Not keeping proper records.");
  addText("Waiting for everything to be perfect before starting.");

  addText(
    "These mistakes may seem small, but they can significantly slow down your business growth."
  );

  addHighlightBox(
    "Progress is more important than perfection. Start now and improve along the way."
  );

  // =========================
  // CHAPTER 11
  // =========================

  addPage();

  doc.text("CHAPTER 11", margin, y);
  y += 22;

  addSectionHeader("Your 7-Day Business Startup Plan");

  addText(
    "This simple plan will help you move from idea to action within one week."
  );

  addDivider();

  addText("Day 1: Define your business idea clearly.");
  addText("Day 2: Choose and validate your business name.");
  addText("Day 3: Start your CAC registration.");
  addText("Day 4: Create your brand identity.");
  addText("Day 5: Open your business bank account.");
  addText("Day 6: Begin marketing your business.");
  addText("Day 7: Get your first customer.");

  addHighlightBox(
    "Execution is the difference between ideas and results. Follow this plan step by step."
  );

  // =========================
  // CHAPTER 12
  // =========================

  addPage();

  doc.text("CHAPTER 12", margin, y);
  y += 22;

  addSectionHeader("Bonus Resources");

  addDivider();

  addText("Sample Business Name Ideas:");
  addText("• PrimeEdge Services");
  addText("• Nexa Solutions");
  addText("• BrightPath Ventures");
  addText("• EliteCore Services");

  addText("");
  addText("Simple Income Tracker Format:");
  addText("Date | Description | Income | Expense | Balance");

  addText("");
  addText("Startup Budget Checklist:");
  addText("• Registration");
  addText("• Branding");
  addText("• Marketing");
  addText("• Miscellaneous");

  addHighlightBox(
    "These simple tools will help you stay organized and make better decisions from the start."
  );

  // =========================
  // CHAPTER 13
  // =========================

  addPage();

  doc.text("CHAPTER 13", margin, y);
  y += 22;

  addSectionHeader("Final Thoughts");

  addText(
    "Starting a business is one of the most important decisions you can make."
  );

  addText(
    "But starting it the right way is what determines long-term success."
  );

  addDivider();

  addText(
    "Success in business comes from structure, consistency, and taking action."
  );

  addHighlightBox(
    "Do not wait for perfect conditions. Start where you are and build as you grow."
  );

  // =========================
  // FINAL CTA PAGE
  // =========================

  addPage();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("READY TO START YOUR BUSINESS?", margin, y);

  y += 40;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);

  addText(
    "Let ABLEBIZ Business Services help you register your business the right way—fast, simple, and stress-free."
  );

  addDivider();

  addText(`WhatsApp/Call: ${site.phoneDisplay}`);
  addText(`Email: ${site.email}`);
  addText(`Location: ${site.location}`);

  addHighlightBox(
    "Send us a message today and let’s help you turn your idea into a registered business."
  );

  // =========================
  // SAVE FILE (FINAL)
  // =========================

  doc.save("ABLEBIZ-Start-Smart-Guide.pdf");
}