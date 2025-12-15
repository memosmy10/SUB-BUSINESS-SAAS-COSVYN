
// Load Razorpay Script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface PaymentProps {
  amount: number; // in Rupees
  planName: string;
  userEmail: string;
  userContact: string;
  businessName?: string;
  onSuccess: (paymentId: string) => void;
  onFailure?: (error: any) => void;
}

export const handleRazorpayPayment = async ({
  amount,
  planName,
  userEmail,
  userContact,
  businessName,
  onSuccess,
  onFailure
}: PaymentProps) => {
  const res = await loadRazorpayScript();

  if (!res) {
    alert('Razorpay SDK failed to load. Please check your internet connection.');
    return;
  }

  // REPLACE THIS WITH YOUR ACTUAL KEY ID
  const RAZORPAY_KEY_ID = 'rzp_live_RmI0NXqEhYfbfl'; 

  const options = {
    key: RAZORPAY_KEY_ID, 
    amount: Math.round(amount * 100), // Amount is in paise (e.g. 10000 paise = 100 INR)
    currency: "INR",
    name: "ScaleKitchen", // Or your company name
    description: `Subscription: ${planName}`,
    image: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png", // You can replace this with your logo URL
    handler: function (response: any) {
      // Success Callback
      if (response.razorpay_payment_id) {
        onSuccess(response.razorpay_payment_id);
      } else {
        if (onFailure) onFailure("Payment ID missing");
      }
    },
    prefill: {
      name: businessName || "Business Owner",
      email: userEmail,
      contact: userContact,
    },
    notes: {
      plan_name: planName,
    },
    theme: {
      color: "#0d40e6", // Primary Brand Color
    },
    modal: {
      ondismiss: function() {
        if (onFailure) onFailure("Cancelled by user");
      }
    }
  };

  try {
    const paymentObject = new (window as any).Razorpay(options);
    paymentObject.open();
  } catch (err) {
    console.error("Razorpay Error:", err);
    if (onFailure) onFailure(err);
  }
};
