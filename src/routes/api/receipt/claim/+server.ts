import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from "$env/static/public";
import { createClient } from "@supabase/supabase-js";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { pr_refno, stno } = await request.json();

    if (!pr_refno || !stno) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const targetStno = stno.trim();
    const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY);

    // Find the user by student number
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, student_no")
      .eq("student_no", targetStno)
      .maybeSingle();

    if (userErr) {
      console.error("Receipt claim user lookup error:", userErr);
      return json({ error: "Internal server error" }, { status: 500 });
    }

    if (!user) {
      return json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    // Find the journal row with this pr_ref_no and matching account_id
    const { data: row, error: jorErr } = await supabase
      .from("journal")
      .select("id")
      .eq("pr_ref_no", pr_refno)
      .eq("account_id", user.id)
      .maybeSingle();

    if (jorErr) {
      console.error("Receipt claim journal lookup error:", jorErr);
      return json({ error: "Internal server error" }, { status: 500 });
    }

    if (!row) {
      return json({ error: "Transaction not found or unauthorized" }, { status: 404 });
    }

    return json({ id: row.id });
  } catch (e: any) {
    console.error("Receipt claim failed:", e);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
