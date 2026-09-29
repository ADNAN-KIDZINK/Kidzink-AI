import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { KidzinkMark } from './KidzinkMark';
import { APP_NAME, BRAND } from './brand';

const GOOSE_REPO_URL = 'https://github.com/aaif-goose/goose';

export function KidzinkAboutCard() {
  const version = window.electron.getVersion() || 'Development';

  return (
    <Card className="rounded-lg">
      <CardHeader className="pb-0">
        <CardTitle className="mb-1">About {APP_NAME}</CardTitle>
        <CardDescription>Need help or more usage? Contact {BRAND.supportContact}.</CardDescription>
      </CardHeader>
      <CardContent className="pt-4 px-4 space-y-4">
        <div className="flex items-center gap-3">
          <KidzinkMark className="size-8" />
          <div>
            <div className="text-text-primary font-medium">{APP_NAME}</div>
            <div className="text-xs text-text-secondary font-mono">Version {version}</div>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => window.electron.openExternal(`mailto:${BRAND.supportContact}`)}
        >
          Contact support
        </Button>
        <p className="text-xs text-text-secondary">
          Powered by{' '}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-text-primary cursor-pointer"
            onClick={() => window.electron.openExternal(GOOSE_REPO_URL)}
          >
            goose
          </button>{' '}
          (open source, Apache License 2.0). {APP_NAME} is an independent distribution by{' '}
          {BRAND.companyName} and is not endorsed by the goose project.
        </p>
      </CardContent>
    </Card>
  );
}
