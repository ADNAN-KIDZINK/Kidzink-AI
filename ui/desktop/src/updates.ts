// Modified by Kidzink for Kidzink AI (see DISTRO_NOTES.md).
// Kidzink AI ships no update feed; the upstream one would offer staff goose releases.
export const UPDATES_ENABLED = false;
export const COST_TRACKING_ENABLED = true;
export const ANNOUNCEMENTS_ENABLED = false;
export const CONFIGURATION_ENABLED = true;
// Telemetry is forced off (GOOSE_TELEMETRY_OFF in src/distro/mainProcess.ts), so its toggle and prompt are hidden.
export const TELEMETRY_UI_ENABLED = false;
export const DICTATION_ALLOWED_PROVIDERS: string[] | null = null;
