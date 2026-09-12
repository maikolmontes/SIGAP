import { createContext, useContext, useState, useEffect, type ReactNode, type FC } from 'react';

export type ColorFilter = 'normal' | 'grayscale' | 'warm' | 'high-contrast' | 'inverted';
export type FontSize = 'normal' | 'large' | 'xlarge';

export interface AccessibilitySettings {
  colorFilter: ColorFilter;
  fontSize: FontSize;
  dyslexiaFriendly: boolean;
  reducedMotion: boolean;
  focusHighlight: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  colorFilter: 'normal',
  fontSize: 'normal',
  dyslexiaFriendly: false,
  reducedMotion: false,
  focusHighlight: false,
};

const STORAGE_KEY = 'sigap_accessibility_settings';

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSetting: <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => void;
  resetSettings: () => void;
  isDefault: boolean;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error al cargar configuración de accesibilidad:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Aplicar atributos al elemento <html> cada vez que cambien los ajustes
  useEffect(() => {
    const root = document.documentElement;

    root.setAttribute('data-color-filter', settings.colorFilter);
    root.setAttribute('data-font-size', settings.fontSize);
    root.setAttribute('data-dyslexia', settings.dyslexiaFriendly ? 'true' : 'false');
    root.setAttribute('data-reduced-motion', settings.reducedMotion ? 'true' : 'false');
    root.setAttribute('data-focus-highlight', settings.focusHighlight ? 'true' : 'false');

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Error al guardar configuración de accesibilidad:', e);
    }
  }, [settings]);

  const updateSetting = <K extends keyof AccessibilitySettings>(key: K, value: AccessibilitySettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  const isDefault = JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS);

  return (
    <AccessibilityContext.Provider value={{ settings, updateSetting, resetSettings, isDefault }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility debe ser usado dentro de un AccessibilityProvider');
  }
  return context;
};
