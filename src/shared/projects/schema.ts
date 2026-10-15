import { z } from "zod";

/**
 * The rules for a new project, checked in the browser before anything is sent. They are the gateway's own
 * (contracts/common/project-create.schema.json); a test keeps the two in step.
 */
export const PROJECT_ID_PATTERN = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/;
export const PROJECT_ID_MIN = 2;
export const PROJECT_ID_MAX = 32;
export const PROJECT_NAME_MAX = 80;
export const PROJECT_DESCRIPTION_MAX = 500;
export const SHORT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,4}$/;
export const SHORT_KEY_MIN = 2;
export const SHORT_KEY_MAX = 5;

/** Why a key breaks the pattern, in words, or null when it doesn't. */
export function projectIdProblem(id: string): string | null {
  if (PROJECT_ID_PATTERN.test(id)) return null;
  if (/[^A-Z0-9-]/.test(id)) return "Use capital letters (A–Z), digits and hyphens only.";
  if (!/^[A-Z]/.test(id)) return "Start with a capital letter.";
  return "Put a letter or digit on both sides of every hyphen.";
}

export function projectCreateSchema(existingIds: readonly string[] = [], existingKeys: readonly string[] = []) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "Enter a name for the project.")
      .max(PROJECT_NAME_MAX, `Use at most ${PROJECT_NAME_MAX} characters.`),
    id: z
      .string()
      .trim()
      .min(1, "Enter a project key.")
      .min(PROJECT_ID_MIN, `Use at least ${PROJECT_ID_MIN} characters.`)
      .max(PROJECT_ID_MAX, `Use at most ${PROJECT_ID_MAX} characters.`)
      .superRefine((id, context) => {
        const problem = projectIdProblem(id);
        if (problem) context.addIssue({ code: "custom", message: problem });
        else if (existingIds.includes(id)) context.addIssue({ code: "custom", message: "A project with this id already exists." });
      }),
    key: z
      .string()
      .trim()
      .superRefine((key, context) => {
        if (key === "") return; // the gateway takes the name's initials
        if (!SHORT_KEY_PATTERN.test(key)) {
          context.addIssue({ code: "custom", message: `Use ${SHORT_KEY_MIN} to ${SHORT_KEY_MAX} capital letters or digits, starting with a letter.` });
        } else if (existingKeys.includes(key)) {
          context.addIssue({ code: "custom", message: "Another project already uses this short key." });
        }
      }),
    description: z
      .string()
      .trim()
      .max(PROJECT_DESCRIPTION_MAX, `Use at most ${PROJECT_DESCRIPTION_MAX} characters.`),
  });
}

/** The gateway's suggestion (app/keys.py): the name's initials (My First Project -> MFP), a number when taken. */
export function suggestShortKey(name: string, taken: readonly string[] = []): string {
  const words = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z][A-Za-z0-9]*/g) ?? [];
  let initials = words.map((word) => word[0]).join("").toUpperCase();
  if (initials.length < 2) initials = (words[0]?.slice(0, 3) ?? "").toUpperCase();
  const base = initials.slice(0, SHORT_KEY_MAX);
  if (base.length < 2 || !taken.includes(base)) return base;
  for (let number = 2; number < 1000; number++) {
    const candidate = `${base.slice(0, SHORT_KEY_MAX - String(number).length)}${number}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return base;
}

export type ProjectCreateValues = z.infer<ReturnType<typeof projectCreateSchema>>;

/** What people type in the key box, as a key: capitals, spaces and underscores as hyphens. */
export function normaliseProjectId(typed: string): string {
  return typed.toUpperCase().replace(/[\s_]+/g, "-");
}

/** A key suggested from the project's name, e.g. "Tutoring app" -> "TUTORING-APP". */
export function suggestProjectId(name: string): string {
  const words = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  while (words.length > 0 && !/^[A-Z]/.test(words[0])) words.shift();
  let key = "";
  for (const word of words) {
    const next = key ? `${key}-${word}` : word;
    if (next.length > PROJECT_ID_MAX) break;
    key = next;
  }
  return key || (words[0] ?? "").slice(0, PROJECT_ID_MAX);
}
