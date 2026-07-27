import type { ResidentServiceInterface } from "../interfaces/resident-service.interface";
import type { ResidentRecord, UserRecord } from "$lib/types";
import { supabase } from "../common";
import { constantsService } from "../constants-service";
import { parseCSVAmount } from "$utils/math";

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
    tags: Array.isArray(u.tags) ? u.tags.join(",") : u.tags || "",
    notes: u.notes || "",
    raw: u
  };
}

function mapUserRecordToDb(data: Partial<UserRecord>): Record<string, any> {
  const payload: Record<string, any> = {};
  if (data.email !== undefined) {
    payload.email = data.email;
  }
  if (data.lastName !== undefined) {
    payload.last_name = data.lastName;
  }
  if (data.firstName !== undefined) {
    payload.first_name = data.firstName;
  }
  if (data.middleName !== undefined) {
    payload.middle_name = data.middleName;
  }
  if (data.suffix !== undefined) {
    payload.suffix = data.suffix;
  }
  if (data.overrideName !== undefined) {
    payload.override_name = data.overrideName;
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
    payload.tags = data.tags ? data.tags.split(",") : [];
  }
  if (data.notes !== undefined) {
    payload.notes = data.notes;
  }
  return payload;
}

export const supabaseResidentService: ResidentServiceInterface = {
  async fetchResidents(_forceRefresh = false, term?: string): Promise<ResidentRecord[]> {
    if (!supabase) {
      return [];
    }

    let accQuery = supabase.from("accounts").select("*");
    if (term) {
      accQuery = accQuery.eq("period", term);
    }

    const [accRes, usersRes, journalRes, consts] = await Promise.all([
      accQuery,
      supabase.from("users_view").select("*"),
      supabase.from("journal").select("*"),
      constantsService.fetchConstants()
    ]);

    if (accRes.error) {
      throw accRes.error;
    }
    if (usersRes.error) {
      throw usersRes.error;
    }

    const userMap = new Map<string, any>();
    (usersRes.data || []).forEach((u: any) => {
      userMap.set(u.id, u);
    });

    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "0";
    const pmtWaived = getConst("PMT_WAIVED") || "PMT_WAIVED";
    const isWaivedEntry = (t: string) =>
      t === pmtWaived || (t && t.toUpperCase().includes("WAIVED"));

    const journalList = journalRes.data || [];

    const result = (accRes.data || [])
      .map((row: any) => {
        const u = userMap.get(row.resident_id) || {};
        const period = row.period || "";
        const email = (u.email || "").toLowerCase().trim();
        const stno = (u.student_no || "").toLowerCase().trim();

        const filtered = journalList.filter((j: any) => {
          if (j.period !== period) {
            return false;
          }
          const acc = (j.account_email || "").toLowerCase().trim();
          return (email && acc === email) || (stno && acc === stno);
        });

        const waterPaid = filtered
          .filter((j: any) => !isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);
        const waterWaived = filtered
          .filter((j: any) => isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.water), 0);

        const assocPaid = filtered
          .filter((j: any) => !isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);
        const assocWaived = filtered
          .filter((j: any) => isWaivedEntry(j.type || ""))
          .reduce((sum: number, j: any) => sum + parseCSVAmount(j.assoc), 0);

        const miscPaid = filtered.reduce((sum: number, j: any) => sum + parseCSVAmount(j.misc), 0);

        const waterBase = parseCSVAmount(getConst(`FEES_${period}_WATER`));
        const assocBase = parseCSVAmount(getConst(`FEES_${period}_ASSOC`));

        const waterBal = waterBase - waterPaid - waterWaived;
        const assocBal = assocBase - assocPaid - assocWaived;
        const totalBase = waterBase + assocBase;
        const paid = waterPaid + assocPaid + miscPaid;
        const waived = waterWaived + assocWaived;
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
          type: row.type || "STUDENT",
          email: u.email || "",
          name: u.display_name || "",
          stno: u.student_no || "Missing Student Number",
          waterBase,
          waterPaid,
          waterWaived,
          waterBal,
          assocBase,
          assocPaid,
          assocWaived,
          assocBal,
          totalBase,
          paid,
          waived,
          bal,
          isFullyPaid: bal <= 0,
          college: u.college || "",
          program: u.degree_program || "",
          ceFullName: "",
          ledgerId: row.id,
          raw: row
        };
      })
      .filter((r: any) => Boolean(r.residentId || r.id)) as ResidentRecord[];

    if (term && result.length === 0) {
      return this.fetchResidents(_forceRefresh, undefined);
    }
    return result;
  },

  async fetchResidentStatus(email: string, term?: string, _forceRefresh = false): Promise<any> {
    if (!supabase) {
      return null;
    }

    const { data: userRow, error: userErr } = await supabase
      .from("users_view")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (userErr) {
      throw userErr;
    }

    const [accRes, journalRes, currRes, consts] = await Promise.all([
      userRow
        ? supabase.from("accounts").select("*").eq("resident_id", userRow.id)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("journal").select("*").eq("account_email", email),
      supabase
        .from("curr")
        .select("*")
        .eq("email", email)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
      constantsService.fetchConstants()
    ]);

    const currentUser = userRow
      ? {
          ...userRow,
          accounts: accRes.data || [],
          journal: journalRes.data || []
        }
      : null;

    const currEntryData = currRes.data;

    const getConst = (k: string) => consts.find((c) => c.key === k)?.value || "";
    const activeTerm = getConst("TERM_CURR");
    const targetTerm = term || activeTerm;

    const userAccounts: any[] = currentUser?.accounts || [];
    const userJournals: any[] = currentUser?.journal || [];

    const termJournals = userJournals.filter((j) => j.period === targetTerm);

    const pmtWaived = getConst("PMT_WAIVED") || "PMT_WAIVED";
    const waterBase = parseCSVAmount(getConst(`FEES_${targetTerm}_WATER`));
    const assocBase = parseCSVAmount(getConst(`FEES_${targetTerm}_ASSOC`));

    let waterPaid = 0;
    let waterWaived = 0;
    let assocPaid = 0;
    let assocWaived = 0;
    let miscPaid = 0;

    for (const j of termJournals) {
      const isWaived = j.type === pmtWaived || (j.type || "").toUpperCase().includes("WAIVED");
      if (isWaived) {
        waterWaived += parseCSVAmount(j.water);
        assocWaived += parseCSVAmount(j.assoc);
      } else {
        waterPaid += parseCSVAmount(j.water);
        assocPaid += parseCSVAmount(j.assoc);
      }
      miscPaid += parseCSVAmount(j.misc);
    }

    const totalBase = waterBase + assocBase;
    const paid = waterPaid + assocPaid + miscPaid;
    const waived = waterWaived + assocWaived;
    const bal = totalBase - paid - waived;

    const targetAccount = userAccounts.find((a) => a.period === targetTerm) || null;

    const allTerms = [...new Set(userJournals.map((j) => j.period).filter(Boolean))];
    if (activeTerm && !allTerms.includes(activeTerm)) {
      allTerms.push(activeTerm);
    }

    const transactionTypes = consts
      .filter((c) => c.key.startsWith("PMT_"))
      .map((c) => ({ value: c.value || c.key, label: c.description || c.value || c.key }));

    const mopTypes = consts
      .filter((c) => c.key.startsWith("MOP_"))
      .map((c) => ({ value: c.value || c.key, label: c.description || c.value || c.key }));

    const mappedProfile = currentUser ? mapDbUserToUserRecord(currentUser) : null;
    const isEvaluated = currEntryData?.evaluated ?? false;

    return {
      isRegistered: !!currentUser,
      hasActiveAccount: !!targetAccount,
      waitingForConfirmation: !!(currEntryData && !isEvaluated),
      activeTerm: targetTerm,
      systemActiveTerm: activeTerm,
      allTerms: allTerms.sort().reverse(),
      transactionTypes,
      mopTypes,
      profile: mappedProfile,
      account: targetAccount
        ? {
            room: targetAccount.room || "",
            bed: targetAccount.bed || "",
            period: targetAccount.period || "",
            ceRefNo: targetAccount.ce_ref_no || "",
            ceIssued: targetAccount.ce_issued || "",
            ceLink: targetAccount.ce_link || "",
            issuerId: targetAccount.issuer_id || "",
            type: targetAccount.type || "STUDENT"
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
            accountType: currEntryData.account_type || "STUDENT",
            suffix: currEntryData.suffix || "",
            overrideName: currEntryData.override_name || "",
            isEvaluated
          }
        : null,
      transactions: termJournals.map((j) => ({
        id: j.id,
        date: j.date,
        type: j.type,
        amount: parseCSVAmount(j.water) + parseCSVAmount(j.assoc) + parseCSVAmount(j.misc),
        period: j.period,
        mop: j.mop,
        notes: j.notes,
        creator: j.creator_email,
        prRefNo: j.pr_ref_no,
        runningBalance: 0
      })),
      occupiedBeds: []
    };
  },

  async changeAccountType(residentId: string, period: string, newType: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase
      .from("accounts")
      .update({ type: newType })
      .eq("resident_id", residentId)
      .eq("period", period);
    if (error) {
      throw error;
    }
  },

  async fetchUsers(_forceRefresh = false): Promise<UserRecord[]> {
    if (!supabase) {
      return [];
    }
    const { data, error } = await supabase.from("users_view").select("*");
    if (error) {
      throw error;
    }
    return (data || []).map(mapDbUserToUserRecord);
  },

  async updateUser(userId: string, data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    const { error } = await supabase.from("users").update(payload).eq("id", userId);
    if (error) {
      throw error;
    }
  },

  async addUser(data: Partial<UserRecord>): Promise<void> {
    if (!supabase) {
      return;
    }
    const payload = mapUserRecordToDb(data);
    if (data.id) {
      payload.id = data.id;
    }
    const { error } = await supabase.from("users").insert(payload);
    if (error) {
      throw error;
    }
  },

  async addUsersBatch(users: Partial<UserRecord>[]): Promise<void> {
    if (!supabase) {
      return;
    }
    const rows = users.map((u) => {
      const payload = mapUserRecordToDb(u);
      if (u.id) {
        payload.id = u.id;
      }
      return payload;
    });
    const { error } = await supabase.from("users").insert(rows);
    if (error) {
      throw error;
    }
  },

  async deleteUser(userId: string): Promise<void> {
    if (!supabase) {
      return;
    }
    const { error } = await supabase.from("users").delete().eq("id", userId);
    if (error) {
      throw error;
    }
  },

  async updateClearance(
    residentId: string,
    period: string,
    data: { refNo: string; dateString: string; publicLink: string; issuerId: string }
  ): Promise<void> {
    if (!supabase) {
      return;
    }
    const { parseDbDate, parseDbUuid } = await import("$utils/parsers");

    const { error } = await supabase
      .from("accounts")
      .update({
        ce_ref_no: data.refNo,
        ce_issued: parseDbDate(data.dateString),
        ce_link: data.publicLink,
        issuer_id: parseDbUuid(data.issuerId)
      })
      .eq("resident_id", residentId)
      .eq("period", period);
    if (error) {
      throw error;
    }
  },

  async registerResident(data: Record<string, any>): Promise<void> {
    if (!supabase) {
      throw new Error("Supabase client uninitialized");
    }

    const { AccountType } = await import("$lib/types");
    const { parseDbDate } = await import("$utils/parsers");
    const targetEmail = (data.email || "").toLowerCase();
    if (!targetEmail) {
      throw new Error("Missing email");
    }

    const resolvedAccountType = data.accountType || AccountType.STUDENT;

    if (!targetEmail.endsWith("@up.edu.ph") && resolvedAccountType === AccountType.STUDENT) {
      throw new Error("Only @up.edu.ph email addresses are allowed for student accounts.");
    }

    const { data: constData } = await supabase
      .from("constants")
      .select("value")
      .eq("key", "TERM_CURR")
      .maybeSingle();
    const activeTerm = constData?.value || "";

    const { data: userRows } = await supabase.from("users").select("id").eq("email", targetEmail);

    const isAlreadyRegistered = (userRows || []).length > 0;

    let finalStudentNo = data.studentNo;
    if (resolvedAccountType !== AccountType.STUDENT && !data.studentNo) {
      const randomUuid = crypto.randomUUID();
      finalStudentNo = `${resolvedAccountType}-${activeTerm}-${randomUuid}`;
    }

    const evaluated = resolvedAccountType === AccountType.ALUMNUS && isAlreadyRegistered;

    const { error: currErr } = await supabase.from("curr").insert({
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
      throw currErr;
    }
  }
};
