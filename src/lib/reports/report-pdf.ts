import branding from "$data/branding.json";
import { formatAccounting } from "$utils/formatters";
import type { ResidentRecord } from "$lib/types";
import type {
  TDocumentDefinitions,
  Content,
  Alignment,
  Margins,
  TableCell,
  Size
} from "pdfmake/interfaces";

async function imgToDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((r) => {
      const reader = new FileReader();
      reader.onloadend = () => r(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to fetch image for PDF:", e);
    return "";
  }
}

export interface PDFReportOptions {
  residents: (ResidentRecord & { position?: string })[];
  categoryLabel: string;
  semester: string;
  brandingKey: string;
  issuedBy: string;
  issuedByEmail: string;
  assessedBy: string;
  assessedByEmail: string;
  certifiedBy: string;
  certifiedByEmail: string;
  periodCovered: string;
  isPublic: boolean;
  isOfficerReport?: boolean;
}

export async function exportReportPDF(options: PDFReportOptions) {
  const {
    residents,
    categoryLabel,
    semester,
    brandingKey,
    issuedBy,
    issuedByEmail,
    assessedBy,
    assessedByEmail,
    certifiedBy,
    certifiedByEmail,
    periodCovered,
    isPublic,
    isOfficerReport
  } = options;

  const [pdfMakeMod, pdfFontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);

  const pdfMake = pdfMakeMod.default;
  const pdfFonts = pdfFontsMod.default;

  const vfs = (pdfFonts as any).pdfMake
    ? (pdfFonts as any).pdfMake.vfs
    : (pdfFonts as any).vfs || pdfFonts;
  (pdfMake as any).vfs = vfs;

  const fontBase = "https://raw.githubusercontent.com/Omnibus-Type/Archivo/master/fonts/ttf";
  (pdfMake as any).addFonts({
    Archivo: {
      normal: `${fontBase}/Archivo-Regular.ttf`,
      bold: `${fontBase}/Archivo-SemiBold.ttf`,
      italics: `${fontBase}/Archivo-Italic.ttf`,
      bolditalics: `${fontBase}/Archivo-SemiBoldItalic.ttf`
    }
  });

  const profile = branding[brandingKey as keyof typeof branding] || branding.default;
  const letterheadData = await imgToDataUrl(profile.letterheadUrl);

  const headers: TableCell[] = isOfficerReport
    ? [
        { text: "Position", style: "tableHeader" },
        { text: "Name", style: "tableHeader" },
        { text: "Room", style: "tableHeader" }
      ]
    : [
        { text: "Resident", style: "tableHeader" },
        { text: "Room", style: "tableHeader" }
      ];

  if (!isPublic && !isOfficerReport) {
    headers.push({ text: "Bed", style: "tableHeader" });
    headers.push({ text: "Base", style: "tableHeader", alignment: "right" });
    headers.push({ text: "Paid", style: "tableHeader", alignment: "right" });
    headers.push({ text: "Waived", style: "tableHeader", alignment: "right" });
    headers.push({ text: "Balance", style: "tableHeader", alignment: "right" });
  }

  const widths: Size[] = isOfficerReport ? [100, "*", 60] : ["*"];
  if (!isPublic && !isOfficerReport) {
    widths.push(40, 40, 60, 60, 60, 60);
  } else if (!isOfficerReport) {
    widths.push(100);
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [72, 40, 72, 120],
    background: function (currentPage: number): Content | null {
      if (currentPage === 1 && letterheadData) {
        return {
          image: letterheadData,
          width: 595.28
        };
      }
      return null;
    },
    content: [
      {
        text: isOfficerReport ? "OFFICER LIST" : "RESIDENT LIST",
        style: "header",
        alignment: "center" as Alignment,
        margin: [0, 60, 0, 5] as Margins
      },
      {
        text: `${categoryLabel.toUpperCase()} - ${semester}`,
        alignment: "center" as Alignment,
        margin: [0, 0, 0, 20] as Margins,
        fontSize: 10,
        bold: true,
        color: "#000000"
      },
      {
        table: {
          headerRows: 1,
          widths: widths,
          body: [
            headers,
            ...residents.map((r) => {
              if (isOfficerReport) {
                return [
                  { text: r.position || "", fontSize: 9, bold: true },
                  { text: r.name, fontSize: 9 },
                  { text: r.room, fontSize: 9 }
                ];
              }
              const row: TableCell[] = [
                { text: r.name, fontSize: 9 },
                { text: r.room, fontSize: 9 }
              ];
              if (!isPublic) {
                row.push({ text: r.bed, fontSize: 9 });
                row.push({ text: formatAccounting(r.totalBase), alignment: "right", fontSize: 9 });
                row.push({ text: formatAccounting(r.paid), alignment: "right", fontSize: 9 });
                row.push({ text: formatAccounting(r.waived), alignment: "right", fontSize: 9 });
                row.push({
                  text: formatAccounting(r.bal),
                  alignment: "right",
                  fontSize: 9,
                  bold: true
                });
              }
              return row;
            })
          ] as TableCell[][]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingTop: () => 4,
          paddingBottom: () => 4,
          paddingLeft: () => 4,
          paddingRight: () => 4
        }
      },
      {
        margin: [0, 30, 0, 0],
        table: {
          widths: [150, "*"],
          body: [
            [
              {
                text: "Report issued by:",
                fontSize: 10
              },
              {
                text: issuedBy ? `${issuedBy} ${issuedByEmail ? `<${issuedByEmail}>` : ""}` : "—",
                fontSize: 10
              }
            ],
            [
              { text: "Assessed by:", fontSize: 10 },
              {
                text: assessedBy
                  ? `${assessedBy} ${assessedByEmail ? `<${assessedByEmail}>` : ""}`
                  : "—",
                fontSize: 10
              }
            ],
            [
              { text: "Certified by:", fontSize: 10 },
              {
                text: certifiedBy
                  ? `${certifiedBy} ${certifiedByEmail ? `<${certifiedByEmail}>` : ""}`
                  : "—",
                fontSize: 10
              }
            ],
            [
              { text: "Period Covered:", fontSize: 10 },
              { text: periodCovered, fontSize: 10 }
            ],
            [
              { text: "Date Generated:", fontSize: 10 },
              {
                text: `${new Date().toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                })} (HAOne v${__APP_VERSION__}-${__COMMIT_SHA__})`,
                fontSize: 10
              }
            ]
          ]
        },
        layout: "noBorders"
      },
      {
        text: "This document is electronically generated and does not require a signature.",
        alignment: "center",
        fontSize: 10,
        margin: [0, 20, 0, 0]
      }
    ],
    footer: function (currentPage: number, pageCount: number): Content {
      return {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right",
        fontSize: 9,
        margin: [0, 70, 72, 20]
      };
    },
    styles: {
      header: {
        fontSize: 14,
        bold: true
      },
      tableHeader: {
        bold: true,
        fontSize: 10,
        margin: [0, 2, 0, 2]
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 12
    }
  };

  pdfMake
    .createPdf(docDefinition)
    .download(`Report_${categoryLabel}_${semester}${isPublic ? "_PUBLIC" : ""}.pdf`);
}
