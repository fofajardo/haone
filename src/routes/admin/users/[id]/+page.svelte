<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { translateCollege, translateProgram } from "$utils/translators";
  import { pluralize } from "$utils/formatters";
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Badge } from "$ui/badge";
  import { Label } from "$ui/label";
  import * as AlertDialog from "$ui/alert-dialog";
  import {
    RefreshCcw,
    User as UserIcon,
    GraduationCap,
    Clock,
    Mail,
    Send,
    IdCard,
    AwardIcon,
    Contact,
    UserCog,
    StickyNote,
    Trash2
  } from "@lucide/svelte";
  import {
    type UserRecord,
    USER_TAG_COLORS,
    type ResidentRecord as Account,
    UserTag
  } from "$lib/types";
  import {
    fetchUserById,
    fetchAccountsByUserId,
    deleteUser
  } from "$api/controllers/resident-controller";
  import { pageState } from "$state/page-info.svelte";
  import SubpageHeader from "$components/SubpageHeader.svelte";
  import LoadingView from "$components/LoadingView.svelte";
  import ErrorView from "$components/ErrorView.svelte";
  import OccupancyHistoryCard from "$components/residents/OccupancyHistoryCard.svelte";

  const userId = $derived(page.params.id);

  let user = $state<UserRecord | null>(null);
  let accounts = $state<Account[]>([]);
  let isLoading = $state(true);
  let isDeleteAlertOpen = $state(false);
  let error = $state<string | null>(null);

  const qualifications = $derived(
    user
      ? translateCollege(user.college).map((col, i) => {
          const programs = translateProgram(user!.program);
          return {
            college: col,
            program: programs[i] || "—"
          };
        })
      : []
  );

  async function loadUserProfile(bypassCache = false) {
    if (!userId) {
      return;
    }
    isLoading = true;
    error = null;

    try {
      user = await fetchUserById(userId, bypassCache);
      if (!user) {
        error = `User with ID ${userId} not found.`;
        return;
      }
      pageState.title = user.displayName;
      accounts = await fetchAccountsByUserId(userId, bypassCache);
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleDelete() {
    if (!user) return;
    isDeleteAlertOpen = false;
    isLoading = true;
    try {
      await deleteUser(user.id);
      goto("/admin/users");
    } catch (e: any) {
      error = e.message;
      isLoading = false;
    }
  }

  onMount(loadUserProfile);
</script>

<div class="space-y-3">
  <SubpageHeader title="View User" onRefresh={() => loadUserProfile(true)} isRefreshing={isLoading}>
    {#snippet actions()}
      <div class="flex gap-2">
        <Button size="sm" href="/admin/users/{userId}/edit" icon={UserCog}>Edit</Button>
        {#if accounts.length === 0}
          <Button
            variant="destructive"
            size="sm"
            onclick={() => (isDeleteAlertOpen = true)}
            {isLoading}
            icon={Trash2}
          >
            <span class="hidden sm:inline">Delete</span>
          </Button>
        {/if}
      </div>

      <AlertDialog.Root bind:open={isDeleteAlertOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
            <AlertDialog.Description>
              This action cannot be undone. This will permanently delete the user profile for
              <span class="font-bold text-foreground">{user?.displayName}</span>
              and remove their data from our servers.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
              onclick={handleDelete}
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog.Root>
    {/snippet}
  </SubpageHeader>

  {#if isLoading}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button variant="outline" class="mt-4" href="/admin/users">Return to Directory</Button>
    </ErrorView>
  {:else if user}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- User Profile Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <UserIcon class="h-5 w-5" />
            Personal Information
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >First Name</Label
              >
              <p class="text-sm font-semibold">{user.firstName}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Last Name</Label
              >
              <p class="text-sm font-semibold">{user.lastName}</p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Middle Name</Label
              >
              <p class="text-sm font-semibold">{user.middleName || "—"}</p>
            </div>
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Suffix</Label
              >
              <p class="text-sm font-semibold">{user.suffix || "—"}</p>
            </div>
          </div>

          {#if user.overrideName}
            <div class="space-y-1">
              <Label class="text-xs font-bold tracking-widest text-muted-foreground uppercase"
                >Override Name</Label
              >
              <p class="text-sm font-semibold text-primary">{user.overrideName}</p>
            </div>
          {/if}

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Mail class="h-3 w-3" /> Email Address
            </Label>
            <div class="flex items-center gap-2">
              <p class="text-sm font-semibold text-foreground">{user.email}</p>
              <a
                href="mailto:{user.email}"
                class="text-muted-foreground transition-colors hover:text-primary"
              >
                <Send class="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {#if user.secondaryContact}
            <div class="space-y-1">
              <Label
                class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
              >
                <Contact class="h-3 w-3" /> Secondary Contact
              </Label>
              <p class="text-sm font-semibold">{user.secondaryContact}</p>
            </div>
          {/if}

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <IdCard class="h-3 w-3" /> Student Number
            </Label>
            <p class="text-sm font-semibold">{user.studentNo}</p>
          </div>

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <UserIcon class="h-3 w-3" /> User Tags
            </Label>
            <div class="flex flex-wrap gap-1">
              {#each (user.tags || UserTag.STUDENT)
                .split(":")
                .map((t) => t.trim())
                .filter(Boolean) as t}
                <Badge
                  variant="outline"
                  class="text-xs font-semibold {USER_TAG_COLORS[t] || USER_TAG_COLORS.DEFAULT}"
                >
                  {t}
                </Badge>
              {/each}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Academic Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <GraduationCap class="h-5 w-5" />
            Academic Details
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1 space-y-6">
          <div class="space-y-4">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              Programs & Colleges
            </Label>
            <div
              class="relative space-y-6 before:absolute before:top-2 before:left-[11px] before:h-[calc(100%-16px)] before:w-px before:bg-border"
            >
              {#each qualifications as q}
                <div class="relative flex items-start gap-4 pl-8">
                  <div
                    class="absolute left-0 mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border-4 border-background bg-muted shadow-sm ring-1 ring-border"
                  >
                    <AwardIcon class="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span
                      class="text-xs font-bold tracking-widest text-primary uppercase opacity-80"
                      >{q.college}</span
                    >
                    <p class="text-sm leading-tight font-bold text-foreground">{q.program}</p>
                  </div>
                </div>
              {/each}
              {#if qualifications.length === 0}
                <div class="flex flex-col items-center justify-center py-8 opacity-30">
                  <GraduationCap class="mb-2 h-8 w-8" />
                  <p class="text-xs font-bold tracking-widest uppercase">No academic records</p>
                </div>
              {/if}
            </div>
          </div>

          <div class="space-y-1">
            <Label
              class="flex items-center gap-1.5 text-xs font-bold tracking-widest text-muted-foreground uppercase"
            >
              <Clock class="h-3 w-3" /> Terms active
            </Label>
            <div class="text-sm font-semibold">
              {pluralize(accounts.length, "Term", "Terms")}
            </div>
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Notes Card -->
      <Card.Root class="flex h-full flex-col">
        <Card.Header>
          <Card.Title class="flex items-center gap-2 text-lg">
            <StickyNote class="h-5 w-5" />
            Administrative Notes
          </Card.Title>
        </Card.Header>
        <Card.Content class="flex-1">
          {#if user.notes}
            <p class="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground italic">
              {user.notes}
            </p>
          {:else}
            <div class="flex flex-col items-center justify-center py-12 opacity-30">
              <StickyNote class="mb-2 h-8 w-8" />
              <p class="text-xs font-bold tracking-widest uppercase">No notes available</p>
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Active Semesters History -->
    <OccupancyHistoryCard
      {accounts}
      onRowClick={(r) => goto(`/admin/residents/${r.stno}?term=${r.period}`)}
    />
  {/if}
</div>
