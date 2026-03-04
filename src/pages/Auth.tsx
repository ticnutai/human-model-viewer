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

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState(() => localStorage.getItem(SAVED_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem(REMEMBER_ME_KEY) !== "false");
  const [submitting, setSubmitting] = useState(false);
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
      if (isLogin) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" style={{ background: "#ffffff" }}>
      <Card className="w-full max-w-md border-border" style={{ borderColor: GOLD, borderWidth: "1px", background: "#ffffff" }}>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-foreground" style={{ color: NAVY }}>
            {isLogin ? "התחברות" : "הרשמה"}
          </CardTitle>
          <CardDescription style={{ color: NAVY_SECONDARY }}>
            {isLogin ? "היכנס לחשבון שלך" : "צור חשבון חדש"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="displayName" style={{ color: NAVY }}>שם תצוגה</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="השם שלך"
                  required={!isLogin}
                  style={{ borderColor: GOLD, color: NAVY }}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" style={{ color: NAVY }}>אימייל</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{ borderColor: GOLD, color: NAVY }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" style={{ color: NAVY }}>סיסמה</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                minLength={6}
                style={{ borderColor: GOLD, color: NAVY }}
              />
            </div>
            {isLogin && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none" style={{ color: NAVY_SECONDARY }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                  style={{ borderColor: GOLD }}
                />
                זכור אותי במכשיר הזה
              </label>
            )}
            <Button type="submit" className="w-full" disabled={submitting} style={{ background: NAVY, color: "#ffffff", border: `1px solid ${GOLD}` }}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: "#ffffff" }} />}
              {isLogin ? "התחבר" : "הירשם"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
              style={{ color: NAVY }}
            >
              {isLogin ? "אין לך חשבון? הירשם" : "יש לך חשבון? התחבר"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
