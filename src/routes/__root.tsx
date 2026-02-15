import type { ReactNode } from "react";
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { ModeToggle } from "@/components/mode-toggle.tsx";
import "@/styles.css";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "eser/tools" },
      { name: "description", content: "Universal tools platform" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider defaultTheme="system">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-border">
            <div className="container mx-auto flex items-center justify-between h-14 px-4">
              <Link to="/" className="font-bold text-lg no-underline">
                eser/tools
              </Link>
              <nav className="flex items-center gap-4 text-sm">
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-foreground no-underline"
                >
                  Tools
                </Link>
                <Link
                  to="/pipelines"
                  className="text-muted-foreground hover:text-foreground no-underline"
                >
                  Pipelines
                </Link>
                <Link
                  to="/designer"
                  className="text-muted-foreground hover:text-foreground no-underline"
                >
                  Designer
                </Link>
                <ModeToggle />
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument(props: { children: ReactNode }) {
  const themeScript = `
(function() {
  var stored = localStorage.getItem('tools-ui-theme');
  var system = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var theme = stored === 'dark' || stored === 'light' ? stored : system;
  document.documentElement.classList.add(theme);
})();`;

  return (
    <html suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link to="/" className="text-primary underline">
        Go Home
      </Link>
    </div>
  );
}
