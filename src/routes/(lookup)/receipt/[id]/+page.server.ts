import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import {
  FEE_CODE_LABELS,
  FEE_CODES,
  type FeeCode,
  type ReceiptData,
  type ReceiptItem
} from "$lib/types";
import { parseCSVAmount } from "$utils/math";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  return {
    receiptData: null,
    id
  };
};

export const actions: Actions = {
  verify: async ({ request, params }) => {
    const formData = await request.formData();
    const stno = formData.get("stno")?.toString().trim();
    const id = params.id;

    if (!stno || !id) {
      return fail(400, { error: "Missing verification data" });
    }

    try {
      const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

      const { data: receiptRow, error: receiptErr } = await supabase
        .from("acknowledgment_receipts")
        .select("*")
        .or(`id.eq.${id},group_id.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (receiptErr) {
        console.error("Receipt lookup failed:", receiptErr);
        return fail(500, { error: "Internal verification error" });
      }

      const targetGroupId = receiptRow?.group_id || id;

      const { data: groupRow, error: groupErr } = await supabase
        .from("journal_groups")
        .select("*")
        .eq("id", targetGroupId)
        .maybeSingle();

      if (groupErr) {
        console.error("Journal group lookup failed:", groupErr);
        return fail(500, { error: "Internal verification error" });
      }

      if (!groupRow) {
        return fail(404, { error: "Transaction record not found" });
      }

      const { data: groupRows, error: rowErr } = await supabase
        .from("journal")
        .select("*")
        .eq("group_id", groupRow.id)
        .order("fee_code", { ascending: true });

      if (rowErr) {
        console.error("Journal lookup failed:", rowErr);
        return fail(500, { error: "Internal verification error" });
      }

      let receipt = receiptRow;
      if (!receipt) {
        const { data: groupReceipt } = await supabase
          .from("acknowledgment_receipts")
          .select("*")
          .eq("group_id", groupRow.id)
          .maybeSingle();
        receipt = groupReceipt;
      }

      const userIds = [groupRow.account_id, groupRow.creator_id].filter(Boolean);
      let accountUser: any = null;
      let creatorUser: any = null;

      if (userIds.length > 0) {
        const { data: users, error: usersErr } = await supabase
          .from("users")
          .select("*")
          .in("id", userIds);

        if (usersErr) {
          console.error("User lookup failed:", usersErr);
          return fail(500, { error: "Internal verification error" });
        }

        accountUser = (users || []).find((u) => u.id === groupRow.account_id) || null;
        creatorUser = (users || []).find((u) => u.id === groupRow.creator_id) || null;
      }

      const receivedBy = creatorUser
        ? creatorUser.display_name || creatorUser.display_name_fl || "N/A"
        : "N/A";

      const receivedFrom = accountUser
        ? accountUser.display_name || accountUser.display_name_fl || "N/A"
        : "N/A";

      const correctStNo = accountUser ? (accountUser.student_no || "").toString().trim() : "";

      if (stno === correctStNo) {
        const prRefNo = receipt?.id || "";
        const totalsByCode = new Map<FeeCode, number>();

        for (const r of groupRows || []) {
          const val = parseCSVAmount(r.value);
          const code = Number(r.fee_code) as FeeCode;
          totalsByCode.set(code, (totalsByCode.get(code) || 0) + val);
        }

        const items: ReceiptItem[] = FEE_CODES.map((code) => ({
          name: FEE_CODE_LABELS[code],
          amount: totalsByCode.get(code) || 0
        })).filter((item) => item.amount !== 0);

        const receiptData: ReceiptData = {
          dateIssued: receipt?.date_issued || new Date().toISOString().split("T")[0],
          paymentDate: groupRow.date,
          processor: groupRow.mop || "",
          referenceNumber: groupRow.mop_ref_no || "N/A",
          period: groupRow.period || "",
          seriesNumber: prRefNo,
          receivedFrom,
          receivedBy,
          notes: groupRow.notes || "",
          transactionType: groupRow.type || "",
          branding: "default",
          stno: correctStNo || "",
          items
        };

        return { success: true, receiptData };
      }

      return fail(401, { error: "Student number does not match this record" });
    } catch (e: any) {
      console.error("Verification action failed:", e);
      return fail(500, { error: "Internal verification error" });
    }
  }
};
