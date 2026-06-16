export type CaptureState =
  | 'idle'
  | 'validating'
  | 'capturing'
  | 'ocr'
  | 'uploading'
  | 'success'
  | 'error';

export interface ICaptureResult {
  documentId: string;
  title: string;
}
