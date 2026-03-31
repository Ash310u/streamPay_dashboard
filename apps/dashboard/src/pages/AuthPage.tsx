import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  useLoginMutation,
  useRegisterMutation,
  useWeb3LoginMutation,
  useOnboardMerchantMutation,
  useKycUploadMutation
} from "../store/api";
import { useAppDispatch } from "../store";
import { getAppPathForRole, syncAuthSession } from "../store/slices/authSlice";

const API_URL = import.meta.env.VITE_API_URL;

export const AuthPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [userType, setUserType] = useState<"user" | "merchant">("user");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<1 | 2>(1);

  // User details
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  // Merchant details
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("other");
  const [panNumber, setPanNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const [showWeb3, setShowWeb3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [register, { isLoading: isRegisterLoading }] = useRegisterMutation();
  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [web3Login, { isLoading: isWeb3Loading }] = useWeb3LoginMutation();
  const [onboardMerchant, { isLoading: isOnboardLoading }] = useOnboardMerchantMutation();
  const [kycUpload, { isLoading: isKycLoading }] = useKycUploadMutation();

  const loading = isRegisterLoading || isLoginLoading || isWeb3Loading || isOnboardLoading || isKycLoading;

  const finalizeSignIn = async (session: { access_token?: string; refresh_token?: string }) => {
    if (!session.access_token || !session.refresh_token) {
      throw new Error("Missing authentication tokens. Please try signing in again.");
    }

    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    const authState = await dispatch(syncAuthSession({ session: data.session })).unwrap();
    navigate(getAppPathForRole(authState.role), { replace: true });
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      setError("Please fill all required fields");
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      if (mode === "signup") {
        if (userType === "merchant" && step === 1) {
          handleNext(event);
          return;
        }

        if (userType === "merchant" && step === 2) {
          if (!businessName || !panNumber || !bankAccountNumber || !bankIfsc) {
            setError("Please fill all required business details");
            return;
          }
        }

        // Register User
        await register({ email, password, fullName, phone: phone || undefined }).unwrap();

        setSuccess("Registration successful! Setting up your dashboard...");

        // Login immediately
        const loginResult = await login({ email, password }).unwrap();
        const session = loginResult.session as { access_token?: string; refresh_token?: string };

        // If merchant, onboard them before setting session to prevent premature navigation
        if (userType === "merchant") {
          setSuccess("Securing your business details...");
          await onboardMerchant({
            businessName,
            businessType,
            gstin: gstNumber || undefined,
            panNumber,
            bankAccountNumber,
            bankIfsc,
            bankAccountName: fullName,
          }).unwrap();

          setSuccess("Uploading KYC documents...");
          await kycUpload({
            documentType: "pan",
            businessName,
            panNumber,
            gstNumber: gstNumber || undefined,
            bankAccountNumber,
            bankIfsc,
            bankAccountName: fullName
          }).unwrap();
        }

        setSuccess("Welcome! Redirecting...");
        await finalizeSignIn(session);

      } else {
        const result = await login({ email, password }).unwrap();
        const session = result.session as { access_token?: string; refresh_token?: string };
        setSuccess("Login successful! Redirecting...");
        await finalizeSignIn(session);
      }
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.data?.error || (err instanceof Error ? err.message : "Authentication failed. Please check your details.");
      setError(errorMessage);
      setSuccess(null);
    }

  };

  const handleWeb3Login = async () => {
    if (!email || !walletAddress) {
      setError("Email and wallet address are required for Web3 login");
      return;
    }
    setError(null);
    setSuccess(null);
    try {
      const result = await web3Login({ email, walletAddress }).unwrap();
      const session = result.session as { access_token?: string; refresh_token?: string };
      setSuccess("Web3 login successful! Redirecting...");
      await finalizeSignIn(session);
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.data?.error || (err instanceof Error ? err.message : "Web3 login failed");
      setError(errorMessage);
      setSuccess(null);
    }
  };

  const fadeUp = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -15 },
    transition: { duration: 0.3 }
  };

  return (
    <div className="min-h-screen bg-obsidian px-4 py-10 text-ivory relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blush/10 blur-[120px] rounded-full mix-blend-screen"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-cyan/10 blur-[120px] rounded-full mix-blend-screen"
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] h-full items-center">

        {/* Left Information Panel */}
        <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[36px] p-8 flex flex-col justify-center relative overflow-hidden h-full min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={userType}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="relative z-10"
            >
              {userType === "merchant" ? (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.35em] text-cyan">Merchant Portal</p>
                  <h1 className="mt-4 text-4xl font-semibold leading-tight text-ivory">Grow your business with seamless payments.</h1>
                  <p className="mt-4 text-base text-slate-400">
                    Manage your venues, view live occupancy, and track fast settlements across the CleanPay ecosystem.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold uppercase tracking-[0.35em] text-blush">Customer Portal</p>
                  <h1 className="mt-4 text-4xl font-semibold leading-tight text-ivory">One wallet for the physical world.</h1>
                  <p className="mt-4 text-base text-slate-400">
                    Pay seamlessly at thousands of venues with crypto or INR. Get started in seconds.
                  </p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Right Form Panel */}
        <section className="glass-panel border-white/5 bg-charcoal/60 shadow-glass rounded-[36px] p-8 flex flex-col">

          <div className="flex gap-2 rounded-2xl bg-black/20 p-1 mb-6 border border-white/5 backdrop-blur-md">
            {(["user", "merchant"] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setUserType(type); setStep(1); setShowWeb3(false); setError(null); }}
                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-300 ${userType === type
                  ? "bg-white/10 text-ivory shadow-sm"
                  : "text-slate-400 hover:text-ivory hover:bg-white/5"
                  }`}
              >
                {type === "user" ? "Personal Account" : "Business Account"}
              </button>
            ))}
          </div>

          <div className="flex gap-2 border-b border-white/10 pb-4 mb-6 relative">
            {(["login", "signup"] as const).map((item) => (
              <button
                key={item}
                onClick={() => { setMode(item); setShowWeb3(false); setStep(1); setError(null); }}
                className={`px-4 py-2 text-sm font-semibold transition-all relative ${mode === item && !showWeb3
                  ? "text-ivory"
                  : "text-slate-400 hover:text-ivory"
                  }`}
              >
                {item === "login" ? "Sign In" : "Create Account"}
                {mode === item && !showWeb3 && (
                  <motion.span
                    layoutId="underline"
                    className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-blush rounded-t-full"
                  />
                )}
              </button>
            ))}
            <div className="ml-auto" />
            <button
              onClick={() => { setShowWeb3(!showWeb3); setStep(1); setError(null); }}
              className={`px-4 py-2 text-sm font-semibold transition-all relative ${showWeb3
                ? "text-ivory"
                : "text-slate-400 hover:text-ivory"
                }`}
            >
              Web3 Auth
              {showWeb3 && (
                <motion.span
                  layoutId="underline"
                  className="absolute bottom-[-17px] left-0 w-full h-[2px] bg-cyan rounded-t-full"
                />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!showWeb3 ? (
              <motion.form key={`form-${mode}-${step}`} {...fadeUp} onSubmit={handleSubmit} className="flex-1 space-y-4">
                {mode === "signup" && userType === "merchant" && step === 2 ? (
                  <motion.div {...fadeUp} className="space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <button type="button" onClick={handleBack} className="p-2 -ml-2 rounded-full text-slate-400 hover:bg-white/10 hover:text-ivory transition">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                      </button>
                      <h2 className="text-xl font-semibold">Business KYC Verification</h2>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Business Name</span>
                        <input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan text-ivory placeholder-slate-500" placeholder="CleanPay India Ltd" />
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Business Category</span>
                        <select required value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan text-ivory appearance-none">
                          <option value="gym" className="bg-obsidian">Gym & Fitness</option>
                          <option value="ev_charger" className="bg-obsidian">EV Charging</option>
                          <option value="coworking" className="bg-obsidian">Co-working Space</option>
                          <option value="parking" className="bg-obsidian">Parking</option>
                          <option value="lab" className="bg-obsidian">Laboratory</option>
                          <option value="other" className="bg-obsidian">Other</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">PAN Number</span>
                        <input required value={panNumber} onChange={(event) => setPanNumber(event.target.value.toUpperCase())} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan uppercase text-sm text-ivory placeholder-slate-500" placeholder="ABCDE1234F" />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">GSTIN (Optional)</span>
                        <input value={gstNumber} onChange={(event) => setGstNumber(event.target.value.toUpperCase())} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan uppercase text-sm text-ivory placeholder-slate-500" placeholder="22AAAAA0000A1Z5" />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">Bank Account #</span>
                        <input required value={bankAccountNumber} onChange={(event) => setBankAccountNumber(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan text-ivory placeholder-slate-500" type="password" placeholder="••••••••••••" />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-300">IFSC Code</span>
                        <input required value={bankIfsc} onChange={(event) => setBankIfsc(event.target.value.toUpperCase())} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan uppercase text-sm text-ivory placeholder-slate-500" placeholder="SBIN0001234" />
                      </label>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div {...fadeUp} className="space-y-4">
                    {mode === "signup" && userType === "merchant" && (
                      <div className="mb-4 p-3.5 rounded-2xl bg-cyan/10 border border-cyan/20 text-cyan-400 text-sm font-medium flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan text-obsidian shrink-0 text-xs font-bold">1</span>
                        Step 1: Sign up with your contact details.
                      </div>
                    )}

                    {mode === "signup" ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-300">Full Name</span>
                          <input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-blush text-ivory placeholder-slate-500" placeholder="Jian Yang" />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-2 block text-sm font-medium text-slate-300">Phone (Optional)</span>
                          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+91 9876543210" className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-blush text-ivory placeholder-slate-500" />
                        </label>
                      </div>
                    ) : null}

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
                      <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-blush text-ivory placeholder-slate-500" placeholder="name@domain.com" />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
                      <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-blush text-ivory placeholder-slate-500" placeholder="••••••••" />
                    </label>
                  </motion.div>
                )}

                <AnimatePresence>
                  {error ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                      <span>{error}</span>
                    </motion.div>
                  ) : null}
                  {success ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                      <span>{success}</span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  className="w-full rounded-2xl bg-ivory px-4 py-3.5 text-sm font-semibold text-obsidian transition-colors disabled:opacity-60 disabled:hover:translate-y-0 mt-6 shadow-xl shadow-ivory/10 hover:bg-white"
                >
                  {loading
                    ? "Please wait…"
                    : mode === "login"
                      ? "Sign In"
                      : mode === "signup" && userType === "merchant" && step === 1
                        ? "Next Step →"
                        : userType === "merchant"
                          ? "Submit Registration"
                          : "Create Account"}
                </motion.button>
              </motion.form>
            ) : (
              <motion.div key="web3-form" {...fadeUp} className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
                  <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan text-ivory placeholder-slate-500" placeholder="name@domain.com" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">Wallet Address</span>
                  <input required value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="0xabc..." className="w-full rounded-2xl border border-white/10 bg-black/20 focus:bg-black/40 px-4 py-3 outline-none transition focus:border-cyan text-sm text-ivory placeholder-slate-500" />
                </label>
                <AnimatePresence>
                  {error ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                      <span>{error}</span>
                    </motion.div>
                  ) : null}
                  {success ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                      <span>{success}</span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleWeb3Login}
                  disabled={loading}
                  className="w-full rounded-2xl bg-cyan px-4 py-3.5 text-sm font-semibold text-obsidian transition-colors disabled:opacity-60 mt-4 shadow-xl shadow-cyan/10 hover:bg-cyan-400"
                >
                  {loading ? "Connecting…" : "Login via Web3"}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8">
            <div className="relative flex items-center py-5">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-xs font-semibold uppercase tracking-wider">Or continue with</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <a
                href={`${API_URL}/auth/google`}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-ivory border border-white/5"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Google
              </a>
              <a
                href={`${API_URL}/auth/github`}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-ivory border border-white/5"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
                GitHub
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
