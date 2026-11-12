import {
  FeeCode,
  type JournalItem,
  type JournalRecord,
  type PaginatedResponse,
  type PaginationOptions
} from "$lib/types";
import { auth } from "$state/auth.svelte";
import { parseCSVAmount } from "$utils/math";
import { getLocalDateString, isUuid, parseDbDate } from "$utils/parsers";
import { assertSupabaseFound, fetchAllSupabaseRows, handleSupabaseError, supabase } from "./common";

export interface JournalFilters {
  term?: string;
  type?: string;
  mop?: string;
  accountId?: string;
}

export interface JournalServiceInterface {
  fetchJournalEntries(
    filters?: JournalFilters,
    options?: PaginationOptions,
    bypassCache?: boolean
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>>;

  addJournalEntry(data: Partial<JournalRecord>): Promise<void>;

  updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void>;

  deleteJournalEntry(id: string): Promise<void>;

  batchAuditEntries(ids: string[]): Promise<void>;
}

function applyFilters(query: any, filters?: JournalFilters) {
  if (filters?.term) {
    query = query.eq("period", filters.term);
  }
  if (filters?.type) {
    query = query.eq("type", filters.type);
  }
  if (filters?.mop) {
    query = query.eq("mop", filters.mop);
  }
  if (filters?.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},creator_id.eq.${filters.accountId}`);
  }
  return query;
}

export function buildJournalInsertPayload(
  data: Partial<JournalRecord>,
  creatorId: string | null,
  accountId: string | null
): { groupRow: Record<string, any>; itemRows: Record<string, any>[] } {
  const groupId = data.id && isUuid(data.id) ? data.id : crypto.randomUUID();
  const groupRow = {
    id: groupId,
    date: parseDbDate(data.date) || getLocalDateString(),
    creator_id: creatorId && isUuid(creatorId) ? creatorId : null,
    account_id: accountId && isUuid(accountId) ? accountId : null,
    mop: data.mop,
    period: data.period,
    type: data.type,
    notes: data.notes,
    notes_private: data.notesPrivate,
    mop_ref_no: data.mopRefNo,
    was_audited: data.wasAudited ?? false
  };

  const active = (data.items || []).filter((item) => item.value !== 0);
  const itemsToInsert = active.length > 0 ? active : [{ feeCode: FeeCode.WATER, value: 0 }];
  const itemRows = itemsToInsert.map((item) => ({
    id: item.id && isUuid(item.id) ? item.id : crypto.randomUUID(),
    group_id: groupId,
    fee_code: item.feeCode,
    value: item.value
  }));
  return { groupRow, itemRows };
}

export async function syncAcknowledgmentReceipt(
  groupId: string,
  data: Partial<JournalRecord>
): Promise<void> {
  if (!supabase || !groupId || !isUuid(groupId)) {
    return;
  }

  if (data.receipt === undefined) {
    return;
  }

  if (data.receipt === null) {
    const { error: delErr } = await supabase
      .from("acknowledgment_receipts")
      .delete()
      .eq("group_id", groupId);
    if (delErr) {
      handleSupabaseError(delErr);
    }
    return;
  }

  const rawRefNo = (data.receipt.id ?? "").trim();
  const rawDateIssued = parseDbDate(data.receipt.dateIssued || undefined);
  const rawReceiptUrl = (data.receipt.receiptUrl ?? "").trim();
  const storedReceiptUrl =
    rawReceiptUrl && !rawReceiptUrl.includes("/receipt/") ? rawReceiptUrl : null;

  const { data: existing, error: findErr } = await supabase
    .from("acknowledgment_receipts")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  if (findErr) {
    handleSupabaseError(findErr);
  }

  if (existing) {
    const updPayload: Record<string, any> = {};
    if (isUuid(rawRefNo)) {
      updPayload.id = rawRefNo;
    }
    if (data.receipt.dateIssued !== undefined) {
      updPayload.date_issued = rawDateIssued;
    }
    if (data.receipt.receiptUrl !== undefined) {
      updPayload.receipt_url = storedReceiptUrl;
    }
    if (Object.keys(updPayload).length > 0) {
      const { error: uErr } = await supabase
        .from("acknowledgment_receipts")
        .update(updPayload)
        .eq("group_id", groupId);
      if (uErr) {
        handleSupabaseError(uErr);
      }
    }
  } else {
    const receiptId = isUuid(rawRefNo) ? rawRefNo : crypto.randomUUID();
    const { error: iErr } = await supabase.from("acknowledgment_receipts").insert({
      id: receiptId,
      group_id: groupId,
      date_issued: rawDateIssued,
      receipt_url: storedReceiptUrl
    });
    if (iErr) {
      handleSupabaseError(iErr);
    }
  }
}

export const journalService: JournalServiceInterface = {
  async fetchJournalEntries(
    filters?: JournalFilters,
    options?: PaginationOptions,
    _bypassCache?: boolean
  ): Promise<JournalRecord[] | PaginatedResponse<JournalRecord>> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;

    const isPaginated = !!(options?.page && options?.pageSize);

    const [groups, itemRows, usersRes, receipts] = await Promise.all([
      fetchAllSupabaseRows(() =>
        applyFilters(sb.from("journal_groups").select("*"), filters)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      fetchAllSupabaseRows(() =>
        sb
          .from("journal")
          .select("*")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
      ),
      supabase.from("users_view").select("id, email, display_name, student_no"),
      fetchAllSupabaseRows(() => sb.from("acknowledgment_receipts").select("*"))
    ]);

    if (usersRes.error) {
      handleSupabaseError(usersRes.error);
    }

    const userMap = new Map<string, any>();
    (usersRes.data || []).forEach((u: any) => {
      if (u.id) {
        userMap.set(u.id.toLowerCase().trim(), u);
      }
      if (u.email) {
        userMap.set(u.email.toLowerCase().trim(), u);
      }
    });

    const receiptMap = new Map<string, any>();
    (receipts || []).forEach((r: any) => {
      if (r.group_id) {
        receiptMap.set(r.group_id, r);
      }
    });

    const itemsByGroup = new Map<string, JournalItem[]>();
    for (const row of itemRows) {
      const groupKey = row.group_id || row.id;
      const val = parseCSVAmount(row.value);
      const code = Number(row.fee_code) as FeeCode;
      const list = itemsByGroup.get(groupKey) || [];
      const existingItem = list.find((item) => item.feeCode === code);
      if (existingItem) {
        existingItem.value += val;
      } else {
        list.push({ id: row.id, groupId: groupKey, feeCode: code, value: val });
      }
      itemsByGroup.set(groupKey, list);
    }

    const allItems: JournalRecord[] = [];

    for (const group of groups) {
      const groupKey = group.id;
      const items = itemsByGroup.get(groupKey) || [];
      const amount = items.reduce((sum, item) => sum + item.value, 0);

      const accountId = (group.account_id || "").toLowerCase().trim();
      const creatorId = (group.creator_id || "").toLowerCase().trim();
      const accountUser = userMap.get(accountId);
      const creatorUser = userMap.get(creatorId);
      const receiptRow = receiptMap.get(groupKey);

      const dateIssued = receiptRow?.date_issued || "";
      const rawReceiptUrl = (receiptRow?.receipt_url || "").trim();
      const receiptUrl =
        rawReceiptUrl || (receiptRow && dateIssued ? `/receipt/${receiptRow.id}` : "");
      const receipt = receiptRow
        ? {
            id: receiptRow.id,
            groupId: groupKey,
            dateIssued,
            receiptUrl
          }
        : null;

      allItems.push({
        id: groupKey,
        items,
        receipt,
        date: group.date,
        creator: creatorUser?.email || "",
        account: accountUser?.email || "",
        amount,
        mop: group.mop || "",
        period: group.period || "",
        type: group.type || "",
        notes: group.notes || "",
        notesPrivate: group.notes_private || "",
        mopRefNo: group.mop_ref_no || "",
        creatorName: creatorUser?.display_name || "",
        name: accountUser?.display_name || "",
        stno: accountUser?.student_no || "",
        wasAudited: group.was_audited || false,
        creatorId: group.creator_id || undefined,
        accountId: group.account_id || undefined,
        raw: group
      });
    }

    if (auth.isResident) {
      for (const item of allItems) {
        item.notesPrivate = "";
        if (item.receipt) {
          item.receipt.receiptUrl = "";
        }
      }
    }

    if (isPaginated) {
      const count = allItems.length;
      const start = (options!.page! - 1) * options!.pageSize!;
      const end = start + options!.pageSize!;
      const items = allItems.slice(start, end);
      return {
        items,
        totalCount: count,
        page: options!.page!,
        pageSize: options!.pageSize!,
        totalPages: Math.ceil(count / options!.pageSize!)
      };
    }

    return allItems;
  },

  async addJournalEntry(data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    let creatorId = data.creatorId;
    if (!creatorId && data.creator) {
      if (isUuid(data.creator)) {
        creatorId = data.creator;
      } else {
        const { data: u } = await supabase
          .from("users_view")
          .select("id")
          .ilike("email", data.creator.trim())
          .maybeSingle();
        if (u?.id) {
          creatorId = u.id;
        }
      }
    }

    let accountId = data.accountId;
    if (!accountId && data.account) {
      if (isUuid(data.account)) {
        accountId = data.account;
      } else {
        const { data: u } = await supabase
          .from("users_view")
          .select("id")
          .or(`email.ilike.${data.account.trim()},student_no.ilike.${data.account.trim()}`)
          .maybeSingle();
        if (u?.id) {
          accountId = u.id;
        }
      }
    }

    const { groupRow, itemRows } = buildJournalInsertPayload(
      data,
      creatorId || null,
      accountId || null
    );

    const { error: groupErr } = await supabase.from("journal_groups").insert(groupRow);
    if (groupErr) {
      handleSupabaseError(groupErr);
    }

    const { error: itemErr } = await supabase.from("journal").insert(itemRows);
    if (itemErr) {
      await supabase.from("journal_groups").delete().eq("id", groupRow.id);
      handleSupabaseError(itemErr);
    }

    await syncAcknowledgmentReceipt(groupRow.id, data);
  },

  async updateJournalEntry(id: string, data: Partial<JournalRecord>): Promise<void> {
    if (!supabase) {
      return;
    }

    let targetGroupId = id;
    const { data: groupCheck, error: gFindErr } = await supabase
      .from("journal_groups")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (gFindErr) {
      handleSupabaseError(gFindErr);
    }

    if (!groupCheck) {
      const { data: itemCheck, error: iFindErr } = await supabase
        .from("journal")
        .select("group_id")
        .eq("id", id)
        .maybeSingle();
      if (iFindErr) {
        handleSupabaseError(iFindErr);
      }
      assertSupabaseFound(itemCheck ? [itemCheck] : [], "Journal entry not found");
      targetGroupId = itemCheck!.group_id;
    }

    await syncAcknowledgmentReceipt(targetGroupId, data);

    const payload: Record<string, any> = {};
    if (data.date !== undefined) {
      payload.date = parseDbDate(data.date);
    }
    if (data.creatorId !== undefined || data.creator !== undefined) {
      let cId = data.creatorId;
      if (!cId && data.creator) {
        if (isUuid(data.creator)) {
          cId = data.creator;
        } else {
          const { data: u } = await supabase
            .from("users_view")
            .select("id")
            .ilike("email", data.creator.trim())
            .maybeSingle();
          if (u?.id) {
            cId = u.id;
          }
        }
      }
      payload.creator_id = cId && isUuid(cId) ? cId : null;
    }
    if (data.accountId !== undefined || data.account !== undefined) {
      let aId = data.accountId;
      if (!aId && data.account) {
        if (isUuid(data.account)) {
          aId = data.account;
        } else {
          const { data: u } = await supabase
            .from("users_view")
            .select("id")
            .or(`email.ilike.${data.account.trim()},student_no.ilike.${data.account.trim()}`)
            .maybeSingle();
          if (u?.id) {
            aId = u.id;
          }
        }
      }
      payload.account_id = aId && isUuid(aId) ? aId : null;
    }
    if (data.mop !== undefined) {
      payload.mop = data.mop;
    }
    if (data.period !== undefined) {
      payload.period = data.period;
    }
    if (data.type !== undefined) {
      payload.type = data.type;
    }
    if (data.notes !== undefined) {
      payload.notes = data.notes;
    }
    if (data.notesPrivate !== undefined) {
      payload.notes_private = data.notesPrivate;
    }
    if (data.mopRefNo !== undefined) {
      payload.mop_ref_no = data.mopRefNo;
    }
    if (data.wasAudited !== undefined) {
      payload.was_audited = data.wasAudited;
    }

    if (Object.keys(payload).length > 0) {
      const { error: updErr } = await supabase
        .from("journal_groups")
        .update(payload)
        .eq("id", targetGroupId);
      if (updErr) {
        handleSupabaseError(updErr);
      }
    }

    const hasFeeUpdates = data.items !== undefined;
    if (!hasFeeUpdates) {
      return;
    }

    const { data: existingRows, error: rowsErr } = await supabase
      .from("journal")
      .select("*")
      .eq("group_id", targetGroupId);
    if (rowsErr) {
      handleSupabaseError(rowsErr);
    }

    const rawDesired = (data.items || []).filter((item) => item.value !== 0);
    const desired =
      rawDesired.length > 0
        ? rawDesired.map((item) => ({ code: item.feeCode, val: item.value }))
        : [{ code: FeeCode.WATER, val: 0 }];

    const desiredCodes = new Set(desired.map((d) => d.code));
    const existingByCode = new Map<number, any>();
    for (const r of existingRows || []) {
      existingByCode.set(Number(r.fee_code), r);
    }

    const idsToDelete = (existingRows || [])
      .filter((r) => !desiredCodes.has(Number(r.fee_code) as FeeCode))
      .map((r) => r.id);

    for (const item of desired) {
      const match = existingByCode.get(item.code);
      if (match) {
        const { error: uErr } = await supabase
          .from("journal")
          .update({
            fee_code: item.code,
            value: item.val
          })
          .eq("id", match.id);
        if (uErr) {
          handleSupabaseError(uErr);
        }
      } else {
        const { error: iErr } = await supabase.from("journal").insert({
          id: crypto.randomUUID(),
          group_id: targetGroupId,
          fee_code: item.code,
          value: item.val
        });
        if (iErr) {
          handleSupabaseError(iErr);
        }
      }
    }

    if (idsToDelete.length > 0) {
      const { error: dErr } = await supabase.from("journal").delete().in("id", idsToDelete);
      if (dErr) {
        handleSupabaseError(dErr);
      }
    }
  },

  async deleteJournalEntry(id: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("journal_groups")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Journal entry not found");
  },

  async batchAuditEntries(ids: string[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const validIds = ids.filter((id) => isUuid(id));
    if (validIds.length === 0) {
      return;
    }
    const { error } = await supabase
      .from("journal_groups")
      .update({ was_audited: true })
      .in("id", validIds);
    if (error) {
      handleSupabaseError(error);
    }
  }
};
