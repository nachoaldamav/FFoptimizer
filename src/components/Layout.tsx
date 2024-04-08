import { Outlet } from 'react-router-dom';
import { GradientBackgroundProvider } from '../context/gradient-background';

export default function Layout() {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f] relative">
      <GradientBackgroundProvider>
        <main className="h-full w-full p-4 overflow-y-auto">
          <Outlet />
        </main>
      </GradientBackgroundProvider>
    </div>
  );
}
