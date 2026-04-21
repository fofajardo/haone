<script lang="ts">
  import { onMount } from "svelte";
  import { decryptJSON } from "$lib/crypto";
  import { goto } from "$app/navigation";
  import StudentNumberAuthCard from "$lib/components/StudentNumberAuthCard.svelte";
  import ReceiptErrorCard from "$lib/components/receipt/ReceiptErrorCard.svelte";
  import { LS_KEYS } from "$lib/constants";
  import { pageState } from "$lib/page-info.svelte";

  let studentNo = $state("");
  let rememberMe = $state(false);
  let isDecrypting = $state(false);
  let error = $state("");

  onMount(() => {
    pageState.title = "Acknowledgment Receipt (Legacy)";

    const savedId = localStorage.getItem(LS_KEYS.STUDENT_NUMBER);
    if (savedId) {
      studentNo = savedId;
      rememberMe = true;
    }

    // Legacy hash support: redirect #data=... to ?data=...
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const encryptedData = params.get("data");
      if (encryptedData) {
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.set("data", encryptedData);
        window.location.replace(url.toString());
      }
    }
  });

  async function attemptDecryption() {
    const params = new URLSearchParams(window.location.search);
    const encryptedData = params.get("data");

    if (!encryptedData) {
      error = "Invalid or missing receipt data. No encrypted payload found.";
      return;
    }

    if (!studentNo) return;

    isDecrypting = true;
    error = "";
    try {
      const payload = await decryptJSON(encryptedData, studentNo);
      const prRefNo = payload.seriesNumber;

      if (rememberMe) {
        localStorage.setItem(LS_KEYS.STUDENT_NUMBER, studentNo);
      } else {
        localStorage.removeItem(LS_KEYS.STUDENT_NUMBER);
      }

      // Claim the secret ID via secure POST
      const resp = await fetch("/api/receipt/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_refno: prRefNo, stno: studentNo })
      });

      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Failed to verify receipt credentials.");
      }

      // Hand off student ID to avoid double prompt (cleared after use)
      sessionStorage.setItem(`receipt_handoff_${result.id}`, studentNo);

      // Redirect to the clean secret ID URL: /receipt/[id]
      goto(`/receipt/${result.id}`, { replaceState: true });
    } catch (e: any) {
      error = e.message;
    } finally {
      isDecrypting = false;
    }
  }
</script>

<main
  class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8"
>
  {#if !error}
    <StudentNumberAuthCard
      bind:studentNo
      bind:rememberMe
      {isDecrypting}
      onAuthenticate={attemptDecryption}
    />
  {:else}
    <ReceiptErrorCard
      {error}
      onRetry={() => {
        error = "";
      }}
    />
  {/if}
</main>
