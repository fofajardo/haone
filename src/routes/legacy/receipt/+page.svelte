<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { decryptJSON } from '$lib/crypto';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import { Lock, CircleAlert, Download, StickyNote, ReceiptText } from 'lucide-svelte';
	import QRCode from 'qrcode';
	import { jsPDF } from 'jspdf';
	import html2canvas from 'html2canvas';

	let data = $state<any>(null);
	let error = $state('');
	let studentNo = $state('');
	let isDecrypting = $state(false);
	let qrDataUrl = $state('');
	let isExporting = $state(false);

	onMount(() => {
		// Clear any legacy cached keys for security
		localStorage.removeItem('receipt_secret_key');
	});

	async function attemptDecryption() {
		const hash = window.location.hash.substring(1);
		const params = new URLSearchParams(hash);
		const encryptedData = params.get('data');

		if (!encryptedData) {
			error = 'Invalid or missing receipt data.';
			return;
		}

		if (!studentNo) return;

		isDecrypting = true;
		error = '';
		try {
			data = await decryptJSON(encryptedData, studentNo);

			qrDataUrl = await QRCode.toDataURL(window.location.href, {
				margin: 1,
				width: 200,
				color: { dark: '#000000', light: '#ffffff' }
			});
		} catch (e: any) {
			error = e.message;
			data = null;
		} finally {
			isDecrypting = false;
		}
	}

	async function downloadPDF() {
		const templateElement = document.getElementById('export-template');
		if (!templateElement) {
			alert('Export content not found.');
			return;
		}

		isExporting = true;

		try {
			const pdf = new jsPDF('p', 'mm', 'a4');
			const pageWidth = pdf.internal.pageSize.getWidth();

			const images = Array.from(templateElement.querySelectorAll('img'));
			await Promise.all(
				images.map((i) =>
					i.complete
						? Promise.resolve()
						: new Promise((r) => {
								i.onload = r;
								i.onerror = r;
							})
				)
			);

			await tick();
			await new Promise((r) => setTimeout(r, 400));

			const canvas = await html2canvas(templateElement, {
				scale: 3,
				useCORS: true,
				logging: false,
				backgroundColor: '#ffffff',
				windowWidth: 210 * 3.7795275591
			});

			const imgData = canvas.toDataURL('image/png');
			const props = pdf.getImageProperties(imgData);
			const imgHeight = (props.height * pageWidth) / props.width;

			pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, imgHeight);
			pdf.save(`Receipt_${data.seriesNumber}.pdf`);
		} catch (e: any) {
			console.error('Export failed:', e);
			alert(`Export failed: ${e.message}.`);
		} finally {
			isExporting = false;
		}
	}

	function formatCurrency(amount: number) {
		return amount.toLocaleString('en-PH', {
			style: 'currency',
			currency: 'PHP'
		});
	}

	function getTotal() {
		if (!data?.items) return 0;
		return data.items.reduce((sum: number, item: any) => sum + item.amount, 0);
	}

	function translateMop(mop: string) {
		const val = mop?.trim().toUpperCase() || '';
		if (val === 'GCASH') return 'G-XCHANGE/GCASH';
		if (val === 'MAYA') return 'MAYA PHILIPPINES, INC./MAYA WALLET';
		if (val === '') return 'N/A';
		return mop;
	}

	function translatePeriod(period: string) {
		if (!period) return 'N/A';
		const p = period.trim();
		const match = p.match(/^(\d{2})(\d{2})_(\d)S$/);
		if (!match) return p;
		const [_, year1, year2, sem] = match;
		const ordinal = sem === '1' ? '1st' : sem === '2' ? '2nd' : sem === '3' ? '3rd' : `${sem}th`;
		return `AY 20${year1}-20${year2} ${ordinal} Semester`;
	}

	function parseRef(ref: string) {
		if (!ref) return { reference: 'N/A', invoice: null };
		const parts = ref.split(';').map((p) => p.trim());
		return {
			reference: parts[0] || 'N/A',
			invoice: parts[1] || null
		};
	}

	function formatDate(dateStr: string) {
		if (!dateStr) return 'N/A';
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			return date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch (e) {
			return dateStr;
		}
	}
</script>

<svelte:head>
	<title>View Receipt | HAONE</title>
	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
</svelte:head>

<main
	class="flex min-h-screen items-center justify-center bg-background p-4 text-foreground md:p-8"
>
	{#if !data && !error}
		<Card.Root class="w-full max-w-sm">
			<Card.Header class="text-center">
				<div class="mx-auto mb-4 w-fit rounded-full bg-muted p-2.5">
					<Lock class="h-5 w-5 text-muted-foreground" />
				</div>
				<Card.Title>Receipt Authentication</Card.Title>
				<Card.Description>Enter Student Number to view document.</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="space-y-2">
					<Label for="stno" class="text-xs tracking-widest text-muted-foreground uppercase"
						>Student ID</Label
					>
					<Input
						id="stno"
						type="text"
						bind:value={studentNo}
						placeholder="e.g. 2021-0001"
						autocomplete="off"
						onkeydown={(e) => e.key === 'Enter' && attemptDecryption()}
					/>
				</div>
				<Button onclick={attemptDecryption} class="w-full" disabled={isDecrypting || !studentNo}>
					{isDecrypting ? 'Verifying...' : 'Unlock Receipt'}
				</Button>
			</Card.Content>
		</Card.Root>
	{:else if error}
		<Card.Root class="w-full max-w-sm border-destructive/50">
			<Card.Header class="text-center">
				<CircleAlert class="mx-auto mb-3 h-10 w-10 text-destructive" />
				<Card.Title class="text-destructive">Error</Card.Title>
				<Card.Description>{error}</Card.Description>
			</Card.Header>
			<Card.Footer>
				<Button
					onclick={() => {
						error = '';
						data = null;
					}}
					variant="outline"
					class="w-full"
				>
					Retry
				</Button>
			</Card.Footer>
		</Card.Root>
	{:else if data}
		{@const refInfo = parseRef(data.referenceNumber)}
		<div class="w-full max-w-2xl space-y-6 print:hidden">
			<!-- WEB VIEW -->
			<Card.Root class="overflow-hidden border shadow-lg">
				<Card.Header>
					<div class="flex items-start justify-between">
						<div class="space-y-3">
							<div class="flex items-center gap-4">
								<img
									src="/ati/wordmark-flag-br.png"
									alt="ATI Logo"
									class="h-14 w-auto object-contain transition-all"
								/>
							</div>
						</div>
						{#if qrDataUrl}
							<div class="rounded border bg-white p-1 shadow-sm">
								<img src={qrDataUrl} alt="Verification QR" class="h-16 w-16" />
							</div>
						{/if}
					</div>
				</Card.Header>

				<Card.Content class="space-y-6">
					<!-- Basic & Period Info -->
					<section class="space-y-4">
						<div class="mb-2 flex items-center gap-2 border-b pb-2 text-primary">
							<ReceiptText class="h-4 w-4" />
							<h3 class="text-xs font-semibold tracking-widest uppercase">
								Acknowledgment Receipt
							</h3>
						</div>
						<div class="space-y-3 px-1">
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Date Issued</span>
								<span class="text-sm font-medium">{formatDate(data.dateIssued)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Payment Date</span>
								<span class="text-sm font-medium">{formatDate(data.paymentDate)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Period</span>
								<span class="text-sm font-medium">{translatePeriod(data.period)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Series Number</span>
								<span class="font-mono text-sm">{data.seriesNumber}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Received From</span>
								<span class="text-sm font-medium">{data.receivedFrom}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Received By</span>
								<span class="text-sm font-medium">{data.receivedBy}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Processor</span>
								<span class="text-sm font-medium">{translateMop(data.processor)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-xs text-muted-foreground uppercase">Reference Number</span>
								<span class="font-mono text-sm">{refInfo.reference}</span>
							</div>
							{#if refInfo.invoice}
								<div class="flex justify-between">
									<span class="text-xs text-muted-foreground uppercase">InstaPay Invoice No.</span>
									<span class="font-mono text-sm">{refInfo.invoice}</span>
								</div>
							{/if}
						</div>
					</section>

					<!-- Line Items Table -->
					<div class="rounded-md border">
						<Table.Root>
							<Table.Header class="bg-muted/50">
								<Table.Row>
									<Table.Head class="h-9">Description</Table.Head>
									<Table.Head class="h-9 text-right">Amount</Table.Head>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{#each data.items as item}
									<Table.Row>
										<Table.Cell class="py-2.5">
											{item.name}
											{#if item.amount < 0}
												<span
													class="ml-2 rounded border px-1.5 py-0.5 text-[8px] font-medium tracking-tighter text-destructive uppercase"
													>Refund</span
												>
											{/if}
										</Table.Cell>
										<Table.Cell class="py-2.5 text-right font-medium"
											>{formatCurrency(item.amount)}</Table.Cell
										>
									</Table.Row>
								{/each}
								<Table.Row class="border-t bg-muted/20 font-semibold">
									<Table.Cell class="py-3 text-xs tracking-widest uppercase"
										>Total Amount</Table.Cell
									>
									<Table.Cell class="py-3 text-right text-lg"
										>{formatCurrency(getTotal())}</Table.Cell
									>
								</Table.Row>
							</Table.Body>
						</Table.Root>
					</div>
					<div>
						{#if data.transactionType === 'WAIVED'}
							<p class="text-[11px] leading-relaxed font-medium text-primary">
								Acknowledgment of Waiver of Amount
							</p>
							<p class="text-[11px] leading-relaxed text-primary">
								The above-mentioned amount has been waived for all intents and purposes, and no
								further claims shall be made in this regard.
							</p>
						{/if}
					</div>
					<!-- Remarks -->
					<div class="space-y-6">
						{#if data.notes || data.transactionType === 'WAIVED'}
							<section class="space-y-2">
								<div class="flex items-center gap-2 border-b pb-2 text-muted-foreground">
									<StickyNote class="h-3 w-3" />
									<h3 class="text-[10px] font-semibold tracking-widest uppercase">Remarks</h3>
								</div>
								<div class="space-y-4 px-1">
									{#if data.notes}
										<p class="text-[11px] leading-relaxed text-muted-foreground">
											{data.notes}
										</p>
									{/if}
								</div>
							</section>
						{/if}
					</div>
				</Card.Content>

				<Card.Footer class="flex flex-col items-center gap-2 border-t bg-muted/10 py-8 text-center">
					<div class="flex flex-col items-center gap-2">
						<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
							>Generated by</span
						>
						<img
							src="/ha1.svg"
							alt="HA1 Logo"
							class="h-10 w-auto opacity-50 contrast-125 grayscale"
						/>
					</div>
					<p class="mt-4 max-w-[350px] text-[10px] leading-relaxed text-muted-foreground">
						This document is electronically generated, does not require a signature, and is not
						valid for claim of input tax.
					</p>
				</Card.Footer>
			</Card.Root>
			<div class="mb-2 flex items-center justify-between px-1">
				<div class="flex gap-2">
					<Button onclick={downloadPDF} size="sm" variant="secondary" disabled={isExporting}>
						<Download class="mr-2 h-3.5 w-3.5" />
						Export to PDF
					</Button>
				</div>
			</div>
		</div>

		<!-- FORMAL PRINT VERSION (SHADCN-FREE) -->
		<div
			id="export-template"
			class="export-font absolute top-0 -left-[10000px] flex min-h-[297mm] w-[210mm] flex-col bg-[#ffffff] text-[#000000]"
		>
			<!-- Letterhead -->
			<div class="w-full">
				<img src="/ati/letterhead_1in_c.png" alt="Letterhead" class="block h-auto w-full" />
			</div>

			<!-- Body Content -->
			<div id="export-body" class="flex-grow p-[1in] pt-8 text-[12pt]">
				{#if qrDataUrl}
					<div class="absolute right-5 bottom-5 w-24">
						<img src={qrDataUrl} alt="QR" class="block h-24 w-24 p-0" />
					</div>
				{/if}
				<header class="relative mb-4 text-center text-[#000000]">
					<h1 class="text-md font-bold text-[#000000] uppercase">Acknowledgment Receipt</h1>
				</header>

				<div class="mb-8 w-full">
					{#each [['Date Issued', formatDate(data.dateIssued)], ['Payment Date', formatDate(data.paymentDate)], ['Payment Processor', translateMop(data.processor)], ['Reference Number', refInfo.reference], ...(refInfo.invoice ? [['InstaPay Invoice No.', refInfo.invoice]] : []), ['Period', translatePeriod(data.period)], ['Series Number', data.seriesNumber], ['Received From', data.receivedFrom.toUpperCase()], ['Received By', data.receivedBy.toUpperCase()], ['Notes', data.notes || '']] as [label, val]}
						<div class="grid grid-cols-[200px_1fr] items-center">
							<div class="font-bold">
								{label}
							</div>
							<div class="">
								{val}
							</div>
						</div>
					{/each}
				</div>

				<table class="w-full border-collapse">
					<thead>
						<tr class="bg-[#f8fafc]">
							<th class="border-y border-[#000000] px-3 pb-4 text-left font-bold">Description</th>
							<th class="w-[180px] border-y border-[#000000] px-3 pb-4 text-right font-bold"
								>Amount (PHP)</th
							>
						</tr>
					</thead>
					<tbody>
						{#each data.items as item}
							<tr>
								<td class="border-y border-[#000000] px-3 pb-4">{item.name}</td>
								<td class="border-y border-[#000000] px-3 pb-4 text-right tabular-nums"
									>{item.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td
								>
							</tr>
						{/each}
						<tr class="bg-[#f8fafc]">
							<td class="border-y border-[#000000] px-3 pb-4 text-right font-bold">Total Amount</td>
							<td class="border-y border-[#000000] px-3 pb-4 text-right font-bold tabular-nums"
								>{getTotal().toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td
							>
						</tr>
					</tbody>
				</table>

				{#if data.transactionType === 'WAIVED'}
					<div class="mt-8 space-y-1 text-left text-[#000000]">
						<h4 class="font-bold italic">Acknowledgment of Waiver of Amount</h4>
						<p>
							The above-mentioned amount has been waived for all intents and purposes, and no
							further claims shall be made in this regard.
						</p>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="mt-auto px-[1in] pb-12 text-center text-[8pt]">
				<p>
					This document is electronically generated, does not require a signature, and is not valid
					for claim of input tax.
				</p>
				<div>
					Generated by HAOne on
					<span>
						{new Date().toLocaleString('en-US', {
							year: 'numeric',
							month: 'short',
							day: 'numeric',
							hour: 'numeric',
							minute: '2-digit',
							hour12: true
						})}.
					</span>
				</div>
			</div>
		</div>
	{/if}
</main>

<style>
	#export-template {
		background-color: #ffffff !important;
		color: #000000 !important;
		font-family: 'Archivo', sans-serif;
	}

	.export-font {
		font-family: 'Archivo', sans-serif;
	}
</style>
