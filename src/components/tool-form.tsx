import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select.tsx";

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface ToolFormProps {
  jsonSchema: JsonSchema;
  onSubmit: (input: Record<string, unknown>) => void;
  loading: boolean;
}

function renderField(
  key: string,
  schema: JsonSchemaProperty,
  value: unknown,
  onChange: (val: unknown) => void,
) {
  const id = `field-${key}`;

  if (schema.enum !== undefined) {
    return (
      <Select
        value={String(value ?? "")}
        onValueChange={(val) => onChange(val || undefined)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="— Select —" />
        </SelectTrigger>
        <SelectContent>
          {schema.enum.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (schema.type === "boolean") {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={Boolean(value ?? schema.default ?? false)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
        <span className="text-sm">{schema.description ?? key}</span>
      </label>
    );
  }

  if (schema.type === "number" || schema.type === "integer") {
    return (
      <Input
        id={id}
        type="number"
        value={String(value ?? schema.default ?? "")}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : Number(v));
        }}
        placeholder={schema.description}
      />
    );
  }

  if (schema.type === "object" || schema.type === "array") {
    return (
      <Textarea
        id={id}
        value={typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2)}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        placeholder={`${schema.description ?? key} (JSON)`}
        rows={6}
        className="font-mono text-xs"
      />
    );
  }

  // Default: string input
  return (
    <Input
      id={id}
      type="text"
      value={String(value ?? schema.default ?? "")}
      onChange={(e) => onChange(e.target.value || undefined)}
      placeholder={schema.description}
    />
  );
}

export function ToolForm(props: ToolFormProps) {
  const { jsonSchema, onSubmit, loading } = props;
  const properties = jsonSchema.properties ?? {};

  const form = useForm({
    defaultValues: {
      values: {} as Record<string, unknown>,
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const vals = form.getFieldValue("values");
        const input: Record<string, unknown> = {};
        for (const [key, schema] of Object.entries(properties)) {
          const val = vals[key];
          if (val !== undefined) {
            input[key] = val;
          } else if (schema.default !== undefined) {
            input[key] = schema.default;
          }
        }
        onSubmit(input);
      }}
      className="space-y-4"
    >
      <form.Field name="values">
        {(valuesField) => {
          const vals = valuesField.state.value;

          const updateValue = (key: string, val: unknown) => {
            valuesField.handleChange({ ...vals, [key]: val });
          };

          return (
            <>
              {Object.entries(properties).map(([key, schema]) => (
                <div key={key} className="space-y-2">
                  {schema.type !== "boolean" && (
                    <Label htmlFor={`field-${key}`}>
                      {key}
                      {jsonSchema.required?.includes(key) && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                  )}
                  {renderField(key, schema, vals[key], (val) => updateValue(key, val))}
                  {schema.description !== undefined && schema.type !== "boolean" && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                  )}
                </div>
              ))}
            </>
          );
        }}
      </form.Field>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Running..." : "Execute"}
      </Button>
    </form>
  );
}
