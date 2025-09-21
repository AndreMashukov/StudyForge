import { Theme } from "../../types/theme";

export interface IThemePreview {
  theme: Theme;
  isActive: boolean;
  onClick: () => void;
}