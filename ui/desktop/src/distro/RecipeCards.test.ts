import { describe, expect, it } from 'vitest';
import type { RecipeManifest } from '../recipe';
import { bundledRecipes, isBundledRecipe } from './RecipeCards';

const entry = (file_path: string) => ({ id: file_path, file_path }) as RecipeManifest;

describe('bundled recipes', () => {
  it('matches files in the bundled folder only', () => {
    const dir = '/Applications/Kidzink AI.app/Contents/Resources/recipes';
    expect(isBundledRecipe(`${dir}/01-make-spreadsheet.yaml`, dir)).toBe(true);
    expect(isBundledRecipe('/Users/me/.agents/recipes/mine.yaml', dir)).toBe(false);
    expect(isBundledRecipe(`${dir}-old/01.yaml`, dir)).toBe(false);
    expect(isBundledRecipe(`${dir}/01.yaml`, '')).toBe(false);
  });

  it('matches Windows paths the backend canonicalized to \\\\?\\ form', () => {
    const dir = 'C:\\Users\\me\\AppData\\Local\\kidzink-ai\\app-1.52.0\\resources\\recipes';
    expect(isBundledRecipe(`\\\\?\\${dir.replace('C:', 'c:')}\\06-write-email.yaml`, dir)).toBe(
      true
    );
  });

  it('orders cards by file name', () => {
    const dir = '/r';
    const sorted = bundledRecipes(
      [entry('/r/03-c.yaml'), entry('/other/00-x.yaml'), entry('/r/01-a.yaml')],
      dir
    );
    expect(sorted.map((recipe) => recipe.file_path)).toEqual(['/r/01-a.yaml', '/r/03-c.yaml']);
  });
});
