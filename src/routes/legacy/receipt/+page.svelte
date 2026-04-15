<script lang="ts">
  import { onMount, tick } from "svelte";
  import { decryptJSON } from "$lib/crypto";
  import QRCode from "qrcode";
  import { jsPDF } from "jspdf";
  import html2canvas from "html2canvas";

  import ReceiptExportTemplate from "$lib/components/receipt/ReceiptExportTemplate.svelte";
  import ReceiptWebView from "$lib/components/receipt/ReceiptWebView.svelte";
  import ReceiptAuthCard from "$lib/components/receipt/ReceiptAuthCard.svelte";
  import ReceiptErrorCard from "$lib/components/receipt/ReceiptErrorCard.svelte";

  const HALSK_REMEMBER_STUDENT_NO = "halsk.student_number";

  let receiptData = $state<any>(null);
  let error = $state("");
  let studentNo = $state("");
  let rememberMe = $state(false);
  let isDecrypting = $state(false);
  let qrDataUrl = $state("");
  let isExporting = $state(false);

  onMount(() => {
    // Load saved student number if "Remember Me" was checked
    const savedId = localStorage.getItem(HALSK_REMEMBER_STUDENT_NO);
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
      receiptData = await decryptJSON(encryptedData, studentNo);

      // Save or clear student ID based on rememberMe preference
      if (rememberMe) {
        localStorage.setItem(HALSK_REMEMBER_STUDENT_NO, studentNo);
      } else {
        localStorage.removeItem(HALSK_REMEMBER_STUDENT_NO);
      }

      qrDataUrl = await QRCode.toDataURL(window.location.href, {
        margin: 1,
        width: 200,
        color: { dark: "#000000", light: "#ffffff" }
      });
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

  async function downloadPDF() {
    const templateElement = document.getElementById("export-template");
    if (!templateElement) {
      alert("Export content not found.");
      return;
    }

    isExporting = true;

    try {
      const canvas = await generateCanvas(templateElement);
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();

      const imgData = canvas.toDataURL("image/png");
      const props = pdf.getImageProperties(imgData);
      const imgHeight = (props.height * pageWidth) / props.width;

      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, imgHeight);
      pdf.save(`Receipt_${receiptData.seriesNumber}.pdf`);
    } catch (e: any) {
      console.error("Export failed:", e);
      alert(`Export failed: ${e.message}.`);
    } finally {
      isExporting = false;
    }
  }

  async function downloadImage() {
    const templateElement = document.getElementById("export-template");
    if (!templateElement) {
      alert("Export content not found.");
      return;
    }

    isExporting = true;

    try {
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
      alert(`Export failed: ${e.message}.`);
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main
  class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8"
>
  {#if !receiptData && !error}
    <ReceiptAuthCard
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
    />
    <ReceiptExportTemplate {receiptData} {qrDataUrl} />
  {/if}
</main>
