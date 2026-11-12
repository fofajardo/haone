import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { OfficerStatus } from "$lib/types";
import { createClient } from "@supabase/supabase-js";
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id;

  return {
    clearanceData: null,
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

      const { data: row, error: accErr } = await supabase
        .from("accounts")
        .select("*")
        .eq("ce_ref_no", id)
        .maybeSingle();

      if (accErr) {
        console.error("Clearance account query failed:", accErr);
        return fail(500, { error: "Internal verification error" });
      }

      if (!row) {
        return fail(404, { error: "Clearance record not found" });
      }

      const resId = row.resident_id;
      const { data: user, error: userErr } = await supabase
        .from("users")
        .select("*")
        .eq("id", resId)
        .maybeSingle();

      if (userErr) {
        console.error("Clearance user query failed:", userErr);
        return fail(500, { error: "Internal verification error" });
      }

      if (!user) {
        return fail(404, { error: "Resident profile not found" });
      }

      const correctStNo = (user.student_no || "").toString().trim();
      if (stno === correctStNo) {
        const issuerId = row.issuer_id;
        const period = row.period || "";

        let signatory = "HOUSE COUNCIL OFFICER";
        let signatoryTitle = "Officer";

        if (issuerId) {
          const { data: issuerUser } = await supabase
            .from("users")
            .select("*")
            .eq("id", issuerId)
            .maybeSingle();

          if (issuerUser) {
            signatory =
              issuerUser.display_name_fl || issuerUser.display_name || "HOUSE COUNCIL OFFICER";

            const { data: officer } = await supabase
              .from("officers")
              .select("*")
              .eq("resident_id", issuerUser.id)
              .eq("term", period)
              .eq("status", OfficerStatus.ACTIVE)
              .limit(1)
              .maybeSingle();

            if (officer && officer.position) {
              signatoryTitle = officer.position;
            }
          }
        }

        const clearanceData = {
          name: user.display_name_fl || user.display_name,
          stno: correctStNo,
          period: period,
          dateIssued: row.ce_issued || "",
          refNo: row.ce_ref_no || "",
          branding: "default",
          signatory,
          signatoryTitle
        };

        return { success: true, clearanceData };
      }

      return fail(401, { error: "Student number does not match this record" });
    } catch (e: any) {
      console.error("Verification action failed:", e);
      return fail(500, { error: "Internal verification error" });
    }
  }
};
