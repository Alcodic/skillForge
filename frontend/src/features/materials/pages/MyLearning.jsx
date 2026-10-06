import { getMaterials, uploadMaterial } from "../api/materialsApi";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import MaterialCard from "../components/MaterialCard";
import LoadingState from "@/components/common/LoadingState";
import ErrorState from "@/components/common/ErrorState";
import EmptyState from "@/components/common/EmptyState";

function MyLearning() {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);

  const fileInputRef = useRef(null);
  const retryOperationsRef = useRef(new Map());

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["materials"],
    queryFn: getMaterials,
  });

  const uploadMutation = useMutation({
    mutationFn: uploadMaterial,

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });

      retryOperationsRef.current.delete(variables.idempotencyKey);

      setTitle("");
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },

    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  const handleUpload = (event) => {
    event.preventDefault();

    if (!title.trim()) return;
    if (!file) return;

    const idempotencyKey = crypto.randomUUID();

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

  if (isLoading) {
    return (
      <LoadingState
        message="Loading your materials..."
        className="min-h-[300px]"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load your materials"
        message={error.message}
        className="min-h-[300px]"
      />
    );
  }

  const materials = data.materials;

  const canUpload =
    title.trim().length > 0 && file !== null && !uploadMutation.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="text-3xl font-semibold">My Learning</h1>

        {/* Upload Material */}
        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <div>
            <h2 className="text-xl font-semibold">Upload Material</h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Add a PDF and SkillForge will prepare it for learning.
            </p>
          </div>

          <form onSubmit={handleUpload} className="mt-6 space-y-6">
            {/* Material title */}
            <div>
              <label
                htmlFor="material-title"
                className="mb-2 block text-sm font-medium"
              >
                Material title
              </label>

              <input
                id="material-title"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Enter material title"
                disabled={uploadMutation.isPending}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* File selection */}
            <div>
              <p className="mb-2 text-sm font-medium">Learning material</p>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                id="material-file"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={uploadMutation.isPending}
                className="sr-only"
              />

              {!file ? (
                /* Empty file state */
                <label
                  htmlFor="material-file"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-10 text-center transition-colors hover:bg-muted"
                >
                  <span className="text-base font-medium">
                    Select a PDF to begin learning
                  </span>

                  <span className="mt-2 text-sm text-muted-foreground">
                    PDF files only
                  </span>

                  <span className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted">
                    Select file
                  </span>
                </label>
              ) : (
                /* Selected file state */
                <div className="relative rounded-xl border border-border bg-background p-5">
                  {/* Remove file button */}
                  {!uploadMutation.isPending && (
                    <button
                      type="button"
                      aria-label="Remove selected file"
                      onClick={() => {
                        setFile(null);

                        if (fileInputRef.current) {
                          fileInputRef.current.value = "";
                        }
                      }}
                      className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      ×
                    </button>
                  )}

                  <div className="flex flex-col gap-3 pr-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pr-10">
                    {/* File information */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium">
                          PDF
                        </span>

                        <p className="truncate text-sm font-medium">
                          {file.name}
                        </p>
                      </div>

                      <p className="mt-2 text-sm text-muted-foreground">
                        {(file.size / 1000000).toFixed(1)} MB
                      </p>
                    </div>

                    {/* Change file button */}
                    {!uploadMutation.isPending && (
                      <label
                        htmlFor="material-file"
                        className="inline-flex shrink-0 cursor-pointer items-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                      >
                        Change file
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Upload action */}
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={!canUpload}
                className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload Material"}
              </button>
            </div>

            {/* Upload error */}
            {uploadMutation.isError && (
              <div
                role="alert"
                className="rounded-lg border border-border bg-background px-4 py-3"
              >
                <p className="text-sm font-medium">Upload failed</p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {uploadMutation.error.message}
                </p>
              </div>
            )}

            {/* Upload success */}
            {uploadMutation.isSuccess && (
              <div
                role="status"
                className="rounded-lg border border-border bg-background px-4 py-3"
              >
                <p className="text-sm font-medium">
                  Material uploaded successfully.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  SkillForge is now preparing it for learning.
                </p>
              </div>
            )}
          </form>
        </section>

        {/* Materials */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Your Materials</h2>

          {materials.length === 0 ? (
            <div className="mt-6 rounded-xl border border-border bg-card p-10">
              <EmptyState
                title="Start your learning journey"
                description="You don't have any learning material yet."
              />
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
        </section>
      </div>
    </div>
  );
}

export default MyLearning;
