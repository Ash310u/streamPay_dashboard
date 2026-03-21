declare module "expo-task-manager" {
  export const defineTask: (
    taskName: string,
    taskExecutor: (payload: { data?: unknown; error?: { message?: string } | null }) => Promise<void> | void
  ) => void;
}

declare module "expo-device" {
  export const isDevice: boolean;
  export const deviceName: string | null;
}

declare module "react-native-razorpay" {
  const RazorpayCheckout: {
    open(options: Record<string, unknown>): Promise<{ razorpay_payment_id?: string }>;
  };

  export default RazorpayCheckout;
}
