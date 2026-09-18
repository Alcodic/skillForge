import { useQuery } from "@tanstack/react-query";

import { getMaterials } from "../api/materialsApi";
import MaterialCard from "../components/MaterialCard";

function MyLearning() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["materials"],
    queryFn: getMaterials,
  });

  if (isLoading) {
    return <h1>Loading your materials...</h1>;
  }

  if (error) {
    return <h1>Error: {error.message}</h1>;
  }

  const materials = data.materials;

  if (materials.length === 0) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-semibold">My Learning</h1>

          <div className="mt-8 rounded-xl border border-border bg-card p-10 text-center">
            <h2 className="text-xl font-semibold">
              Start your learning journey
            </h2>

            <p className="mt-2 text-muted-foreground">
              You don't have any learning material yet.
            </p>

            <button className="mt-6 rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">
              Upload Material
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-semibold">My Learning</h1>

        <div className="mt-8 space-y-4">
          {materials.map((material) => (
            <MaterialCard key={material.id} material={material} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default MyLearning;
