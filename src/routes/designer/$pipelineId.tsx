import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  listToolsWithSchemas,
  getSavedPipeline,
} from "@/server/functions.ts";
import { DesignerCanvas } from "@/components/designer/designer-canvas.tsx";

export const Route = createFileRoute("/designer/$pipelineId")({
  loader: async ({ params }) => {
    const [tools, pipeline] = await Promise.all([
      listToolsWithSchemas(),
      getSavedPipeline({ data: { id: params.pipelineId } }),
    ]);
    return { tools, pipeline };
  },
  component: EditDesignerPage,
});

function EditDesignerPage() {
  const { tools, pipeline } = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <DesignerCanvas
      tools={tools}
      initialPipeline={pipeline}
      onSaveSuccess={(id) =>
        navigate({ to: "/designer/$pipelineId", params: { pipelineId: id } })
      }
    />
  );
}
