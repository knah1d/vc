/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useAppearance } from '@/context/AppearanceContext';

export function useTheme() {
  return useAppearance().palette;
}
