import { createRazorpayOrderCallable, verifyRazorpayPaymentCallable } from './firebase';

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof (window as any).Razorpay !== 'undefined') {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface ServerPaymentProps {
  planId: string;
  userEmail?: string;
  userContact?: string;
  businessName?: string;
  onSuccess: (result: {
    paymentId: string;
    planExpiryDate?: string;
    planStatus?: string;
    purchasedInvoiceCredits?: number;
  }) => void | Promise<void>;
  onFailure?: (error: Error) => void;
}

export const handleRazorpayPayment = async ({
  planId,
  userEmail = '',
  userContact = '',
  businessName = 'Business Owner',
  onSuccess,
  onFailure
}: ServerPaymentProps): Promise<void> => {
  let order: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    planName: string;
  };

  try {
    const response = await createRazorpayOrderCallable({ planId });
    order = response.data;
    if (
      !order.orderId ||
      !Number.isSafeInteger(order.amount) ||
      order.amount <= 0 ||
      order.currency !== 'INR' ||
      !order.keyId
    ) {
      throw new Error('The payment service returned an invalid order.');
    }
  } catch (error) {
    const orderError = error instanceof Error ? error : new Error('Could not create a verified payment order.');
    onFailure?.(orderError);
    return;
  }

  const isSdkLoaded = await loadRazorpayScript();
  if (!isSdkLoaded) {
    onFailure?.(new Error('Razorpay Checkout failed to load. Check your internet connection and try again.'));
    return;
  }

  try {
    const options = {
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: 'ScaleKitchen',
      description: order.planName,
      image: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
      prefill: {
        name: businessName,
        email: userEmail,
        contact: userContact
      },
      theme: { color: '#0d40e6' },
      handler: async (result: {
        razorpay_order_id?: string;
        razorpay_payment_id?: string;
        razorpay_signature?: string;
      }) => {
        try {
          if (
            result.razorpay_order_id !== order.orderId ||
            !result.razorpay_payment_id ||
            !result.razorpay_signature
          ) {
            throw new Error('Razorpay returned incomplete payment verification data.');
          }

          const verification = await verifyRazorpayPaymentCallable({
            orderId: order.orderId,
            paymentId: result.razorpay_payment_id,
            signature: result.razorpay_signature
          });
          if (!verification.data.success) {
            throw new Error('Payment could not be verified.');
          }

          await onSuccess({
            paymentId: result.razorpay_payment_id,
            planExpiryDate: verification.data.planExpiryDate,
            planStatus: verification.data.planStatus,
            purchasedInvoiceCredits: verification.data.purchasedInvoiceCredits
          });
        } catch (error) {
          const verificationError = error instanceof Error
            ? error
            : new Error('Payment verification failed. Contact support if your account was charged.');
          onFailure?.(verificationError);
        }
      },
      modal: {
        ondismiss: () => onFailure?.(new Error('Payment window closed.'))
      }
    };

    const checkout = new (window as any).Razorpay(options);
    checkout.on('payment.failed', (response: any) => {
      const description = response?.error?.description || 'Payment was declined by the bank or gateway.';
      onFailure?.(new Error(description));
    });
    checkout.open();
  } catch (error) {
    const launchError = error instanceof Error
      ? error
      : new Error('Could not open Razorpay Checkout.');
    onFailure?.(launchError);
  }
};
