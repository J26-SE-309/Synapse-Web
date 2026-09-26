import axe from "axe-core";

/**
 * WCAG 2.1 A and AA problems axe-core finds in a rendered component (NFR11). Colour contrast needs a real
 * browser's layout, so it is checked there (in both themes) rather than in jsdom.
 */
export async function accessibilityProblems(container: Element): Promise<string[]> {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
}
