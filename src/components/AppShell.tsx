"use client";

import { SessionProvider, useSession } from "@/state/session";
import { CheckoutFlow } from "./CheckoutFlow";
import { Consent } from "./Consent";
import { Dashboard, ResetDialog } from "./Dashboard";
import { Landing } from "./Landing";
import { Preview } from "./Preview";
import { Processing } from "./Processing";
import { Tiers } from "./Tiers";

function StageRoot() {
  const { stage } = useSession();
  if (stage === "landing" || stage === "reading") return <Landing />;
  if (stage === "preview") return <Preview />;
  if (stage === "tier") return <Tiers />;
  if (stage === "consent") return <Consent />;
  if (stage === "checkout") return <CheckoutFlow />;
  if (stage === "processing") return <Processing />;
  return (
    <>
      <Dashboard />
      <ResetDialog />
    </>
  );
}

export function AppShell() {
  return (
    <SessionProvider>
      <StageRoot />
    </SessionProvider>
  );
}
