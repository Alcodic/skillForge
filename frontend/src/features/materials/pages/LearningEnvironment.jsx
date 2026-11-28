import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getMaterialById, getMaterialReader } from "../api/materialsApi";

const getSourcePageLabel = (source) => {
  const { pageStart, pageEnd } = source ?? {};

  if (!Number.isInteger(pageStart) || pageStart < 1) {
    return null;
  }

  if (pageEnd === undefined || pageEnd === null || pageEnd === pageStart) {
    return `Page ${pageStart}`;
  }

  if (!Number.isInteger(pageEnd) || pageEnd < pageStart) {
    return `Page ${pageStart}`;
  }

  return `Pages ${pageStart}–${pageEnd}`;
};

function LearningEnvironment() {
  const { materialId } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialById(materialId),
    enabled: Boolean(materialId),
  });

  const material = data?.material;

  const {
    data: readerData,
    isLoading: isReaderLoading,
    isError: isReaderError,
    error: readerError,
    refetch: refetchReader,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["material", materialId, "reader"],
    queryFn: ({ pageParam }) =>
      getMaterialReader(materialId, {
        limit: 20,
        afterSequence: pageParam,
      }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNextPage
        ? lastPage.pagination.nextCursor
        : undefined,
    enabled: Boolean(materialId && material?.processingStatus === "READY"),
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

  const chunks = readerData?.pages.flatMap((page) => page.chunks) ?? [];

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl space-y-6">
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

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-semibold">Learning Material</h2>

          {material.processingStatus !== "READY" && (
            <p className="mt-4 text-muted-foreground">
              This material is not ready for reading yet.
            </p>
          )}

          {material.processingStatus === "READY" && isReaderLoading && (
            <p className="mt-4 text-muted-foreground">
              Loading document content...
            </p>
          )}

          {material.processingStatus === "READY" && isReaderError && (
            <div className="mt-4 space-y-3">
              <p className="text-destructive">
                Unable to load document content: {readerError.message}
              </p>

              <button
                onClick={() => refetchReader()}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {material.processingStatus === "READY" &&
            !isReaderLoading &&
            !isReaderError &&
            chunks.length === 0 && (
              <p className="mt-4 text-muted-foreground">
                No readable content is available in this material.
              </p>
            )}

          {chunks.length > 0 && (
            <div className="mt-6 space-y-5">
              {chunks.map((chunk) => {
                const sourcePageLabel = getSourcePageLabel(chunk.source);

                return (
                  <article
                    key={chunk.chunkId}
                    className="rounded-lg border border-border p-5"
                  >
                    {sourcePageLabel && (
                      <p className="mb-3 text-xs font-medium text-muted-foreground">
                        {sourcePageLabel}
                      </p>
                    )}

                    <p className="whitespace-pre-wrap leading-7 text-foreground">
                      {chunk.text}
                    </p>
                  </article>
                );
              })}
            </div>
          )}

          {hasNextPage && (
            <div className="mt-6">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage ? "Loading more content..." : "Load More"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default LearningEnvironment;
