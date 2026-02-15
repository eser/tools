export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  format?: string;
  minimum?: number;
  maximum?: number;
  properties?: Record<string, JsonSchemaProperty>;
  items?: JsonSchemaProperty;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

/**
 * Extract default values from a JSON Schema's properties.
 */
export function getSchemaDefaults(schema: JsonSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  if (!schema.properties) return defaults;

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.default !== undefined) {
      defaults[key] = prop.default;
    }
  }
  return defaults;
}

/**
 * Determine the UI control type for a JSON Schema property.
 */
export function getFieldControl(
  key: string,
  prop: JsonSchemaProperty,
): "text" | "url" | "number" | "checkbox" | "select" | "textarea" | "file" | "json" {
  if (prop.enum !== undefined) return "select";
  if (prop.type === "boolean") return "checkbox";
  if (prop.type === "number" || prop.type === "integer") return "number";
  if (prop.type === "object" || prop.type === "array") return "json";

  if (prop.type === "string") {
    if (prop.format === "uri" || prop.format === "url") return "url";

    const desc = (prop.description ?? "").toLowerCase();
    const keyLower = key.toLowerCase();

    if (desc.includes("base64") || keyLower.includes("base64")) {
      return "file";
    }

    if (
      desc.includes("content string") ||
      desc.includes("svg") ||
      keyLower === "svg" ||
      keyLower === "content"
    ) {
      return "textarea";
    }

    return "text";
  }

  return "json";
}
