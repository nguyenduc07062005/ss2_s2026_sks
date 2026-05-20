import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { completeRegistration } from '../../service/authAPI.js';
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '../../utils/passwordPolicy.js';
import AuthShowcase from './AuthShowcase.jsx';
import PasswordField from './PasswordField.jsx';

const CompleteRegistration = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const redirectTimeoutRef = useRef(null);
  const [token] = useState(() => searchParams.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(token ? '' : 'Registration token is missing.');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (searchParams.has('token')) {
      navigate('/complete-registration', { replace: true });
    }
  }, [navigate, searchParams]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!token) {
      setError('Registration token is missing.');
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
      const response = await completeRegistration(token, password);
      const nextMessage =
        response.message || 'Your account is ready. You can now log in.';
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
          'Could not complete registration. Please request a new link.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl shadow-sky-900/10 xl:grid-cols-[1fr_1fr]">
        <AuthShowcase
          title="Set Password"
          description="Create a strong password to activate your SKS workspace."
          variant="blue"
        />

        <div className="bg-white px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
              Email Verification
            </p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              Finish Setup
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Use the email link to confirm your account and create a password.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <PasswordField
                id="complete-registration-password"
                label="Password"
                placeholder="Create a strong password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                visible={showPassword}
                onToggleVisible={() => setShowPassword((current) => !current)}
              />

              <PasswordField
                id="complete-registration-confirm-password"
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
                  ? 'Activating account...'
                  : successMessage
                    ? 'Redirecting to Login...'
                    : 'Activate Account'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Already activated?{' '}
              <Link className="font-semibold text-cyan-600 hover:text-cyan-500" to="/login">
                Log In
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default CompleteRegistration;
