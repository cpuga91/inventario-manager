"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DocPage {
  slug: string;
  title: string;
  description: string;
  section: string;
  content: string;
  lastUpdated?: string;
}

export default function DocPageView() {
  const params = useParams();
  const slug = params.slug as string;
  const [doc, setDoc] = useState<DocPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/docs/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setDoc)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold mb-2">Página no encontrada</h1>
        <p className="text-muted-foreground">La documentación solicitada no existe.</p>
      </div>
    );
  }

  return (
    <article>
      <div className="mb-6 pb-4 border-b">
        <Badge variant="secondary" className="mb-2">{doc.section}</Badge>
        <h1 className="text-3xl font-bold mb-2">{doc.title}</h1>
        {doc.description && (
          <p className="text-lg text-muted-foreground">{doc.description}</p>
        )}
        {doc.lastUpdated && (
          <p className="text-xs text-muted-foreground mt-2">
            Última actualización: {doc.lastUpdated}
          </p>
        )}
      </div>
      <div className="prose prose-neutral dark:prose-invert max-w-none
        prose-headings:scroll-mt-20
        prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
        prose-h3:text-lg prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-2
        prose-p:text-sm prose-p:leading-relaxed
        prose-li:text-sm prose-li:leading-relaxed
        prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-muted prose-pre:text-xs
        prose-table:text-sm
        prose-th:text-left prose-th:font-semibold prose-th:px-3 prose-th:py-2 prose-th:border-b
        prose-td:px-3 prose-td:py-2 prose-td:border-b
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:font-semibold
        prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
      </div>
    </article>
  );
}
