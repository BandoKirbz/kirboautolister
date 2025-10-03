"use client";

import * as React from "react";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Icons } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

const formSchema = z.object({
  identifier: z.string().min(1, {
    message: "Please enter your email or username.",
  }),
  password: z.string().min(8, {
    message: "Password must be at least 8 characters.",
  }),
});

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null);
    startTransition(async () => {
      try {
        const signInResult = await signIn("credentials", {
          identifier: values.identifier.toLowerCase(),
          password: values.password,
          redirect: false,
          callbackUrl: searchParams?.get("from") || "/dashboard",
        });

        if (signInResult?.error) {
          setError("The email/username or password you entered is incorrect.");
          form.setError("identifier", { message: " " });
          form.setError("password", { message: " " });
        } else if (signInResult?.ok) {
          router.push(signInResult.url || "/dashboard");
          router.refresh();
        }
      } catch (error) {
        console.error("Auth error:", error);
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/15 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <FormField
          control={form.control}
          name="identifier"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or Username</FormLabel>
              <FormControl>
                <Input
                  placeholder="email or username"
                  {...field}
                  className={error ? "border-destructive" : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  {...field}
                  className={error ? "border-destructive" : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
