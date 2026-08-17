<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$ui/button";
  import { Textarea } from "$ui/textarea";
  import * as Card from "$ui/card";
  import * as AlertDialog from "$ui/alert-dialog";
  import { Save, FileUp, Info, CircleAlert } from "@lucide/svelte";
  import { type UserRecord } from "$lib/types";
  import { addUsersBatch } from "$api/controllers/resident-controller";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import Papa from "papaparse";

  let csvData = $state("");
  let isProcessing = $state(false);
  let isSaving = $state(false);
  let previewRows = $state<Partial<UserRecord>[]>([]);
  let errors = $state<string[]>([]);

  let isErrorDialogOpen = $state(false);
  let saveError = $state<string | null>(null);

  function handleParse() {
    isProcessing = true;
    errors = [];
    previewRows = [];

    Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as any[];
        const mapped: Partial<UserRecord>[] = rows.map((row, index) => {
          // Normalize keys (case insensitive)
          const findKey = (keys: string[]) => {
            const found = Object.keys(row).find((k) =>
              keys.some((target) => k.toLowerCase() === target.toLowerCase())
            );
            return found ? row[found] : "";
          };

          const email = findKey(["email", "mail"]);
          const lastName = findKey(["lastName", "last name", "surname"]);
          const firstName = findKey(["firstName", "first name", "given name"]);
          const studentNo = findKey(["studentNo", "student number", "id number", "stno"]);

          if (!email || !lastName || !firstName) {
            errors.push(`Row ${index + 1}: Missing required fields (Email, First Name, Last Name)`);
          }

          return {
            email: email?.trim(),
            lastName: lastName?.trim(),
            firstName: firstName?.trim(),
            middleName: findKey(["middleName", "middle name"])?.trim(),
            suffix: findKey(["suffix"])?.trim(),
            studentNo: studentNo?.trim(),
            college: findKey(["college"])?.trim(),
            program: findKey(["program", "degree", "course"])?.trim(),
            tags: findKey(["tags", "type"])?.trim(),
            notes: findKey(["notes", "remarks"])?.trim(),
            displayName: `${firstName} ${lastName}`.trim(),
            displayNameFormal: `${lastName}, ${firstName}`.trim()
          };
        });

        previewRows = mapped;
        isProcessing = false;
      },
      error: (err: any) => {
        errors.push(`CSV Parse Error: ${err.message}`);
        isProcessing = false;
      }
    });
  }

  async function handleImport() {
    if (previewRows.length === 0 || errors.length > 0) return;
    isSaving = true;
    try {
      await addUsersBatch(previewRows);
      goto("/admin/users");
    } catch (e: any) {
      saveError = e.message;
      isErrorDialogOpen = true;
    } finally {
      isSaving = false;
    }
  }

  const exampleCsv = `email,last name,first name,middle name,student number,college,program,tags
juan.delacruz@up.edu.ph,Dela Cruz,Juan,M.,2020-12345,CS,BS CS,STUDENT
maria.clara@up.edu.ph,Clara,Maria,S.,2018-54321,CAL,BA EL,ALUMNUS`;
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <SubpageHeader title="Batch Import Users" />

  <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
    <!-- Input Section -->
    <div class="space-y-6 lg:col-span-1">
      <Card.Root>
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <FileUp class="h-5 w-5" />
            CSV Import
          </Card.Title>
          <Card.Description>
            Paste your CSV data below. Ensure headers match the expected fields.
          </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-muted-foreground uppercase">CSV Content</span>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 text-xs"
                onclick={() => (csvData = exampleCsv)}
              >
                Load Example
              </Button>
            </div>
            <Textarea
              bind:value={csvData}
              placeholder="email,last name,first name..."
              rows={15}
              class="font-mono text-xs"
            />
          </div>

          <Button class="w-full" onclick={handleParse} isLoading={isProcessing} disabled={!csvData}>
            Parse CSV
          </Button>
        </Card.Content>
      </Card.Root>

      <Card.Root class="bg-muted/30">
        <Card.Header class="pb-2">
          <Card.Title class="flex items-center gap-2 text-sm">
            <Info class="h-4 w-4" />
            Expected Headers
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <ul class="space-y-1 text-xs text-muted-foreground">
            <li><strong class="text-foreground">email</strong> (Required)</li>
            <li><strong class="text-foreground">last name</strong> (Required)</li>
            <li><strong class="text-foreground">first name</strong> (Required)</li>
            <li>middle name</li>
            <li>student number</li>
            <li>college, program</li>
            <li>tags (separate with :)</li>
          </ul>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Preview Section -->
    <div class="space-y-6 lg:col-span-2">
      <Card.Root class="flex h-full flex-col">
        <Card.Header class="flex flex-row items-center justify-between">
          <div>
            <Card.Title class="text-lg">Preview & Validation</Card.Title>
            <Card.Description>
              {previewRows.length} rows identified
            </Card.Description>
          </div>
          <div class="flex gap-2">
            <Button
              size="sm"
              onclick={handleImport}
              isLoading={isSaving}
              disabled={previewRows.length === 0 || errors.length > 0}
              icon={Save}
            >
              Import
            </Button>
          </div>
        </Card.Header>
        <Card.Content class="flex-1 overflow-auto">
          {#if errors.length > 0}
            <div class="mb-4 space-y-2">
              {#each errors as err}
                <div
                  class="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
                >
                  <CircleAlert class="h-4 w-4" />
                  {err}
                </div>
              {/each}
            </div>
          {/if}

          {#if previewRows.length > 0}
            <div class="rounded-md border">
              <table class="w-full text-left text-xs">
                <thead class="bg-muted">
                  <tr>
                    <th class="p-2 font-bold">Email</th>
                    <th class="p-2 font-bold">Last Name</th>
                    <th class="p-2 font-bold">First Name</th>
                    <th class="p-2 font-bold">Middle Name</th>
                    <th class="p-2 font-bold">Student No</th>
                    <th class="p-2 font-bold">Tags</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  {#each previewRows as row}
                    <tr>
                      <td class="p-2 text-muted-foreground">{row.email}</td>
                      <td class="p-2 font-medium">{row.lastName}</td>
                      <td class="p-2">{row.firstName}</td>
                      <td class="p-2">{row.middleName || "—"}</td>
                      <td class="p-2 font-mono">{row.studentNo || "—"}</td>
                      <td class="p-2">
                        <div class="flex flex-wrap gap-1">
                          {#each (row.tags || "").split(":").filter(Boolean) as t}
                            <span class="rounded-full border px-1.5 py-0.5 font-semibold">{t}</span>
                          {/each}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {:else if !isProcessing}
            <div class="flex h-64 flex-col items-center justify-center text-muted-foreground">
              <FileUp class="mb-2 h-12 w-12 opacity-10" />
              <p>Parse some data to see a preview here.</p>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>
  </div>
</div>

<!-- Save Error AlertDialog -->
<AlertDialog.Root bind:open={isErrorDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Import Failed</AlertDialog.Title>
      <AlertDialog.Description>
        An error occurred during batch import:
        <div class="mt-2 rounded-md border bg-muted p-3 text-sm text-foreground">
          {saveError}
        </div>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => (isErrorDialogOpen = false)}>OK</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
