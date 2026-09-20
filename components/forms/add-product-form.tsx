"use client";

import React, { useCallback, useEffect, useState } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Camera, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// Form schema with validation
const productFormSchema = z.object({
  images: z.array(z.string()).min(1, "At least one image is required"),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  // Optional, but Brand is the single most common required "item specific"
  // on real eBay categories - sending it (as an aspect) is often the
  // difference between a listing publishing and getting rejected outside
  // of aspect-free fallback categories.
  brand: z.string().optional(),
  condition: z.enum(["new-with-tags", "new-without-tags", "very-good", "good", "fair"]),
  price: z.number().min(0.01, "Price must be greater than 0"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  platforms: z.array(z.string()).default([]),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

type PlatformConnectionStatus = {
  id: string;
  name: string;
  logo: string;
  availability: "available" | "coming_soon";
  connected: boolean;
  username?: string | null;
};

const conditions = [
  { value: "new-with-tags", label: "New with tags" },
  { value: "new-without-tags", label: "New without tags" },
  { value: "very-good", label: "Very good" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
];

export default function AddProductForm() {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [platformStatuses, setPlatformStatuses] = useState<PlatformConnectionStatus[]>([]);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      images: [],
      title: "",
      description: "",
      brand: "",
      condition: "new-with-tags",
      price: 0,
      quantity: 1,
      platforms: [],
    },
  });

  // Load real platform connection status (never hardcode "Connected")
  useEffect(() => {
    async function loadPlatforms() {
      try {
        const response = await fetch("/api/platforms");
        if (!response.ok) throw new Error("Failed to load platforms");
        const data = await response.json();
        setPlatformStatuses(data.platforms || []);
      } catch (error) {
        console.error("Failed to load platform status:", error);
        toast({
          title: "Warning",
          description: "Could not load platform connection status",
          variant: "destructive",
        });
      }
    }
    loadPlatforms();
  }, [toast]);

  // Load existing product data if editing
  useEffect(() => {
    async function loadProduct() {
      if (!editId) return;

      try {
        const response = await fetch(`/api/products/${editId}`);
        if (!response.ok) throw new Error("Failed to fetch product");

        const product = await response.json();

        // Parse the price string to remove the $ and convert to number
        const price =
          typeof product.price === "string"
            ? parseFloat(product.price.replace("$", ""))
            : product.price;

        form.reset({
          images: product.images.map((img: { url: string }) => img.url),
          title: product.name,
          description: product.description,
          brand: product.brand || "",
          condition: product.condition,
          price: price,
          quantity: product.quantity,
          platforms: product.listings.map((l: any) => l.platform.id),
        });
      } catch (error) {
        console.error("Failed to load product:", error);
        toast({
          title: "Error",
          description: "Failed to load product data",
          variant: "destructive",
        });
      }
    }

    loadProduct();
  }, [editId, form, toast]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsUploading(true);
      const failedUploads: string[] = [];

      try {
        const imagePromises = acceptedFiles.map(
          (file) =>
            new Promise<{ success: boolean; result: string; fileName: string }>((resolve) => {
              // Validate file type
              if (!file.type.startsWith("image/")) {
                resolve({ success: false, result: "Not an image file", fileName: file.name });
                return;
              }

              // Validate file size (5MB)
              if (file.size > 5 * 1024 * 1024) {
                resolve({
                  success: false,
                  result: "File too large (max 5MB)",
                  fileName: file.name,
                });
                return;
              }

              // Create object URL first as a fallback
              const objectUrl = URL.createObjectURL(file);

              const reader = new FileReader();

              reader.onload = (e) => {
                try {
                  // If FileReader succeeds, use its result
                  const result = e.target?.result as string;
                  if (result) {
                    URL.revokeObjectURL(objectUrl); // Clean up object URL
                    resolve({ success: true, result, fileName: file.name });
                  } else {
                    resolve({ success: false, result: objectUrl, fileName: file.name });
                  }
                } catch (error) {
                  resolve({ success: false, result: "Failed to read file", fileName: file.name });
                }
              };

              reader.onerror = () => {
                resolve({ success: false, result: "Failed to read file", fileName: file.name });
              };

              // Add timeout for Safari
              const timeout = setTimeout(() => {
                reader.abort();
                resolve({ success: false, result: "Upload timeout", fileName: file.name });
              }, 5000);

              reader.onloadend = () => {
                clearTimeout(timeout);
              };

              // Start reading the file
              try {
                reader.readAsDataURL(file);
              } catch (error) {
                resolve({ success: false, result: "Failed to read file", fileName: file.name });
              }
            })
        );

        const results = await Promise.all(imagePromises);

        // Separate successful and failed uploads
        const successfulUploads = results.filter((r) => r.success).map((r) => r.result);
        const failedFiles = results.filter((r) => !r.success).map((r) => r.fileName);

        // Update form with successful uploads
        const currentImages = form.getValues("images");
        const totalImages = [...currentImages, ...successfulUploads].slice(0, 12);
        form.setValue("images", totalImages);

        // Show error toast for failed uploads
        if (failedFiles.length > 0) {
          toast({
            title: "Failed Uploads",
            description: `Failed to upload: ${failedFiles.join(", ")}`,
            variant: "destructive",
          });
        }

        // Show warning if maximum images reached
        if (totalImages.length >= 12) {
          toast({
            title: "Maximum images reached",
            description: "You can only upload up to 12 images.",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to upload one or more images. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [form, toast]
  );

  // Add cleanup function for object URLs
  React.useEffect(() => {
    return () => {
      // Clean up object URLs when component unmounts
      form.getValues("images").forEach((image) => {
        if (image.startsWith("blob:")) {
          URL.revokeObjectURL(image);
        }
      });
    };
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxSize: 5242880, // 5MB
    multiple: true, // Enable multiple file selection
  });

  const onSubmit = async (data: ProductFormValues, isDraft: boolean = false) => {
    try {
      setIsUploading(true);

      // If we have an editId, update the existing product instead of creating a new one
      const url = editId ? `/api/products/${editId}` : "/api/products";
      const method = editId ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isDraft }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage =
          result.error?.errors?.[0]?.message || result.error || "Failed to save product";
        throw new Error(errorMessage);
      }

      // The API returns 200 even when the product itself saved fine but
      // publishing/syncing to a platform (e.g. eBay) failed - that failure
      // was previously silent to the user. Surface it explicitly.
      if (result.warning) {
        toast({
          title: "Saved with a warning",
          description: result.warning,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: isDraft
            ? editId
              ? "Draft updated successfully"
              : "Draft saved successfully"
            : editId
              ? "Product updated successfully"
              : "Product created successfully",
        });
      }
      router.push("/dashboard");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageReorder = (result: any) => {
    if (!result.destination) return;

    const images = form.getValues("images");
    const [reorderedItem] = images.splice(result.source.index, 1);
    images.splice(result.destination.index, 0, reorderedItem);
    form.setValue("images", images);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Upload Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {/* Main upload box */}
                <div
                  {...getRootProps()}
                  className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-blue-500"
                >
                  <input {...getInputProps()} />
                  {isUploading ? (
                    <div className="flex flex-col items-center">
                      <div className="animate-spin">
                        <svg
                          className="h-8 w-8 text-gray-400"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                      </div>
                      <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <Camera className="mb-2 h-8 w-8 text-gray-400" />
                      <span className="text-center text-sm text-gray-500">
                        {isDragActive
                          ? "Drop files here"
                          : "Drag & drop or click to upload\nSelect multiple images"}
                      </span>
                    </>
                  )}
                </div>

                {/* Image previews */}
                <DragDropContext onDragEnd={handleImageReorder}>
                  <Droppable droppableId="images" direction="horizontal">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="col-span-2 grid grid-cols-2 gap-4 md:grid-cols-3"
                      >
                        {form.watch("images").map((image, index) => (
                          <Draggable key={index} draggableId={`image-${index}`} index={index}>
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="relative aspect-square rounded-lg bg-gray-100"
                              >
                                <img
                                  src={image}
                                  alt={`Product image ${index + 1}`}
                                  className="h-full w-full rounded-lg object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const images = form
                                      .getValues("images")
                                      .filter((_, i) => i !== index);
                                    form.setValue("images", images);
                                  }}
                                  className="absolute right-2 top-2 rounded-full bg-white p-1 shadow-lg hover:bg-gray-100"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>

              <p className="mt-4 text-sm text-gray-500">
                Add up to 12 photos. First photo will be the cover (drag to reorder)
              </p>
              <FormMessage>{form.formState.errors.images?.message}</FormMessage>
            </CardContent>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Vintage Levi's 501 Jeans" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Describe your item's features, flaws, and history..."
                        className="h-32"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Levi's, Nike, Apple" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condition</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="grid grid-cols-2 gap-2"
                      >
                        {conditions.map((condition) => (
                          <div key={condition.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={condition.value} id={condition.value} />
                            <Label htmlFor={condition.value}>{condition.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                            $
                          </span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            value={field.value}
                            className="pl-7"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          value={field.value}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Choose Platforms</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="platforms"
                render={() => (
                  <FormItem>
                    <div className="space-y-4">
                      {platformStatuses.map((platform) => {
                        const canSelect =
                          platform.availability === "available" && platform.connected;
                        const statusLabel =
                          platform.availability === "coming_soon"
                            ? "Coming soon"
                            : platform.connected
                              ? platform.username
                                ? `Connected as ${platform.username}`
                                : "Connected"
                              : "Not connected";

                        return (
                          <div
                            key={platform.id}
                            className={`flex items-center space-x-4 rounded-lg border p-4 ${
                              canSelect
                                ? "hover:border-blue-500"
                                : "opacity-60"
                            }`}
                          >
                            <FormField
                              control={form.control}
                              name="platforms"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(platform.id)}
                                      disabled={!canSelect}
                                      onCheckedChange={(checked) => {
                                        if (!canSelect) return;
                                        const current = field.value || [];
                                        const updated = checked
                                          ? [...current, platform.id]
                                          : current.filter((id) => id !== platform.id);
                                        field.onChange(updated);
                                      }}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="flex-1">
                              <Label className="cursor-pointer text-base">
                                <span className="mr-2">{platform.logo}</span>
                                {platform.name}
                              </Label>
                            </div>
                            <span
                              className={`text-sm ${
                                canSelect
                                  ? "text-green-600"
                                  : platform.availability === "coming_soon"
                                    ? "text-slate-500"
                                    : "text-amber-600"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {!platformStatuses.some((p) => p.connected) && (
                      <p className="mt-3 text-sm text-amber-700">
                        No platforms connected yet. Go to{" "}
                        <a href="/dashboard/platforms" className="underline">
                          Platforms
                        </a>{" "}
                        and connect eBay first.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-6 rounded-lg bg-blue-50 p-4">
                <h4 className="font-medium text-blue-900">Platform-specific optimizations</h4>
                <p className="mt-1 text-sm text-blue-700">
                  We'll automatically optimize your listing for each platform, including title
                  format, description layout, and image requirements.
                </p>
              </div>
            </CardContent>
          </div>
        );
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      // For final submission, validate all fields including platforms
      const data = form.getValues();
      if (!data.platforms?.length) {
        form.setError("platforms", {
          type: "manual",
          message: "Select at least one platform for final listing",
        });
        return;
      }
      const isValid = await form.trigger();
      if (isValid) {
        await form.handleSubmit((data) => onSubmit(data, false))();
      }
    } else {
      // Validate current step fields before proceeding
      const fieldsToValidate = {
        1: ["images"],
        2: ["title", "description", "condition", "price", "quantity"],
        3: ["platforms"],
      }[step];

      const isStepValid = await form.trigger(fieldsToValidate as any[]);
      if (isStepValid) {
        setStep(step + 1);
      }
    }
  };

  const handleSaveAsDraft = async () => {
    // Only validate images and title for drafts
    const isValid = await form.trigger(["images", "title"]);
    if (isValid) {
      try {
        const data = form.getValues();
        await onSubmit({ ...data, platforms: data.platforms || [] }, true);
      } catch (error) {
        console.error("Draft save error:", error);
        toast({
          title: "Error",
          description: "Failed to save draft. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Required Fields",
        description: "Please add at least one image and a title to save as draft.",
        variant: "destructive",
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((data) => onSubmit(data, false))}>
        <Card className="mx-auto max-w-2xl">
          {/* Progress indicator */}
          <div className="border-b">
            <div className="flex">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 transition-all duration-200 ${
                    i < step ? "bg-blue-500" : i === step ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              {[
                { step: 1, label: "Photos", icon: "📸" },
                { step: 2, label: "Details", icon: "📝" },
                { step: 3, label: "Platforms", icon: "🌐" },
              ].map(({ step: stepNum, label, icon }) => (
                <div
                  key={stepNum}
                  className={`flex items-center space-x-2 rounded-full px-3 py-1 transition-all duration-200 ${
                    stepNum === step
                      ? "bg-blue-50 font-medium text-blue-700 shadow-sm"
                      : stepNum < step
                        ? "text-blue-500"
                        : "text-gray-500"
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                  {stepNum < step && <span className="ml-1 text-green-500">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {renderStep()}

          <CardFooter className="flex justify-between border-t p-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(step - 1)}
                disabled={step === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isUploading}
              >
                Save as Draft
              </Button>
            </div>

            <Button type="button" onClick={handleNext} disabled={isUploading}>
              {isUploading
                ? "Saving..."
                : step === 3
                  ? "Create Listing"
                  : "Continue"}
              {!isUploading && step !== 3 && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
