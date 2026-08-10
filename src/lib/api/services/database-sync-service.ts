import { supabaseResidentService } from "./supabase/resident-service";
import { sheetsResidentService } from "./sheets/resident-service";
import { supabaseAnnouncementService } from "./supabase/announcement-service";
import { sheetsAnnouncementService } from "./sheets/announcement-service";
import { supabaseConstantsService } from "./supabase/constants-service";
import { sheetsConstantsService } from "./sheets/constants-service";
import { supabaseLaundryService } from "./supabase/laundry-service";
import { sheetsLaundryService } from "./sheets/laundry-service";
import { supabasePaymentRequestService } from "./supabase/payment-request-service";
import { sheetsPaymentRequestService } from "./sheets/payment-request-service";
import { supabaseAchievementService } from "./supabase/achievement-service";
import { sheetsAchievementService } from "./sheets/achievement-service";
import { supabaseOfficerService } from "./supabase/officer-service";
import { sheetsOfficerService } from "./sheets/officer-service";
import { supabaseJournalService } from "./supabase/journal-service";
import { sheetsJournalService } from "./sheets/journal-service";
import {
  supabase,
  fetchSheetRowsRaw,
  batchUpdateValues,
  appendSheetRow,
  fetchAllSupabaseRows
} from "./common";
import { parseDbDate, isUuid } from "$utils/parsers";
import {
  USER_COL,
  ACCOUNT_COL,
  JOURNAL_COL,
  ANNOUNCEMENT_COL,
  LAUNDRY_COL,
  PAYMENT_REQUEST_COL,
  ACHIEVEMENT_COL,
  ACHIEVEMENT_RECORD_COL,
  OFFICER_COL
} from "$lib/types";
import type {
  UserRecord,
  ResidentRecord,
  JournalRecord,
  AnnouncementRecord,
  LaundryRecord,
  PaymentRequestRecord,
  AchievementRecord,
  AchievementLogRecord,
  OfficerRecord,
  ConstantRecord
} from "$lib/types";

export type SyncDirection = "toSupabase" | "toGSheets";

export interface SyncResult {
  entity: string;
  added: number;
  updated: number;
  failed: number;
  errors: string[];
}

// Keys excluded from diffing: raw payloads, sheet-only row indices, and
// provider-specific fields that have no counterpart on the other side
// (Supabase-only id/issuerId/name), which would otherwise compare unequal
// forever and re-upsert on every sync.
const DIFF_EXCLUDED_KEYS = new Set(["raw", "ledgerIndex", "id", "issuerId", "name"]);

function isDifferent(a: any, b: any): boolean {
  const keys = Object.keys(a).filter((k) => !DIFF_EXCLUDED_KEYS.has(k));
  for (const key of keys) {
    if (String(a[key] ?? "") !== String(b[key] ?? "")) {
      return true;
    }
  }
  return false;
}

async function syncEntity<T extends { id: string }>(
  entityName: string,
  fetchSource: () => Promise<T[]>,
  fetchTarget: () => Promise<T[]>,
  upsertTarget: (items: T[]) => Promise<void>
): Promise<SyncResult> {
  const result: SyncResult = { entity: entityName, added: 0, updated: 0, failed: 0, errors: [] };

  try {
    const sourceData = await fetchSource();
    const targetData = await fetchTarget();
    const targetMap = new Map(targetData.map((item) => [item.id, item]));

    const toUpsert: T[] = [];

    for (const sourceItem of sourceData) {
      const targetItem = targetMap.get(sourceItem.id);
      if (!targetItem) {
        toUpsert.push(sourceItem);
        result.added++;
      } else if (isDifferent(sourceItem, targetItem)) {
        toUpsert.push(sourceItem);
        result.updated++;
      }
    }

    if (toUpsert.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < toUpsert.length; i += chunkSize) {
        const chunk = toUpsert.slice(i, i + chunkSize);
        await upsertTarget(chunk);
      }
    }
  } catch (err: any) {
    result.failed = 1;
    result.errors.push(err.message);
  }

  return result;
}

function extractList<T>(res: T[] | { items?: T[]; total?: number }): T[] {
  if (Array.isArray(res)) {
    return res;
  }
  return res.items || [];
}

/**
 * Fetches ALL journal entries from either provider. PostgREST hard-caps
 * responses at 1000 rows server-side, so paginated Supabase calls must loop;
 * the Sheets provider ignores pagination and returns everything at once.
 */
async function fetchAllJournalEntries(service: {
  fetchJournalEntries: (
    filters?: any,
    options?: any
  ) => Promise<JournalRecord[] | { items: JournalRecord[]; totalPages: number }>;
}): Promise<JournalRecord[]> {
  const pageSize = 1000;
  const all: JournalRecord[] = [];
  let page = 1;
  for (;;) {
    const res = await service.fetchJournalEntries(undefined, { page, pageSize });
    if (Array.isArray(res)) {
      all.push(...res);
      break;
    }
    all.push(...res.items);
    if (res.items.length < pageSize || page >= res.totalPages) {
      break;
    }
    page++;
  }
  return all;
}

/**
 * Sync Users
 */
export async function syncUsers(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const existingUsers = await extractList(await supabaseResidentService.fetchUsers());
    const emailToExistingIdMap = new Map<string, string>();
    existingUsers.forEach((u) => {
      if (u.email && u.id) {
        emailToExistingIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Users",
      async () => extractList(await sheetsResidentService.fetchUsers(true)),
      async () => extractList(await supabaseResidentService.fetchUsers()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          const email = (item.email || "").trim().toLowerCase();
          const existingId = emailToExistingIdMap.get(email);
          return {
            id: existingId || item.id,
            email,
            last_name: item.lastName,
            first_name: item.firstName,
            middle_name: item.middleName,
            suffix: item.suffix,
            override_name: item.overrideName,
            student_no: item.studentNo,
            secondary_contact: item.secondaryContact,
            address: item.address,
            college: item.college,
            degree_program: item.program,
            tags: item.tags
              ? item.tags
                  .split(/[,:]/)
                  .map((t) => t.trim())
                  .filter(Boolean)
              : [],
            notes: item.notes
          };
        });
        const { error } = await supabase.from("users").upsert(payload, { onConflict: "email" });
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Users",
      async () => extractList(await supabaseResidentService.fetchUsers()),
      async () => extractList(await sheetsResidentService.fetchUsers(true)),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.residentRecordsId;
        if (!spreadsheetId) {
          throw new Error("Resident records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "users!A:P");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[USER_COL.ID] === item.id);
          const row = new Array(16).fill("");
          row[USER_COL.EMAIL] = (item.email || "").trim().toLowerCase();
          row[USER_COL.LAST_NAME] = (item.lastName || "").trim().toUpperCase();
          row[USER_COL.FIRST_NAME] = (item.firstName || "").trim().toUpperCase();
          row[USER_COL.MIDDLE_NAME] = (item.middleName || "").trim().toUpperCase();
          row[USER_COL.SUFFIX] = (item.suffix || "").trim().toUpperCase();
          row[USER_COL.OVERRIDE_NAME] = item.overrideName || "";
          row[USER_COL.DISPLAY_NAME] = item.displayName || "";
          row[USER_COL.DISPLAY_NAME_FL] = item.displayNameFormal || "";
          row[USER_COL.STUDENT_NO] = item.studentNo || "";
          row[USER_COL.SECONDARY_CONTACT] = item.secondaryContact || "";
          row[USER_COL.ADDRESS] = item.address || "";
          row[USER_COL.COLLEGE] = item.college || "";
          row[USER_COL.DEGREE_PROGRAM] = item.program || "";
          row[USER_COL.TAGS] = item.tags || "";
          row[USER_COL.NOTES] = item.notes || "";
          row[USER_COL.ID] = item.id;

          if (rowIndex !== -1) {
            updates.push({ range: `users!A${rowIndex + 1}:P${rowIndex + 1}`, values: [row] });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "users!A:P", newRows);
        }
      }
    );
  }
}

async function getValidUserUuidSet(): Promise<Set<string>> {
  if (!supabase) {
    return new Set();
  }
  const sb = supabase;
  const data = await fetchAllSupabaseRows(() =>
    sb.from("users").select("id").order("id", { ascending: true })
  );
  return new Set(data.map((u: any) => u.id));
}

/**
 * Sync Accounts (Residents)
 */
export async function syncAccounts(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Residents",
      async () => extractList(await sheetsResidentService.fetchResidents(true)),
      async () => extractList(await supabaseResidentService.fetchResidents()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let resId = isUuid(item.residentId) ? item.residentId : null;
          if (!resId && item.email) {
            const mapped = emailToIdMap.get(item.email.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              resId = mapped;
            }
          }

          if (resId && !validUserIds.has(resId)) {
            resId = null;
          }

          let issuerId = isUuid((item as any).issuerId) ? (item as any).issuerId : null;
          if (issuerId && !validUserIds.has(issuerId)) {
            issuerId = null;
          }

          return {
            id: item.ledgerId || item.id,
            resident_id: resId,
            period: item.period,
            room: item.room,
            bed: item.bed,
            ce_ref_no: item.ceRefNo,
            ce_issued: parseDbDate(item.ceIssued),
            ce_link: item.ceLink,
            account_notes: item.notes,
            check_in_date: parseDbDate(item.checkInDate),
            issuer_id: issuerId
          };
        });
        const { error } = await supabase.from("accounts").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Residents",
      async () => extractList(await supabaseResidentService.fetchResidents()),
      async () => extractList(await sheetsResidentService.fetchResidents(true)),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.accountingWorkbookId;
        if (!spreadsheetId) {
          throw new Error("Accounting workbook ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "accounts!A:L");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[ACCOUNT_COL.ID] === item.id);
          const row = new Array(12).fill("");
          row[ACCOUNT_COL.ID] = item.ledgerId || item.id;
          row[ACCOUNT_COL.RESIDENT_ID] = item.residentId || "";
          row[ACCOUNT_COL.PERIOD] = item.period || "";
          row[ACCOUNT_COL.ROOM] = item.room || "";
          row[ACCOUNT_COL.BED] = item.bed || "";
          row[ACCOUNT_COL.CE_REFNO] = item.ceRefNo || "";
          row[ACCOUNT_COL.CE_ISSUED] = item.ceIssued || "";
          row[ACCOUNT_COL.CE_LINK] = item.ceLink || "";
          row[ACCOUNT_COL.NOTES] = item.notes || "";
          row[ACCOUNT_COL.ISSUER_ID] = (item as any).issuerId || "";
          row[ACCOUNT_COL.CHECK_IN_DATE] = item.checkInDate || "";
          row[ACCOUNT_COL.TYPE] = (item as any).type || "";

          if (rowIndex !== -1) {
            updates.push({ range: `accounts!A${rowIndex + 1}:L${rowIndex + 1}`, values: [row] });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "accounts!A:L", newRows);
        }
      }
    );
  }
}

/**
 * Sync Journal
 */
export async function syncJournal(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    return syncEntity(
      "Journal",
      async () => fetchAllJournalEntries(sheetsJournalService),
      async () => fetchAllJournalEntries(supabaseJournalService),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => ({
          id: item.id,
          date: parseDbDate(item.date),
          creator_email: item.creator,
          account_email: item.account,
          water: item.water,
          assoc: item.assoc,
          misc: item.misc,
          mop: item.mop,
          period: item.period,
          type: item.type,
          notes: item.notes,
          notes_private: item.notesPrivate,
          mop_ref_no: item.mopRefNo,
          pr_date_issued: parseDbDate(item.prDateIssued),
          pr_ref_no: item.prRefNo,
          was_audited: item.wasAudited,
          receipt_url: item.receiptUrl
        }));
        const { error } = await supabase.from("journal").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Journal",
      async () => fetchAllJournalEntries(supabaseJournalService),
      async () => fetchAllJournalEntries(sheetsJournalService),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.accountingWorkbookId;
        if (!spreadsheetId) {
          throw new Error("Accounting workbook ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "journal_general!A:T");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[JOURNAL_COL.ID] === item.id);
          const row = new Array(20).fill("");
          row[JOURNAL_COL.DATE] = item.date || "";
          row[JOURNAL_COL.CREATOR] = item.creator || "";
          row[JOURNAL_COL.ACCOUNT] = item.account || "";
          row[JOURNAL_COL.WATER] = String(item.water || 0);
          row[JOURNAL_COL.ASSOC] = String(item.assoc || 0);
          row[JOURNAL_COL.MISC] = String(item.misc || 0);
          row[JOURNAL_COL.MOP] = item.mop || "";
          row[JOURNAL_COL.PERIOD] = item.period || "";
          row[JOURNAL_COL.TYPE] = item.type || "";
          row[JOURNAL_COL.NOTES] = item.notes || "";
          row[JOURNAL_COL.NOTES_PRIVATE] = item.notesPrivate || "";
          row[JOURNAL_COL.MOP_REFNO] = item.mopRefNo || "";
          row[JOURNAL_COL.PR_DATE_ISSUED] = item.prDateIssued || "";
          row[JOURNAL_COL.PR_REFNO] = item.prRefNo || "";
          row[JOURNAL_COL.CREATOR_NAME] = item.creatorName || "";
          row[JOURNAL_COL.NAME] = item.name || "";
          row[JOURNAL_COL.STNO] = item.stno || "";
          row[JOURNAL_COL.WAS_AUDITED] = item.wasAudited ? "TRUE" : "FALSE";
          row[JOURNAL_COL.RECEIPT_URL] = item.receiptUrl || "";
          row[JOURNAL_COL.ID] = item.id;

          if (rowIndex !== -1) {
            updates.push({
              range: `journal_general!A${rowIndex + 1}:T${rowIndex + 1}`,
              values: [row]
            });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "journal_general!A:T", newRows);
        }
      }
    );
  }
}

/**
 * Sync Announcements
 */
export async function syncAnnouncements(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Announcements",
      async () => extractList(await sheetsAnnouncementService.fetchAnnouncements()),
      async () => extractList(await supabaseAnnouncementService.fetchAnnouncements()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let creatorId = isUuid(item.creatorId) ? item.creatorId : null;
          if (!creatorId && item.creatorId) {
            const mapped = emailToIdMap.get(item.creatorId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              creatorId = mapped;
            }
          }
          if (creatorId && !validUserIds.has(creatorId)) {
            creatorId = null;
          }

          return {
            id: item.id,
            creator_id: creatorId,
            start_date: parseDbDate(item.startDate),
            expiry_date: parseDbDate(item.expiryDate),
            is_indefinite: item.isIndefinite,
            is_admin_only: item.isAdminOnly,
            is_unlisted: item.isUnlisted,
            tags: item.tags ? item.tags.split(",") : [],
            title: item.title,
            content: item.content,
            slug: item.slug,
            broadcast_count: item.broadcastCount || 0
          };
        });
        const { error } = await supabase.from("announcements").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Announcements",
      async () => extractList(await supabaseAnnouncementService.fetchAnnouncements()),
      async () => extractList(await sheetsAnnouncementService.fetchAnnouncements()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.sharedRecordsId;
        if (!spreadsheetId) {
          throw new Error("Shared records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "announcements!A:M");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[ANNOUNCEMENT_COL.ID] === item.id);
          const row = new Array(13).fill("");
          row[ANNOUNCEMENT_COL.ID] = item.id;
          row[ANNOUNCEMENT_COL.CREATOR_ID] = item.creatorId || "";
          row[ANNOUNCEMENT_COL.DATE_CREATED] = item.dateCreated || "";
          row[ANNOUNCEMENT_COL.START_DATE] = item.startDate || "";
          row[ANNOUNCEMENT_COL.EXPIRY_DATE] = item.expiryDate || "";
          row[ANNOUNCEMENT_COL.IS_INDEFINITE] = item.isIndefinite ? "TRUE" : "FALSE";
          row[ANNOUNCEMENT_COL.IS_ADMIN_ONLY] = item.isAdminOnly ? "TRUE" : "FALSE";
          row[ANNOUNCEMENT_COL.IS_UNLISTED] = item.isUnlisted ? "TRUE" : "FALSE";
          row[ANNOUNCEMENT_COL.SLUG] = item.slug || "";
          row[ANNOUNCEMENT_COL.TAGS] = item.tags || "";
          row[ANNOUNCEMENT_COL.TITLE] = item.title || "";
          row[ANNOUNCEMENT_COL.CONTENT] = item.content || "";
          row[ANNOUNCEMENT_COL.BROADCAST_COUNT] = String(item.broadcastCount || 0);

          if (rowIndex !== -1) {
            updates.push({
              range: `announcements!A${rowIndex + 1}:M${rowIndex + 1}`,
              values: [row]
            });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "announcements!A:M", newRows);
        }
      }
    );
  }
}

/**
 * Sync Constants
 */
export async function syncConstants(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    return syncEntity(
      "Constants",
      async () =>
        (await sheetsConstantsService.fetchConstants(true)).map((c) => ({ ...c, id: c.key })),
      async () =>
        (await supabaseConstantsService.fetchConstants()).map((c) => ({ ...c, id: c.key })),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => ({
          key: item.key,
          value: item.value,
          description: item.description
        }));
        const { error } = await supabase.from("constants").upsert(payload, { onConflict: "key" });
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Constants",
      async () =>
        (await supabaseConstantsService.fetchConstants()).map((c) => ({ ...c, id: c.key })),
      async () =>
        (await sheetsConstantsService.fetchConstants(true)).map((c) => ({ ...c, id: c.key })),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.accountingWorkbookId;
        if (!spreadsheetId) {
          throw new Error("Accounting workbook ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "constants!A:C");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[0] === item.key);
          const row = [item.key, item.value, item.description];
          if (rowIndex !== -1) {
            updates.push({ range: `constants!A${rowIndex + 1}:C${rowIndex + 1}`, values: [row] });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "constants!A:C", newRows);
        }
      }
    );
  }
}

/**
 * Sync Laundry
 */
export async function syncLaundry(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Laundry",
      async () => extractList(await sheetsLaundryService.fetchReservations()),
      async () => extractList(await supabaseLaundryService.fetchReservations()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let resId = isUuid(item.residentId) ? item.residentId : null;
          if (!resId && item.residentId) {
            const mapped = emailToIdMap.get(item.residentId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              resId = mapped;
            }
          }
          if (resId && !validUserIds.has(resId)) {
            resId = null;
          }

          return {
            id: item.id,
            resident_id: resId,
            date: parseDbDate(item.date),
            time_start: item.timeStart,
            time_end: item.timeEnd,
            status: item.status,
            cancel_reason: item.cancelReason
          };
        });
        const { error } = await supabase.from("laundry").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Laundry",
      async () => extractList(await supabaseLaundryService.fetchReservations()),
      async () => extractList(await sheetsLaundryService.fetchReservations()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.sharedRecordsId;
        if (!spreadsheetId) {
          throw new Error("Shared records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "laundry!A:I");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[LAUNDRY_COL.ID] === item.id);
          const row = new Array(9).fill("");
          row[LAUNDRY_COL.ID] = item.id;
          row[LAUNDRY_COL.RESIDENT_ID] = item.residentId || "";
          row[LAUNDRY_COL.DATE] = item.date || "";
          row[LAUNDRY_COL.TIME_START] = item.timeStart || "";
          row[LAUNDRY_COL.TIME_END] = item.timeEnd || "";
          row[LAUNDRY_COL.STATUS] = item.status || "ACTIVE";
          row[LAUNDRY_COL.CANCEL_REASON] = item.cancelReason || "";
          row[LAUNDRY_COL.CREATION_TIMESTAMP] = item.creationTimestamp || "";
          row[LAUNDRY_COL.CANCEL_TIMESTAMP] = item.cancelTimestamp || "";

          if (rowIndex !== -1) {
            updates.push({ range: `laundry!A${rowIndex + 1}:I${rowIndex + 1}`, values: [row] });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "laundry!A:I", newRows);
        }
      }
    );
  }
}

/**
 * Sync Payment Requests
 */
export async function syncPaymentRequests(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Payment Requests",
      async () => extractList(await sheetsPaymentRequestService.fetchPaymentRequests()),
      async () => extractList(await supabasePaymentRequestService.fetchPaymentRequests()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let resId = isUuid(item.residentId) ? item.residentId : null;
          if (!resId && item.residentId) {
            const mapped = emailToIdMap.get(item.residentId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              resId = mapped;
            }
          }
          if (resId && !validUserIds.has(resId)) {
            resId = null;
          }

          return {
            id: item.id,
            resident_id: resId,
            date: parseDbDate(item.date),
            water_fee: item.waterFee,
            assoc_fee: item.assocFee,
            misc: item.misc,
            mop: item.mop,
            type: item.type,
            proof_link: item.proofLink,
            status: item.status,
            notes: item.notes,
            status_reason: item.statusReason
          };
        });
        const { error } = await supabase.from("payment_requests").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Payment Requests",
      async () => extractList(await supabasePaymentRequestService.fetchPaymentRequests()),
      async () => extractList(await sheetsPaymentRequestService.fetchPaymentRequests()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.sharedRecordsId;
        if (!spreadsheetId) {
          throw new Error("Shared records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "payment_requests!A:L");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[PAYMENT_REQUEST_COL.ID] === item.id);
          const row = new Array(12).fill("");
          row[PAYMENT_REQUEST_COL.ID] = item.id;
          row[PAYMENT_REQUEST_COL.RESIDENT_ID] = item.residentId || "";
          row[PAYMENT_REQUEST_COL.DATE] = item.date || "";
          row[PAYMENT_REQUEST_COL.WATER_FEE] = String(item.waterFee || 0);
          row[PAYMENT_REQUEST_COL.ASSOC_FEE] = String(item.assocFee || 0);
          row[PAYMENT_REQUEST_COL.MISC] = String(item.misc || 0);
          row[PAYMENT_REQUEST_COL.MOP] = item.mop || "";
          row[PAYMENT_REQUEST_COL.TYPE] = item.type || "";
          row[PAYMENT_REQUEST_COL.PROOF_LINK] = item.proofLink || "";
          row[PAYMENT_REQUEST_COL.STATUS] = item.status || "PENDING";
          row[PAYMENT_REQUEST_COL.NOTES] = item.notes || "";
          row[PAYMENT_REQUEST_COL.STATUS_REASON] = item.statusReason || "";

          if (rowIndex !== -1) {
            updates.push({
              range: `payment_requests!A${rowIndex + 1}:L${rowIndex + 1}`,
              values: [row]
            });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "payment_requests!A:L", newRows);
        }
      }
    );
  }
}

/**
 * Sync Achievements
 */
export async function syncAchievements(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Achievements",
      async () => extractList(await sheetsAchievementService.fetchAchievements()),
      async () => extractList(await supabaseAchievementService.fetchAchievements()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let creatorId = isUuid(item.creatorId) ? item.creatorId : null;
          if (!creatorId && item.creatorId) {
            const mapped = emailToIdMap.get(item.creatorId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              creatorId = mapped;
            }
          }
          if (creatorId && !validUserIds.has(creatorId)) {
            creatorId = null;
          }

          return {
            id: item.id,
            creator_id: creatorId,
            name: item.name,
            description: item.description,
            icon: item.icon,
            extra_url: item.extraUrl,
            term: item.term,
            points: item.points
          };
        });
        const { error } = await supabase.from("achievements").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Achievements",
      async () => extractList(await supabaseAchievementService.fetchAchievements()),
      async () => extractList(await sheetsAchievementService.fetchAchievements()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.sharedRecordsId;
        if (!spreadsheetId) {
          throw new Error("Shared records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "achievements!A:H");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[ACHIEVEMENT_COL.ID] === item.id);
          const row = new Array(8).fill("");
          row[ACHIEVEMENT_COL.ID] = item.id;
          row[ACHIEVEMENT_COL.CREATOR_ID] = item.creatorId || "";
          row[ACHIEVEMENT_COL.NAME] = item.name || "";
          row[ACHIEVEMENT_COL.DESCRIPTION] = item.description || "";
          row[ACHIEVEMENT_COL.ICON] = item.icon || "";
          row[ACHIEVEMENT_COL.EXTRA_URL] = item.extraUrl || "";
          row[ACHIEVEMENT_COL.TERM] = item.term || "";
          row[ACHIEVEMENT_COL.POINTS] = String(item.points ?? 0);

          if (rowIndex !== -1) {
            updates.push({
              range: `achievements!A${rowIndex + 1}:H${rowIndex + 1}`,
              values: [row]
            });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "achievements!A:H", newRows);
        }
      }
    );
  }
}

/**
 * Sync Achievement Logs (Awards)
 */
export async function syncAwards(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    const validUserIds = await getValidUserUuidSet();
    const userList = extractList(await sheetsResidentService.fetchUsers(true));
    const emailToIdMap = new Map<string, string>();
    userList.forEach((u) => {
      if (u.email && u.id) {
        emailToIdMap.set(u.email.trim().toLowerCase(), u.id);
      }
    });

    return syncEntity(
      "Awards",
      async () => extractList(await sheetsAchievementService.fetchAchievementLogs()),
      async () => extractList(await supabaseAchievementService.fetchAchievementLogs()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => {
          let recorderId = isUuid(item.recorderId) ? item.recorderId : null;
          if (!recorderId && item.recorderId) {
            const mapped = emailToIdMap.get(item.recorderId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              recorderId = mapped;
            }
          }
          if (recorderId && !validUserIds.has(recorderId)) {
            recorderId = null;
          }

          let accountId = isUuid(item.accountId) ? item.accountId : null;
          if (!accountId && item.accountId) {
            const mapped = emailToIdMap.get(item.accountId.trim().toLowerCase());
            if (mapped && isUuid(mapped)) {
              accountId = mapped;
            }
          }
          if (accountId && !validUserIds.has(accountId)) {
            accountId = null;
          }

          return {
            id: item.id,
            recorder_id: recorderId,
            account_id: accountId,
            date: parseDbDate(item.date),
            achievement_id: isUuid(item.achievementId) ? item.achievementId : null,
            term: item.term
          };
        });
        const { error } = await supabase.from("achievement_records").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Awards",
      async () => extractList(await supabaseAchievementService.fetchAchievementLogs()),
      async () => extractList(await sheetsAchievementService.fetchAchievementLogs()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        const spreadsheetId = uiSettings.sharedRecordsId;
        if (!spreadsheetId) {
          throw new Error("Shared records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "achievement_records!A:F");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[ACHIEVEMENT_RECORD_COL.ID] === item.id);
          const row = new Array(6).fill("");
          row[ACHIEVEMENT_RECORD_COL.ID] = item.id;
          row[ACHIEVEMENT_RECORD_COL.RECORDER_ID] = item.recorderId || "";
          row[ACHIEVEMENT_RECORD_COL.ACCOUNT_ID] = item.accountId || "";
          row[ACHIEVEMENT_RECORD_COL.DATE] = item.date || "";
          row[ACHIEVEMENT_RECORD_COL.ACHIEVEMENT_ID] = item.achievementId || "";
          row[ACHIEVEMENT_RECORD_COL.TERM] = item.term || "";

          if (rowIndex !== -1) {
            updates.push({
              range: `achievement_records!A${rowIndex + 1}:F${rowIndex + 1}`,
              values: [row]
            });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "achievement_records!A:F", newRows);
        }
      }
    );
  }
}

/**
 * Sync Officers
 */
export async function syncOfficers(direction: SyncDirection): Promise<SyncResult> {
  if (direction === "toSupabase") {
    return syncEntity(
      "Officers",
      async () => extractList(await sheetsOfficerService.fetchOfficers()),
      async () => extractList(await supabaseOfficerService.fetchOfficers()),
      async (items) => {
        if (!supabase) {
          throw new Error("Supabase client not initialized");
        }
        const payload = items.map((item) => ({
          id: item.id,
          position: item.position,
          name: item.name,
          nickname: item.nickname,
          email: item.email,
          fb_link: item.fbLink,
          term: item.term,
          committee: item.committee,
          birthday: parseDbDate(item.birthday),
          status: item.status
        }));
        const { error } = await supabase.from("officers").upsert(payload);
        if (error) {
          throw error;
        }
      }
    );
  } else {
    return syncEntity(
      "Officers",
      async () => extractList(await supabaseOfficerService.fetchOfficers()),
      async () => extractList(await sheetsOfficerService.fetchOfficers()),
      async (items) => {
        const { uiSettings } = await import("$state/settings.svelte");
        // The live sheets officer service uses the "directory" sheet in the
        // RESIDENT RECORDS workbook, not "officers" in shared records.
        const spreadsheetId = uiSettings.residentRecordsId;
        if (!spreadsheetId) {
          throw new Error("Resident records ID not configured");
        }
        const rows = await fetchSheetRowsRaw(spreadsheetId, "directory!A:J");

        const updates: { range: string; values: any[][] }[] = [];
        const newRows: string[][] = [];

        for (const item of items) {
          const rowIndex = rows.findIndex((r) => r[OFFICER_COL.ID] === item.id);
          const row = new Array(10).fill("");
          row[OFFICER_COL.POSITION] = item.position || "";
          row[OFFICER_COL.NAME] = item.name || "";
          row[OFFICER_COL.NICKNAME] = item.nickname || "";
          row[OFFICER_COL.EMAIL] = item.email || "";
          row[OFFICER_COL.FB_LINK] = item.fbLink || "";
          row[OFFICER_COL.TERM] = item.term || "";
          row[OFFICER_COL.COMMITTEE] = item.committee || "";
          row[OFFICER_COL.BIRTHDAY] = item.birthday || "";
          row[OFFICER_COL.ID] = item.id;
          row[OFFICER_COL.STATUS] = item.status || "ACTIVE";

          if (rowIndex !== -1) {
            updates.push({ range: `directory!A${rowIndex + 1}:J${rowIndex + 1}`, values: [row] });
          } else {
            newRows.push(row);
          }
        }

        if (updates.length > 0) {
          await batchUpdateValues(spreadsheetId, updates);
        }
        if (newRows.length > 0) {
          await appendSheetRow(spreadsheetId, "directory!A:J", newRows);
        }
      }
    );
  }
}

/**
 * Bulk fetch counts for status display
 */
export async function fetchDatabaseStatus() {
  const [
    gsUsers,
    sbUsers,
    gsAcc,
    sbAcc,
    gsJour,
    sbJour,
    gsAnn,
    sbAnn,
    gsConst,
    sbConst,
    gsLau,
    sbLau,
    gsPay,
    sbPay,
    gsAch,
    sbAch,
    gsAwa,
    sbAwa,
    gsOff,
    sbOff
  ] = await Promise.all([
    sheetsResidentService.fetchUsers(true),
    supabaseResidentService.fetchUsers(),
    sheetsResidentService.fetchResidents(true),
    supabaseResidentService.fetchResidents(),
    fetchAllJournalEntries(sheetsJournalService),
    fetchAllJournalEntries(supabaseJournalService),
    sheetsAnnouncementService.fetchAnnouncements(),
    supabaseAnnouncementService.fetchAnnouncements(),
    sheetsConstantsService.fetchConstants(true),
    supabaseConstantsService.fetchConstants(),
    sheetsLaundryService.fetchReservations(),
    supabaseLaundryService.fetchReservations(),
    sheetsPaymentRequestService.fetchPaymentRequests(),
    supabasePaymentRequestService.fetchPaymentRequests(),
    sheetsAchievementService.fetchAchievements(),
    supabaseAchievementService.fetchAchievements(),
    sheetsAchievementService.fetchAchievementLogs(),
    supabaseAchievementService.fetchAchievementLogs(),
    sheetsOfficerService.fetchOfficers(),
    supabaseOfficerService.fetchOfficers()
  ]);

  return [
    {
      entity: "Users",
      gsheets: extractList(gsUsers).length,
      supabase: extractList(sbUsers).length
    },
    {
      entity: "Residents",
      gsheets: extractList(gsAcc).length,
      supabase: extractList(sbAcc).length
    },
    {
      entity: "Journal",
      gsheets: extractList(gsJour).length,
      supabase: extractList(sbJour).length
    },
    {
      entity: "Announcements",
      gsheets: extractList(gsAnn).length,
      supabase: extractList(sbAnn).length
    },
    { entity: "Constants", gsheets: gsConst.length, supabase: sbConst.length },
    {
      entity: "Laundry",
      gsheets: extractList(gsLau).length,
      supabase: extractList(sbLau).length
    },
    {
      entity: "Payment Requests",
      gsheets: extractList(gsPay).length,
      supabase: extractList(sbPay).length
    },
    {
      entity: "Achievements",
      gsheets: extractList(gsAch).length,
      supabase: extractList(sbAch).length
    },
    {
      entity: "Awards",
      gsheets: extractList(gsAwa).length,
      supabase: extractList(sbAwa).length
    },
    { entity: "Officers", gsheets: gsOff.length, supabase: sbOff.length }
  ];
}
