import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { SchemaField } from "@/components/schema-field.tsx";
import type { JsonSchema } from "@/lib/json-schema.ts";
import { BracesIcon } from "lucide-react";

const EXPR_RE = /^\$\{\{.*\}\}$/;

function isExpression(value: unknown): boolean {
  return typeof value === "string" && EXPR_RE.test(value.trim());
}

interface SchemaFormProps {
  schema: JsonSchema | null;
  value: string;
  onChange: (json: string) => void;
  /** Enable per-field expression toggle (for pipeline builder) */
  enableExpressions?: boolean;
}

export function SchemaForm(props: SchemaFormProps) {
  const { schema, value, onChange, enableExpressions } = props;
  const [mode, setMode] = useState<"form" | "json">("form");
  const [parseError, setParseError] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [exprFields, setExprFields] = useState<Set<string>>(new Set());

  const syncFromJson = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json);
      setFormValues(parsed);
      setParseError(null);

      // Auto-detect expression fields
      if (enableExpressions === true) {
        const detected = new Set<string>();
        for (const [key, val] of Object.entries(parsed)) {
          if (isExpression(val)) {
            detected.add(key);
          }
        }
        setExprFields(detected);
      }

      return true;
    } catch {
      setParseError("Invalid JSON");
      return false;
    }
  }, [enableExpressions]);

  useEffect(() => {
    if (mode === "form") {
      syncFromJson(value);
    }
  }, [value, mode, syncFromJson]);

  if (schema === null || schema.properties === undefined) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="font-mono text-xs"
        placeholder='{"key": "value"}'
      />
    );
  }

  const properties = schema.properties;
  const required = schema.required ?? [];

  const handleFieldChange = (key: string, fieldValue: unknown) => {
    const updated = { ...formValues, [key]: fieldValue };
    if (fieldValue === undefined) {
      delete updated[key];
    }
    setFormValues(updated);
    onChange(JSON.stringify(updated, null, 2));
  };

  const toggleExprMode = (key: string) => {
    const next = new Set(exprFields);
    if (next.has(key)) {
      next.delete(key);
      // Clear the expression value when switching back to literal
      handleFieldChange(key, undefined);
    } else {
      next.add(key);
      // Set empty expression placeholder
      handleFieldChange(key, "${{ }}");
    }
    setExprFields(next);
  };

  const switchToForm = () => {
    if (syncFromJson(value)) {
      setMode("form");
    }
  };

  const switchToJson = () => {
    setMode("json");
    setParseError(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={mode === "form" ? "default" : "ghost"}
          size="sm"
          onClick={switchToForm}
          className="text-xs h-7"
        >
          Form
        </Button>
        <Button
          type="button"
          variant={mode === "json" ? "default" : "ghost"}
          size="sm"
          onClick={switchToJson}
          className="text-xs h-7"
        >
          JSON
        </Button>
        {parseError !== null && mode === "form" && (
          <Badge variant="destructive" className="text-[10px]">
            Parse error — fix JSON to switch to form
          </Badge>
        )}
      </div>

      {mode === "json" ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          className="font-mono text-xs"
          placeholder='{"key": "value"}'
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(properties).map(([key, propSchema]) => (
            <div key={key} className="relative">
              {enableExpressions === true && (
                <Button
                  type="button"
                  variant={exprFields.has(key) ? "default" : "ghost"}
                  size="sm"
                  className="absolute right-0 top-0 h-6 w-6 p-0"
                  title={exprFields.has(key) ? "Switch to literal value" : "Use expression"}
                  onClick={() => toggleExprMode(key)}
                >
                  <BracesIcon className="size-3" />
                </Button>
              )}
              <SchemaField
                fieldKey={key}
                schema={propSchema}
                value={formValues[key]}
                onChange={(val) => handleFieldChange(key, val)}
                required={required.includes(key)}
                expressionMode={exprFields.has(key)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
