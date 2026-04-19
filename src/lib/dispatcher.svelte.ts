import { browser } from "$app/environment";
import type { EmailTemplate, BrandingProfile } from "./templates/types";

export interface StagedEmail<T = any> {
  id: string;
  to: string;
  template: EmailTemplate<T>;
  data: T;
  branding: BrandingProfile;
  // Metadata for the UI
  recipientName: string;
  context?: string;
  // Execution data
  onSuccess?: () => Promise<void> | void;
}

class DispatcherState {
  queue = $state<StagedEmail[]>([]);
  customReminders = $state(""); // For Payment Status updates
  warnReservationCancellation = $state(false); // For Priority Reservation warning
  warnClearance = $state(false); // For Clearance warning
  hideBedNotice = $state(false); // For Registration Form notice
  configType = $state<"reminders" | null>(null);
  batchType = $state<"ACKNOWLEDGMENT" | "REMINDER" | "CLEARANCE" | null>(null);

  push(email: StagedEmail) {
    this.queue.push(email);
  }

  pushBatch(emails: StagedEmail[]) {
    this.queue.push(...emails);
  }

  clear() {
    this.queue = [];
    this.customReminders = "";
    this.warnReservationCancellation = false;
    this.warnClearance = false;
    this.hideBedNotice = false;
    this.configType = null;
    this.batchType = null;
  }

  get total() {
    return this.queue.length;
  }
}

export const emailDispatcher = new DispatcherState();
