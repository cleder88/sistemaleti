import Link from "next/link";
import { LayoutDashboard, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#121217] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <SearchX className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-white">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          O endereço acessado não existe ou foi movido.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-amber-400"
        >
          <LayoutDashboard className="h-4 w-4" />
          Ir para o Dashboard
        </Link>
      </div>
    </div>
  );
}
