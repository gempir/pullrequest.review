import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/oauth/callback")({
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3 bg-secondary">
          <span className="text-[13px] font-medium">Redirecting</span>
        </div>
        <div className="p-6">
          <div className="text-[13px] text-muted-foreground">Returning home...</div>
        </div>
      </div>
    </div>
  );
}
