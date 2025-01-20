import { auth } from "@/app/auth";
import DashboardLayout from "@/components/layout/dashboard-layout";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <style jsx global>{`
        header:first-child {
          display: none;
        }
      `}</style>
      <DashboardLayout>{children}</DashboardLayout>
    </div>
  );
} 