import branding from "$data/branding.json";
import { calculateTotal } from "$utils/math";
import { formatAmount, formatCurrency, formatDate } from "$utils/formatters";
import { parseRef } from "$utils/parsers";
import { translateMop, translatePeriod } from "$utils/translators";
import type { ReceiptData } from "$lib/types";
import type {
  TDocumentDefinitions,
  ContextPageSize,
  Content,
  ContentTable,
  Alignment,
  Size,
  TableCell,
  Margins
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

/**
 * Generates and downloads a branded, selectable PDF receipt.
 * Optimized with dynamic imports for SvelteKit SSR stability.
 */
export async function exportReceiptPDF(receiptData: ReceiptData, qrDataUrl: string) {
  // Dynamic imports to avoid SSR and hydration issues
  const [pdfMakeMod, pdfFontsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts")
  ]);

  const pdfMake = pdfMakeMod.default;
  const pdfFonts = pdfFontsMod.default;

  // Setup VFS and Fonts
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
    },
    Roboto: {
      normal: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Regular.ttf",
      bold: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Medium.ttf",
      italics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-Italic.ttf",
      bolditalics: "https://unpkg.com/pdfmake@0.3/build/fonts/Roboto/Roboto-MediumItalic.ttf"
    }
  });

  const profile = branding[receiptData.branding as keyof typeof branding] || branding.default;
  const letterheadData = await imgToDataUrl(profile.letterheadUrl);
  const qrImage = qrDataUrl ? await imgToDataUrl(qrDataUrl) : "";

  const refInfo = parseRef(receiptData.referenceNumber);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [72, 40, 72, 80], // 72pt = 1 inch
    background: function (
      currentPage: number,
      pageSize: ContextPageSize
    ): Content | null | undefined {
      if (currentPage === 1 && letterheadData) {
        return {
          image: letterheadData,
          width: 595.28 // A4 width in points
        };
      }
      return null;
    },
    content: [
      {
        text: "ACKNOWLEDGMENT RECEIPT",
        style: "header",
        alignment: "center" as Alignment,
        margin: [0, 60, 0, 20] as Margins
      },
      {
        table: {
          widths: [150, "*"] as Size[],
          body: [
            [{ text: "Issuer", bold: true }, { text: profile.issuerName }],
            [{ text: "Date Issued", bold: true }, { text: formatDate(receiptData.dateIssued) }],
            [{ text: "Payment Date", bold: true }, { text: formatDate(receiptData.paymentDate) }],
            [
              { text: "Payment Processor", bold: true },
              { text: translateMop(receiptData.processor) }
            ],
            [{ text: "Reference Number", bold: true }, { text: refInfo.reference }],
            ...(refInfo.invoice
              ? [[{ text: "InstaPay Invoice No.", bold: true }, { text: refInfo.invoice }]]
              : []),
            [{ text: "Period", bold: true }, { text: translatePeriod(receiptData.period) }],
            [{ text: "Series Number", bold: true }, { text: receiptData.seriesNumber }],
            [
              { text: "Received From", bold: true },
              { text: receiptData.receivedFrom.toUpperCase() }
            ],
            [{ text: "Received By", bold: true }, { text: receiptData.receivedBy.toUpperCase() }],
            [{ text: "Notes", bold: true }, { text: receiptData.notes || "" }]
          ] as TableCell[][]
        },
        layout: "noBorders",
        margin: [0, 0, 0, 20] as Margins
      },
      {
        table: {
          headerRows: 1,
          widths: ["*", 120] as Size[],
          body: [
            [
              {
                text: "Description",
                bold: true,
                fillColor: "#f8fafc",
                margin: [0, 5, 0, 5] as Margins
              },
              {
                text: "Amount",
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              }
            ],
            ...receiptData.items.map(
              (item) =>
                [
                  {
                    text: [
                      { text: item.name },
                      ...(item.amount < 0
                        ? [
                            {
                              text: ` (${receiptData.transactionType === "RECLASSIFY" ? "RECLASSIFIED" : "REFUND"})`,
                              color: "#dc2626",
                              bold: true,
                              fontSize: 9
                            }
                          ]
                        : [])
                    ],
                    margin: [0, 5, 0, 5] as Margins
                  },
                  {
                    text: formatAmount(item.amount),
                    alignment: "right" as Alignment,
                    margin: [0, 5, 0, 5] as Margins
                  }
                ] as TableCell[]
            ),
            [
              {
                text: "Total Amount",
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              },
              {
                text: formatCurrency(calculateTotal(receiptData.items)),
                bold: true,
                fillColor: "#f8fafc",
                alignment: "right" as Alignment,
                margin: [0, 5, 0, 5] as Margins
              }
            ]
          ]
        },
        layout: {
          hLineWidth: function (i: number) {
            return 0.5;
          },
          vLineWidth: () => 0,
          hLineColor: () => "#000000",
          paddingLeft: () => 9,
          paddingRight: () => 9,
          paddingTop: () => 0,
          paddingBottom: () => 0
        }
      },
      ...(receiptData.transactionType === "WAIVED"
        ? [
            {
              stack: [
                {
                  text: "Acknowledgment of Waiver of Amount",
                  bold: true,
                  italics: true,
                  margin: [0, 20, 0, 5] as Margins
                },
                {
                  text: "The above-mentioned amount has been waived for all intents and purposes, and no further claims shall be made in this regard."
                }
              ]
            }
          ]
        : [])
    ],
    footer: function (
      currentPage: number,
      pageCount: number,
      pageSize: ContextPageSize
    ): Content | null | undefined {
      return {
        stack: [
          {
            text: "This document is electronically generated, does not require a signature, and is not valid for claim of input tax.",
            alignment: "center",
            fontSize: 8
          },
          {
            text: `Generated by HAOne on ${new Date().toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            })}.`,
            alignment: "center",
            fontSize: 8,
            margin: [0, 2, 0, 0]
          }
        ],
        margin: [0, 20, 0, 0]
      };
    },
    images: {
      qr: qrImage || ""
    },
    styles: {
      header: {
        fontSize: 12,
        bold: true
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 12
    }
  };

  if (qrImage && Array.isArray(docDefinition.content)) {
    docDefinition.content.push({
      image: "qr",
      width: 72,
      absolutePosition: { x: 500, y: 750 }
    });
  }

  pdfMake.createPdf(docDefinition).download(`Receipt_${receiptData.seriesNumber}.pdf`);
}
