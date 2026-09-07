import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export const seasons = {
  summer: { name: 'Summer', icon: '☀️', accent: '#B76421', glow: '#F5BE63', light: '#FFF5E5', dark: '#231A12' },
  monsoon: { name: 'Monsoon', icon: '🌿', accent: '#267458', glow: '#87CBA4', light: '#EDF4ED', dark: '#101E19' },
  autumn: { name: 'Autumn', icon: '☁️', accent: '#367799', glow: '#A4D5E9', light: '#EFF7FA', dark: '#14212A' },
  lateAutumn: { name: 'Late autumn', icon: '🍂', accent: '#93652C', glow: '#DEB977', light: '#F6F0E3', dark: '#231F15' },
  winter: { name: 'Winter', icon: '💧', accent: '#547982', glow: '#BCDADB', light: '#EFF5F5', dark: '#162225' },
  spring: { name: 'Spring', icon: '🌸', accent: '#AE5578', glow: '#ECB2CB', light: '#FBF0F4', dark: '#291B24' },
} as const;
export type Appearance = { season: keyof typeof seasons; mode: 'system' | 'light' | 'dark'; motion: 'full' | 'subtle' | 'still'; interactive: boolean };
const defaults: Appearance = { season: 'monsoon', mode: 'system', motion: 'full', interactive: true };
function paletteFor(prefs: Appearance, dark: boolean) {
  const season = seasons[prefs.season];
  return { text: dark ? '#F1F5F1' : '#202B27', textSecondary: dark ? '#AFBEB6' : '#65726C', background: dark ? season.dark : season.light, backgroundElement: dark ? '#26332CEE' : '#FFFFFFE8', backgroundSelected: dark ? '#34453B' : '#DFE9E1', tint: dark ? season.glow : season.accent, border: dark ? '#FFFFFF25' : '#203A2820', danger: dark ? '#FF9690' : '#B93838', accent: season.accent, glow: season.glow, read: dark ? season.glow : season.accent };
}
const Context = createContext({ preferences: defaults, dark: false, palette: paletteFor(defaults, false), update: (_patch: Partial<Appearance>) => {}, saveError: false });
export function AppearanceProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => { let active = true; void SecureStore.getItemAsync('hush_appearance_v1').then(raw => {
    if (!raw || !active) return;
    const value = JSON.parse(raw);
    setPreferences({ season: Object.prototype.hasOwnProperty.call(seasons, value.season) ? value.season : defaults.season, mode: ['system', 'light', 'dark'].includes(value.mode) ? value.mode : defaults.mode, motion: ['full', 'subtle', 'still'].includes(value.motion) ? value.motion : defaults.motion, interactive: typeof value.interactive === 'boolean' ? value.interactive : true });
  }).catch(() => {}).finally(() => { if (active) setReady(true); }); return () => { active = false; }; }, []);
  useEffect(() => { if (!ready) return; writes.current = writes.current.catch(() => {}).then(() => SecureStore.setItemAsync('hush_appearance_v1', JSON.stringify(preferences))).then(() => setSaveError(false)).catch(() => setSaveError(true)); }, [preferences, ready]);
  const dark = preferences.mode === 'dark' || (preferences.mode === 'system' && system === 'dark');
  return <Context.Provider value={{ preferences, dark, palette: paletteFor(preferences, dark), update: patch => setPreferences(old => ({ ...old, ...patch })), saveError }}>{ready ? children : null}</Context.Provider>;
}
export const useAppearance = () => useContext(Context);
