import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
      <div className="flex flex-col items-center gap-3 text-amber-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium text-zinc-400">Carregando...</p>
      </div>
    </div>
  );
}
