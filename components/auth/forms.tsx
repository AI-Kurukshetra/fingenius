"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { PasswordStrength } from "@/components/auth/password-strength";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type ServerAction = (formData: FormData) => void | Promise<void>;

type StatusProps = {
  error?: string;
  message?: string;
};

const SubmitButton = ({ label }: { label: string }) => {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Working..." : label}
    </Button>
  );
};

const emailLooksValid = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

export const LoginForm = ({ action, error, message }: StatusProps & { action: ServerAction }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const emailError = useMemo(() => {
    if (!email) return null;
    return emailLooksValid(email) ? null : "Enter a valid email address";
  }, [email]);

  const passwordError = useMemo(() => {
    if (!password) return null;
    return password.length >= 8 ? null : "Password must be at least 8 characters";
  }, [password]);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        setLocalError(null);

        if (!emailLooksValid(email) || password.length < 8) {
          event.preventDefault();
          setLocalError("Please correct validation errors before continuing.");
        }
      }}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {localError ? <Alert tone="error">{localError}</Alert> : null}

      <FormField error={emailError} label="Work Email">
        <Input
          autoComplete="email"
          hasError={Boolean(emailError)}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@bank.com"
          required
          type="email"
          value={email}
        />
      </FormField>

      <FormField error={passwordError} hint="Minimum 8 characters" label="Password">
        <PasswordInput
          autoComplete="current-password"
          hasError={Boolean(passwordError)}
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter password"
          required
          value={password}
        />
      </FormField>

      <SubmitButton label="Sign in to Dashboard" />

      <div className="flex items-center justify-between text-sm">
        <Link className="text-teal-700 transition-colors hover:text-teal-800 hover:underline" href="/forgot-password">
          Forgot password?
        </Link>
        <Link className="text-teal-700 transition-colors hover:text-teal-800 hover:underline" href="/register">
          Create account
        </Link>
      </div>
    </form>
  );
};

export const RegisterForm = ({ action, error, message }: StatusProps & { action: ServerAction }) => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const fullNameError = useMemo(() => {
    if (!fullName) return null;
    return fullName.trim().length >= 2 ? null : "Name is too short";
  }, [fullName]);

  const emailError = useMemo(() => {
    if (!email) return null;
    return emailLooksValid(email) ? null : "Enter a valid email address";
  }, [email]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword ? null : "Passwords do not match";
  }, [password, confirmPassword]);

  const passwordError = useMemo(() => {
    if (!password) return null;
    return password.length >= 8 ? null : "Password must be at least 8 characters";
  }, [password]);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        setLocalError(null);

        if (
          fullName.trim().length < 2 ||
          !emailLooksValid(email) ||
          password.length < 8 ||
          password !== confirmPassword
        ) {
          event.preventDefault();
          setLocalError("Please fix the form errors before creating the account.");
        }
      }}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {localError ? <Alert tone="error">{localError}</Alert> : null}

      <FormField error={fullNameError} label="Full Name">
        <Input
          hasError={Boolean(fullNameError)}
          name="fullName"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Asha Rao"
          required
          type="text"
          value={fullName}
        />
      </FormField>

      <FormField error={emailError} label="Email">
        <Input
          autoComplete="email"
          hasError={Boolean(emailError)}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="asha@bank.com"
          required
          type="email"
          value={email}
        />
      </FormField>

      <FormField error={passwordError} label="Password">
        <PasswordInput
          autoComplete="new-password"
          hasError={Boolean(passwordError)}
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Create a strong password"
          required
          value={password}
        />
        <PasswordStrength value={password} />
      </FormField>

      <FormField error={confirmError} label="Confirm Password">
        <PasswordInput
          autoComplete="new-password"
          hasError={Boolean(confirmError)}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter password"
          required
          value={confirmPassword}
        />
      </FormField>

      <SubmitButton label="Create Secure Account" />

      <p className="text-sm text-slate-600">
        Already have credentials?{" "}
        <Link className="text-teal-700 transition-colors hover:text-teal-800 hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </form>
  );
};

export const ForgotPasswordForm = ({
  action,
  error,
  message
}: StatusProps & { action: ServerAction }) => {
  const [email, setEmail] = useState("");

  const emailError = useMemo(() => {
    if (!email) return null;
    return emailLooksValid(email) ? null : "Enter a valid email address";
  }, [email]);

  return (
    <form action={action} className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <FormField
        error={emailError}
        hint="We will send a recovery link to this email"
        label="Account Email"
      >
        <Input
          autoComplete="email"
          hasError={Boolean(emailError)}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@bank.com"
          required
          type="email"
          value={email}
        />
      </FormField>

      <SubmitButton label="Send Recovery Link" />

      <p className="text-sm text-slate-600">
        <Link className="text-teal-700 transition-colors hover:text-teal-800 hover:underline" href="/login">
          Back to sign in
        </Link>
      </p>
    </form>
  );
};

export const ResetPasswordForm = ({
  action,
  error,
  message
}: StatusProps & { action: ServerAction }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password) return null;
    return password.length >= 8 ? null : "Password must be at least 8 characters";
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null;
    return confirmPassword === password ? null : "Passwords do not match";
  }, [confirmPassword, password]);

  return (
    <form
      action={action}
      className="space-y-4"
      onSubmit={(event) => {
        setLocalError(null);

        if (password.length < 8 || password !== confirmPassword) {
          event.preventDefault();
          setLocalError("Please resolve password requirements before continuing.");
        }
      }}
    >
      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      {localError ? <Alert tone="error">{localError}</Alert> : null}

      <FormField error={passwordError} label="New Password">
        <PasswordInput
          autoComplete="new-password"
          hasError={Boolean(passwordError)}
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter new password"
          required
          value={password}
        />
        <PasswordStrength value={password} />
      </FormField>

      <FormField error={confirmError} label="Confirm New Password">
        <PasswordInput
          autoComplete="new-password"
          hasError={Boolean(confirmError)}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Re-enter new password"
          required
          value={confirmPassword}
        />
      </FormField>

      <SubmitButton label="Update Password" />
    </form>
  );
};
