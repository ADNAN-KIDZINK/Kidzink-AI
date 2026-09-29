import { useEffect, useState } from 'react';
import { acpGetProviderDetails, acpReadDefaults, acpSaveDefaults } from '../acp/providers';
import { useConfig } from '../components/ConfigContext';
import { useModelAndProvider } from '../components/ModelAndProviderContext';
import { Button } from '../components/ui/button';
import { toastError } from '../toasts';
import { ApiKeyForm } from './ApiKeyForm';
import { APP_NAME, BRAND } from './brand';
import { KidzinkMark } from './KidzinkMark';

type GuardState = 'checking' | 'server-error' | 'needs-key' | 'ready';

// Keeps the saved default on OpenRouter and, when an allowlist is configured, on an allowed model.
export async function ensureDistroDefaults(): Promise<void> {
  const { providerId, modelId } = await acpReadDefaults();
  const modelAllowed =
    !!modelId && (BRAND.allowedModels.length === 0 || BRAND.allowedModels.includes(modelId));
  if (providerId !== BRAND.provider || !modelAllowed) {
    await acpSaveDefaults(BRAND.provider, BRAND.defaultModel);
  }
}

export function warnIfNoUsageLeft(limitRemaining: number | null): void {
  if (limitRemaining !== null && limitRemaining <= 0) {
    toastError({
      title: 'Your key has no usage left',
      msg: `The key works, but its usage limit is used up. Contact ${BRAND.supportContact} if you need more.`,
    });
  }
}

// Replaces upstream's OnboardingGuard: staff only ever set up a personal OpenRouter key.
export default function KidzinkKeyGuard({ children }: { children: React.ReactNode }) {
  const { upsert } = useConfig();
  const { refreshCurrentModelAndProvider } = useModelAndProvider();
  const [state, setState] = useState<GuardState>('checking');

  const check = async (retries = 3, delay = 1000) => {
    setState('checking');
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const openRouter = await acpGetProviderDetails(BRAND.provider);
        if (!openRouter.is_configured) {
          setState('needs-key');
          return;
        }
        await ensureDistroDefaults();
        await refreshCurrentModelAndProvider();
        setState('ready');
        return;
      } catch (error) {
        console.error(
          `Error checking API key setup (attempt ${attempt + 1}/${retries + 1}):`,
          error
        );
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    setState('server-error');
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaved = async ({ limitRemaining }: { limitRemaining: number | null }) => {
    await acpSaveDefaults(BRAND.provider, BRAND.defaultModel);
    // Answers the telemetry question up front so the upstream consent prompt never appears.
    await upsert('GOOSE_TELEMETRY_ENABLED', false, false).catch(() => {});
    await refreshCurrentModelAndProvider();
    warnIfNoUsageLeft(limitRemaining);
    setState('ready');
  };

  if (state === 'checking') {
    return null;
  }

  if (state === 'ready') {
    return <>{children}</>;
  }

  if (state === 'server-error') {
    return (
      <div className="h-screen w-full bg-background-primary flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <KidzinkMark className="size-10 mx-auto mb-4" />
          <h1 className="text-xl font-light mb-3">{APP_NAME} is still starting up</h1>
          <p className="text-text-secondary mb-6">
            This usually takes a few seconds. If it keeps happening, restart the app or contact{' '}
            {BRAND.supportContact}.
          </p>
          <Button onClick={() => check()}>Try again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-background-primary overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="w-full max-w-md py-8">
          <KidzinkMark className="size-12 mb-6" />
          <h1 className="text-2xl sm:text-3xl font-light mb-3">Welcome to {APP_NAME}</h1>
          <p className="text-text-secondary mb-8">
            Your AI assistant for documents, spreadsheets, emails and everyday work. To get started,
            add the personal API key IT gave you.
          </p>
          <ApiKeyForm submitLabel="Continue" onSaved={handleSaved} />
          <div className="mt-6 space-y-2 text-sm text-text-secondary">
            <p>
              IT issues every person their own key. It's stored securely in your computer's{' '}
              {window.electron.platform === 'win32' ? 'Credential Manager' : 'Keychain'} and is
              never shared.
            </p>
            <p>Don't have a key yet? Contact {BRAND.supportContact}.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
