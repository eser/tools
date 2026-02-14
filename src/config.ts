import { load } from "@eser/config/dotenv";

const vars = await load();

export const env: Record<string, string> = Object.fromEntries(vars);
