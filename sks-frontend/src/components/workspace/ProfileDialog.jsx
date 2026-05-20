import { useEffect, useMemo, useState } from 'react';
import {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} from '../../utils/passwordPolicy.js';

const Icon = {
  Close: (p) => (
    <svg viewBox="0 0 20 20" fill="currentColor" {...p}>
      <path
        fillRule="evenodd"
        d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 0 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  ),
  User: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Shield: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Mail: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Badge: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Pencil: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </svg>
  ),
  Lock: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Eye: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  ),
  Logout: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Check: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Sparkle: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  ),
};

const getPasswordStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-cyan-500' };
  if (score >= 4) return { score: Math.min(score, 4), label: 'Strong', color: 'bg-emerald-500' };
  return { score: 0, label: '', color: '' };
};

const passwordRules = [
  { test: (pw) => pw.length >= 12, label: 'At least 12 characters' },
  { test: (pw) => /[a-z]/.test(pw), label: 'Lowercase letter (a-z)' },
  { test: (pw) => /[A-Z]/.test(pw), label: 'Uppercase letter (A-Z)' },
  { test: (pw) => /\d/.test(pw), label: 'Number (0-9)' },
  { test: (pw) => /[^A-Za-z0-9]/.test(pw), label: 'Special character (!@#...)' },
];

const PasswordInput = ({ value, onChange, placeholder, icon = Icon.Lock }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="group relative">
      <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500">
        {icon({ className: 'h-[18px] w-[18px]' })}
      </div>
      <input
        className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 py-3 pl-11 pr-11 text-sm font-medium text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(6,182,212,0.12)]"
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-0.5 text-slate-400 transition-colors hover:text-slate-600"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <Icon.EyeOff className="h-[18px] w-[18px]" /> : <Icon.Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
};

const StrengthMeter = ({ password }) => {
  const { score, label, color } = getPasswordStrength(password);
  if (!password) return null;

  const labelColor = {
    1: 'text-red-600',
    2: 'text-amber-600',
    3: 'text-cyan-600',
    4: 'text-emerald-600',
  }[score] || 'text-slate-400';

  return (
    <div className="mt-2.5 space-y-1.5">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              i <= score ? color : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${labelColor}`}>
        Strength: {label}
      </p>
    </div>
  );
};

const RequirementsList = ({ password }) => {
  if (!password) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
      {passwordRules.map(({ test, label }) => {
        const pass = test(password);
        return (
          <div
            key={label}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors duration-300 ${
              pass
                ? 'text-emerald-700'
                : 'text-slate-400'
            }`}
          >
            {pass ? (
              <Icon.Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            ) : (
              <Icon.X className="h-3.5 w-3.5 shrink-0 text-slate-300" />
            )}
            {label}
          </div>
        );
      })}
    </div>
  );
};

const Toast = ({ type, message }) => {
  if (!message) return null;
  const isError = type === 'error';
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium animate-fade-in ${
        isError
          ? 'border-red-200/80 bg-red-50 text-red-700'
          : 'border-emerald-200/80 bg-emerald-50 text-emerald-700'
      }`}
    >
      {isError ? (
        <Icon.X className="h-4 w-4 shrink-0" />
      ) : (
        <Icon.Check className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
};

const InfoRow = ({ icon, label, value, valueClass = '' }) => (
  <div className="flex items-center gap-3 rounded-xl bg-white/60 px-3.5 py-3 ring-1 ring-slate-100 transition-all hover:bg-white hover:ring-slate-200 hover:shadow-sm">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 text-slate-500">
      {icon({ className: 'h-4 w-4' })}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`truncate text-sm font-semibold text-slate-800 ${valueClass}`}>{value}</p>
    </div>
  </div>
);

const ProfileDialog = ({
  isOpen,
  profile,
  onClose,
  onChangePassword,
  onLogout,
  onUpdateName,
}) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [name, setName] = useState(profile?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const displayName = profile?.name?.trim() || 'Workspace member';
  const email = profile?.email || 'No email available';
  const isEmailVerified = profile?.isEmailVerified === true;
  const isAccountActive = profile?.isActive !== false;
  const accountStatus = !isAccountActive
    ? 'Inactive'
    : isEmailVerified
      ? 'Verified'
      : 'Pending';
  const accountStatusClass = !isAccountActive
    ? 'text-red-600'
    : isEmailVerified
      ? 'text-emerald-600'
      : 'text-amber-600';
  const initial = useMemo(
    () => (displayName.trim() ? displayName.trim()[0].toUpperCase() : 'S'),
    [displayName],
  );

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setName(profile?.name || '');
      setActiveTab('profile');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileError('');
      setProfileSuccess('');
      setPasswordError('');
      setPasswordSuccess('');
    }
  }, [isOpen, profile?.name]);

  if (!isOpen) {
    return null;
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!name.trim()) {
      setProfileError('Display name is required.');
      return;
    }

    setIsSavingName(true);
    try {
      await onUpdateName(name.trim());
      setProfileSuccess('Name updated successfully!');
    } catch (error) {
      setProfileError(
        error.response?.data?.message || 'Failed to update name.',
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setPasswordError(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsSavingPassword(true);
    try {
      await onChangePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed successfully!');
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || 'Failed to change password.',
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: Icon.User },
    { id: 'security', label: 'Security', icon: Icon.Shield },
  ];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-label="Close profile dialog"
      />

      <section className="relative w-full max-w-[540px] animate-soft-reveal">
        <div className="relative flex max-h-[90vh] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200/60 backdrop-blur-xl">
          <div className="relative shrink-0 overflow-hidden border-b border-slate-100 px-6 pb-5 pt-5" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #ede9fe 40%, #fce7f3 70%, #e0f2fe 100%)' }}>
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-all hover:bg-slate-200/60 hover:text-slate-600"
              aria-label="Close profile settings"
            >
              <Icon.Close className="h-5 w-5" />
            </button>

            <div className="relative flex items-center gap-4">
              <div className="relative">
                <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 opacity-80" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-[14px] bg-gradient-to-br from-cyan-500 to-blue-600 text-xl font-black text-white shadow-md">
                  {initial}
                </div>
              </div>

              <div className="min-w-0 flex-1 pr-8">
                <h2 className="truncate text-lg font-black text-slate-900">
                  {displayName}
                </h2>
                <p className="truncate text-sm font-medium text-slate-500">
                  {email}
                </p>
                {isEmailVerified && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 ring-1 ring-emerald-200/60">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Verified
                  </div>
                )}
              </div>
            </div>

            <div className="relative mt-4 flex gap-1 rounded-xl bg-slate-200/50 p-1">
              {tabs.map(({ id, label, icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-300 ${
                    activeTab === id
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {icon({ className: 'h-4 w-4' })}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain p-6 scrollbar-thin">
            {activeTab === 'profile' && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                    <Icon.Sparkle className="h-3.5 w-3.5 text-cyan-500" />
                    Account Information
                  </p>
                  <div className="mt-3 grid gap-2">
                    <InfoRow icon={Icon.Mail} label="Email" value={email} />
                    <div className="grid grid-cols-2 gap-2">
                      <InfoRow
                        icon={Icon.Badge}
                        label="Role"
                        value={profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'User'}
                      />
                      <InfoRow
                        icon={Icon.Shield}
                        label="Status"
                        value={accountStatus}
                        valueClass={accountStatusClass}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-200" />

                <form onSubmit={handleProfileSubmit}>
                  <div className="flex items-center gap-2">
                    <Icon.Pencil className="h-4 w-4 text-cyan-500" />
                    <h3 className="text-sm font-black text-slate-900">
                      Display Name
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    This name appears in your workspace header.
                  </p>
                  <div className="group relative mt-3">
                    <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-500">
                      <Icon.User className="h-[18px] w-[18px]" />
                    </div>
                    <input
                      className="w-full rounded-xl border border-slate-200/80 bg-slate-50/60 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(6,182,212,0.12)]"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={80}
                      required
                      placeholder="Enter your display name"
                    />
                  </div>

                  <Toast type="error" message={profileError} />
                  <Toast type="success" message={profileSuccess} />

                  <button
                    type="submit"
                    disabled={isSavingName}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                  >
                    {isSavingName ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Saving...
                      </>
                    ) : (
                      'Save name'
                    )}
                  </button>
                </form>

                <div className="border-t border-dashed border-slate-200" />

                <button
                  type="button"
                  onClick={onLogout}
                  className="group flex w-full items-center justify-center gap-2.5 rounded-xl border border-red-200/80 bg-red-50/50 px-4 py-3 text-sm font-bold text-red-600 transition-all hover:border-red-300 hover:bg-red-50 hover:shadow-sm active:scale-[0.98]"
                >
                  <Icon.Logout className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  Log out
                </button>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="animate-fade-in">
                <div className="flex items-center gap-2">
                  <Icon.Lock className="h-4 w-4 text-cyan-500" />
                  <h3 className="text-sm font-black text-slate-900">
                    Change Password
                  </h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Confirm your current password before setting a new one.
                </p>

                <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500">
                      Current Password
                    </label>
                    <PasswordInput
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="Enter current password"
                    />
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3">
                    <label className="mb-1.5 block text-xs font-bold text-slate-500">
                      New Password
                    </label>
                    <PasswordInput
                      value={newPassword}
                      onChange={setNewPassword}
                      placeholder="Enter new password"
                    />
                    <StrengthMeter password={newPassword} />
                    <RequirementsList password={newPassword} />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-500">
                      Confirm New Password
                    </label>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Re-enter new password"
                    />
                    {confirmPassword && newPassword && (
                      <div className={`mt-2 flex items-center gap-1.5 text-xs font-semibold ${
                        confirmPassword === newPassword ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {confirmPassword === newPassword ? (
                          <><Icon.Check className="h-3.5 w-3.5" /> Passwords match</>
                        ) : (
                          <><Icon.X className="h-3.5 w-3.5" /> Passwords do not match</>
                        )}
                      </div>
                    )}
                  </div>

                  <Toast type="error" message={passwordError} />
                  <Toast type="success" message={passwordSuccess} />

                  <button
                    type="submit"
                    disabled={isSavingPassword}
                    className="!mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-cyan-600/25 transition-all hover:shadow-lg hover:shadow-cyan-600/30 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-md"
                  >
                    {isSavingPassword ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Icon.Shield className="h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ProfileDialog;
