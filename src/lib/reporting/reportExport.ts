import { jsPDF } from "jspdf";
import { strToU8, zipSync } from "fflate";
import {
  DEFAULT_BUSINESS_PROFILE,
  formatBusinessAddress,
  type BusinessProfile,
} from "../../types/businessProfile";
import { formatMetricValue } from "./reportEngine";
import type { GeneratedReportPayload, ReportTableSpec } from "./types";

function escapeXml(input: unknown): string {
  const s = String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizePdfText(text: unknown): string {
  // jsPDF standard Helvetica font is WinAnsi; replace ₦ with NGN for crisp vector rendering without glyph boxes
  return String(text ?? "")
    .replace(/₦/g, "NGN ")
    .replace(/[•]/g, "-")
    .replace(/[–—]/g, "-");
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builds a clean, UTF-8 CSV string with metadata header, KPI summary, and all report tables.
 */
export function buildReportCsvString(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): string {
  const lines: string[] = [];

  lines.push(
    [
      escapeCsvCell(profile.legal_name || profile.trading_name || "ABLEBIZ Business Services"),
      escapeCsvCell(payload.title),
      escapeCsvCell(payload.documentNumber),
    ].join(",")
  );
  lines.push(
    [
      "Category",
      escapeCsvCell(payload.categoryLabel),
      "Reporting Period",
      escapeCsvCell(payload.periodWindow.label),
      "Comparison Baseline",
      escapeCsvCell(payload.periodWindow.comparisonLabel),
    ].join(",")
  );
  lines.push(
    [
      "Generated At",
      escapeCsvCell(payload.generatedAtFormatted),
      "Prepared By",
      escapeCsvCell(
        `${payload.generatedBy.name} (${payload.generatedBy.roleTitle})`
      ),
      "Data Scope",
      escapeCsvCell(payload.scopeDescription),
    ].join(",")
  );
  lines.push("");

  // KPI Section
  lines.push("KEY PERFORMANCE INDICATORS (KPI SUMMARY)");
  lines.push(
    [
      "Metric",
      "Current Period",
      "Comparison Baseline",
      "Absolute Difference",
      "Percentage Change",
      "Executive Interpretation",
    ].join(",")
  );
  for (const kpi of payload.kpis) {
    lines.push(
      [
        escapeCsvCell(kpi.label),
        escapeCsvCell(kpi.comparison.formattedCurrent),
        escapeCsvCell(kpi.comparison.formattedPrevious),
        escapeCsvCell(kpi.comparison.formattedDifference),
        escapeCsvCell(kpi.comparison.formattedPercentage),
        escapeCsvCell(kpi.interpretation),
      ].join(",")
    );
  }
  lines.push("");

  // Organisational Health Section (if present)
  if (payload.healthAssessment) {
    lines.push("ORGANISATIONAL HEALTH ASSESSMENT");
    lines.push(
      [
        "Overall Health Score",
        escapeCsvCell(
          payload.healthAssessment.overallScore !== null
            ? `${payload.healthAssessment.overallScore}/100`
            : "Insufficient Data"
        ),
        "Assessment Band",
        escapeCsvCell(payload.healthAssessment.overallBand),
        "Data Completeness",
        escapeCsvCell(`${payload.healthAssessment.dataCompletenessPercent}%`),
      ].join(",")
    );
    lines.push(
      [
        "Dimension",
        "Weight (%)",
        "Score (0-100)",
        "Status",
        "Measured Value",
        "Methodology / Note",
      ].join(",")
    );
    for (const dim of payload.healthAssessment.dimensions) {
      lines.push(
        [
          escapeCsvCell(dim.name),
          escapeCsvCell(`${dim.weightPercent}%`),
          escapeCsvCell(dim.score !== null ? String(dim.score) : "N/A"),
          escapeCsvCell(dim.statusLabel),
          escapeCsvCell(dim.measuredValueLabel),
          escapeCsvCell(dim.limitationOrNote || dim.calculationExplanation),
        ].join(",")
      );
    }
    lines.push("");
  }

  // Detailed Tables
  for (const table of payload.tables) {
    lines.push(escapeCsvCell(table.title.toUpperCase()));
    lines.push(table.columns.map((c) => escapeCsvCell(c.header)).join(","));
    for (const row of table.rows) {
      lines.push(
        table.columns
          .map((col) => {
            const val = row[col.key];
            if (col.format === "currency_ngn" && typeof val === "number") {
              return escapeCsvCell(formatMetricValue(val, "NGN"));
            }
            if (col.format === "percentage" && typeof val === "number") {
              return escapeCsvCell(`${val.toFixed(1)}%`);
            }
            return escapeCsvCell(val ?? "");
          })
          .join(",")
      );
    }
    if (table.totalsRow) {
      lines.push(
        table.columns
          .map((col) => {
            const val = table.totalsRow?.[col.key];
            if (col.format === "currency_ngn" && typeof val === "number") {
              return escapeCsvCell(formatMetricValue(val, "NGN"));
            }
            return escapeCsvCell(val ?? "");
          })
          .join(",")
      );
    }
    lines.push("");
  }

  // Insights & Recommended Actions
  lines.push("EXECUTIVE INSIGHTS & RECOMMENDED MANAGEMENT ACTIONS");
  lines.push(["Section", "Statement"].join(","));
  lines.push(
    [
      "Executive Narrative",
      escapeCsvCell(payload.insights.executiveNarrative),
    ].join(",")
  );
  for (const item of payload.insights.keyAchievements) {
    lines.push(["Key Achievement", escapeCsvCell(item)].join(","));
  }
  for (const item of payload.insights.financialRisks) {
    lines.push(["Financial / Operational Risk", escapeCsvCell(item)].join(","));
  }
  for (const item of payload.insights.recommendedActions) {
    lines.push(["Recommended Action", escapeCsvCell(item)].join(","));
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function exportReportToCsv(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): void {
  const csvContent = buildReportCsvString(payload, profile);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerBrowserDownload(
    blob,
    `${payload.reportId}_${payload.generatedAtIso.slice(0, 10)}.csv`
  );
}

function colIndexToLetter(index0: number): string {
  let n = index0 + 1;
  let str = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

interface ExcelCellSpec {
  value: string | number;
  type?: "s" | "n";
  style?: number; // 0=normal, 1=title, 2=sectionHeader, 3=tableHeader, 4=currency, 5=boldText, 6=boldCurrency
}

function buildWorksheetXml(
  rows: ExcelCellSpec[][],
  colWidths: number[]
): string {
  const colsXml = colWidths
    .map(
      (w, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
    )
    .join("");

  const sheetDataRows = rows
    .map((cells, rIdx) => {
      const rowNum = rIdx + 1;
      const cellsXml = cells
        .map((cell, cIdx) => {
          const ref = `${colIndexToLetter(cIdx)}${rowNum}`;
          const styleAttr = cell.style ? ` s="${cell.style}"` : "";
          if (cell.type === "n" && typeof cell.value === "number" && Number.isFinite(cell.value)) {
            return `<c r="${ref}"${styleAttr}><v>${cell.value}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(
            cell.value
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowNum}">${cellsXml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>${colsXml}</cols>
  <sheetData>${sheetDataRows}</sheetData>
</worksheet>`;
}

/**
 * Builds a genuine OpenXML (.xlsx) multi-worksheet workbook as a Uint8Array.
 */
export function buildReportExcelBytes(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): Uint8Array {
  const sheets: { name: string; xml: string }[] = [];

  // Sheet 1: Executive Summary & KPIs
  const summaryRows: ExcelCellSpec[][] = [
    [
      {
        value: `${profile.legal_name || profile.trading_name || "ABLEBIZ Business Services"} — ${payload.title}`,
        style: 1,
      },
    ],
    [
      { value: "Document Reference:", style: 5 },
      { value: payload.documentNumber },
      { value: "Category:", style: 5 },
      { value: payload.categoryLabel },
    ],
    [
      { value: "Reporting Period:", style: 5 },
      { value: payload.periodWindow.label },
      { value: "Comparison Baseline:", style: 5 },
      { value: payload.periodWindow.comparisonLabel },
    ],
    [
      { value: "Generated Date:", style: 5 },
      { value: payload.generatedAtFormatted },
      { value: "Prepared By:", style: 5 },
      {
        value: `${payload.generatedBy.name} (${payload.generatedBy.roleTitle})`,
      },
    ],
    [
      { value: "Data Scope:", style: 5 },
      { value: payload.scopeDescription },
      { value: "Source Records:", style: 5 },
      { value: payload.totalSourceRecords, type: "n" },
    ],
    [],
    [{ value: "EXECUTIVE NARRATIVE SUMMARY", style: 2 }],
    [{ value: payload.insights.executiveNarrative }],
    [],
    [{ value: "KEY PERFORMANCE INDICATORS (KPIs)", style: 2 }],
    [
      { value: "KPI Indicator", style: 3 },
      { value: "Current Value", style: 3 },
      { value: "Formatted Current", style: 3 },
      { value: "Prior Baseline", style: 3 },
      { value: "Variance", style: 3 },
      { value: "Growth / Change %", style: 3 },
      { value: "Executive Interpretation", style: 3 },
    ],
  ];

  for (const kpi of payload.kpis) {
    summaryRows.push([
      { value: kpi.label, style: 5 },
      {
        value: kpi.comparison.currentValue,
        type: "n",
        style: kpi.unit === "NGN" ? 4 : 0,
      },
      { value: kpi.comparison.formattedCurrent },
      { value: kpi.comparison.formattedPrevious },
      { value: kpi.comparison.formattedDifference },
      { value: kpi.comparison.formattedPercentage },
      { value: kpi.interpretation },
    ]);
  }

  if (payload.healthAssessment) {
    summaryRows.push([]);
    summaryRows.push([
      {
        value: `ORGANISATIONAL HEALTH ASSESSMENT (${
          payload.healthAssessment.overallScore !== null
            ? `${payload.healthAssessment.overallScore}/100 — ${payload.healthAssessment.overallBand}`
            : payload.healthAssessment.overallBand
        })`,
        style: 2,
      },
    ]);
    summaryRows.push([
      { value: "Dimension", style: 3 },
      { value: "Weight (%)", style: 3 },
      { value: "Score (0-100)", style: 3 },
      { value: "Band Status", style: 3 },
      { value: "Measured Operational Value", style: 3 },
      { value: "Calculation / Note", style: 3 },
    ]);
    for (const dim of payload.healthAssessment.dimensions) {
      summaryRows.push([
        { value: dim.name, style: 5 },
        { value: dim.weightPercent, type: "n" },
        dim.score !== null
          ? { value: dim.score, type: "n" }
          : { value: "N/A" },
        { value: dim.statusLabel },
        { value: dim.measuredValueLabel },
        { value: dim.limitationOrNote || dim.calculationExplanation },
      ]);
    }
  }

  sheets.push({
    name: "Executive Summary",
    xml: buildWorksheetXml(summaryRows, [32, 18, 22, 22, 18, 20, 48]),
  });

  // Additional Sheets: One per Table in payload
  payload.tables.forEach((table: ReportTableSpec, idx: number) => {
    const tableRows: ExcelCellSpec[][] = [
      [{ value: table.title, style: 1 }],
      [{ value: table.subtitle }],
      [],
      table.columns.map((c) => ({ value: c.header, style: 3 })),
    ];

    for (const row of table.rows) {
      tableRows.push(
        table.columns.map((col) => {
          const val = row[col.key];
          if (typeof val === "number" && Number.isFinite(val)) {
            return {
              value: val,
              type: "n",
              style: col.format === "currency_ngn" ? 4 : 0,
            };
          }
          return { value: String(val ?? "") };
        })
      );
    }

    if (table.totalsRow) {
      tableRows.push(
        table.columns.map((col) => {
          const val = table.totalsRow?.[col.key];
          if (typeof val === "number" && Number.isFinite(val)) {
            return {
              value: val,
              type: "n",
              style: col.format === "currency_ngn" ? 6 : 5,
            };
          }
          return { value: String(val ?? ""), style: 5 };
        })
      );
    }

    const safeName =
      table.title
        .replace(/[\\/?*[\]:]/g, "")
        .trim()
        .slice(0, 26) || `Data Table ${idx + 1}`;

    sheets.push({
      name: `${idx + 1}. ${safeName}`.slice(0, 31),
      xml: buildWorksheetXml(
        tableRows,
        table.columns.map(() => 24)
      ),
    });
  });

  // Final Sheet: Insights, Actions & Metric Definitions
  const insightsRows: ExcelCellSpec[][] = [
    [{ value: "BUSINESS INTELLIGENCE INSIGHTS & METRIC DEFINITIONS", style: 1 }],
    [],
    [{ value: "KEY ACHIEVEMENTS", style: 2 }],
    ...payload.insights.keyAchievements.map((i) => [{ value: `• ${i}` }]),
    [],
    [{ value: "FINANCIAL & OPERATIONAL RISKS", style: 2 }],
    ...(payload.insights.financialRisks.length > 0
      ? payload.insights.financialRisks.map((i) => [{ value: `• ${i}` }])
      : [[{ value: "No critical financial risks flagged in window." }]]),
    [],
    [{ value: "OPERATIONAL BOTTLENECKS & AREAS REQUIRING ATTENTION", style: 2 }],
    ...[
      ...payload.insights.operationalBottlenecks,
      ...payload.insights.areasRequiringAttention,
    ].map((i) => [{ value: `• ${i}` }]),
    [],
    [{ value: "RECOMMENDED MANAGEMENT ACTIONS", style: 2 }],
    ...payload.insights.recommendedActions.map((i) => [
      { value: `• ${i}`, style: 5 },
    ]),
    [],
    [{ value: "METRIC DEFINITIONS & HOW FIGURES ARE CALCULATED", style: 2 }],
    [
      { value: "Metric Name", style: 3 },
      { value: "What This Measures", style: 3 },
      { value: "How this is calculated", style: 3 },
      { value: "Data source", style: 3 },
      { value: "Important Notes", style: 3 },
    ],
    ...payload.metricDefinitionsUsed.map((m) => [
      { value: m.name, style: 5 },
      { value: m.description },
      { value: m.calculationFormula },
      { value: m.authoritativeSource },
      { value: m.knownLimitations },
    ]),
  ];

  sheets.push({
    name: "Insights & Definitions",
    xml: buildWorksheetXml(insightsRows, [32, 42, 30, 24, 48]),
  });

  // Assemble OpenXML ZIP Package
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("\n  ")}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map(
        (s, i) =>
          `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${
            i + 1
          }"/>`
      )
      .join("\n    ")}
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join("\n  ")}
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="&quot;₦&quot;#,##0"/>
  </numFmts>
  <fonts count="5">
    <font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FF0A192F"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0A192F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="164" fontId="4" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml),
    "_rels/.rels": strToU8(rootRelsXml),
    "xl/workbook.xml": strToU8(workbookXml),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml),
    "xl/styles.xml": strToU8(stylesXml),
  };

  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(s.xml);
  });

  return zipSync(files, { level: 6 });
}

export function exportReportToExcel(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): void {
  const bytes = buildReportExcelBytes(payload, profile);
  const blob = new Blob([bytes as unknown as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerBrowserDownload(
    blob,
    `${payload.reportId}_${payload.generatedAtIso.slice(0, 10)}.xlsx`
  );
}

/**
 * Builds a presentation-ready multi-page Executive PDF document using jsPDF.
 */
export function buildReportPdfDocument(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 20) {
      doc.addPage();
      y = 18;
      // Running top header on continuation pages
      doc.setFillColor(10, 25, 47);
      doc.rect(margin, y - 6, contentWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(
        sanitizePdfText(
          `${profile.legal_name || profile.trading_name || "ABLEBIZ BUSINESS SERVICES"} | ${payload.title.toUpperCase()}`
        ),
        margin + 3,
        y - 1.5
      );
      doc.text(
        sanitizePdfText(payload.documentNumber),
        pageWidth - margin - 3,
        y - 1.5,
        { align: "right" }
      );
      y += 6;
    }
  };

  // Page 1 Executive Header Banner
  doc.setFillColor(10, 25, 47);
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, "F");
  doc.setFillColor(16, 185, 129);
  doc.rect(margin, y + 32.5, contentWidth, 1.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(
    sanitizePdfText(profile.legal_name || profile.trading_name || "ABLEBIZ BUSINESS SERVICES"),
    margin + 5,
    y + 9
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(167, 243, 208);
  doc.text(
    sanitizePdfText(
      profile.tagline || "CAC Accredited Corporate & Business Registration Suite"
    ),
    margin + 5,
    y + 14.5
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(sanitizePdfText(payload.title), margin + 5, y + 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    sanitizePdfText(
      `${payload.categoryLabel} | Period: ${payload.periodWindow.label} | Scope: ${payload.scopeDescription}`
    ),
    margin + 5,
    y + 29
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    sanitizePdfText(`REF: ${payload.documentNumber}`),
    pageWidth - margin - 5,
    y + 9,
    { align: "right" }
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    sanitizePdfText(`Generated: ${payload.generatedAtFormatted}`),
    pageWidth - margin - 5,
    y + 14.5,
    { align: "right" }
  );
  doc.text(
    sanitizePdfText(
      `Prepared By: ${payload.generatedBy.name} (${payload.generatedBy.roleTitle})`
    ),
    pageWidth - margin - 5,
    y + 20,
    { align: "right" }
  );

  y += 40;

  // Executive Narrative Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  const narrativeLines = doc.splitTextToSize(
    sanitizePdfText(payload.insights.executiveNarrative),
    contentWidth - 8
  );
  const narrativeBoxHeight = narrativeLines.length * 4.2 + 10;
  ensureSpace(narrativeBoxHeight + 4);
  doc.roundedRect(margin, y, contentWidth, narrativeBoxHeight, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("EXECUTIVE SUMMARY", margin + 4, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(narrativeLines, margin + 4, y + 10.5);
  y += narrativeBoxHeight + 6;

  // KPI Grid (2 columns per row)
  if (payload.kpis.length > 0) {
    ensureSpace(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(10, 25, 47);
    doc.text("KEY PERFORMANCE INDICATORS", margin, y);
    y += 4;

    const cardWidth = (contentWidth - 4) / 2;
    const cardHeight = 20;

    for (let i = 0; i < payload.kpis.length; i += 2) {
      ensureSpace(cardHeight + 4);
      const rowKpis = payload.kpis.slice(i, i + 2);
      rowKpis.forEach((kpi, idx) => {
        const x = margin + idx * (cardWidth + 4);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(sanitizePdfText(kpi.label.toUpperCase()), x + 3, y + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(
          sanitizePdfText(kpi.comparison.formattedCurrent),
          x + 3,
          y + 11.5
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(16, 185, 129);
        doc.text(
          sanitizePdfText(
            `vs Prior: ${kpi.comparison.formattedPercentage}`
          ),
          x + cardWidth - 3,
          y + 11.5,
          { align: "right" }
        );

        doc.setTextColor(71, 85, 105);
        const interp = doc.splitTextToSize(
          sanitizePdfText(kpi.interpretation),
          cardWidth - 6
        );
        doc.text(interp[0] || "", x + 3, y + 17);
      });
      y += cardHeight + 3;
    }
    y += 3;
  }

  // Organisational Health Assessment Section (if present)
  if (payload.healthAssessment) {
    ensureSpace(32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(10, 25, 47);
    const scoreText =
      payload.healthAssessment.overallScore !== null
        ? `${payload.healthAssessment.overallScore}/100 (${payload.healthAssessment.overallBand})`
        : payload.healthAssessment.overallBand;
    doc.text(
      sanitizePdfText(`ORGANISATIONAL HEALTH ASSESSMENT - ${scoreText}`),
      margin,
      y
    );
    y += 4.5;

    for (const dim of payload.healthAssessment.dimensions) {
      ensureSpace(7);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text(
        sanitizePdfText(`${dim.name} (${dim.weightPercent}%)`),
        margin + 2,
        y + 3.5
      );

      // Progress bar
      const barX = margin + 68;
      const barW = 48;
      doc.setFillColor(226, 232, 240);
      doc.rect(barX, y + 0.8, barW, 3.2, "F");
      if (dim.score !== null) {
        const fillW = Math.max(1, (dim.score / 100) * barW);
        doc.setFillColor(
          dim.score >= 80 ? 5 : dim.score >= 65 ? 37 : 217,
          dim.score >= 80 ? 150 : dim.score >= 65 ? 99 : 119,
          dim.score >= 80 ? 105 : dim.score >= 65 ? 235 : 6
        );
        doc.rect(barX, y + 0.8, fillW, 3.2, "F");
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(
        sanitizePdfText(
          `${dim.score !== null ? `${dim.score}/100` : dim.statusLabel} - ${dim.measuredValueLabel}`
        ),
        barX + barW + 4,
        y + 3.5
      );
      y += 5.5;
    }
    y += 4;
  }

  // Charts Section
  for (const chart of payload.charts) {
    if (chart.points.length === 0) continue;
    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(10, 25, 47);
    doc.text(sanitizePdfText(chart.title), margin, y);
    y += 4;

    const maxVal = Math.max(...chart.points.map((p) => p.value), 1);
    for (const pt of chart.points.slice(0, 8)) {
      ensureSpace(6.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(sanitizePdfText(pt.label.slice(0, 32)), margin + 2, y + 3.5);

      const barX = margin + 62;
      const maxBarW = 75;
      const barW = Math.max(1.5, (Math.max(0, pt.value) / maxVal) * maxBarW);
      doc.setFillColor(30, 58, 138);
      doc.rect(barX, y + 0.8, barW, 3.2, "F");

      doc.setFont("helvetica", "bold");
      doc.text(
        sanitizePdfText(pt.formattedValue || String(pt.value)),
        barX + barW + 3,
        y + 3.5
      );
      y += 5.5;
    }
    y += 4;
  }

  // Tables Section with Repeating Headers
  for (const table of payload.tables) {
    ensureSpace(22);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(10, 25, 47);
    doc.text(sanitizePdfText(table.title), margin, y);
    y += 4.5;

    const colCount = Math.max(1, table.columns.length);
    const colWidth = contentWidth / colCount;

    const drawTableHeader = () => {
      doc.setFillColor(15, 23, 42);
      doc.rect(margin, y, contentWidth, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      table.columns.forEach((col, cIdx) => {
        const cx = margin + cIdx * colWidth + 1.5;
        doc.text(sanitizePdfText(col.header.slice(0, 22)), cx, y + 4.4);
      });
      y += 6.5;
    };

    drawTableHeader();

    const maxPdfRows = Math.min(table.rows.length, 60);
    for (let rIdx = 0; rIdx < maxPdfRows; rIdx++) {
      if (y + 6.5 > pageHeight - 20) {
        ensureSpace(16);
        drawTableHeader();
      }
      const row = table.rows[rIdx];
      if (rIdx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 5.8, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 41, 59);

      table.columns.forEach((col, cIdx) => {
        const rawVal = row[col.key];
        let formatted = String(rawVal ?? "");
        if (col.format === "currency_ngn" && typeof rawVal === "number") {
          formatted = formatMetricValue(rawVal, "NGN");
        } else if (col.format === "percentage" && typeof rawVal === "number") {
          formatted = `${rawVal.toFixed(1)}%`;
        }
        const cx = margin + cIdx * colWidth + 1.5;
        doc.text(sanitizePdfText(formatted.slice(0, 25)), cx, y + 4);
      });
      y += 5.8;
    }

    if (table.totalsRow) {
      ensureSpace(7);
      doc.setFillColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, 6.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.2);
      doc.setTextColor(15, 23, 42);
      table.columns.forEach((col, cIdx) => {
        const rawVal = table.totalsRow?.[col.key];
        let formatted = String(rawVal ?? "");
        if (col.format === "currency_ngn" && typeof rawVal === "number") {
          formatted = formatMetricValue(rawVal, "NGN");
        }
        const cx = margin + cIdx * colWidth + 1.5;
        doc.text(sanitizePdfText(formatted.slice(0, 25)), cx, y + 4.2);
      });
      y += 6.2;
    }

    y += 5;
  }

  // Executive Insights & Recommended Actions
  ensureSpace(26);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(10, 25, 47);
  doc.text("KEY FINDINGS, RISKS & RECOMMENDED MANAGEMENT ACTIONS", margin, y);
  y += 5;

  const writeBulletBlock = (heading: string, items: string[]) => {
    if (items.length === 0) return;
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(30, 58, 138);
    doc.text(sanitizePdfText(heading), margin + 2, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    for (const item of items) {
      const wrapped = doc.splitTextToSize(
        sanitizePdfText(`- ${item}`),
        contentWidth - 6
      );
      ensureSpace(wrapped.length * 4 + 2);
      doc.text(wrapped, margin + 4, y);
      y += wrapped.length * 3.8 + 1.2;
    }
    y += 2;
  };

  writeBulletBlock("Key Achievements & Highlights", payload.insights.keyAchievements);
  writeBulletBlock("Financial & Operational Risk Exposure", [
    ...payload.insights.financialRisks,
    ...payload.insights.operationalBottlenecks,
  ]);
  writeBulletBlock(
    "Recommended Management Actions",
    payload.insights.recommendedActions
  );
  if (payload.dataLimitations.length > 0) {
    writeBulletBlock(
      "Data Scope & Known Methodological Notes",
      payload.dataLimitations
    );
  }

  // Stamp Page Numbers & Official Footer on Every Page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageHeight - 13, pageWidth - margin, pageHeight - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      sanitizePdfText(
        `${profile.legal_name || profile.trading_name || "ABLEBIZ Business Services"} | ${formatBusinessAddress(profile)} | Confidential Management Report`
      ),
      margin,
      pageHeight - 8.5
    );
    doc.setFont("helvetica", "bold");
    doc.text(
      `Page ${p} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8.5,
      { align: "right" }
    );
  }

  return doc;
}

export function exportReportToPdf(
  payload: GeneratedReportPayload,
  profile: BusinessProfile = DEFAULT_BUSINESS_PROFILE
): void {
  const doc = buildReportPdfDocument(payload, profile);
  doc.save(`${payload.reportId}_${payload.generatedAtIso.slice(0, 10)}.pdf`);
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Records an immutable audit trail entry whenever a report is exported or printed.
 */
export async function recordReportExportAudit(
  supabaseClient: any,
  payload: GeneratedReportPayload,
  format: "pdf" | "xlsx" | "csv" | "print"
): Promise<void> {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from("audit_logs").insert({
      action: `report_export_${format}`,
      entity_type: "reports",
      entity_id: payload.reportId,
      actor_id: payload.generatedBy.staffId || null,
      details: {
        report_id: payload.reportId,
        report_title: payload.title,
        category: payload.category,
        format,
        document_number: payload.documentNumber,
        scope_applied: payload.scopeApplied,
        period_label: payload.periodWindow.label,
        record_count: payload.totalSourceRecords,
      },
    });
  } catch {
    // Non-blocking if audit_logs insert is restricted for non-admin roles
  }
}
