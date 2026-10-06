import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function AuthForm({ mode }) {
  const navigate = useNavigate();

  const isLogin = mode === "login";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));

    if (error) {
      setError("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    const endpoint = isLogin
      ? "http://localhost:5001/api/auth/login"
      : "http://localhost:5001/api/auth/register";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      localStorage.setItem("token", data.token);

      if (isLogin) {
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    } catch (error) {
      setError(error.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">SkillForge</h1>

          <p className="mt-2 text-sm text-muted-foreground">
            Adaptive learning for deeper understanding.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-8 shadow-level-1">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {isLogin
                ? "Sign in to continue your learning journey."
                : "Start building your personalized learning journey."}
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium"
                >
                  Name
                </label>

                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                  placeholder="Enter your name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email
              </label>

              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? isLogin
                  ? "Signing in..."
                  : "Creating account..."
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <div className="mt-6 border-t border-border pt-6 text-center text-sm text-muted-foreground">
            {isLogin ? (
              <p>
                Don't have an account?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:underline"
                >
                  Create one
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default AuthForm;
