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
  import type { PageData } from "./$types";

  let { data } = $props<{ data: PageData }>();

  let receiptData = $state<ReceiptData | null>(null);
  let error = $state("");

  $effect(() => {
    receiptData = data.receiptData;
    if (data.error) error = data.error;
  });

  let studentNo = $state("");
  let rememberMe = $state(false);
  let isDecrypting = $state(false);
  let qrDataUrl = $state("");
  let isExporting = $state(false);

  // AlertDialog State
  let alertState = $state({ open: false, title: "", description: "" });

  $effect(() => {
    if (receiptData) {
      const profile = branding[receiptData.branding as keyof typeof branding] || branding.default;
      pageState.title = `${profile.issuerName} - Acknowledgment Receipt`;
    }
  });

  function showAlert(title: string, description: string) {
    alertState.title = title;
    alertState.description = description;
    alertState.open = true;
  }

  onMount(async () => {
    // Generate QR if we already have data from server
    if (receiptData) {
      qrDataUrl = await QRCode.toDataURL(window.location.href, {
        margin: 1,
        width: 200,
        color: { dark: "#000000", light: "#ffffff" }
      });
    }

    // Load saved student number if "Remember Me" was checked
    const savedId = localStorage.getItem(LS_KEYS.STUDENT_NUMBER);
    if (savedId) {
      studentNo = savedId;
      rememberMe = true;
    }

    // Legacy support: redirect #data=... to ?data=...
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(hash);
      const encryptedData = params.get("data");
      if (encryptedData) {
        // Remove hash, redirect to query param
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.set("data", encryptedData);
        window.location.replace(url.toString());
      }
    }
  });

  async function attemptDecryption() {
    // Use query param for encrypted data
    const params = new URLSearchParams(window.location.search);
    const encryptedData = params.get("data");

    if (!encryptedData) {
      error = "Invalid or missing receipt data.";
      return;
    }

    if (!studentNo) return;

    isDecrypting = true;
    error = "";
    try {
      const payload = await decryptJSON(encryptedData, studentNo);
      const prRefNo = payload.seriesNumber;

      // Save student ID for persistence if requested
      if (rememberMe) {
        localStorage.setItem(LS_KEYS.STUDENT_NUMBER, studentNo);
      } else {
        localStorage.removeItem(LS_KEYS.STUDENT_NUMBER);
      }

      // Claim the secret ID via secure POST to avoid query param exposure
      const resp = await fetch("/api/receipt/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_refno: prRefNo, stno: studentNo })
      });

      const result = await resp.json();
      if (!resp.ok) {
        throw new Error(result.error || "Failed to verify receipt credentials.");
      }

      // Redirect to the clean secret ID URL
      const url = new URL(window.location.href);
      url.searchParams.set("id", result.id);
      url.searchParams.delete("data");
      window.location.href = url.toString();
    } catch (e: any) {
      error = e.message;
      receiptData = null;
    } finally {
      isDecrypting = false;
    }
  }

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
  {#if !receiptData && !error}
    <StudentNumberAuthCard
      bind:studentNo
      bind:rememberMe
      {isDecrypting}
      onAuthenticate={attemptDecryption}
    />
  {:else if error}
    <ReceiptErrorCard
      {error}
      onRetry={() => {
        error = "";
        receiptData = null;
      }}
    />
  {:else if receiptData}
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
