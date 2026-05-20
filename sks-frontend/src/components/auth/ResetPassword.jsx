import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../../service/authAPI.js';
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '../../utils/passwordPolicy.js';
import AuthShowcase from './AuthShowcase.jsx';
import PasswordField from './PasswordField.jsx';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef(null);
  const [token] = useState(() => searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(token ? '' : 'Reset token is missing.');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (searchParams.has('token')) {
      navigate('/reset-password', { replace: true });
    }
  }, [navigate, searchParams]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Reset token is missing.');
      return;
    }

    if (!isStrongPassword(password)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check again.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await resetPassword(token, password);
      const nextMessage =
        response.message || 'Your password has been reset. You can log in now.';
      setSuccessMessage(`${nextMessage} Redirecting to login...`);
      redirectTimeoutRef.current = window.setTimeout(
        () =>
          navigate('/login', {
            replace: true,
            state: { successMessage: nextMessage },
          }),
        1200,
      );
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Could not reset password. Please request a new link.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl shadow-sky-900/10 xl:grid-cols-[1fr_1fr]">
        <AuthShowcase
          title="New Password"
          description="Use your reset email link to secure the account again."
          variant="teal"
        />

        <div className="bg-white px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
              Password Reset
            </p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              Create Password
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Choose a new password for your SKS account.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <PasswordField
                id="reset-password"
                label="New Password"
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((current) => !current)}
              />

              <PasswordField
                id="reset-confirm-password"
                label="Confirm Password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                visible={showConfirm}
                onToggleVisible={() => setShowConfirm((current) => !current)}
              />

              <p className="text-xs leading-5 text-slate-500">
                {PASSWORD_POLICY_MESSAGE}
              </p>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              <button
                className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-4 text-base font-bold text-white shadow-lg shadow-cyan-600/25 transition hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting || !token || Boolean(successMessage)}
              >
                {isSubmitting
                  ? 'Resetting password...'
                  : successMessage
                    ? 'Redirecting to Login...'
                    : 'Reset Password'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Need a new link?{' '}
              <Link className="font-semibold text-cyan-600 hover:text-cyan-500" to="/forgot-password">
                Request Reset
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default ResetPassword;
