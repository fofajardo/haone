import branding from "$lib/data/branding.json";
import { formatAccounting } from "$lib/utils/formatters";
import { translateMop } from "$lib/utils/translators";
import { parseDateWeight } from "$lib/utils/parsers";
import { fetchSheetRowsRaw } from "$lib/services/google-sheets-service";
import { fetchResidents, mapRowToJournal } from "$lib/logic/resident-logic";
import type { JournalRecord, ResidentRecord } from "$lib/types";
import type {
  TDocumentDefinitions,
  Content,
  Alignment,
  TableCell,
  CustomTableLayout
} from "pdfmake/interfaces";

declare const __APP_VERSION__: string;
declare const __COMMIT_SHA__: string;

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

export interface FinancialReportOptions {
  journal: JournalRecord[];
  accounts: ResidentRecord[];
  semester: string;
  brandingKey: string;
  issuedBy: string;
  assessedBy: string;
  certifiedBy: string;
  periodCovered: string;
  transactionTypes: { value: string; label: string }[];
  availableMops: { value: string; label: string }[];
}

export async function fetchFinancialReportData(workbookId: string, forceRefresh = false) {
  const [journalRows, mappedAccounts, constRows] = await Promise.all([
    fetchSheetRowsRaw(workbookId, "journal_general!A:T", forceRefresh),
    fetchResidents(forceRefresh),
    fetchSheetRowsRaw(workbookId, "constants!A:C", forceRefresh)
  ]);

  // Fetch Journal
  const allJournal = journalRows.slice(1).map((row, idx) => {
    const res = mapRowToJournal(row, idx);
    return {
      ...res,
      dateWeight: parseDateWeight(res.date)
    };
  });

  // Fetch Accounts
  const allAccounts = mappedAccounts;

  // Fetch Constants (Transaction Types & MOPs)
  const transactionTypes = constRows
    .slice(1)
    .filter((r) => {
      return (r[0] || "").startsWith("PMT_");
    })
    .map((r) => {
      return {
        value: r[1] || r[0],
        label: r[2] || r[1] || r[0]
      };
    });

  const availableMops = constRows
    .slice(1)
    .filter((r) => {
      return (r[0] || "").startsWith("MOP_");
    })
    .map((r) => {
      return {
        value: r[1] || r[0],
        label: r[2] || r[1] || r[0]
      };
    });

  return {
    allJournal,
    allAccounts,
    transactionTypes,
    availableMops
  };
}

export function computeFinancialReportData(
  journal: JournalRecord[],
  accounts: ResidentRecord[],
  availableMops: { value: string; label: string }[]
) {
  // 1. Sort Journal chronologically
  const sortedJournal = [...journal].sort(
    (a, b) =>
      (a.dateWeight ?? 0) - (b.dateWeight ?? 0) || (a.ledgerIndex ?? 0) - (b.ledgerIndex ?? 0)
  );

  // 2. Data Processing
  let runningBalance = 0;
  const processedJournal = sortedJournal.map((j) => {
    const isWaived = j.type.toUpperCase().includes("WAIVED");
    const amount = j.water + j.assoc + j.misc;
    const incoming = !isWaived && amount > 0 ? amount : 0;
    const outgoing = !isWaived && amount < 0 ? Math.abs(amount) : 0;
    if (!isWaived) {
      runningBalance += amount;
    }
    return {
      ...j,
      incoming,
      outgoing,
      runningBalance
    };
  }) as (JournalRecord & { incoming: number; outgoing: number; runningBalance: number })[];

  // Summary by MOP
  const mopSummary: Record<string, { incoming: number; outgoing: number }> = {};
  availableMops.forEach((m) => {
    mopSummary[m.value] = { incoming: 0, outgoing: 0 };
  });

  processedJournal.forEach((j) => {
    const rawMop = (j.mop || "").trim().toUpperCase();
    if (rawMop === "N/A") return;

    // Map to normalized key if possible, else use raw
    const key = rawMop || "CASH";
    if (!mopSummary[key]) mopSummary[key] = { incoming: 0, outgoing: 0 };
    mopSummary[key].incoming += j.incoming;
    mopSummary[key].outgoing += j.outgoing;
  });

  // Summary by Fee Type
  const feeSummary = {
    WATER: { incoming: 0, outgoing: 0 },
    ASSOC: { incoming: 0, outgoing: 0 },
    MISC: { incoming: 0, outgoing: 0 }
  };

  // Summary by Fee Type and MOP
  const feeTypeMopSummary = {
    WATER: {} as Record<string, { incoming: number; outgoing: number }>,
    ASSOC: {} as Record<string, { incoming: number; outgoing: number }>,
    MISC: {} as Record<string, { incoming: number; outgoing: number }>
  };

  processedJournal.forEach((j) => {
    const isWaived = j.type.toUpperCase().includes("WAIVED");
    if (isWaived) {
      return;
    }
    const rawMop = (j.mop || "").trim().toUpperCase();
    if (rawMop === "N/A") {
      return;
    }
    const mopKey = rawMop || "CASH";

    if (j.water !== 0) {
      if (j.water > 0) {
        feeSummary.WATER.incoming += j.water;
        if (!feeTypeMopSummary.WATER[mopKey]) {
          feeTypeMopSummary.WATER[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.WATER[mopKey].incoming += j.water;
      } else {
        const absVal = Math.abs(j.water);
        feeSummary.WATER.outgoing += absVal;
        if (!feeTypeMopSummary.WATER[mopKey]) {
          feeTypeMopSummary.WATER[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.WATER[mopKey].outgoing += absVal;
      }
    }

    if (j.assoc !== 0) {
      if (j.assoc > 0) {
        feeSummary.ASSOC.incoming += j.assoc;
        if (!feeTypeMopSummary.ASSOC[mopKey]) {
          feeTypeMopSummary.ASSOC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.ASSOC[mopKey].incoming += j.assoc;
      } else {
        const absVal = Math.abs(j.assoc);
        feeSummary.ASSOC.outgoing += absVal;
        if (!feeTypeMopSummary.ASSOC[mopKey]) {
          feeTypeMopSummary.ASSOC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.ASSOC[mopKey].outgoing += absVal;
      }
    }

    if (j.misc !== 0) {
      if (j.misc > 0) {
        feeSummary.MISC.incoming += j.misc;
        if (!feeTypeMopSummary.MISC[mopKey]) {
          feeTypeMopSummary.MISC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MISC[mopKey].incoming += j.misc;
      } else {
        const absVal = Math.abs(j.misc);
        feeSummary.MISC.outgoing += absVal;
        if (!feeTypeMopSummary.MISC[mopKey]) {
          feeTypeMopSummary.MISC[mopKey] = { incoming: 0, outgoing: 0 };
        }
        feeTypeMopSummary.MISC[mopKey].outgoing += absVal;
      }
    }
  });

  // Collection Summary
  const waterColl = {
    target: accounts.reduce((s, r) => s + r.waterBase, 0),
    waived: accounts.reduce((s, r) => s + r.waterWaived, 0),
    resident: processedJournal.reduce(
      (s, j) => s + (j.type === "COLLECTION" && j.water > 0 ? j.water : 0),
      0
    ),
    uho: processedJournal.reduce((s, j) => s + (j.type === "COLLECTION_OTHERS" ? j.water : 0), 0),
    refunds: processedJournal.reduce(
      (s, j) => s + (j.type === "COLLECTION" && j.water < 0 ? Math.abs(j.water) : 0),
      0
    ),
    overdue: accounts.reduce((s, r) => s + (r.waterBal > 0 ? r.waterBal : 0), 0),
    aquaAltria: processedJournal.reduce(
      (s, j) => s + (j.type === "WATER_AQUA_ALTRIA" ? Math.abs(j.water + j.assoc + j.misc) : 0),
      0
    ),
    paidToWater: processedJournal.reduce(
      (s, j) => s + (j.type === "WATER" ? Math.abs(j.water + j.assoc + j.misc) : 0),
      0
    )
  };

  const assocColl = {
    target: accounts.reduce((s, r) => s + r.assocBase, 0),
    waived: accounts.reduce((s, r) => s + r.assocWaived, 0),
    resident: processedJournal.reduce(
      (s, j) => s + (j.type === "COLLECTION" && j.assoc > 0 ? j.assoc : 0),
      0
    ),
    refunds: processedJournal.reduce(
      (s, j) => s + (j.type === "COLLECTION" && j.assoc < 0 ? Math.abs(j.assoc) : 0),
      0
    ),
    overdue: accounts.reduce((s, r) => s + (r.assocBal > 0 ? r.assocBal : 0), 0)
  };

  return {
    processedJournal,
    runningBalance,
    mopSummary,
    feeSummary,
    feeTypeMopSummary,
    waterColl,
    assocColl
  };
}

export async function exportFinancialReportPDF(options: FinancialReportOptions) {
  const {
    journal,
    accounts,
    semester,
    brandingKey,
    issuedBy,
    assessedBy,
    certifiedBy,
    periodCovered,
    availableMops
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
  const letterheadData = await imgToDataUrl(
    (profile as any).letterheadHalfInchUrl || profile.letterheadUrl
  );

  const {
    processedJournal,
    runningBalance,
    mopSummary,
    feeSummary,
    feeTypeMopSummary,
    waterColl,
    assocColl
  } = computeFinancialReportData(journal, accounts, availableMops);

  const summaryLayout: CustomTableLayout = {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0.5,
    hLineColor: () => "#000000",
    vLineColor: () => "#000000",
    paddingTop: () => 2,
    paddingBottom: () => 2,
    paddingLeft: () => 4,
    paddingRight: () => 4
  };

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [36, 40, 36, 60],
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
      // PAGE 1: Summaries
      {
        text: "FINANCIAL REPORT",
        style: "mainHeader",
        margin: [0, 60, 0, 0]
      },
      {
        text: semester.toUpperCase(),
        fontSize: 12
      },

      { text: "ACCOUNT SUMMARY", style: "sectionHeader" },

      // Table 1: MOP Summary
      {
        table: {
          widths: ["*", 100, 100, 100],
          body: [
            [
              { text: "BY MODE OF PAYMENT¹", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            ...Object.entries(mopSummary).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => m.value === mop);
              let label = mopConst ? mopConst.label : translateMop(mop);

              return [
                { text: label.toUpperCase(), fontSize: 9 },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ENDING BALANCE", bold: true, fontSize: 9 },
              { text: "" },
              { text: "" },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[]
          ]
        },
        layout: summaryLayout,
        margin: [0, 0, 0, 15]
      },

      // Table 2: Fee Type Summary
      {
        table: {
          widths: ["*", 100, 100, 100],
          body: [
            [
              { text: "BY FEE TYPE¹", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            [
              { text: "WATER FEE", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.WATER.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.WATER.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.WATER.incoming - feeSummary.WATER.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.WATER).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ASSOCIATION FEE", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.ASSOC.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.ASSOC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.ASSOC.incoming - feeSummary.ASSOC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.ASSOC).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "MISCELLANEOUS", bold: true, fontSize: 9 },
              {
                text: formatAccounting(feeSummary.MISC.incoming),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MISC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              },
              {
                text: formatAccounting(feeSummary.MISC.incoming - feeSummary.MISC.outgoing),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...Object.entries(feeTypeMopSummary.MISC).map(([mop, data]) => {
              const mopConst = availableMops.find((m) => {
                return m.value === mop;
              });
              const label = mopConst ? mopConst.label : translateMop(mop);
              return [
                { text: label.toUpperCase(), fontSize: 9, margin: [15, 0, 0, 0] },
                { text: formatAccounting(data.incoming), alignment: "right", fontSize: 9 },
                { text: formatAccounting(data.outgoing), alignment: "right", fontSize: 9 },
                {
                  text: formatAccounting(data.incoming - data.outgoing),
                  alignment: "right",
                  fontSize: 9
                }
              ] as TableCell[];
            }),
            [
              { text: "ENDING BALANCE", bold: true, fontSize: 9 },
              { text: "" },
              { text: "" },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[]
          ]
        },
        layout: summaryLayout,
        margin: [0, 0, 0, 25]
      },

      { text: "COLLECTION SUMMARY", style: "sectionHeader" },

      // Table 3: Collection Summary
      {
        table: {
          widths: [80, "*", 100],
          body: [
            [
              { text: "CATEGORY", style: "tableHeader" },
              { text: "DETAILS", style: "tableHeader" },
              { text: "AMOUNT", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            // WATER FEE
            [
              {
                text: "WATER FEE",
                rowSpan: waterColl.aquaAltria > 0 ? 10 : 9,
                bold: true,
                alignment: "center",
                verticalAlignment: "middle",
                fontSize: 9
              } as any,
              { text: "TARGET", fontSize: 9 },
              { text: formatAccounting(waterColl.target), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "LESS: WAIVED", fontSize: 9 },
              { text: formatAccounting(waterColl.waived), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION FROM RESIDENTS", fontSize: 9 },
              { text: formatAccounting(waterColl.resident), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "LESS: COLLECTION REFUNDS", fontSize: 9 },
              {
                text: formatAccounting(waterColl.resident - waterColl.refunds),
                alignment: "right",
                fontSize: 9
              }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION FROM UHO", fontSize: 9 },
              { text: formatAccounting(waterColl.uho), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "TOTAL COLLECTION", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.resident - waterColl.refunds + waterColl.uho),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            [
              "",
              { text: "OVERDUE ACCOUNTS²", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.overdue),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            ...(waterColl.aquaAltria > 0
              ? [
                  [
                    "",
                    { text: `PAID TO WATER SUPPLIER (AQUA ALTRIA)³`, fontSize: 9 },
                    {
                      text: formatAccounting(waterColl.aquaAltria),
                      alignment: "right",
                      fontSize: 9
                    }
                  ] as TableCell[]
                ]
              : []),
            [
              "",
              { text: `PAID TO WATER SUPPLIER³`, fontSize: 9 },
              { text: formatAccounting(waterColl.paidToWater), alignment: "right", fontSize: 9 }
            ] as TableCell[],
            [
              "",
              { text: "PAID TO WATER SUPPLIER (TOTAL)³", bold: true, fontSize: 9 },
              {
                text: formatAccounting(waterColl.aquaAltria + waterColl.paidToWater),
                alignment: "right",
                bold: true,
                fontSize: 9
              }
            ] as TableCell[],
            // ASSOC FEE
            ...(assocColl.target > 0
              ? [
                  [
                    {
                      text: "ASSOCIATION FEE",
                      rowSpan: 5,
                      bold: true,
                      alignment: "center",
                      verticalAlignment: "middle",
                      fontSize: 9
                    } as any,
                    { text: "TARGET", fontSize: 9 },
                    { text: formatAccounting(assocColl.target), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: WAIVED", fontSize: 9 },
                    { text: formatAccounting(assocColl.waived), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "TOTAL COLLECTION FROM RESIDENTS", fontSize: 9 },
                    { text: formatAccounting(assocColl.resident), alignment: "right", fontSize: 9 }
                  ] as TableCell[],
                  [
                    "",
                    { text: "LESS: COLLECTION REFUNDS", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(assocColl.resident - assocColl.refunds),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[],
                  [
                    "",
                    { text: "OVERDUE ACCOUNTS²", bold: true, fontSize: 9 },
                    {
                      text: formatAccounting(assocColl.overdue),
                      alignment: "right",
                      bold: true,
                      fontSize: 9
                    }
                  ] as TableCell[]
                ]
              : [])
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000"
        },
        margin: [0, 0, 0, 20]
      },

      {
        text: "¹ Amounts may appear inflated due to internal transfers between accounts (e.g., Cash to GCash).",
        fontSize: 11,
        margin: [0, 0, 0, 2]
      },
      {
        text: "² Residents who have not settled their accounts by the due date and are considered to be in arrears.",
        fontSize: 11,
        margin: [0, 0, 0, 2]
      },
      {
        text: `³ Period covered: ${periodCovered} (excluding transaction fees).`,
        fontSize: 11,
        margin: [0, 0, 0, 15]
      },

      {
        columns: [
          {
            width: "auto",
            stack: [
              { text: "Financial Report issued by:", fontSize: 11 },
              { text: "Assessed by:", fontSize: 11 },
              { text: "Certified by:", fontSize: 11 },
              { text: "Period Covered:", fontSize: 11 },
              { text: "Date Generated:", fontSize: 11 }
            ]
          },
          {
            width: "*",
            margin: [10, 0, 0, 0],
            stack: [
              { text: issuedBy, fontSize: 11 },
              { text: assessedBy, fontSize: 11 },
              { text: certifiedBy, fontSize: 11 },
              { text: periodCovered, fontSize: 11 },
              {
                text: `${new Date().toLocaleString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true
                })} (HAOne v${__APP_VERSION__}-${__COMMIT_SHA__})`,
                fontSize: 11
              }
            ]
          }
        ],
        pageBreak: "after"
      },

      // PAGE 2+: Transaction Details
      { text: "ACCOUNT STATEMENT AND TRANSACTION DETAILS", style: "sectionHeader" },
      // Table 4: Transaction Details
      {
        table: {
          headerRows: 1,
          widths: [55, 85, "*", 55, 55, 55],
          body: [
            [
              { text: "DATE", style: "tableHeader" },
              { text: "TYPE", style: "tableHeader" },
              { text: "PARTICULARS", style: "tableHeader" },
              { text: "INCOMING", style: "tableHeader", alignment: "right" },
              { text: "OUTGOING", style: "tableHeader", alignment: "right" },
              { text: "BALANCE", style: "tableHeader", alignment: "right" }
            ] as TableCell[],
            ...processedJournal.map(
              (j) =>
                [
                  { text: j.date, fontSize: 8 },
                  { text: j.type, fontSize: 8 },
                  { text: (j.notes || "").toUpperCase(), fontSize: 8 },
                  { text: formatAccounting(j.incoming), alignment: "right", fontSize: 8 },
                  { text: formatAccounting(j.outgoing), alignment: "right", fontSize: 8 },
                  { text: formatAccounting(j.runningBalance), alignment: "right", fontSize: 8 }
                ] as TableCell[]
            ),
            // Totals
            [
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] }
            ],
            [
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              { text: "BALANCE THIS STATEMENT", fontSize: 8, border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              {
                text: formatAccounting(runningBalance),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              }
            ] as TableCell[],
            [
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] },
              { text: "", border: [true, false, true, false] }
            ],
            [
              { text: "", border: [true, false, true, true] },
              { text: "", border: [true, false, true, true] },
              { text: "TOTAL DEBIT", fontSize: 8, border: [true, true, true, true] },
              { text: "", border: [true, true, true, true] },
              {
                text: formatAccounting(processedJournal.reduce((s, j) => s + j.outgoing, 0)),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              },
              { text: "", border: [true, false, true, true] }
            ] as TableCell[],
            [
              { text: "", border: [true, false, true, true] },
              { text: "", border: [true, false, true, true] },
              { text: "TOTAL CREDIT", fontSize: 8, border: [true, true, true, true] },
              {
                text: formatAccounting(processedJournal.reduce((s, j) => s + j.incoming, 0)),
                alignment: "right",
                fontSize: 8,
                border: [true, true, true, true]
              },
              { text: "", border: [true, true, true, true] },
              { text: "", border: [true, false, true, true] }
            ] as TableCell[]
          ]
        },
        layout: {
          hLineWidth: (i, node) => {
            // Top, below header, and bottom lines only
            if (i === 0 || i === 1 || i === node.table.body.length) return 0.5;
            return 0;
          },
          vLineWidth: () => 0.5,
          hLineColor: () => "#000000",
          vLineColor: () => "#000000",
          paddingTop: () => 2,
          paddingBottom: () => 2,
          paddingLeft: () => 4,
          paddingRight: () => 4
        }
      },

      {
        text: "Remarks:",
        bold: true,
        fontSize: 10,
        margin: [0, 15, 0, 5]
      },
      {
        text: "AF – Association Fee, WF – Water Fee, MF – Miscellaneous Fund",
        fontSize: 9
      }
    ],
    footer: function (currentPage: number, pageCount: number): Content {
      const pageInfo = {
        text: `Page ${currentPage} of ${pageCount}`,
        alignment: "right" as Alignment,
        fontSize: 9
      };

      if (currentPage === 1) {
        return {
          stack: [
            {
              text: "This document is electronically generated and does not require a signature.",
              alignment: "center" as Alignment,
              fontSize: 8,
              color: "#000",
              margin: [0, 0, 0, 5]
            },
            pageInfo
          ],
          margin: [36, 10, 36, 0]
        };
      }

      return {
        ...pageInfo,
        margin: [0, 10, 36, 0]
      };
    },
    styles: {
      mainHeader: {
        fontSize: 16,
        bold: true
      },
      sectionHeader: {
        fontSize: 11,
        bold: true,
        margin: [0, 10, 0, 5]
      },
      tableHeader: {
        bold: true,
        fontSize: 8.5
      }
    },
    defaultStyle: {
      font: "Archivo",
      fontSize: 10
    }
  };

  pdfMake.createPdf(docDefinition).download(`Financial_Report_${semester.replace(/ /g, "_")}.pdf`);
}
