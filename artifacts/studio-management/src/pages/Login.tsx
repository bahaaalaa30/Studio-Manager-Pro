import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Camera, Eye, EyeOff, LockKeyhole, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function readError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error;
  }
  return fallback;
}

export default function Login() {
  const [, navigate] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setError("Username is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    if (cleanUsername.length < 4 || !/^[A-Za-z0-9]+$/.test(cleanUsername)) {
      setError("Enter a valid username using at least 4 letters or numbers.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const text = await response.text();
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (!response.ok) {
        if (response.status === 423) throw new Error("Your account is temporarily locked. Please try again later.");
        throw new Error(readError(data, "Invalid username or password."));
      }
      navigate("/reception", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#07111f] text-slate-950 flex overflow-hidden">
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%] relative overflow-hidden bg-[#07111f] text-white p-10 xl:p-14 flex-col justify-between">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 18% 20%, rgba(255,107,0,.32), transparent 28%), radial-gradient(circle at 85% 78%, rgba(255,255,255,.08), transparent 26%)" }} />
        <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-10 -top-10 h-60 w-60 rounded-full border border-white/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#FF6B00] flex items-center justify-center shadow-[0_12px_35px_rgba(255,107,0,.3)]"><Camera className="h-6 w-6" strokeWidth={2.2} /></div>
            <div><div className="text-lg font-bold tracking-tight">Studio Manager</div><div className="text-xs text-white/45 font-medium tracking-[.2em] uppercase">Pro</div></div>
          </div>
        </div>
        <div className="relative z-10 max-w-xl pb-10 xl:pb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 mb-6"><span className="h-1.5 w-1.5 rounded-full bg-[#FF6B00]" />Studio operations, beautifully organized</div>
          <h1 className="text-4xl xl:text-6xl font-bold tracking-[-0.04em] leading-[1.02]">Everything your studio needs.<br /><span className="text-[#FF6B00]">One smart workspace.</span></h1>
          <p className="mt-6 max-w-lg text-sm xl:text-base leading-7 text-white/55">Manage orders, production, inventory, branches and your team from a single place built for the rhythm of a modern photography studio.</p>
          <div className="mt-10 flex items-center gap-6 text-xs text-white/40"><span>Orders</span><span className="h-1 w-1 rounded-full bg-white/20" /><span>Inventory</span><span className="h-1 w-1 rounded-full bg-white/20" /><span>Team & Access</span></div>
        </div>
        <div className="relative z-10 text-[11px] text-white/25">© {new Date().getFullYear()} Studio Manager Pro</div>
      </div>

      <div className="flex-1 bg-[#f7f8fa] flex items-center justify-center p-5 sm:p-8 relative">
        <div className="absolute top-0 right-0 h-64 w-64 bg-[#FF6B00]/5 blur-3xl rounded-full pointer-events-none" />
        <div className="w-full max-w-md relative">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-10">
            <div className="h-11 w-11 rounded-xl bg-[#FF6B00] text-white flex items-center justify-center shadow-lg shadow-[#FF6B00]/20"><Camera className="h-6 w-6" /></div>
            <div><div className="text-lg font-bold tracking-tight">Studio Manager</div><div className="text-xs text-muted-foreground font-medium tracking-[.2em] uppercase">Pro</div></div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-[0_24px_70px_rgba(15,23,42,.09)]">
            <div className="mb-8">
              <div className="h-10 w-10 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00] flex items-center justify-center mb-5"><LogIn className="h-5 w-5" /></div>
              <h2 className="text-2xl font-bold tracking-tight text-[#10243e]">Welcome back</h2>
              <p className="mt-1.5 text-sm text-slate-500">Sign in to continue to your studio workspace.</p>
            </div>

            <form onSubmit={submit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-username" className="text-sm font-semibold text-slate-700">Username</Label>
                <div className="relative">
                  <UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="login-username" name="username" value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }} placeholder="Enter your username" autoComplete="username" autoFocus className="h-11 pl-10 border-slate-200 bg-slate-50/60 focus-visible:ring-[#FF6B00] focus-visible:border-[#FF6B00]" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password" className="text-sm font-semibold text-slate-700">Password</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input id="login-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" autoComplete="current-password" className="h-11 pl-10 pr-11 border-slate-200 bg-slate-50/60 focus-visible:ring-[#FF6B00] focus-visible:border-[#FF6B00]" />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-400 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>

              {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>}

              <Button type="submit" disabled={loading || !username.trim() || !password} className="h-11 w-full gap-2 bg-[#FF6B00] hover:bg-[#e85f00] text-white shadow-lg shadow-[#FF6B00]/20 disabled:opacity-50 disabled:shadow-none">
                {loading ? <span className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white animate-spin" /> : <LogIn className="h-4 w-4" />}
                {loading ? "Signing in…" : "Sign in"}
                {!loading && <ArrowRight className="h-4 w-4 ml-auto" />}
              </Button>
            </form>

            <p className="mt-7 text-center text-[11px] text-slate-400">Use the username and password assigned to your studio account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
