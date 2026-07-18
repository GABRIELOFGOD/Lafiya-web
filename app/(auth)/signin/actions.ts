"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { logError } from "@/lib/logging/logger";

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export interface SignInState {
  error?: string;
}

export async function signIn(
  _prevState: SignInState | undefined,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logError("Sign in failed", error, {
      route: "/signin (action: signIn)",
      email: parsed.data.email,
    });
    return { error: "Incorrect email or password." };
  }

  redirect("/profile");
}
