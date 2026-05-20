import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../service/authAPI.js';
import AuthShowcase from './AuthShowcase.jsx';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await requestPasswordReset(email);
      setSuccessMessage(
        response.message ||
          'If an account exists for this email, a password reset link has been sent.',
      );
      setEmail('');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          'Could not request password reset. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="relative grid w-full max-w-3xl overflow-hidden rounded-3xl shadow-2xl shadow-sky-900/10 xl:grid-cols-[1fr_1fr]">
        <AuthShowcase
          title="Reset Access"
          description="Request a secure email link to create a new password."
          variant="teal"
        />

        <div className="bg-white px-6 py-8 sm:px-8">
          <div className="mx-auto max-w-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">
              Password Help
            </p>
            <h2 className="mt-2 text-4xl font-bold text-slate-900">
              Forgot Password
            </h2>
            <p className="mt-2 text-base text-slate-500">
              Enter your email and check your inbox for a reset link.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  id="forgot-password-email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 placeholder:text-slate-400"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

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
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Sending reset link...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-slate-500">
              Remember your password?{' '}
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

export default ForgotPassword;
