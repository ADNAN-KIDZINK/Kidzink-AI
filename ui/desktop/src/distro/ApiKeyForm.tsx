import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { keyCheckErrorMessage, saveOpenRouterKey } from './openrouterKey';

interface ApiKeyFormProps {
  submitLabel: string;
  onSaved: (result: { limitRemaining: number | null }) => void | Promise<void>;
}

export function ApiKeyForm({ submitLabel, onSaved }: ApiKeyFormProps) {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!key.trim() || checking) return;
    setChecking(true);
    setError(null);
    try {
      const check = await window.kidzink.validateOpenRouterKey(key);
      if (!check.ok) {
        setError(keyCheckErrorMessage(check));
        return;
      }
      await saveOpenRouterKey(key);
      setKey('');
      await onSaved({ limitRemaining: check.limitRemaining });
    } catch {
      setError("Your key works, but we couldn't save it. Restart the app and try again.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label htmlFor="kidzink-api-key" className="block text-sm font-medium text-text-primary">
        Paste your personal API key
      </label>
      <div className="relative">
        <Input
          id="kidzink-api-key"
          type={showKey ? 'text' : 'password'}
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
            setError(null);
          }}
          placeholder="sk-or-v1-…"
          autoComplete="off"
          spellCheck={false}
          autoFocus
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'kidzink-api-key-error' : undefined}
          className="pr-10 font-mono"
        />
        <button
          type="button"
          onClick={() => setShowKey((shown) => !shown)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary hover:text-text-primary cursor-pointer"
          aria-label={showKey ? 'Hide key' : 'Show key'}
        >
          {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && (
        <p id="kidzink-api-key-error" role="alert" className="text-sm text-text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!key.trim() || checking} className="w-full">
        {checking ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Checking your key…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
