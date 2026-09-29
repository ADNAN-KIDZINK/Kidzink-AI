import { describe, expect, it } from 'vitest';
import { brandText, englishOnly } from './i18n';

describe('brandText', () => {
  it('replaces the product name', () => {
    expect(brandText('Welcome to goose')).toBe('Welcome to Kidzink AI');
    expect(brandText("Goose's capabilities")).toBe("Kidzink AI's capabilities");
    expect(brandText('Ask goose anything...')).toBe('Ask Kidzink AI anything...');
  });

  it('keeps technical identifiers intact', () => {
    for (const text of [
      'Configure Project Hints (.goosehints)',
      'Paste goose://recipe link here...',
      'Enter an absolute path (e.g. /home/goose/workspace)',
      'Loaded from .goose/skills/',
      'Set GOOSE_DISABLE_AUTO_DOWNLOAD',
    ]) {
      expect(brandText(text)).toBe(text);
    }
  });
});

describe('englishOnly', () => {
  it('forces English messages but keeps a regional English tag', () => {
    expect(englishOnly({ locale: 'en-GB', messageLocale: 'en' })).toEqual({
      locale: 'en-GB',
      messageLocale: 'en',
    });
    expect(englishOnly({ locale: 'ja-JP', messageLocale: 'ja' })).toEqual({
      locale: 'en',
      messageLocale: 'en',
    });
  });
});
