import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { listToolsWithSchemas } from "@/server/functions.ts";
import { DesignerCanvas } from "@/components/designer/designer-canvas.tsx";

export const Route = createFileRoute("/designer/")({
  loader: () => listToolsWithSchemas(),
  component: DesignerPage,
});

function DesignerPage() {
  const tools = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <DesignerCanvas
      tools={tools}
      onSaveSuccess={(id) =>
        navigate({ to: "/designer/$pipelineId", params: { pipelineId: id } })
      }
    />
  );
}
