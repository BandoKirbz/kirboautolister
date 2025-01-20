import { Metadata } from "next"
import AddProductForm from "@/components/forms/add-product-form"

export const metadata: Metadata = {
  title: "Add Product",
  description: "Add a new product to your inventory",
}

export default function AddProductPage() {
  return (
    <div className="flex-1 p-8 pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Add Product</h2>
        <p className="text-muted-foreground">
          Create a new product listing to sell across multiple platforms
        </p>
      </div>
      <AddProductForm />
    </div>
  )
} 