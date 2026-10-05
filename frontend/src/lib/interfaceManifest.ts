import schema from "../../../contracts/schema.json";

export const frontendInterfaceManifest = schema;
export const frontendWrites = schema.methods.filter((method) => method.kind === "write");

export function manifestMethod(name: string) {
  const method = schema.methods.find((candidate) => candidate.name === name);
  if (!method) throw new Error(`Unknown Procurement_V1 method: ${name}`);
  return method;
}
