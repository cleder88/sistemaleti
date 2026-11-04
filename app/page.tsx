import { CheckCircle2, Database, FileText, BarChart3, Smartphone } from "lucide-react";

export default function HomePage() {
  const features = [
    {
      icon: Database,
      title: "Supabase SSR & Admin",
      description: "Clientes configurados para Browser, Server Components e Service Role.",
    },
    {
      icon: BarChart3,
      title: "Recharts & UI",
      description: "Tailwind CSS, Lucide Icons, clsx, tailwind-merge e gráficos Recharts.",
    },
    {
      icon: FileText,
      title: "Leitura de PDF",
      description: "Pacote pdf-parse configurado para processamento em rotas de servidor.",
    },
    {
      icon: Smartphone,
      title: "Suporte a PWA",
      description: "Manifesto e Service Worker configurados com @ducanh2912/next-pwa.",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Base Next.js 14+ Pronta
        </div>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
          Sistema Inicializado
        </h1>
        <p className="mt-2 text-slate-600">
          Estrutura base com App Router, TypeScript, Tailwind CSS, Supabase e suporte a PWA configurada com sucesso.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-semibold text-slate-900">{item.title}</h2>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
