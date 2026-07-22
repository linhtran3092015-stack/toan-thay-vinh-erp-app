import { LoadingState } from "@/components/shared/loading-state";

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-[1600px] bg-canvas px-4 py-6 sm:px-5 lg:px-6">
      <LoadingState rows={6} />
    </main>
  );
}
