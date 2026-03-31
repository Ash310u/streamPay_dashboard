import { useEffect, useMemo, useState } from "react";
import { createRealtimeClient } from "../lib/realtime";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { useAppDispatch, useAppSelector } from "../store";
import {
  Profile,
  WalletTransaction,
  CustomerOverviewRow,
  useGetProfileQuery,
  useGetWalletBalanceQuery,
  useGetCustomerSessionsQuery,
  useGetActiveSessionQuery,
  useGetActiveSessionChargeQuery,
  useGetCustomerNotificationsQuery,
  useGetWalletTransactionsQuery,
  useGetCustomerOverviewQuery,
  useLazyGetReceiptQuery,
  useTopupOrderMutation,
  useTopupVerifyMutation,
  useCheckoutSessionMutation,
  useCloseSessionMutation,
  useResumeSessionMutation,
  useDisputeSessionMutation,
  useMarkNotificationReadMutation,
  useReconcileSessionQuery
} from "../store/api";
import {
  closeCustomerDispute,
  openCustomerDispute,
  selectCustomerDashboard,
  setCustomerDashboardTab,
  setCustomerDisputeReason,
  setCustomerTopUpLoading
} from "../store/slices/customerDashboardSlice";

type Wallet = {
  balance_crypto: number;
  balance_inr_equivalent: number;
  locked_balance: number;
  currency_code: string;
};

type TopUpOrder = {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  mode: "live" | "demo";
};

type Session = {
  id: string;
  created_at: string;
  inr_equivalent: number;
  duration_seconds: number;
  status: string;
  venue_id: string;
  venues?: {
    name?: string;
    city?: string;
  };
};

type ChargeSnapshot = {
  sessionId: string;
  status: string;
  elapsedSeconds: number;
  billingUnit: string;
  lockedRate: number;
  currentChargeInr: number;
  currentChargeCrypto: number;
  merchantPayoutInr: number;
  platformFeeInr: number;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
};

const Spinner = () => (
  <div className="flex items-center justify-center py-8">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blush border-t-transparent" />
  </div>
);

const ErrorBanner = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[24px] bg-rose-500/10 border border-rose-500/20 p-4 text-sm text-rose-500">
    <p>{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="mt-2 rounded-full bg-rose-500/20 px-4 py-2 text-xs font-semibold text-rose-400 transition hover:bg-rose-500/30">
        Retry
      </button>
    )}
  </motion.div>
);

const EmptyState = ({ message }: { message: string }) => (
  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[24px] bg-charcoal/40 border border-white/5 p-5 text-sm text-slate-400">{message}</motion.p>
);

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export const CustomerDashboardPage = () => {
  const dispatch = useAppDispatch();
  const { tab, disputeSessionId, disputeReason, isTopUpLoading } = useAppSelector(selectCustomerDashboard);

  const { data: profileData } = useGetProfileQuery();
  const { data: walletData, isLoading: walletLoading, isError: walletError, refetch: walletRefetch } = useGetWalletBalanceQuery();
  const { data: sessionsData, isLoading: sessionsLoading, isError: sessionsError, refetch: sessionsRefetch } = useGetCustomerSessionsQuery();
  const { data: activeSessionData, isLoading: activeSessionLoading, refetch: activeSessionRefetch } = useGetActiveSessionQuery();
  const { data: activeChargeData, refetch: activeChargeRefetch } = useGetActiveSessionChargeQuery(activeSessionData?.id ?? "", { skip: !activeSessionData?.id, pollingInterval: 5000 });
  const { data: notificationsData, isLoading: notificationsLoading, isError: notificationsError, refetch: notificationsRefetch } = useGetCustomerNotificationsQuery();
  const { data: walletTxData, isLoading: walletTxLoading, isError: walletTxError, refetch: walletTxRefetch } = useGetWalletTransactionsQuery(undefined, { skip: tab !== "transactions" });
  const { data: overviewData, isLoading: overviewLoading, isError: overviewError, refetch: overviewRefetch } = useGetCustomerOverviewQuery(undefined, { skip: tab !== "overview" });

  const [triggerReceipt, { data: receiptData }] = useLazyGetReceiptQuery();

  useReconcileSessionQuery();

  const [topupOrder] = useTopupOrderMutation();
  const [topupVerify] = useTopupVerifyMutation();

  const [checkoutSession, { isLoading: isCheckoutLoading }] = useCheckoutSessionMutation();
  const [closeSession, { isLoading: isCloseLoading }] = useCloseSessionMutation();
  const [resumeSession, { isLoading: isResumeLoading }] = useResumeSessionMutation();
  const [disputeSession, { isLoading: isDisputeLoading }] = useDisputeSessionMutation();
  const [markRead] = useMarkNotificationReadMutation();

  const handleTopUp = async (amountInr: number) => {
    dispatch(setCustomerTopUpLoading(true));
    try {
      const order = await topupOrder({ amountInr }).unwrap();
      if (order.mode === "live") {
        throw new Error("Live Razorpay web checkout is not configured in this local build yet");
      }
      await topupVerify({ amountInr, paymentId: order.orderId }).unwrap();
    } catch (err) {
      console.error("Topup failed", err);
    } finally {
      dispatch(setCustomerTopUpLoading(false));
    }
  };

  const viewReceipt = async (sessionId: string) => {
    try {
      await triggerReceipt(sessionId).unwrap();
    } catch {
      // Error handled by query state
    }
  };

  useEffect(() => {
    let socketCleanup: (() => void) | undefined;

    void (async () => {
      const socket = await createRealtimeClient();

      socket.on("session:started", () => {
        void activeSessionRefetch();
        void sessionsRefetch();
        void activeChargeRefetch();
      });

      socket.on("session:closed", () => {
        void activeSessionRefetch();
        void sessionsRefetch();
        void walletRefetch();
        void activeChargeRefetch();
      });

      socket.on("billing:charge_update", () => {
        void walletRefetch();
        void activeChargeRefetch();
      });

      socket.on("billing:settled", () => {
        void walletRefetch();
      });

      socketCleanup = () => socket.disconnect();
    })();

    return () => {
      socketCleanup?.();
    };
  }, [activeSessionRefetch, sessionsRefetch, activeChargeRefetch, walletRefetch]);

  const stats = useMemo(() => {
    const sessions = sessionsData ?? [];
    const totalSpent = sessions.reduce((sum, session) => sum + Number(session.inr_equivalent ?? 0), 0);
    const averageDuration = sessions.length
      ? Math.round(sessions.reduce((sum, session) => sum + Number(session.duration_seconds ?? 0), 0) / sessions.length / 60)
      : 0;

    return {
      totalSessions: sessions.length,
      totalSpent,
      averageDuration
    };
  }, [sessionsData]);

  return (
    <div className="space-y-5 text-ivory">
      {/* Profile card */}
      <AnimatePresence>
        {profileData && (
          <motion.section
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blush/20 text-sm font-bold text-blush shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                {(profileData.full_name?.[0] ?? "U").toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-ivory">{profileData.full_name}</p>
                <p className="text-xs text-slate-400">{profileData.phone} · KYC: <span className="text-cyan">{profileData.kyc_status}</span></p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-cyan/10 blur-[80px] rounded-full pointer-events-none" />
        <p className="text-sm uppercase tracking-[0.35em] text-slate-400 font-bold relative z-10">Customer workspace</p>
        <h2 className="mt-3 text-3xl font-semibold relative z-10 text-ivory">Wallet, live access, receipts, and notifications.</h2>

        {walletLoading ? <Spinner /> : walletError ? (
          <ErrorBanner message="Failed to load wallet data" onRetry={() => void walletRefetch()} />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mt-6 grid gap-4 md:grid-cols-4 relative z-10"
          >
            {[
              ["Wallet balance", `INR ${Number(walletData?.balance_inr_equivalent ?? 0).toFixed(2)}`],
              ["Crypto balance", `${Number(walletData?.balance_crypto ?? 0).toFixed(4)} ${walletData?.currency_code ?? "USDC"}`],
              ["Total sessions", `${stats.totalSessions}`],
              ["Avg duration", `${stats.averageDuration} min`]
            ].map(([label, value]) => (
              <motion.article
                variants={itemVariants}
                whileHover={{ y: -4, scale: 1.02 }}
                key={label}
                className="rounded-[24px] bg-black/20 border border-white/5 p-5 transition-shadow hover:shadow-xl hover:shadow-cyan/5 hover:border-white/10"
              >
                <p className="text-sm text-slate-400">{label}</p>
                <p className="mt-3 text-2xl font-semibold text-ivory">{value}</p>
              </motion.article>
            ))}
          </motion.div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 rounded-full bg-black/30 p-1 border border-white/5">
              {(["sessions", "transactions", "overview"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => dispatch(setCustomerDashboardTab(t))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition duration-300 ${tab === t ? "bg-white/10 text-ivory shadow-sm" : "bg-transparent text-slate-400 hover:text-ivory"
                    }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleTopUp(500)}
              disabled={isTopUpLoading}
              className="rounded-full bg-blush px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:bg-blush/90 transition disabled:opacity-60 disabled:hover:scale-100"
            >
              {isTopUpLoading ? "Processing…" : "Add INR 500"}
            </motion.button>
          </div>

          <div className="mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {tab === "sessions" && (
                  <>
                    {sessionsLoading ? <Spinner /> : sessionsError ? (
                      <ErrorBanner message="Failed to load sessions" onRetry={() => void sessionsRefetch()} />
                    ) : (sessionsData ?? []).length === 0 ? (
                      <EmptyState message="No sessions yet. Visit a venue to get started." />
                    ) : (
                      <div className="overflow-hidden rounded-[24px] bg-black/20 border border-white/5">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-black/30 text-slate-400">
                            <tr>
                              <th className="px-4 py-3 font-medium">Venue</th>
                              <th className="px-4 py-3 font-medium">Date</th>
                              <th className="px-4 py-3 font-medium">Duration</th>
                              <th className="px-4 py-3 font-medium">Amount</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                            {(sessionsData ?? []).map((session) => (
                              <motion.tr variants={itemVariants} key={session.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-slate-300">{session.venues?.name ?? session.venue_id}</td>
                                <td className="px-4 py-3 text-slate-400">{new Date(session.created_at).toLocaleDateString()}</td>
                                <td className="px-4 py-3 text-slate-300">{Math.max(1, Math.round(Number(session.duration_seconds ?? 0) / 60))} min</td>
                                <td className="px-4 py-3 text-slate-300 font-medium">INR {Number(session.inr_equivalent ?? 0).toFixed(2)}</td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${session.status === "active" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" :
                                    session.status === "disputed" ? "bg-amber-500/20 text-amber-400 border border-amber-500/20" :
                                      "bg-white/10 text-slate-300 border border-white/10"
                                    }`}>{session.status}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => void viewReceipt(session.id)}
                                      className="rounded-full bg-white/10 px-2 flex items-center justify-center py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/20 hover:text-white"
                                    >
                                      Receipt
                                    </button>
                                    {session.status === "closed" && (
                                      <button
                                        onClick={() => dispatch(openCustomerDispute(session.id))}
                                        className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-400 transition hover:bg-amber-500/20"
                                      >
                                        Dispute
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </motion.tr>
                            ))}
                          </motion.tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {tab === "transactions" && (
                  <>
                    {walletTxLoading ? <Spinner /> : walletTxError ? (
                      <ErrorBanner message="Failed to load transactions" onRetry={() => void walletTxRefetch()} />
                    ) : (walletTxData ?? []).length === 0 ? (
                      <EmptyState message="No wallet transactions yet." />
                    ) : (
                      <div className="overflow-hidden rounded-[24px] bg-black/20 border border-white/5">
                        <table className="min-w-full text-left text-sm">
                          <thead className="bg-black/30 text-slate-400">
                            <tr>
                              <th className="px-4 py-3 font-medium">Type</th>
                              <th className="px-4 py-3 font-medium">INR</th>
                              <th className="px-4 py-3 font-medium">Crypto</th>
                              <th className="px-4 py-3 font-medium">Rate</th>
                              <th className="px-4 py-3 font-medium">Status</th>
                              <th className="px-4 py-3 font-medium">Date</th>
                            </tr>
                          </thead>
                          <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                            {(walletTxData ?? []).map((tx) => (
                              <motion.tr variants={itemVariants} key={tx.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${tx.type === "topup" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" : "bg-rose-500/20 text-rose-400 border-rose-500/20"
                                    }`}>{tx.type}</span>
                                </td>
                                <td className="px-4 py-3 text-ivory font-medium">INR {Number(tx.inr_amount ?? 0).toFixed(2)}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-400">{Number(tx.crypto_amount ?? 0).toFixed(6)}</td>
                                <td className="px-4 py-3 text-slate-300">₹{Number(tx.exchange_rate ?? 0).toFixed(2)}</td>
                                <td className="px-4 py-3 text-slate-300">{tx.status}</td>
                                <td className="px-4 py-3 text-slate-400">{new Date(tx.created_at).toLocaleString()}</td>
                              </motion.tr>
                            ))}
                          </motion.tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {tab === "overview" && (
                  <>
                    {overviewLoading ? <Spinner /> : overviewError ? (
                      <ErrorBanner message="Failed to load overview" onRetry={() => void overviewRefetch()} />
                    ) : (overviewData ?? []).length === 0 ? (
                      <EmptyState message="No usage data available yet." />
                    ) : (
                      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-3">
                        {(overviewData ?? []).map((row, i) => (
                          <motion.article variants={itemVariants} key={i} className="rounded-[22px] bg-black/20 border border-white/5 p-4 hover:border-white/10 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-ivory">{row.venues?.name ?? "Venue"}</p>
                                <p className="mt-1 text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-ivory">INR {Number(row.inr_equivalent ?? 0).toFixed(2)}</p>
                                <p className="text-xs text-slate-400">{Math.round(Number(row.duration_seconds ?? 0) / 60)} min</p>
                              </div>
                            </div>
                          </motion.article>
                        ))}
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Receipt modal */}
          <AnimatePresence>
            {receiptData && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="mt-4 rounded-[24px] bg-charcoal/80 border border-white/10 p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Receipt</h4>
                  <button onClick={() => triggerReceipt("")} className="text-xs text-slate-400 hover:text-white transition-colors">✕ Close</button>
                </div>
                <pre className="mt-3 overflow-auto rounded-xl bg-black/40 border border-white/5 p-3 text-xs text-slate-300 font-mono">{JSON.stringify(receiptData, null, 2)}</pre>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dispute dialog */}
          <AnimatePresence>
            {disputeSessionId && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="mt-4 rounded-[24px] bg-amber-500/10 border border-amber-500/20 p-5">
                <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-500">Dispute session</h4>
                <textarea
                  value={disputeReason}
                  onChange={(e) => dispatch(setCustomerDisputeReason(e.target.value))}
                  placeholder="Describe your concern…"
                  className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 focus:bg-black/60 p-3 text-sm outline-none text-ivory placeholder-slate-500 focus:border-amber-500/50 transition-colors"
                  rows={3}
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => disputeSession({ sessionId: disputeSessionId, reason: disputeReason })}
                    disabled={isDisputeLoading || !disputeReason.trim()}
                    className="rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-obsidian disabled:opacity-60 hover:bg-amber-400 transition-colors"
                  >
                    {isDisputeLoading ? "Submitting…" : "Submit dispute"}
                  </button>
                  <button
                    onClick={() => dispatch(closeCustomerDispute())}
                    className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/20 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-5">
          <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
            <div className="absolute left-[-20%] bottom-[-20%] w-48 h-48 bg-blush/10 blur-[60px] rounded-full pointer-events-none" />
            <h3 className="text-xl font-semibold relative z-10 text-ivory">Live session</h3>
            {activeSessionLoading ? <Spinner /> : activeSessionData ? (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 space-y-3 rounded-[24px] bg-black/20 border border-white/5 p-5 relative z-10">
                <p className="text-sm text-slate-400">Active venue</p>
                <p className="text-2xl font-semibold text-ivory">{activeSessionData.venues?.name ?? activeSessionData.venue_id}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] bg-white/5 border border-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Current charge</p>
                    <p className="mt-2 text-xl font-semibold text-cyan">
                      INR {Number(activeChargeData?.currentChargeInr ?? activeSessionData.inr_equivalent ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/5 border border-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Elapsed</p>
                    <p className="mt-2 text-xl font-semibold text-ivory">
                      {Math.floor(Number(activeChargeData?.elapsedSeconds ?? 0) / 60)}m {Number(activeChargeData?.elapsedSeconds ?? 0) % 60}s
                    </p>
                  </div>
                  <div className="rounded-[20px] bg-white/5 border border-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Locked rate</p>
                    <p className="mt-2 text-xl font-semibold text-slate-300">
                      INR {Number(activeChargeData?.lockedRate ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => checkoutSession(activeSessionData!.id)}
                    disabled={isCheckoutLoading}
                    className="rounded-full bg-ivory px-4 py-2 text-sm font-semibold text-obsidian transition hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
                  >
                    {isCheckoutLoading ? "Ending…" : "End session"}
                  </button>
                  <button
                    onClick={() => closeSession(activeSessionData!.id)}
                    disabled={isCloseLoading}
                    className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/20 hover:text-white disabled:opacity-60"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            ) : (
              <EmptyState message="No active session. Start via geofence or QR from the mobile app." />
            )}
            {/* Resume paused session - only shows if there's a paused session from reconcile */}
          </div>

          <div className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[32px] p-6 relative overflow-hidden">
            <h3 className="text-xl font-semibold text-ivory relative z-10">Notifications</h3>
            {notificationsLoading ? <Spinner /> : notificationsError ? (
              <ErrorBanner message="Failed to load notifications" onRetry={() => void notificationsRefetch()} />
            ) : (notificationsData ?? []).length === 0 ? (
              <EmptyState message="No notifications." />
            ) : (
              <motion.div variants={containerVariants} initial="hidden" animate="show" className="mt-4 space-y-3 relative z-10">
                {(notificationsData ?? []).slice(0, 6).map((notification) => (
                  <motion.article
                    variants={itemVariants}
                    key={notification.id}
                    className={`cursor-pointer rounded-[22px] p-4 transition duration-300 hover:border-white/20 border ${notification.read ? "bg-black/20 border-white/5" : "bg-black/40 border-blush/30 shadow-[0_0_10px_rgba(139,92,246,0.1)]"
                      }`}
                    onClick={() => {
                      if (!notification.read) {
                        markRead(notification.id);
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`font-medium ${notification.read ? 'text-slate-300' : 'text-ivory'}`}>{notification.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{notification.body}</p>
                      </div>
                      {!notification.read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blush shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString()}</p>
                  </motion.article>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
