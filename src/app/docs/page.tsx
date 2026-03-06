"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Book, Rocket, ArrowRightLeft, Tag, Brain, Settings, Wrench, Shield, HelpCircle, Code } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface NavSection {
  title: string;
  items: { slug: string; title: string }[];
}

const sectionIcons: Record<string, React.ReactNode> = {
  "Inicio": <Book className="h-5 w-5" />,
  "Configuración": <Settings className="h-5 w-5" />,
  "Integraciones": <Rocket className="h-5 w-5" />,
  "Funcionalidades": <ArrowRightLeft className="h-5 w-5" />,
  "Inteligencia Artificial": <Brain className="h-5 w-5" />,
  "Operaciones": <Wrench className="h-5 w-5" />,
  "Administración": <Shield className="h-5 w-5" />,
  "Soporte": <HelpCircle className="h-5 w-5" />,
  "Referencia Técnica": <Code className="h-5 w-5" />,
};

export default function DocsHome() {
  const [sections, setSections] = useState<NavSection[]>([]);

  useEffect(() => {
    fetch("/api/docs/nav")
      .then((r) => r.json())
      .then(setSections)
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Documentación de Adagio Replenishment</h1>
        <p className="text-lg text-muted-foreground">
          Guía completa para configurar, operar y mantener tu sistema de reposición de inventario.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                {sectionIcons[section.title] || <Book className="h-5 w-5" />}
                <CardTitle className="text-lg">{section.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/docs/${item.slug}`}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      → {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-muted/50 rounded-lg">
        <h2 className="font-semibold mb-2">Inicio rápido</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            <Link href="/docs/getting-started" className="text-primary hover:underline">
              Configura el Wizard
            </Link>{" "}
            — conecta Shopify y mapea tus locations
          </li>
          <li>
            <Link href="/docs/cogs" className="text-primary hover:underline">
              Importa COGS
            </Link>{" "}
            — para análisis de capital atado
          </li>
          <li>
            <Link href="/docs/transfers" className="text-primary hover:underline">
              Revisa Transfers
            </Link>{" "}
            — ejecuta tu primer plan de reposición
          </li>
          <li>
            <Link href="/docs/playbook" className="text-primary hover:underline">
              Lee el Playbook
            </Link>{" "}
            — rutina diaria recomendada
          </li>
        </ol>
      </div>
    </div>
  );
}
