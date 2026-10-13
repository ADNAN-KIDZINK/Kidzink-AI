import { Navigate } from 'react-router';
import { isDistroAdmin } from './admin';

// Guards routes that the sidebar hides, since set-view IPC and in-app links can still reach them.
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return isDistroAdmin() ? <>{children}</> : <Navigate to="/" replace />;
}
