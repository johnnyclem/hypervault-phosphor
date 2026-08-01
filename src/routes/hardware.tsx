import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { HardwareDesign } from "@/components/hardware/HardwareDesign";

export const Route = createFileRoute("/hardware")({
  component: HardwarePage,
  ssr: false,
});

function HardwarePage() {
  return (
    <ClientOnly
      fallback={
        <div className="flex min-h-full items-center justify-center bg-bg text-muted">
          <p className="font-mono text-sm tracking-wide">Loading design…</p>
        </div>
      }
    >
      <HardwareDesign />
    </ClientOnly>
  );
}
