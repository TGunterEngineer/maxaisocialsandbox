import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function SmsTopupDialog({ open, onOpenChange, organizationId }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const returnUrl = `${window.location.origin}/billing/return?session_id={CHECKOUT_SESSION_ID}&topup=1`;
    const { data, error } = await supabase.functions.invoke("create-sms-topup", {
      body: {
        organizationId,
        returnUrl,
        bundle: "sms_topup_500",
        environment: getStripeEnvironment(),
      },
    });
    if (error || !data?.clientSecret) {
      throw new Error(error?.message || "Failed to start top-up checkout");
    }
    return data.clientSecret as string;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buy 500 SMS credits</DialogTitle>
          <DialogDescription>
            Credits are added to your account immediately after payment and never expire.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <div id="sms-topup-checkout">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
