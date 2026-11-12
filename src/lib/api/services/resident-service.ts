import type { ResidentRecord, UserRecord } from "$lib/types";
import {
  AccountType,
  JOURNAL_ACCOUNT_KIND_CONFIG,
  JOURNAL_ACCOUNT_KINDS,
  TRANSACTION_TYPE_CONFIG,
  TransactionType
} from "$lib/types";
import { auth } from "$state/auth.svelte";
import { parseCSVAmount } from "$utils/math";
import { parseDateWeight, parseDbDate, parseDbUuid } from "$utils/parsers";
import { assertSupabaseFound, fetchAllSupabaseRows, handleSupabaseError, supabase } from "./common";
import { constantsService } from "./constants-service";

export interface ResidentServiceInterface {
  fetchResidents(bypassCache?: boolean, term?: string): Promise<ResidentRecord[]>;
  fetchResidentStatus(term?: string, bypassCache?: boolean): Promise<any>;
  changeAccountType(residentId: string, period: string, newType: string): Promise<void>;
  fetchUsers(bypassCache?: boolean): Promise<UserRecord[]>;
  updateUser(userId: string, data: Partial<UserRecord>): Promise<void>;
  addUser(data: Partial<UserRecord>): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void>;
  registerResident(data: Record<string, any>): Promise<void>;
}

function mapDbUserToUserRecord(u: any): UserRecord {
  if (!u) {
    return {} as UserRecord;
  }
  return {
    id: u.id,
    email: u.email,
    lastName: u.last_name || "",
    firstName: u.first_name || "",
    middleName: u.middle_name || "",
    suffix: u.suffix || "",
    overrideName: u.override_name || "",
    displayName: u.display_name || "",
    displayNameFormal: u.display_name_fl || "",
    studentNo: u.student_no || "",
    secondaryContact: u.secondary_contact || "",
    address: u.address || "",
    college: u.college || "",
    program: u.degree_program || "",
    tags: Array.isArray(u.tags) ? u.tags.join(":") : u.tags || "",
    notes: u.notes || "",
    raw: u
  };
}

function mapUserRecordToDb(data: Partial<UserRecord>): Record<string, any> {
  const payload: Record<string, any> = {};
  if (data.email !== undefined) {
    payload.email = data.email.trim().toLowerCase();
  }
  if (data.lastName !== undefined) {
    payload.last_name = data.lastName.trim().toUpperCase();
  }
  if (data.firstName !== undefined) {
    payload.first_name = data.firstName.trim().toUpperCase();
  }
  if (data.middleName !== undefined) {
    payload.middle_name = data.middleName.trim().toUpperCase();
  }
  if (data.suffix !== undefined) {
    payload.suffix = data.suffix.trim().toUpperCase();
  }
  if (data.overrideName !== undefined) {
    payload.override_name = data.overrideName.trim();
  }
  if (data.studentNo !== undefined) {
    payload.student_no = data.studentNo;
  }
  if (data.secondaryContact !== undefined) {
    payload.secondary_contact = data.secondaryContact;
  }
  if (data.address !== undefined) {
    payload.address = data.address;
  }
  if (data.college !== undefined) {
    payload.college = data.college;
  }
  if (data.program !== undefined) {
    payload.degree_program = data.program;
  }
  if (data.tags !== undefined) {
    payload.tags = data.tags
      ? data.tags
          .split(/[,:]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
  }
  if (data.notes !== undefined) {
    payload.notes = data.notes;
  }
  return payload;
}

export const residentService: ResidentServiceInterface = {
  async fetchResidents(_bypassCache = false, term?: string): Promise<ResidentRecord[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;

    const [accData, usersData, journalGroups, journalItems, consts] = await Promise.all([
      fetchAllSupabaseRows(() => {
        let query = sb.from("accounts").select("*");
        if (term && !auth.isResident) {
          query = query.eq("period", term);
        }
        return query.order("created_at", { ascending: true }).order("id", { ascending: true });
      }),
      fetchAllSupabaseRows(() =>
        sb.from("users_view").select("*").order("id", { ascending: true })
      ),
      fetchAllSupabaseRows(() =>
        sb
          .from("journal_groups")
          .select("*")
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
      constantsService.fetchConstants()
    ]);

    const groupMap = new Map<string, any>();
    journalGroups.forEach((g: any) => {
      groupMap.set(g.id, g);
    });
    const journalList = journalItems
      .map((item: any) => {
        const g = groupMap.get(item.group_id);
        if (!g) {
          return null;
        }
        return {
          ...g,
          id: item.id,
          group_id: item.group_id,
          account_kind: item.account_kind,
          value: item.value
        };
      })
      .filter(Boolean);

    let currentUserId: string | null = null;
    if (auth.isResident && auth.user) {
      currentUserId = auth.userId;
    }

    const targetAccounts = currentUserId
      ? accData.filter((a: any) => a.resident_id === currentUserId)
      : accData;

    const userMap = new Map<string, any>();
    usersData.forEach((u: any) => {
      userMap.set(u.id, u);
    });

    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "0";
    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;
    const isWaivedEntry = (t: string) =>
      t === pmtWaived || (t && t.toUpperCase().includes("WAIVED"));

    const result = targetAccounts
      .map((row: any) => {
        const u = userMap.get(row.resident_id) || {};
        const period = row.period || "";
        const resId = (row.resident_id || "").toLowerCase();

        const filtered = journalList.filter((j: any) => {
          if (j.period !== period) {
            return false;
          }
          const accId = (j.account_id || "").toLowerCase().trim();
          return (resId && accId === resId) || (u.id && accId === u.id.toLowerCase());
        });

        const financials: Record<string, number> = {};
        let totalBase = 0;
        let paid = 0;
        let waived = 0;

        for (const kind of JOURNAL_ACCOUNT_KINDS) {
          const cfg = JOURNAL_ACCOUNT_KIND_CONFIG[kind];
          if (cfg.baseField && cfg.paidField && cfg.waivedField && cfg.balanceField) {
            const kindPaid = filtered
              .filter((j: any) => Number(j.account_kind) === kind && !isWaivedEntry(j.type || ""))
              .reduce((sum: number, j: any) => sum + parseCSVAmount(j.value), 0);
            const kindWaived = filtered
              .filter((j: any) => Number(j.account_kind) === kind && isWaivedEntry(j.type || ""))
              .reduce((sum: number, j: any) => sum + parseCSVAmount(j.value), 0);
            const kindBase = parseCSVAmount(getConst(`FEES_${period}_${cfg.key}`));

            financials[cfg.baseField] = kindBase;
            financials[cfg.paidField] = kindPaid;
            financials[cfg.waivedField] = kindWaived;
            financials[cfg.balanceField] = kindBase - kindPaid - kindWaived;

            totalBase += kindBase;
            paid += kindPaid;
            waived += kindWaived;
          }
        }
        const bal = totalBase - paid - waived;

        return {
          id: row.id,
          residentId: row.resident_id || "",
          period: period,
          room: row.room || "",
          bed: row.bed || "",
          ceRefNo: row.ce_ref_no || "",
          ceIssued: row.ce_issued || "",
          ceLink: row.ce_link || "",
          notes: row.account_notes || "",
          issuerId: row.issuer_id || "",
          checkInDate: row.check_in_date || "",
          type: row.type || "",
          email: u.email || "",
          name: u.display_name || "",
          stno: u.student_no || "",
          ...(financials as any),
          totalBase,
          paid,
          waived,
          bal,
          isFullyPaid: bal <= 0,
          college: u.college || "",
          program: u.degree_program || "",
          ceFullName: u.display_name_fl || "",
          ledgerId: row.id,
          raw: row
        };
      })
      .filter((r: any) => r.residentId && r.residentId !== "") as ResidentRecord[];

    if (auth.isResident) {
      result.sort((a, b) => b.period.localeCompare(a.period));
    }

    return result;
  },

  async fetchResidentStatus(term?: string, _bypassCache = false): Promise<any> {
    if (!supabase) {
      return null;
    }

    const email = (auth.user?.email || "").toLowerCase().trim();
    const sb = supabase;

    const { data: userRow, error: userErr } = await supabase
      .from("users_view")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (userErr) {
      handleSupabaseError(userErr);
    }

    const [consts, academicTerms] = await Promise.all([
      constantsService.fetchConstants(),
      constantsService.fetchTerms()
    ]);
    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "";
    const activeTerm = getConst("TERM_CURR");
    const targetTerm = term || activeTerm;

    const [accRes, journalGroups, journalItems, currRes, termAccRes, receiptsList] =
      await Promise.all([
        userRow
          ? supabase.from("accounts").select("*").eq("resident_id", userRow.id)
          : Promise.resolve({ data: [], error: null }),
        userRow?.id
          ? fetchAllSupabaseRows(() =>
              sb
                .from("journal_groups")
                .select("*")
                .eq("account_id", userRow.id)
                .order("created_at", { ascending: true })
                .order("id", { ascending: true })
            )
          : Promise.resolve([]),
        userRow?.id
          ? fetchAllSupabaseRows(() =>
              sb
                .from("journal")
                .select("*")
                .order("created_at", { ascending: true })
                .order("id", { ascending: true })
            )
          : Promise.resolve([]),
        supabase
          .from("registrations")
          .select("*")
          .ilike("email", email)
          .eq("term", activeTerm)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("accounts").select("resident_id, room, bed, period").eq("period", targetTerm),
        userRow?.id
          ? fetchAllSupabaseRows(() => sb.from("acknowledgment_receipts").select("*"))
          : Promise.resolve([])
      ]);
    if (accRes.error) {
      handleSupabaseError(accRes.error);
    }
    if (currRes.error) {
      handleSupabaseError(currRes.error);
    }
    if (termAccRes.error) {
      handleSupabaseError(termAccRes.error);
    }

    const currentUser = userRow || null;
    const userAccounts: any[] = accRes.data || [];
    const currEntryData = currRes.data;

    const statusGroupMap = new Map<string, any>();
    (journalGroups || []).forEach((g: any) => {
      statusGroupMap.set(g.id, g);
    });
    const journalList = (journalItems || [])
      .map((item: any) => {
        const g = statusGroupMap.get(item.group_id);
        if (!g) {
          return null;
        }
        return {
          ...g,
          id: item.id,
          group_id: item.group_id,
          account_kind: item.account_kind,
          value: item.value
        };
      })
      .filter(Boolean);

    const receiptMap = new Map<string, any>();
    (receiptsList || []).forEach((r: any) => {
      if (r.group_id) {
        receiptMap.set(r.group_id, r);
      }
    });

    const groupedTransactions = new Map<string, any>();
    for (const j of journalList) {
      if (term && j.period !== term) {
        continue;
      }
      const groupKey = j.group_id || j.id;
      const val = parseCSVAmount(j.value);
      const existing = groupedTransactions.get(groupKey);
      if (existing) {
        existing.amount += val;
        continue;
      }
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

      groupedTransactions.set(groupKey, {
        id: groupKey,
        date: j.date,
        type: j.type || "",
        amount: val,
        period: j.period || "",
        mop: j.mop || "",
        notes: j.notes || "",
        creator: j.creator_id || j.creator_email || "",
        receipt,
        runningBalance: 0
      });
    }
    const transactions = Array.from(groupedTransactions.values());

    let globalBalance = 0;
    const sortedTransactions = [...transactions].sort(
      (a, b) => parseDateWeight(a.date) - parseDateWeight(b.date)
    );
    for (const t of sortedTransactions) {
      if (!t.type.toUpperCase().includes("WAIVED")) {
        globalBalance += t.amount;
      }
      t.runningBalance = globalBalance;
    }

    const pmtWaived = TRANSACTION_TYPE_CONFIG[TransactionType.WAIVED].val;
    const termJournals = journalList.filter((j: any) => j.period === targetTerm);

    const financials: Record<string, number> = {};
    let totalBase = 0;
    let paid = 0;
    let waived = 0;

    for (const kind of JOURNAL_ACCOUNT_KINDS) {
      const cfg = JOURNAL_ACCOUNT_KIND_CONFIG[kind];
      if (cfg.baseField && cfg.paidField && cfg.waivedField && cfg.balanceField) {
        const kindPaid = termJournals
          .filter((j: any) => Number(j.account_kind) === kind && j.type !== pmtWaived)
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.value), 0);
        const kindWaived = termJournals
          .filter((j: any) => Number(j.account_kind) === kind && j.type === pmtWaived)
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.value), 0);
        const kindBase = parseCSVAmount(getConst(`FEES_${targetTerm}_${cfg.key}`));

        financials[cfg.baseField] = kindBase;
        financials[cfg.paidField] = kindPaid;
        financials[cfg.waivedField] = kindWaived;
        financials[cfg.balanceField] = kindBase - kindPaid - kindWaived;

        totalBase += kindBase;
        paid += kindPaid;
        waived += kindWaived;
      }
    }
    const bal = totalBase - paid - waived;

    const targetAccount = userAccounts.find((a: any) => a.period === targetTerm) || null;

    const allTerms = [...new Set(journalList.map((j: any) => j.period).filter(Boolean))];
    if (activeTerm && !allTerms.includes(activeTerm)) {
      allTerms.push(activeTerm);
    }

    const mopTypes = consts
      .filter((c) => c.key.startsWith("MOP_"))
      .map((c) => ({ value: c.value || c.key, label: c.description || c.value || c.key }));

    const isEvaluated = currEntryData?.evaluated ?? false;

    const college = currentUser ? (currentUser.college || "").split(",").pop()?.trim() || "" : "";
    const program = currentUser
      ? (currentUser.degree_program || "").split(":").pop()?.trim() || ""
      : "";

    return {
      isRegistered: !!(currentUser?.first_name && currentUser?.last_name),
      hasExistingAccounts: userAccounts.length > 0,
      hasActiveAccount: !!targetAccount,
      waitingForConfirmation: !!(currEntryData && !isEvaluated),
      activeTerm: targetTerm,
      systemActiveTerm: activeTerm,
      hasAcademicTerms: academicTerms.length > 0,
      allTerms: allTerms.sort().reverse(),
      mopTypes,
      profile: currentUser
        ? {
            id: currentUser.id,
            email: currentUser.email,
            firstName: currentUser.first_name || "",
            lastName: currentUser.last_name || "",
            studentNo: currentUser.student_no || "",
            college,
            program,
            tags: Array.isArray(currentUser.tags)
              ? currentUser.tags.join(",")
              : currentUser.tags || "",
            suffix: currentUser.suffix || "",
            overrideName: currentUser.override_name || ""
          }
        : null,
      account: targetAccount
        ? {
            email: currentUser?.email || "",
            period: targetAccount.period || "",
            room: targetAccount.room || "",
            bed: targetAccount.bed || "",
            checkInDate: targetAccount.check_in_date || "",
            name: currentUser?.display_name || "",
            stno: currentUser?.student_no || "",
            ...(financials as any),
            totalBase,
            paid,
            waived,
            bal,
            isFullyPaid: bal <= 0,
            ceRefNo: targetAccount.ce_ref_no || "",
            ceIssued: targetAccount.ce_issued || "",
            ceLink: targetAccount.ce_link || "",
            college,
            program,
            type: (targetAccount.type || "").trim().toUpperCase()
          }
        : null,
      currEntry: currEntryData
        ? {
            room: currEntryData.room || "",
            bed: currEntryData.bed || "",
            lastName: currEntryData.last_name || "",
            firstName: currEntryData.first_name || "",
            college: currEntryData.college || "",
            program: currEntryData.program || "",
            studentNo: currEntryData.student_no || "",
            accountType: (currEntryData.account_type || "").trim().toUpperCase(),
            suffix: currEntryData.suffix || "",
            overrideName: currEntryData.override_name || "",
            declineReason: (
              currEntryData.decline_reason ||
              currEntryData.declination_reason ||
              ""
            ).trim(),
            isEvaluated
          }
        : null,
      transactions: sortedTransactions.reverse(),
      occupiedBeds: (termAccRes.data || [])
        .filter((a: any) => a.room && a.bed && (!currentUser || a.resident_id !== currentUser.id))
        .map((a: any) => ({ room: (a.room || "").trim(), bed: (a.bed || "").trim() }))
    };
  },

  async changeAccountType(residentId: string, period: string, newType: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase
      .from("accounts")
      .update({ type: newType })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "Account row not found.");
  },

  async fetchUsers(_bypassCache = false): Promise<UserRecord[]> {
    if (!supabase) {
      return [];
    }
    const sb = supabase;
    const viewName = auth.isResident ? "resident_directory" : "users_view";
    const data = await fetchAllSupabaseRows(() =>
      sb.from(viewName).select("*").order("id", { ascending: true })
    );
    return data.map(mapDbUserToUserRecord);
  },

  async updateUser(userId: string, data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    const { data: updated, error } = await supabase
      .from("users")
      .update(payload)
      .eq("id", userId)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "User not found");
  },

  async addUser(data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    payload.id = data.id || crypto.randomUUID();
    const { error } = await supabase.from("users").insert(payload);
    if (error) {
      handleSupabaseError(error);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { data, error } = await supabase.from("users").delete().eq("id", userId).select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(data, "User not found in database");
  },

  async updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void> {
    if (!supabase) {
      return;
    }

    const { data: updated, error } = await supabase
      .from("accounts")
      .update({
        ce_ref_no: data.refNo,
        ce_issued: parseDbDate(data.dateString),
        ce_link: data.publicLink,
        issuer_id: parseDbUuid(data.issuerId)
      })
      .eq("resident_id", residentId)
      .eq("period", period)
      .select("id");
    if (error) {
      handleSupabaseError(error);
    }
    assertSupabaseFound(updated, "Resident account not found");
  },

  async registerResident(data: Record<string, any>): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client uninitialized");
    }

    const targetEmail = (data.email || "").toLowerCase();
    if (!targetEmail) {
      throw new Error("Missing email");
    }

    const resolvedAccountType = data.accountType || AccountType.STUDENT;

    if (!targetEmail.endsWith("@up.edu.ph") && resolvedAccountType === AccountType.STUDENT) {
      throw new Error("Only @up.edu.ph email addresses are allowed for student accounts.");
    }

    const [academicTerms, activeTerm] = await Promise.all([
      constantsService.fetchTerms(),
      constantsService.fetchConstantByKey("TERM_CURR") ?? ""
    ]);
    if (academicTerms.length === 0 || !activeTerm) {
      throw new Error(
        "Onboarding is currently unavailable because no active academic term is configured."
      );
    }

    const { data: userRows, error: userErr } = await supabase
      .from("users_view")
      .select("id")
      .ilike("email", targetEmail);
    if (userErr) {
      handleSupabaseError(userErr);
    }

    const targetUserId = userRows?.[0]?.id;
    let hasPreviousAccounts = false;
    if (targetUserId) {
      const { data: accCheck, error: accErr } = await supabase
        .from("accounts")
        .select("id")
        .eq("resident_id", targetUserId)
        .neq("period", activeTerm)
        .limit(1);
      if (accErr) {
        handleSupabaseError(accErr);
      }
      hasPreviousAccounts = (accCheck || []).length > 0;
    }

    let finalStudentNo = data.studentNo;
    if (resolvedAccountType !== AccountType.STUDENT && !data.studentNo) {
      const randomUuid = crypto.randomUUID();
      finalStudentNo = `${resolvedAccountType}-${activeTerm}-${randomUuid}`;
    }

    const evaluated = resolvedAccountType === AccountType.ALUMNUS && hasPreviousAccounts;

    const { error: currErr } = await supabase.from("registrations").insert({
      email: targetEmail,
      room: data.room || "",
      bed: data.bed || "",
      last_name: (data.lastName || "").trim().toUpperCase(),
      first_name: (data.firstName || "").trim().toUpperCase(),
      college: data.college || "",
      program: data.program || "",
      student_no: finalStudentNo || "",
      check_in_date: parseDbDate(data.checkInDate),
      evaluated: evaluated,
      term: activeTerm,
      account_type: resolvedAccountType,
      suffix: (data.suffix || "").trim().toUpperCase(),
      override_name: (data.overrideName || "").trim().toUpperCase()
    });

    if (currErr) {
      handleSupabaseError(currErr);
    }
  }
};
