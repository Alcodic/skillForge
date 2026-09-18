import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getMaterialById } from "../api/materialsApi";

function LearningEnvironment() {
  const { materialId } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialById(materialId),
  });

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">Loading learning material...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-semibold">Unable to load material</h1>

          <p className="mt-2 text-muted-foreground">{error.message}</p>
        </div>
      </main>
    );
  }

  const material = data.material;

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Learning Environment</p>

          <h1 className="mt-2 text-3xl font-semibold">{material.title}</h1>

          <p className="mt-2 text-muted-foreground">
            {material.originalFileName}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-lg border border-border px-3 py-2 text-sm">
              {material.fileType.toUpperCase()}
            </span>

            <span className="rounded-lg border border-border px-3 py-2 text-sm">
              {(material.fileSize / 1000000).toFixed(1)} MB
            </span>

            <span className="rounded-lg border border-border px-3 py-2 text-sm">
              {material.processingStatus}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

export default LearningEnvironment;
