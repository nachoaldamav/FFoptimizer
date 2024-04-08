import { createContext, useContext, useState } from 'react';

export interface GradientBackgroundContextType {
  gradientBackground: string;
  setGradientBackground: (background: string) => void;
}

export const GradientBackgroundContext =
  createContext<GradientBackgroundContextType>(
    {} as GradientBackgroundContextType
  );

export function useGradientBackground() {
  return useContext(GradientBackgroundContext);
}

export function GradientBackgroundProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [gradientBackground, setGradientBackground] = useState(
    'linear-gradient(to bottom, #0f0f0f, #0f0f0f)'
  );

  return (
    <GradientBackgroundContext.Provider
      value={{ gradientBackground, setGradientBackground }}
    >
      {children}
    </GradientBackgroundContext.Provider>
  );
}
