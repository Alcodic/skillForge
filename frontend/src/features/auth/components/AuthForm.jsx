import { useState } from "react";

function AuthForm({ mode }) {
  const isLogin = mode === "login";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const endpoint = isLogin
      ? "http://localhost:5001/api/auth/login"
      : "http://localhost:5001/api/auth/register";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
    }

    console.log("Form Submitted:", data);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>

      {!isLogin && (
        <input
          type="text"
          name="name"
          placeholder="Name"
          value={formData.name}
          onChange={handleChange}
        />
      )}

      <input
        type="email"
        name="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange}
      />

      <input
        type="password"
        name="password"
        placeholder="Password"
        value={formData.password}
        onChange={handleChange}
      />

      <button type="submit">{isLogin ? "Login" : "Create Account"}</button>
    </form>
  );
}

export default AuthForm;
