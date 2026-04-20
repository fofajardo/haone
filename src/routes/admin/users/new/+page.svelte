<script lang="ts">
  import { goto } from "$app/navigation";
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { type UserRecord, UserTag } from "$lib/schemas";
  import { addUser } from "$lib/resident-logic";
  import SubpageHeader from "$lib/components/SubpageHeader.svelte";
  import UserForm from "$lib/components/admin/UserForm.svelte";

  let isSaving = $state(false);
  let formData = $state<Partial<UserRecord>>({
    firstName: "",
    lastName: "",
    middleName: "",
    suffix: "",
    email: "",
    studentNo: "",
    tags: ""
  });
  let academicItems = $state<{ college: string; program: string }[]>([]);
  let userTypes = $state<string[]>([]);

  let isErrorDialogOpen = $state(false);
  let saveError = $state<string | null>(null);

  async function handleSave() {
    isSaving = true;
    try {
      // Sync academic items back to formData
      formData.college = academicItems.map((i) => i.college).join(",");
      formData.program = academicItems.map((i) => i.program).join(":");
      formData.tags = userTypes.join(":");

      // Final validation
      if (userTypes.includes(UserTag.STUDENT) && userTypes.includes(UserTag.ALUMNUS)) {
        throw new Error("User cannot be both STUDENT and ALUMNUS at the same time.");
      }

      if (!formData.email) throw new Error("Email is required.");
      if (!formData.lastName) throw new Error("Last name is required.");
      if (!formData.firstName) throw new Error("First name is required.");

      await addUser(formData);
      goto("/admin/users");
    } catch (e: any) {
      saveError = e.message;
      isErrorDialogOpen = true;
    } finally {
      isSaving = false;
    }
  }
</script>

<div class="space-y-6">
  <SubpageHeader title="New User" />

  <UserForm
    bind:formData
    bind:userTypes
    bind:academicItems
    {isSaving}
    onSave={handleSave}
    onCancel={() => goto("/admin/users")}
    title="Create New User Account"
  />
</div>

<!-- Save Error AlertDialog -->
<AlertDialog.Root bind:open={isErrorDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Creation Failed</AlertDialog.Title>
      <AlertDialog.Description>
        An error occurred while trying to create the user:
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
