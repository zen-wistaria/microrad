import { toNextJsHandler } from "better-auth/next-js";
import { authPortal } from "@/lib/auth-portal";

export const { POST, GET } = toNextJsHandler(authPortal);
