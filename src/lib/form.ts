import { z } from "zod";

// État renvoyé par toutes les server actions (compatible useActionState).
export type FormState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

export const initialFormState: FormState = null;

// Valide un FormData contre un schéma zod. Le discriminant `ok` permet à
// TypeScript de narrower correctement (data garanti non-null si ok).
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.infer<T> } | { ok: false; state: FormState } {
  const raw = Object.fromEntries(formData.entries());
  const result = schema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    state: { ok: false, message: "Vérifie les champs du formulaire.", fieldErrors },
  };
}

// Helpers de coercition pour les champs de formulaire (toujours des strings).
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null ? undefined : v;

export const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().optional(),
);

export const optionalDate = z.preprocess(emptyToUndefined, z.coerce.date().optional());
