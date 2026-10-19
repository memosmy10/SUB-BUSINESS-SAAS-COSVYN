import { createRazorpayOrderCallable, verifyRazorpayPaymentCallable } from './firebase';

// Load Razorpay Script dynamically
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof (window as any).Razorpay !== 'undefined') {
      return resolve(true);
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface ServerPaymentProps {
  planId: string;
  planName?: string;
  userEmail?: string;
  userContact?: string;
  businessName?: string;
  onSuccess: (result: { paymentId: string; planExpiryDate?: string; planStatus?: string }) => void;
  onFailure?: (error: any) => void;
}

/**
 * Initiates Razorpay payment via secure server-side order creation and verification (Phase 3).
 *
 * 1. The client NEVER computes or sends the price to Razorpay.
 * 2. createRazorpayOrder reads the authoritative price on the server from Firebase Secret Manager.
 * 3. verifyRazorpayPayment verifies razorpay_signature on the server and computes expiry.
 * 4. Only the server updates planName, planStatus, planExpiryDate, and billing_history.
 */
export const handleRazorpayPayment = async ({
  planId,
  planName,
  userEmail = '',
  userContact = '',
  businessName = 'Business Owner',
  onSuccess,
  onFailure
}: ServerPaymentProps | any) => {
  try {
    const isSdkLoaded = await loadRazorpayScript();
    if (!isSdkLoaded) {
      const err = new Error('Razorpay SDK failed to load. Please check your internet connection.');
      alert(err.message);
      if (onFailure) onFailure(err);
      return;
    }

    // Determine target plan ID (supports legacy planName if planId is omitted)
    const effectivePlanId = planId || planName || 'Monthly';

    // 1. Create server-side order (Server determines authoritative price in integer paise)
    const orderRes = await createRazorpayOrderCallable({ planId: effectivePlanId });
    const { orderId, amount, currency, keyId, planName: resolvedPlanName } = orderRes.data;

    if (!orderId) {
      throw new Error('Server failed to return an order ID for payment.');
    }

    // 2. Open Razorpay Checkout bound to server order_id
    const options = {
      key: keyId,
      order_id: orderId, // Strictly bound to server-side order
      amount: amount,    // in integer paise, matching the server order
      currency: currency || 'INR',
      name: 'ScaleKitchen',
      description: `Subscription: ${resolvedPlanName || effectivePlanId}`,
      image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      handler: async function (response: any) {
        try {
          const razorpayPaymentId = response.razorpay_payment_id;
          const razorpayOrderId = response.razorpay_order_id || orderId;
          const razorpaySignature = response.razorpay_signature;

          if (!razorpayPaymentId) {
            throw new Error('Razorpay payment ID was missing in payment response.');
          }

          // 3. Verify payment signature and fulfill subscription on the server
          const verifyRes = await verifyRazorpayPaymentCallable({
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: razorpaySignature
          });

          onSuccess({
            paymentId: razorpayPaymentId,
            planExpiryDate: verifyRes.data?.planExpiryDate,
            planStatus: verifyRes.data?.planStatus || 'Active'
          });
        } catch (verifyError: any) {
          console.error('[Razorpay Verification Error]:', verifyError);
          const msg = verifyError?.message || 'Payment verification failed on the server. Please contact support.';
          alert(msg);
          if (onFailure) onFailure(verifyError);
        }
      },
      prefill: {
        name: businessName,
        email: userEmail,
        contact: userContact,
      },
      notes: {
        plan_id: effectivePlanId,
      },
      theme: {
        color: '#0d40e6',
      },
      modal: {
        ondismiss: function () {
          if (onFailure) onFailure(new Error('Payment cancelled by user.'));
        }
      }
    };

    const paymentObject = new (window as any).Razorpay(options);
    paymentObject.open();
  } catch (err: any) {
    console.error('[Razorpay Initialization Error]:', err);
    if (onFailure) onFailure(err);
  }
};
