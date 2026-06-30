export interface IMermaidDiagram {
  code: string;
  className?: string;
  /**
   * When true (default), enables drag-pan, wheel/pinch zoom, and zoom controls.
   * On touch-primary devices (`(hover: none) and (pointer: coarse)`), SVG pointer
   * events are blocked via CSS so Panzoom does not respond to pinch or single-finger
   * drag — only the zoom controls and fullscreen toggle remain interactive.
   */
  enablePanZoom?: boolean;
}
