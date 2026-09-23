import { getMaterials, uploadMaterial } from "../api/materialsApi";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MaterialCard from "../components/MaterialCard";

function MyLearning() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);

  const queryClient = useQueryClient();
  const retryOperationsRef = useRef(new Map());

  const { data, isLoading, error } = useQuery({
    queryKey: ["materials"],
    queryFn: getMaterials,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });

  const handleUpload = (event) => {
    event.preventDefault();

    if (!title.trim()) return;
    if (!file) return;

    const idempotencyKey = crypto.randomUUID();
    console.log("NEW UPLOAD:", idempotencyKey);

    const normalizedTitle = title.trim();

    retryOperationsRef.current.set(idempotencyKey, {
      title: normalizedTitle,
      file,
    });

    uploadMutation.mutate({
      title: normalizedTitle,
      file,
      idempotencyKey,
    });
  };

  if (isLoading) {
    return <h1>Loading your materials...</h1>;
  }

  if (error) {
    return <h1>Error: {error.message}</h1>;
  }

  const materials = data.materials;

  const handleRetry = (material) => {
    const operation = retryOperationsRef.current.get(material.idempotencyKey);

    if (!operation) {
      console.error("Original upload data is unavailable for retry.");
      return;
    }

    uploadMutation.mutate({
      title: operation.title,
      file: operation.file,
      idempotencyKey: material.idempotencyKey,
    });
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold">My Learning</h1>

        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Upload Material</h2>

          <form onSubmit={handleUpload} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Material title
              </label>

              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter material title"
                className="w-full rounded-lg border border-border bg-background px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">PDF file</label>

              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files[0])}
                className="w-full"
              />
            </div>

            <button
              type="submit"
              disabled={uploadMutation.isPending}
              className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload Material"}
            </button>

            {uploadMutation.isError && (
              <p className="text-sm text-red-500">
                {uploadMutation.error.message}
              </p>
            )}

            {uploadMutation.isSuccess && (
              <p className="text-sm text-green-500">
                Material uploaded successfully.
              </p>
            )}
          </form>
        </div>

        <div className="mt-10">
          <h2 className="text-2xl font-semibold">Your Materials</h2>

          {materials.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-10 text-center">
              <h3 className="text-xl font-semibold">
                Start your learning journey
              </h3>

              <p className="mt-2 text-muted-foreground">
                You don't have any learning material yet.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {materials.map((material) => (
                <MaterialCard
                  key={material.id}
                  material={material}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default MyLearning;
