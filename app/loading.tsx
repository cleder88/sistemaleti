import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3 text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium text-inkMuted">Carregando...</p>
      </div>
    </div>
  );
}
