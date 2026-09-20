"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  username: string | null;
  location: string | null;
  website: string | null;
  businessName: string | null;
  taxId: string | null;
  createdAt: string | Date;
}

const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  email: z.string().email("Invalid email address"),
  bio: z.string().max(500, "Bio must be under 500 characters").optional(),
  location: z.string().max(100).optional(),
  website: z
    .string()
    .optional()
    .refine((v) => !v || /^https?:\/\//.test(v), "Must start with http:// or https://"),
  businessName: z.string().max(200).optional(),
  taxId: z.string().max(50).optional(),
});

const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

function getInitials(name: string | null) {
  if (!name) return "U";
  return name.trim()[0]?.toUpperCase() || "U";
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const { toast } = useToast();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.image);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: profile.name || "",
      username: profile.username || "",
      email: profile.email,
      bio: profile.bio || "",
      location: profile.location || "",
      website: profile.website || "",
      businessName: profile.businessName || "",
      taxId: profile.taxId || "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max size is 5MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) setAvatarPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const onSaveProfile = async (data: z.infer<typeof profileFormSchema>) => {
    setIsSavingProfile(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(avatarPreview !== profile.image && { image: avatarPreview || "" }),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to update profile");

      toast({ title: "Success", description: "Your profile has been updated." });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onChangePassword = async (data: z.infer<typeof passwordFormSchema>) => {
    setIsSavingPassword(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to change password");

      toast({ title: "Success", description: "Your password has been changed." });
      passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="grid gap-6 lg:max-w-3xl">
      {/* Profile */}
      <Card>
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)}>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                This information may be visible to buyers on the platforms you list to.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border">
                  <AvatarImage src={avatarPreview || undefined} alt={profile.name || "Avatar"} className="object-cover" />
                  <AvatarFallback className="bg-primary/10 text-lg text-primary">
                    {getInitials(profile.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <Button asChild type="button" variant="outline" size="sm">
                    <label className="cursor-pointer">
                      Change photo
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                    </label>
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">PNG or JPG, up to 5MB.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jane Seller" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="janeseller" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} placeholder="you@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Tell buyers a bit about your shop..." className="h-24" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="City, State" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={profileForm.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://your-shop.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={profileForm.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business name (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jane's Vintage Co." />
                      </FormControl>
                      <FormDescription>Used on invoices/receipts if you sell as a business.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="taxId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tax ID / EIN (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="12-3456789" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t px-6 py-4">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Saving..." : "Save changes"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Password */}
      <Card>
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)}>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Change the password you use to sign in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
            <CardFooter className="justify-end border-t px-6 py-4">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Saving..." : "Change password"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {/* Explicit locale/timezone - the server (Node) and browser can have
              different default locales, and letting toLocaleDateString() pick
              its own would cause a hydration mismatch since this is rendered
              both during SSR and on the client. */}
          <p>
            Member since{" "}
            {new Date(profile.createdAt).toLocaleDateString("en-US", {
              timeZone: "UTC",
            })}
          </p>
          <p className="mt-1">
            Manage your eBay and other marketplace connections on the{" "}
            <a href="/dashboard/platforms" className="underline">
              Platforms
            </a>{" "}
            page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
