import { createFileRoute, Link } from "@tanstack/react-router";
import { listSavedPipelines } from "@/server/functions.ts";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";

export const Route = createFileRoute("/pipelines/")({
  loader: () => listSavedPipelines(),
  component: PipelinesPage,
});

function PipelinesPage() {
  const pipelines = Route.useLoaderData();

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Pipelines</h1>
        <p className="text-muted-foreground">
          Saved pipeline definitions. Chain tools together and reuse them.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link to="/pipelines/new" className="no-underline">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full border-dashed">
            <CardHeader>
              <CardTitle className="text-lg">+ New Pipeline</CardTitle>
              <CardDescription>Create a new pipeline from scratch</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        {pipelines.map((pipeline) => (
          <Link key={pipeline.id} to="/pipelines/$pipelineId" params={{ pipelineId: pipeline.id }} className="no-underline">
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                <CardDescription>
                  {pipeline.description || pipeline.id}
                  <span className="block text-xs mt-1">
                    Updated: {new Date(pipeline.updatedAt).toLocaleDateString()}
                  </span>
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
