// Upstream UI that the Kidzink AI distribution hides. Each flag guards one upstream block.
export const DISTRO_FEATURES = {
  // English-only distribution.
  languagePicker: false,
  // Upstream's help card files bug reports on the goose GitHub; staff contact Kidzink support instead.
  upstreamHelpCard: false,
  // Upstream's version card shows the Block logo; KidzinkAboutCard shows the version instead.
  upstreamVersionCard: false,
  // Staff see model tiers (Low/Medium/High), not which provider serves them.
  predefinedModelProvider: false,
} as const;
