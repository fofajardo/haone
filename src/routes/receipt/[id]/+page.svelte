<script lang="ts">
  import { onMount, tick } from "svelte";
  import { decryptJSON } from "$lib/crypto";
  import QRCode from "qrcode";
  import html2canvas from "html2canvas";
  import branding from "$lib/branding.json";

  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import ReceiptExportTemplate from "$lib/components/receipt/ReceiptExportTemplate.svelte";
  import ReceiptWebView from "$lib/components/receipt/ReceiptWebView.svelte";
  import StudentNumberAuthCard from "$lib/components/StudentNumberAuthCard.svelte";
  import ReceiptErrorCard from "$lib/components/receipt/ReceiptErrorCard.svelte";

  import { LS_KEYS } from "$lib/constants";

  import { pageState } from "$lib/page-info.svelte";
  import type { ReceiptData } from "$lib/types";
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";

  let { data, form } = $props<{ data: PageData; form: ActionData }>();

  let receiptData = $state<ReceiptData | null>(null);
  let error = $state("");

  $effect(() => {
    if (form?.success) {
      receiptData = form.receiptData;
    } else {
      receiptData = data.receiptData;
    }
    if (data.error) error = data.error;
  });

  let studentNo = $state("");
  let rememberMe = $state(false);
  let isChecking = $state(false);
  let isVerified = $derived(!!receiptData);
  let qrDataUrl = $state("");
  let isExporting = $state(false);

  // AlertDialog State
  let alertState = $state({ open: false, title: "", description: "" });

  $effect(() => {
    if (receiptData && isVerified) {
      const profile = branding[receiptData.branding as keyof typeof branding] || branding.default;
      pageState.title = `${profile.issuerName} - Acknowledgment Receipt`;

      // Generate QR if we verified
      QRCode.toDataURL(window.location.href, {
        margin: 1,
        width: 200,
        color: { dark: "#000000", light: "#ffffff" }
      }).then((url) => (qrDataUrl = url));
    }
  });

  function showAlert(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    // Load saved student number if "Remember Me" was checked
    const savedId = localStorage.getItem(LS_KEYS.STUDENT_NUMBER);
    if (savedId) {
      studentNo = savedId;
      rememberMe = true;
    }

    // Check for session-handed-off ID (avoids double auth prompt)
    const handedOffId = sessionStorage.getItem(`receipt_handoff_${data.id}`);
    if (handedOffId) {
      studentNo = handedOffId;
      sessionStorage.removeItem(`receipt_handoff_${data.id}`);
      await tick();
      const formEl = document.getElementById("auth-form") as HTMLFormElement;
      if (formEl) formEl.requestSubmit();
    }
  });

  function noop() {}

  async function generateCanvas(element: HTMLElement) {
    const images = Array.from(element.querySelectorAll("img"));
    await Promise.all(
      images.map(
        (i) =>
          new Promise((r) => {
            if (i.complete) {
              r(null);
            } else {
              i.onload = r;
              i.onerror = r;
            }
          })
      )
    );

    await tick();
    await new Promise((r) => setTimeout(r, 400));

    return await html2canvas(element, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 210 * 3.7795275591
    });
  }

  import { exportReceiptPDF } from "$lib/receipt-pdf";

  async function downloadPDF() {
    if (!receiptData) {
      return;
    }

    isExporting = true;

    try {
      await exportReceiptPDF(receiptData, qrDataUrl);
    } catch (e: any) {
      console.error("pdfmake export failed:", e);
      showAlert("Export Error", `The PDF generation failed: ${e.message}`);
    } finally {
      isExporting = false;
    }
  }

  async function downloadImage() {
    const templateElement = document.getElementById("export-template");
    if (!templateElement) {
      showAlert("Export Error", "Export template content not found.");
      return;
    }

    isExporting = true;

    try {
      if (!receiptData) {
        throw new Error("Receipt data missing");
      }
      const canvas = await generateCanvas(templateElement);
      const imgData = canvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = imgData;
      link.download = `Receipt_${receiptData.seriesNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      console.error("Export failed:", e);
      showAlert("Export Error", `The image generation failed: ${e.message}`);
    } finally {
      isExporting = false;
    }
  }

  async function shareLink() {
    if (!receiptData) {
      return;
    }
    const shareData = {
      title: "Acknowledgment Receipt",
      text: `Receipt for ${receiptData.receivedFrom}`,
      url: window.location.href
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showAlert("Link Copied", "The receipt link has been copied to your clipboard.");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }
  }

  async function shareQRCode() {
    if (!qrDataUrl || !receiptData) {
      return;
    }

    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], `QR_${receiptData.seriesNumber}.png`, { type: "image/png" });

      const shareData = {
        files: [file],
        title: "Verification QR Code",
        text: `Scan to verify receipt ${receiptData.seriesNumber}`
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        throw new Error("Sharing not supported");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Fallback: Download
        const link = document.createElement("a");
        link.href = qrDataUrl;
        link.download = `QR_${receiptData.seriesNumber}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }
</script>

<main
  class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8"
>
  {#if !isVerified && !error}
    <form
      id="auth-form"
      method="POST"
      action="?/verify"
      class="w-full max-w-sm"
      use:enhance={() => {
        isChecking = true;
        return async ({ result, update }) => {
          isChecking = false;
          if (result.type === "success") {
            if (rememberMe) {
              localStorage.setItem(LS_KEYS.STUDENT_NUMBER, studentNo);
            } else {
              localStorage.removeItem(LS_KEYS.STUDENT_NUMBER);
            }
          } else if (result.type === "failure") {
            error = (result.data as any)?.error || "Verification failed";
          }
          await update();
        };
      }}
    >
      <input type="hidden" name="stno" value={studentNo} />
      <input type="hidden" name="remember" value={rememberMe ? "on" : ""} />
      <StudentNumberAuthCard
        bind:studentNo
        bind:rememberMe
        isDecrypting={isChecking}
        onAuthenticate={() => {
          const form = document.getElementById("auth-form") as HTMLFormElement;
          if (form) form.requestSubmit();
        }}
      />
    </form>
  {:else if error}
    <ReceiptErrorCard
      {error}
      onRetry={() => {
        error = "";
      }}
    />
  {:else if receiptData && isVerified}
    <ReceiptWebView
      {receiptData}
      {qrDataUrl}
      {isExporting}
      onDownloadPDF={downloadPDF}
      onDownloadImage={downloadImage}
      onShareLink={shareLink}
      onShareQR={shareQRCode}
    />
    <ReceiptExportTemplate {receiptData} {qrDataUrl} />
  {/if}
</main>

<AlertDialog.Root bind:open={alertState.open}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{alertState.title}</AlertDialog.Title>
      <AlertDialog.Description>
        {alertState.description}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (alertState.open = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
