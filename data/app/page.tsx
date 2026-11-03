import { AssistantPanel } from "@/components/AssistantPanel/AssistantPanel";

export default function Home() {
  return (
    <main
      className="min-h-screen bg-cover bg-center bg-fixed bg-no-repeat p-10"
      style={{
        backgroundImage:
          "linear-gradient(rgba(15,23,42,0.75), rgba(15,23,42,0.85)), url('https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80')",
      }}
    >
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-white">
          Approvals &amp; Review
        </h1>
        <div className="flex justify-end">
          <AssistantPanel />
        </div>
      </div>
    </main>
  );
}