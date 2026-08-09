type ModalVisibilityListener = () => void;

let openModalCount = 0;
const listeners = new Set<ModalVisibilityListener>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeOpenModalCount(listener: ModalVisibilityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHasOpenModalSnapshot(): boolean {
  return openModalCount > 0;
}

export function incrementOpenModalCount(): void {
  openModalCount += 1;
  emitChange();
}

export function decrementOpenModalCount(): void {
  openModalCount = Math.max(0, openModalCount - 1);
  emitChange();
}
