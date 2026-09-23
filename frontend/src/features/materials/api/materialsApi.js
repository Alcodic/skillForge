export async function getMaterials() {
  const token = localStorage.getItem("token");

  const response = await fetch("http://localhost:5001/api/materials", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch materials");
  }

  if (!data.success) {
    throw new Error(data.message || "Failed to fetch materials");
  }

  return data.data;
}

export async function getMaterialById(materialId) {
  const token = localStorage.getItem("token");

  const response = await fetch(
    `http://localhost:5001/api/materials/${materialId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to fetch material");
  }
  if (!data.success) {
    throw new Error(data.message || "Failed to fetch material");
  }
  return data.data;
}

export async function uploadMaterial({ title, file,idempotencyKey }) {
  const token = localStorage.getItem("token");

  

  const formData = new FormData();

  formData.append("title", title);
  formData.append("file", file);

  const response = await fetch("http://localhost:5001/api/materials", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": idempotencyKey,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to upload material");
  }

  if (!data.success) {
    throw new Error(data.message || "Failed to upload material");
  }

  return data.data;
}
