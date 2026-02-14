import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select.tsx";
import { Button } from "@/components/ui/button.tsx";
import { type JsonSchemaProperty, getFieldControl } from "@/lib/json-schema.ts";

function enumLabel(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SchemaFieldProps {
  fieldKey: string;
  schema: JsonSchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  required: boolean;
  expressionMode?: boolean;
}

export function SchemaField(props: SchemaFieldProps) {
  const { fieldKey, schema, value, onChange, required, expressionMode } = props;
  const control = getFieldControl(fieldKey, schema);
  const id = `field-${fieldKey}`;

  if (expressionMode === true) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id}>
          {fieldKey}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Input
          id={id}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="${{ steps.0.output.field }}"
          className="font-mono text-xs"
        />
        {schema.description !== undefined && (
          <p className="text-xs text-muted-foreground">{schema.description}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {control !== "checkbox" && (
        <Label htmlFor={id}>
          {fieldKey}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {control === "select" && (
        <Select
          value={String(value ?? "")}
          onValueChange={(val) => onChange(val || undefined)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={schema.default !== undefined ? enumLabel(String(schema.default)) : "-- Select --"}>
              {(val: string) => enumLabel(val)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {schema.enum!.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {enumLabel(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {control === "checkbox" && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={Boolean(value ?? schema.default ?? false)}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-sm">
            {fieldKey}
            {required && <span className="text-destructive ml-1">*</span>}
          </span>
        </label>
      )}

      {control === "number" && (
        <Input
          id={id}
          type="number"
          value={value !== undefined ? String(value) : ""}
          min={schema.minimum}
          max={schema.maximum}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? undefined : Number(v));
          }}
          placeholder={schema.default !== undefined ? String(schema.default) : undefined}
        />
      )}

      {control === "text" && (
        <Input
          id={id}
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder={schema.default !== undefined ? String(schema.default) : undefined}
        />
      )}

      {control === "url" && (
        <Input
          id={id}
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          placeholder="https://..."
        />
      )}

      {control === "textarea" && (
        <div className="space-y-1">
          <Textarea
            id={id}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value || undefined)}
            rows={4}
            className="font-mono text-xs"
            placeholder={schema.default !== undefined ? String(schema.default) : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".svg,.txt,.xml,.html";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file === undefined) return;
                const reader = new FileReader();
                reader.onload = () => onChange(reader.result as string);
                reader.readAsText(file);
              };
              input.click();
            }}
          >
            Upload file...
          </Button>
        </div>
      )}

      {control === "file" && (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="text"
            value={value !== undefined ? `[${String(value).length} chars]` : ""}
            readOnly
            placeholder="No file selected"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.onchange = () => {
                const file = input.files?.[0];
                if (file === undefined) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const result = reader.result as string;
                  const base64 = result.includes(",") ? result.split(",")[1] : result;
                  onChange(base64);
                };
                reader.readAsDataURL(file);
              };
              input.click();
            }}
          >
            Browse
          </Button>
        </div>
      )}

      {control === "json" && (
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
          rows={6}
          className="font-mono text-xs"
          placeholder={`${fieldKey} (JSON)`}
        />
      )}

      {schema.description !== undefined && control !== "checkbox" && (
        <p className="text-xs text-muted-foreground">{schema.description}</p>
      )}
      {schema.description !== undefined && control === "checkbox" && (
        <p className="text-xs text-muted-foreground ml-6">{schema.description}</p>
      )}
    </div>
  );
}
