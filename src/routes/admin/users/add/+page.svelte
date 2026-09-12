<script lang="ts">
  import { goto } from "$app/navigation";
  import { globalDialog } from "$state/dialog.svelte";
  import { type UserRecord, UserTag } from "$lib/types";
  import { addUser } from "$api/controllers/resident-controller";
  import UserForm from "$components/admin/UserForm.svelte";

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

  async function handleSave() {
    isSaving = true;
    try {
      // Sync academic items back to formData
      formData.college = academicItems.map((i) => i.college).join(",");
      formData.program = academicItems.map((i) => i.program).join(":");
      formData.tags = userTypes.join(":");

      if (!formData.email) throw new Error("Email is required.");
      if (!formData.lastName) throw new Error("Last name is required.");
      if (!formData.firstName) throw new Error("First name is required.");

      await addUser(formData);
      goto("/admin/users");
    } catch (e: any) {
      globalDialog.show(
        "Creation Failed",
        `An error occurred while trying to create the user:<div class="mt-2 rounded-md border bg-muted p-3 text-sm text-foreground">${e.message}</div>`
      );
    } finally {
      isSaving = false;
    }
  }
</script>

<UserForm
  bind:formData
  bind:userTypes
  bind:academicItems
  {isSaving}
  onSave={handleSave}
  title="Add User"
/>
