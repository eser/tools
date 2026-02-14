/**
 * Expression resolver for pipeline step inputs.
 *
 * Supports GitHub Actions-style expressions:
 *   ${{ steps.0.output }}          — entire output of step 0
 *   ${{ steps.0.output.platform }} — dot-path into step 0's output
 *   ${{ variables.my-var }}        — named variable
 *
 * When the entire value is a single expression, the resolved value
 * preserves its original type. When embedded in a larger string,
 * the resolved value is stringified.
 */

export interface ExpressionContext {
  stepOutputs: unknown[];
  variables: Record<string, unknown>;
}

const FULL_EXPR_RE = /^\$\{\{\s*([^}]+?)\s*\}\}$/;
const INLINE_EXPR_RE = /\$\{\{\s*([^}]+?)\s*\}\}/g;

export function getNestedField(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function resolveExpression(
  expr: string,
  context: ExpressionContext,
): unknown {
  if (expr.startsWith("steps.")) {
    const parts = expr.split(".");
    const stepIndex = parseInt(parts[1], 10);

    if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= context.stepOutputs.length) {
      return undefined;
    }

    const output = context.stepOutputs[stepIndex];

    // "steps.0.output" → return whole output
    // "steps.0.output.field.path" → traverse into output
    if (parts.length <= 3) {
      return output;
    }

    const fieldPath = parts.slice(3).join(".");
    return getNestedField(output, fieldPath);
  }

  if (expr.startsWith("variables.")) {
    const name = expr.slice("variables.".length);
    return context.variables[name];
  }

  return undefined;
}

/**
 * Recursively resolves `${{ ... }}` expressions in a value tree.
 */
export function resolveExpressions(
  value: unknown,
  context: ExpressionContext,
): unknown {
  if (typeof value === "string") {
    // Full expression: entire value is a single expression → preserve type
    const fullMatch = value.match(FULL_EXPR_RE);
    if (fullMatch !== null) {
      return resolveExpression(fullMatch[1], context);
    }

    // Inline expressions: string interpolation
    if (value.includes("${{")) {
      return value.replace(INLINE_EXPR_RE, (_, expr: string) => {
        const resolved = resolveExpression(expr.trim(), context);
        return String(resolved ?? "");
      });
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((v) => resolveExpressions(v, context));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = resolveExpressions(v, context);
    }
    return result;
  }

  return value;
}
