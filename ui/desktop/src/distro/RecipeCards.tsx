import { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileSearch,
  FileSignature,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Languages,
  Lightbulb,
  Mail,
  MessagesSquare,
  Presentation,
  Scale,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { AppEvents } from '../constants/events';
import { formatAcpError, isRecipeDeclined, isRecipeParamsCancelled } from '../acp/errors';
import type { RecipeManifest } from '../recipe';
import { listSavedRecipes } from '../recipe/recipe_management';
import { createSession } from '../sessions';
import { toastError } from '../toasts';
import type { View, ViewOptions } from '../utils/navigationUtils';
import { getEffectiveWorkingDir } from '../utils/workingDir';

// Keyed by file name without its order prefix; recipes added later get the default icon.
const RECIPE_ICONS: Record<string, LucideIcon> = {
  'write-email': Mail,
  'compare-options': Scale,
  'research-topic': Search,
  'brainstorm-ideas': Lightbulb,
  'draft-document': FileText,
  'summarise-document': FileSearch,
  'summarise-meeting': MessagesSquare,
  'learn-something': BookOpen,
  'analyse-spreadsheet': BarChart3,
  'make-spreadsheet': FileSpreadsheet,
  'make-presentation': Presentation,
  'prepare-meeting': CalendarCheck,
  'plan-project': ClipboardList,
  'translate-text': Languages,
  'review-contract': FileSignature,
  'read-image': ImageIcon,
};

// The backend canonicalizes recipe paths (\\?\C:\... on Windows), so compare loosely.
const normalizePath = (filePath: string) =>
  filePath
    .replace(/^\\\\\?\\/, '')
    .replace(/\\/g, '/')
    .toLowerCase();

const fileName = (filePath: string) => normalizePath(filePath).split('/').pop() ?? '';

const iconFor = (filePath: string): LucideIcon =>
  RECIPE_ICONS[
    fileName(filePath)
      .replace(/^\d+-/, '')
      .replace(/\.(ya?ml|json)$/, '')
  ] ?? Sparkles;

export function isBundledRecipe(filePath: string, recipesDir: string): boolean {
  return !!recipesDir && normalizePath(filePath).startsWith(`${normalizePath(recipesDir)}/`);
}

export function bundledRecipes(entries: RecipeManifest[], recipesDir: string): RecipeManifest[] {
  return entries
    .filter((entry) => isBundledRecipe(entry.file_path, recipesDir))
    .sort((a, b) => fileName(a.file_path).localeCompare(fileName(b.file_path)));
}

// One-click starting points on the home screen, built from the recipes shipped in distro/recipes.
export function RecipeCards({
  setView,
  workingDir,
}: {
  setView: (view: View, viewOptions?: ViewOptions) => void;
  /** The folder the person picked on the home screen, if any. */
  workingDir?: string;
}) {
  const [recipes, setRecipes] = useState<RecipeManifest[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    listSavedRecipes()
      .then((entries) => setRecipes(bundledRecipes(entries, window.kidzink.recipesDir)))
      .catch((error) => console.error('Failed to load recipes:', error));
  }, []);

  const start = async (entry: RecipeManifest) => {
    if (startingId) return;
    setStartingId(entry.id);
    try {
      // These ship with the app, so the "do you trust this recipe?" prompt is skipped.
      await window.electron.recordRecipeHash(entry.recipe);
      const dir = workingDir || (await getEffectiveWorkingDir());
      const session = await createSession(dir, { recipeId: entry.id });
      const initialMessage = session.recipe?.prompt
        ? { msg: session.recipe.prompt, images: [] }
        : undefined;
      window.dispatchEvent(new CustomEvent(AppEvents.SESSION_CREATED, { detail: { session } }));
      window.dispatchEvent(
        new CustomEvent(AppEvents.ADD_ACTIVE_SESSION, {
          detail: { sessionId: session.id, initialMessage },
        })
      );
      setView('pair', { disableAnimation: true, resumeSessionId: session.id, initialMessage });
    } catch (error) {
      if (!isRecipeDeclined(error) && !isRecipeParamsCancelled(error)) {
        toastError({ title: "Couldn't start that task", msg: formatAcpError(error) });
      }
      setStartingId(null);
    }
  };

  if (recipes.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-text-secondary mb-2">Or start with a task</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {recipes.map((entry) => {
          const Icon = iconFor(entry.file_path);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => void start(entry)}
              disabled={startingId !== null}
              title={entry.recipe.description}
              className="flex items-center gap-2 rounded-xl border border-border-primary bg-background-primary px-3 py-2 text-left transition-colors hover:bg-background-secondary disabled:opacity-60"
            >
              <Icon className="size-4 shrink-0 text-brand" />
              <span className="text-sm text-text-primary truncate">{entry.recipe.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
