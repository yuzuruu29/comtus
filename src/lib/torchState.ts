export type TorchListener = () => void;

class TorchManager {
  private litSections = new Set<string>();
  private totalSections = new Set<string>();
  private listeners = new Set<TorchListener>();

  registerSection(id: string) {
    this.totalSections.add(id);
    this.notify();
  }

  unregisterSection(id: string) {
    this.totalSections.delete(id);
    this.notify();
  }

  isLit(id: string): boolean {
    return this.litSections.has(id);
  }

  ignite(id: string): boolean {
    if (!this.litSections.has(id)) {
      this.litSections.add(id);
      this.notify();
      return true;
    }
    return false;
  }

  igniteAll() {
    this.totalSections.forEach((id) => this.litSections.add(id));
    this.notify();
  }

  getCounts() {
    return {
      lit: this.litSections.size,
      total: Math.max(this.totalSections.size, 1),
    };
  }

  subscribe(listener: TorchListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const torchManager = new TorchManager();
