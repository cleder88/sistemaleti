import { CheckCircle2, Database, FileText, BarChart3, Smartphone } from "lucide-react";
import { Badge, Card } from "@/components/ui";

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
      <Card className="p-8">
        <Badge variant="success">
          <CheckCircle2 className="h-4 w-4" />
          Base Next.js 14+ Pronta
        </Badge>

        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink">
          Sistema Inicializado
        </h1>
        <p className="mt-2 text-inkSoft">
          Estrutura base com App Router, TypeScript, Tailwind CSS, Supabase e suporte a PWA configurada com sucesso.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                variant="muted"
                className="p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-black">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-semibold text-ink">{item.title}</h2>
                </div>
                <p className="mt-2 text-sm text-inkSoft">{item.description}</p>
              </Card>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
