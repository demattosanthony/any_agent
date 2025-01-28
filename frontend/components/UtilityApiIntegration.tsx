import Image from "next/image";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import api from "@/lib/api";
import { useMeQuery } from "@/queries/queries";

export default function UtilityApiIntegration() {
  const { data: user } = useMeQuery();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const referral = searchParams.get("referral");

    if (referral) {
      // Clear the URL parameter
      router.replace("/settings");

      // Handle the authorization
      const handleAuthorization = async () => {
        try {
          const res = await api.getAuthorizations({
            referrals: [referral],
            include: ["meters"],
          });

          const meters = res.authorizations[0].meters?.meters;

          // Get historical data
          await api.triggerHistoricalCollection(meters.map((m: any) => m.uid));
        } catch (error) {
          console.error("Error processing utility connection:", error);
        }
      };

      handleAuthorization();
    }
  }, [searchParams]);

  // Update the click handler
  const handleUtilityConnect = async () => {
    const form = await api.createUtilityApiForm(user?.email || "");
    window.open(form.url, "_blank");
  };

  return (
    <section className="space-y-4">
      <h2 className="text-base font-medium">Integrations</h2>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <Image
            src="/utility-icon.ico"
            alt="Utility API svg"
            width={35}
            height={35}
          />

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Utility API</h3>

              <Badge
                variant="secondary"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
              >
                New
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Connection your utility bills to Yo for better insights.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={handleUtilityConnect}
        >
          Connect
        </Button>
      </div>
    </section>
  );
}
