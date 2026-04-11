import { DesktopScaleShell } from './components/DesktopScaleShell';
import { AppVersionGuard } from './components/AppVersionGuard';
import { AppRouter } from './router';

export default function App() {
  return (
    <>
      <AppVersionGuard />
      <DesktopScaleShell>
        <AppRouter />
      </DesktopScaleShell>
    </>
  );
}
