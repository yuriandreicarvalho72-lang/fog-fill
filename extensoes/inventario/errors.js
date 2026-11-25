export function reason(error) {
  if (typeof error === "string" && error.trim()) return error;
  const detail = error?.message ?? error?.error ?? error?.reason ?? error?.name;
  return detail && detail !== error ? reason(detail) : "O serviço não informou o motivo.";
}
