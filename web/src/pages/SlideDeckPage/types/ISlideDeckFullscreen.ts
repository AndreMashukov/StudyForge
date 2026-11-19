export interface ISlideDeckFullscreen {
  isFullscreen: boolean;
  handleToggleFullscreen: () => void;
  handleExitFullscreen: () => void;
  /** Syncs app fullscreen when the browser leaves fullscreen (e.g. Esc). */
  handleBrowserFullscreenChange: () => void;
}
