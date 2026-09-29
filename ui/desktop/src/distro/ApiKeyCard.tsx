import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { useModelAndProvider } from '../components/ModelAndProviderContext';
import { toastSuccess } from '../toasts';
import { ApiKeyForm } from './ApiKeyForm';
import { ensureDistroDefaults, warnIfNoUsageLeft } from './KidzinkKeyGuard';

export function KidzinkApiKeyCard() {
  const { refreshCurrentModelAndProvider } = useModelAndProvider();
  const [open, setOpen] = useState(false);
  const storeName = window.electron.platform === 'win32' ? 'Credential Manager' : 'Keychain';

  const handleSaved = async ({ limitRemaining }: { limitRemaining: number | null }) => {
    await ensureDistroDefaults();
    await refreshCurrentModelAndProvider();
    setOpen(false);
    toastSuccess({ title: 'API key updated', msg: 'New chats will use your new key.' });
    warnIfNoUsageLeft(limitRemaining);
  };

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-0">
        <CardTitle className="mb-1">API key</CardTitle>
        <CardDescription>
          Your personal OpenRouter key, stored securely in your computer's {storeName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 px-4">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Change API key
        </Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Change API key</DialogTitle>
            <DialogDescription>
              Paste the new key IT gave you. We'll check it before replacing your current one.
            </DialogDescription>
          </DialogHeader>
          <ApiKeyForm submitLabel="Save new key" onSaved={handleSaved} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
