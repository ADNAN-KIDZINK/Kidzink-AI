import * as React from 'react';
import { useCallback, useState } from 'react';
import {
  TabsContent as UpstreamTabsContent,
  TabsTrigger as UpstreamTabsTrigger,
} from '../components/ui/tabs';
import { isDistroAdmin } from './admin';

export { Tabs, TabsList } from '../components/ui/tabs';

// Staff keep Chat, Keyboard and App. Models, providers, agent loop, prompts and auth are IT's.
const STAFF_SETTINGS_TABS = new Set(['chat', 'keyboard', 'app']);
const STAFF_DEFAULT_TAB = 'chat';

function isTabVisible(tab: string): boolean {
  return isDistroAdmin() || STAFF_SETTINGS_TABS.has(tab);
}

// Deep links (e.g. section=models) can still ask for a hidden tab; they land on Chat instead.
export function useDistroSettingsTab(initialTab: string) {
  const coerce = (tab: string) => (isTabVisible(tab) ? tab : STAFF_DEFAULT_TAB);
  const [activeTab, setActiveTabState] = useState(() => coerce(initialTab));
  const setActiveTab = useCallback((tab: string) => setActiveTabState(coerce(tab)), []);
  return [activeTab, setActiveTab] as const;
}

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof UpstreamTabsTrigger>,
  React.ComponentPropsWithoutRef<typeof UpstreamTabsTrigger>
>((props, ref) =>
  isTabVisible(props.value) ? <UpstreamTabsTrigger ref={ref} {...props} /> : null
);
TabsTrigger.displayName = 'DistroTabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof UpstreamTabsContent>,
  React.ComponentPropsWithoutRef<typeof UpstreamTabsContent>
>((props, ref) =>
  isTabVisible(props.value) ? <UpstreamTabsContent ref={ref} {...props} /> : null
);
TabsContent.displayName = 'DistroTabsContent';
