
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

const getEnv = (key: string) => {
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    console.error(e);
  }
  return undefined;
};

interface PaymentProps {
  amount: number; // in Rupees
  planName: string;
  userEmail: string;
  userContact: string;
  onSuccess: (paymentId: string) => void;
  onFailure: (error: any) => void;
}

export const handleRazorpayPayment = async ({
  amount,
  planName,
  userEmail,
  userContact,
  onSuccess,
  onFailure
}: PaymentProps) => {
  const res = await loadRazorpayScript();

  if (!res) {
    alert('Razorpay SDK failed to load. Are you online?');
    return;
  }

  // In a real backend app, you would fetch the 'order_id' from your backend here.
  const options = {
    key: getEnv('REACT_APP_RAZORPAY_KEY_ID') || 'rzp_test_12345678',
    amount: amount * 100, // Amount is in paise
    currency: "INR",
    name: "COSVYN SaaS",
    description: `Subscription for ${planName}`,
    image: "https://via.placeholder.com/150", 
    handler: function (response: any) {
      onSuccess(response.razorpay_payment_id);
    },
    prefill: {
      name: "Business Owner",
      email: userEmail,
      contact: userContact,
    },
    notes: {
      address: "Cosvyn Corporate Office",
    },
    theme: {
      color: "#0d40e6", // Primary Color
    },
    modal: {
      ondismiss: function() {
        if (onFailure) onFailure("Payment Cancelled by user");
      }
    }
  };

  const paymentObject = new (window as any).Razorpay(options);
  paymentObject.open();
};
