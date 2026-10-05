import iface from "../../../contracts/interface.json";

export const contractInterface = iface as { schemaVersion: string; methods: string[] };
export const publicMethods = contractInterface.methods;
