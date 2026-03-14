import { PublicLayout } from "@/components/public/public-layout";

export default async function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PublicLayout>{children}</PublicLayout>;
}
