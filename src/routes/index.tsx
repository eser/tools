import { createFileRoute, Link } from "@tanstack/react-router";
import { listTools } from "@/server/functions.ts";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";

export const Route = createFileRoute("/")({
  loader: () => listTools(),
  component: HomePage,
});

function HomePage() {
  const tools = Route.useLoaderData();

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Tools</h1>
        <p className="text-muted-foreground">
          Select a tool to get started, or{" "}
          <Link to="/pipelines" className="text-primary underline">
            manage pipelines
          </Link>{" "}
          to chain them together.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            to="/tools/$toolId"
            params={{ toolId: tool.id }}
            className="no-underline"
          >
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardHeader>
                <Badge variant="secondary" className="w-fit mb-2">
                  {tool.category}
                </Badge>
                <CardTitle className="text-lg">{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
