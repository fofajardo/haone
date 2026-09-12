class DialogState {
  open = $state(false);
  title = $state("");
  description = $state("");
  onClose = $state<(() => void) | undefined>(undefined);

  show(title: string, description: string, onClose?: () => void) {
    this.title = title;
    this.description = description;
    this.onClose = onClose;
    this.open = true;
  }

  close() {
    this.open = false;
    if (this.onClose) {
      const cb = this.onClose;
      this.onClose = undefined;
      cb();
    }
  }
}

export const globalDialog = new DialogState();
