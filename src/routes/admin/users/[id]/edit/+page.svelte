<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import * as AlertDialog from "$ui/alert-dialog";
  import { type UserRecord, UserTag } from "$lib/types";
  import { fetchUserById, updateUser } from "$api/controllers/resident-controller";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import UserForm from "$components/admin/UserForm.svelte";
  import { Button } from "$ui/button";

  const userId = $derived(page.params.id);

  let user = $state<UserRecord | null>(null);
  let isLoading = $state(true);
  let isSaving = $state(false);
  let error = $state<string | null>(null);

  let formData = $state<Partial<UserRecord>>({});
  let academicItems = $state<{ college: string; program: string }[]>([]);
  let userTypes = $state<string[]>([]);

  function parseAcademic(colStr: string, progStr: string) {
    const cols = (colStr || "").split(",").map((s) => s.trim());
    const progs = (progStr || "").split(":").map((s) => s.trim());
    const count = Math.max(cols.length, progs.length);
    const items: { college: string; program: string }[] = [];
    for (let i = 0; i < count; i++) {
      if (cols[i] || progs[i]) {
        items.push({ college: cols[i] || "", program: progs[i] || "" });
      }
    }
    return items.length > 0 ? items : [{ college: "", program: "" }];
  }

  async function loadUser() {
    if (!userId) return;
    isLoading = true;
    error = null;
    try {
      user = await fetchUserById(userId);
      if (user) {
        formData = { ...user };
        academicItems = parseAcademic(user.college || "", user.program || "");
        userTypes = (user.tags || "")
          .split(":")
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        error = "User not found";
      }
    } catch (e: any) {
      console.error(e);
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  let isErrorDialogOpen = $state(false);
  let saveError = $state<string | null>(null);

  async function handleSave() {
    if (!userId || !user) return;
    isSaving = true;
    try {
      // Sync academic items back to formData
      formData.college = academicItems.map((i) => i.college).join(",");
      formData.program = academicItems.map((i) => i.program).join(":");
      formData.tags = userTypes.join(":");

      await updateUser(userId, formData);
      goto(`/admin/users/${userId}`);
    } catch (e: any) {
      saveError = e.message;
      isErrorDialogOpen = true;
    } finally {
      isSaving = false;
    }
  }

  onMount(loadUser);
</script>

{#if isLoading}
  <LoadingView />
{:else if error}
  <ErrorView {error}>
    <Button variant="outline" class="mt-4" onclick={() => goto("/admin/users")}>
      Return to Directory
    </Button>
  </ErrorView>
{:else if user}
  <UserForm
    bind:formData
    bind:userTypes
    bind:academicItems
    {isSaving}
    onSave={handleSave}
    title="Edit User"
  />
{/if}

<!-- Save Error AlertDialog -->
<AlertDialog.Root bind:open={isErrorDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Save Failed</AlertDialog.Title>
      <AlertDialog.Description>
        An error occurred while trying to save the user data:
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
