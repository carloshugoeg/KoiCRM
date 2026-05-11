import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-bold">koi-crm</h1>
      <Button asChild>
        <Link href="/app">Get Started</Link>
      </Button>
    </main>
  );
}
