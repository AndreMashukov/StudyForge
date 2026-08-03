export interface ICreateDocumentModalProps {
  open: boolean;
  directoryId: string | null;
  onClose: () => void;
  onRequestStarted?: (directoryId: string) => void;
}
