import crypto from 'crypto';

export const verifyRazorpayWebhookSignature = (
  rawBody: string,
  receivedSignature: string
): boolean => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (
    !webhookSecret ||
    !receivedSignature ||
    !/^[a-f0-9]{64}$/i.test(receivedSignature)
  ) return false;
  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest();
    const signature = Buffer.from(receivedSignature, 'hex');
    if (signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(
      expectedSignature,
      signature
    );
  } catch {
    return false;
  }
};
