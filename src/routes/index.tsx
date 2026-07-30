import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { SynthApp } from "@/components/synth/SynthApp";

export const Route = createFileRoute("/")({
  component: HomePage,
  ssr: false,
});

function HomePage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-full items-center justify-center bg-bg text-muted">
          <p className="font-mono text-sm tracking-wide">Loading PHOSPHOR…</p>
        </div>
      }
    >
      <SynthApp />
    </ClientOnly>
  );
}
