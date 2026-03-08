import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const REMEMBER_ME_KEY = "auth-remember-me";
const SAVED_EMAIL_KEY = "auth-saved-email";
const NAVY = "#0b1f4d";
const NAVY_SECONDARY = "#27406f";
const GOLD = "#c9a227";

type AuthMode = "login" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState(() => localStorage.getItem(SAVED_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) !== "false");
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" style={{ background: "#ffffff" }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" style={{ color: NAVY }} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast({
          title: "נשלח בהצלחה!",
          description: "בדוק את תיבת המייל שלך לקישור לאיפוס סיסמה.",
        });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (rememberMe) {
          localStorage.setItem(REMEMBER_ME_KEY, "true");
          localStorage.setItem(SAVED_EMAIL_KEY, email.trim());
        } else {
          localStorage.setItem(REMEMBER_ME_KEY, "false");
          localStorage.removeItem(SAVED_EMAIL_KEY);
        }

        toast({ title: "התחברת בהצלחה!" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: "ההרשמה הצליחה!",
          description: "בדוק את תיבת המייל שלך לאישור.",
        });
      }
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
      setOauthLoading(null);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      toast({ title: "ברוך הבא, אורח!" });
    } catch (error: any) {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGuestLoading(false);
    }
  };

  const title = mode === "forgot" ? "איפוס סיסמה" : mode === "login" ? "התחברות" : "הרשמה";
  const subtitle = mode === "forgot"
    ? "הכנס את כתובת המייל שלך לקבלת קישור לאיפוס"
    : mode === "login" ? "היכנס לחשבון שלך" : "צור חשבון חדש";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" style={{ background: "#ffffff" }}>
      <Card className="w-full max-w-md border-border" style={{ borderColor: GOLD, borderWidth: "1px", background: "#ffffff" }}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground" style={{ color: NAVY }}>
            {title}
          </CardTitle>
          <CardDescription style={{ color: NAVY }}>
            {subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ── OAuth buttons ── */}
          {mode !== "forgot" && (
            <>
              <div className="flex gap-3 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 focus-visible:ring-[#c9a227]"
                  disabled={!!oauthLoading}
                  onClick={() => handleOAuth("google")}
                  style={{ borderColor: GOLD, color: NAVY, background: "#ffffff" }}
                >
                  {oauthLoading === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 gap-2 focus-visible:ring-[#c9a227]"
                  disabled={!!oauthLoading}
                  onClick={() => handleOAuth("github")}
                  style={{ borderColor: GOLD, color: NAVY, background: "#ffffff" }}
                >
                  {oauthLoading === "github" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={NAVY}>
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  )}
                  GitHub
                </Button>
              </div>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" style={{ borderColor: GOLD + "44" }} />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="px-2" style={{ background: "#ffffff", color: NAVY }}>או</span>
                </div>
              </div>
            </>
          )}

          {/* ── Email form ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="displayName" style={{ color: NAVY }}>שם תצוגה</Label>
                <Input
                  id="displayName"
                  className="focus-visible:ring-[#c9a227] focus-visible:border-[#c9a227] focus-visible:ring-offset-0"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="השם שלך"
                  required={mode === "signup"}
                  style={{ borderColor: GOLD, color: NAVY, background: "#ffffff" }}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: NAVY }}>אימייל</Label>
              <Input
                id="email"
                type="email"
                className="focus-visible:ring-[#c9a227] focus-visible:border-[#c9a227] focus-visible:ring-offset-0"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ borderColor: GOLD, color: NAVY, background: "#ffffff" }}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="password" style={{ color: NAVY }}>סיסמה</Label>
                <Input
                  id="password"
                  type="password"
                  className="focus-visible:ring-[#c9a227] focus-visible:border-[#c9a227] focus-visible:ring-offset-0"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••"
                  required
                  minLength={6}
                  style={{ borderColor: GOLD, color: NAVY, background: "#ffffff" }}
                />
              </div>
            )}
            {mode === "login" && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm select-none" style={{ color: NAVY }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-[#0b1f4d] focus:ring-[#c9a227] focus:ring-2"
                  style={{ borderColor: GOLD, outlineColor: GOLD }}
                />
                זכור אותי
              </label>
              <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs hover:underline"
                  style={{ color: NAVY }}
                >
                  שכחתי סיסמה
                </button>
              </div>
            )}
            <Button type="submit" className="w-full focus-visible:ring-[#c9a227]" disabled={submitting} style={{ background: NAVY, color: "#ffffff", border: `1px solid ${GOLD}` }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: "#ffffff" }} />}
              {mode === "forgot" ? "שלח קישור לאיפוס" : mode === "login" ? "התחבר" : "הירשם"}
            </Button>
          </form>

          {/* ── Guest login ── */}
          {mode !== "forgot" && (
            <Button
              type="button"
              variant="outline"
              className="w-full mt-3 gap-2 focus-visible:ring-[#c9a227]"
              disabled={guestLoading}
              onClick={handleGuestLogin}
              style={{ color: NAVY, borderColor: GOLD, background: "#ffffff" }}
            >
              {guestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "👤"}
              כניסה כאורח
            </Button>
          )}

          {/* ── Mode switcher ── */}
          <div className="mt-4 text-center space-y-1">
            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-primary hover:underline"
                style={{ color: NAVY }}
              >
                חזרה להתחברות
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="text-sm text-primary hover:underline"
                style={{ color: NAVY }}
              >
                {mode === "login" ? "אין לך חשבון? הירשם" : "יש לך חשבון? התחבר"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
