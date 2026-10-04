import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import type { ReceiptData, ReceiptItem } from "$lib/types";
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

      const { data: row, error: rowErr } = await supabase
        .from("journal")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (rowErr) {
        console.error("Journal lookup failed:", rowErr);
        return fail(500, { error: "Internal verification error" });
      }

      if (!row) {
        return fail(404, { error: "Transaction record not found" });
      }

      const userIds = [row.account_id, row.creator_id].filter(Boolean);
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

        accountUser = (users || []).find((u) => u.id === row.account_id) || null;
        creatorUser = (users || []).find((u) => u.id === row.creator_id) || null;
      }

      const receivedBy = creatorUser
        ? creatorUser.display_name || creatorUser.display_name_fl || "N/A"
        : "N/A";

      const receivedFrom = accountUser
        ? accountUser.display_name || accountUser.display_name_fl || "N/A"
        : "N/A";

      const correctStNo = accountUser ? (accountUser.student_no || "").toString().trim() : "";

      if (stno === correctStNo) {
        const prRefNo = row.pr_ref_no || "";
        const items: ReceiptItem[] = [];
        const water = parseCSVAmount(row.water);
        const assoc = parseCSVAmount(row.assoc);
        const misc = parseCSVAmount(row.misc);

        if (water !== 0) {
          items.push({ name: "Water Fee", amount: water });
        }
        if (assoc !== 0) {
          items.push({ name: "Association Fee", amount: assoc });
        }
        if (misc !== 0) {
          items.push({ name: "Miscellaneous", amount: misc });
        }

        const receiptData: ReceiptData = {
          dateIssued: row.pr_date_issued || new Date().toISOString().split("T")[0],
          paymentDate: row.date,
          processor: row.mop || "",
          referenceNumber: row.mop_ref_no || "N/A",
          period: row.period || "",
          seriesNumber: prRefNo,
          receivedFrom,
          receivedBy,
          notes: row.notes || "",
          transactionType: row.type || "",
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
