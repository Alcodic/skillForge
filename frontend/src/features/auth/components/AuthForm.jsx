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

    setFormData((previousData) => ({ ...previousData, [name]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    console.log("Form Submitted: ", formData);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>

      {!isLogin && <input type="text" placeholder="Name" />}

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
