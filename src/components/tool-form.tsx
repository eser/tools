import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button.tsx";
import { SchemaField } from "@/components/schema-field.tsx";
import type { JsonSchema } from "@/lib/json-schema.ts";

interface ToolFormProps {
  jsonSchema: JsonSchema;
  onSubmit: (input: Record<string, unknown>) => void;
  loading: boolean;
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
                <SchemaField
                  key={key}
                  fieldKey={key}
                  schema={schema}
                  value={vals[key]}
                  onChange={(val) => updateValue(key, val)}
                  required={jsonSchema.required?.includes(key) ?? false}
                />
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
