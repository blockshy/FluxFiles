import { AppVersionGuard } from './components/AppVersionGuard';
import { AppRouter } from './router';

export default function App() {
  return (
    <>
      <AppVersionGuard />
      <AppRouter />
    </>
  );
}
