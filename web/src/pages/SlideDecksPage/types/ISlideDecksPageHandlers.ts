export interface ISlideDecksPageHandlers {
  handleView: (slideDeckId: string) => void;
  handleDelete: (slideDeckId: string) => Promise<void>;
}
