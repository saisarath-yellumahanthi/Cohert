import React, { useState } from 'react';
import {
  AlertCircle,
  HelpCircle,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  UserPlus,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { CircleConfig } from '../types';
import {
  MAX_CIRCLE_MEMBERS,
  sanitizeString,
  validateCircleCapacity,
  validateInviteCode,
  validateInviteCodeFormat,
} from '../utils/validation';

interface AuthScreenProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ darkMode, onToggleDarkMode }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const registerOrVerifyCircleMember = async (user: User, providedInviteCode: string) => {
    const profileRef = doc(db, 'profiles', user.uid);
    const existingProfileSnap = await getDoc(profileRef);
    if (existingProfileSnap.exists()) {
      return; // Existing member signing back in
    }

    const configRef = doc(db, 'circleConfig', 'cohert');
    const configSnap = await getDoc(configRef);

    if (!configSnap.exists()) {
      // First account created becomes the admin automatically!
      const initialInviteCode = validateInviteCodeFormat(providedInviteCode.trim())
        ? providedInviteCode.trim()
        : 'COHERT2026';

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        setInfoMsg(
          'Verification email sent! Please click the link in your inbox and sign in again, or use Google Sign-In for instant verified access.'
        );
        await signOut(auth);
        return;
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'admins', user.uid), {
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      batch.set(configRef, {
        circleId: 'cohert',
        inviteCode: initialInviteCode,
        memberCount: 1,
        maxMembers: MAX_CIRCLE_MEMBERS,
        adminId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(profileRef, {
        userId: user.uid,
        circleId: 'cohert',
        name: '',
        avatarUrl: '',
        branch: '',
        year: '',
        skills: [],
        bio: '',
        profileCompleted: false,
        onboardingCompleted: false,
        onlineStatus: 'online',
        lastActiveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'userPrivate', user.uid), {
        userId: user.uid,
        circleId: 'cohert',
        email: sanitizeString(user.email || email || 'member@cohert.app', 120),
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      return;
    }

    // Circle already initialized: enforce 5-member cap and Invite Code!
    const configData = configSnap.data() as CircleConfig;
    const capacityCheck = validateCircleCapacity(configData.memberCount);
    if (!capacityCheck.allowed) {
      await signOut(auth);
      throw new Error(capacityCheck.message);
    }

    if (!validateInviteCode(providedInviteCode, configData.inviteCode)) {
      await signOut(auth);
      throw new Error('Invalid Invite Code. Ask your circle admin for the private invite code.');
    }

    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setInfoMsg(
        'Verification email sent! Please verify your email and sign in, or use Google Sign-In for instant verified access.'
      );
      await signOut(auth);
      return;
    }

    const batch = writeBatch(db);
    batch.update(configRef, {
      memberCount: configData.memberCount + 1,
      updatedAt: serverTimestamp(),
    });
    batch.set(profileRef, {
      userId: user.uid,
      circleId: 'cohert',
      name: '',
      avatarUrl: '',
      branch: '',
      year: '',
      skills: [],
      bio: '',
      profileCompleted: false,
      onboardingCompleted: false,
      onlineStatus: 'online',
      lastActiveAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'userPrivate', user.uid), {
      userId: user.uid,
      circleId: 'cohert',
      email: sanitizeString(user.email || email || 'member@cohert.app', 120),
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanedEmail = email.trim();
    if (!cleanedEmail || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (!inviteCode.trim()) {
        setErrorMsg('An Invite Code is required to join Cohert.');
        return;
      }
      if (!validateInviteCodeFormat(inviteCode.trim())) {
        setErrorMsg('Invite code must be 4–32 letters, numbers, hyphens, or underscores.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanedEmail, password);
        await registerOrVerifyCircleMember(cred.user, inviteCode);
      } else {
        const cred = await signInWithEmailAndPassword(auth, cleanedEmail, password);
        await registerOrVerifyCircleMember(cred.user, inviteCode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Cohert is full. This space is private.')) {
        setErrorMsg('Cohert is full. This space is private.');
      } else if (msg.includes('auth/operation-not-allowed')) {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in your Firebase Console. Click "Firebase Setup Instructions" below to enable it in 1 click, or sign in with Google right now.'
        );
        setShowSetupGuide(true);
      } else if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        setErrorMsg('Invalid email or password.');
      } else if (msg.includes('auth/email-already-in-use')) {
        setErrorMsg('An account with this email already exists. Switch to Sign In.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setInfoMsg('');
    if (mode === 'signup' && !inviteCode.trim()) {
      setErrorMsg('Please enter the circle Invite Code before signing up.');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await registerOrVerifyCircleMember(cred.user, inviteCode);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Cohert is full. This space is private.')) {
        setErrorMsg('Cohert is full. This space is private.');
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#FFFFFF] dark:bg-[#000000] text-[#262626] dark:text-[#F5F5F5] px-4 py-6">
      {/* Top Bar with Theme Toggle */}
      <header className="max-w-5xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#A8A8A8]">
          <Lock className="w-3.5 h-3.5 text-[#833AB4] dark:text-[#FCB045]" />
          <span>Friends-Only Private Community</span>
        </div>
        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label="Toggle color theme"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#121212] text-xs font-medium"
        >
          {darkMode ? <Sun className="w-4 h-4 text-[#FCB045]" /> : <Moon className="w-4 h-4" />}
          <span>{darkMode ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      {/* Center Auth Card */}
      <main className="w-full max-w-[420px] mx-auto my-8 space-y-5">
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6 sm:p-8 shadow-sm space-y-6">
          {/* Logo & Welcome Tagline */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-logo text-cohert-gradient py-1 select-none">
              Cohert
            </h1>
            <p className="text-xs sm:text-sm text-[#737373] dark:text-[#A8A8A8] leading-relaxed font-medium">
              Cohert: grow together. Learn, build, and get placed with your people.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626]">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
              }}
              className={`py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'signin'
                  ? 'bg-[#FFFFFF] dark:bg-[#121212] text-[#262626] dark:text-[#F5F5F5] shadow-2xs'
                  : 'text-[#737373] dark:text-[#A8A8A8]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`py-2 min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-[#FFFFFF] dark:bg-[#121212] text-[#262626] dark:text-[#F5F5F5] shadow-2xs'
                  : 'text-[#737373] dark:text-[#A8A8A8]'
              }`}
            >
              Sign Up (Invite Only)
            </button>
          </div>

          {/* Email + Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@college.edu"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="auth-invite-code"
                  className="block text-xs font-medium text-[#737373] dark:text-[#A8A8A8] mb-1"
                >
                  Invite Code (Required)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-invite-code"
                    type="text"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="Enter circle invite code (e.g. COHERT2026)"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm font-mono rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5] focus:outline-none focus:border-[#833AB4]"
                  />
                </div>
                <p className="text-[11px] text-[#737373] dark:text-[#A8A8A8] mt-1">
                  First account created becomes the Admin automatically and sets this code for the 4 friends.
                </p>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 rounded-xl bg-[#833AB4]/10 border border-[#833AB4]/20 text-xs text-[#262626] dark:text-[#F5F5F5]">
                {infoMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] rounded-xl bg-cohert-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-transform active:scale-98"
            >
              {mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Signing In...' : 'Sign In to Cohert'}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Joining Circle...' : 'Create Account'}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#DBDBDB] dark:border-[#262626]" />
            <span className="shrink-0 mx-3 text-xs text-[#737373]">or</span>
            <div className="flex-grow border-t border-[#DBDBDB] dark:border-[#262626]" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-semibold text-[#262626] dark:text-[#F5F5F5] hover:opacity-90 flex items-center justify-center gap-2 transition-transform active:scale-98"
          >
            <ShieldCheck className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
            <span>
              {mode === 'signup'
                ? 'Verify & Join with Google'
                : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Short Firebase Setup Instructions Card */}
        <div className="rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#121212] p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowSetupGuide((prev) => !prev)}
            className="w-full flex items-center justify-between text-xs font-medium text-[#737373] dark:text-[#A8A8A8]"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-[#833AB4] dark:text-[#FCB045]" />
              <span>Firebase Setup & Connection Info</span>
            </span>
            <span className="underline">{showSetupGuide ? 'Hide' : 'View'}</span>
          </button>

          {showSetupGuide && (
            <div className="pt-2 border-t border-[#DBDBDB] dark:border-[#262626] text-xs text-[#737373] dark:text-[#A8A8A8] space-y-2 leading-relaxed">
              <p>
                <strong>Connected Project:</strong>{' '}
                <code className="font-mono">{firebaseConfig.projectId}</code>
              </p>
              <p>
                <strong>1. Google Sign-In:</strong> Already enabled and pre-verified out of the box.
              </p>
              <p>
                <strong>2. Enabling Email/Password Provider:</strong> In the{' '}
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#833AB4] dark:text-[#FCB045] underline"
                >
                  Firebase Authentication Console
                </a>
                , go to <em>Sign-in method → Email/Password → Enable → Save</em>.
              </p>
              <p>
                <strong>3. First Admin Account:</strong> The very first account to sign in automatically becomes the Circle Admin and sets the Invite Code for the remaining 4 friends.
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center text-xs text-[#737373] dark:text-[#A8A8A8]">
        Private space for our circle only · Maximum 5 members
      </footer>
    </div>
  );
};
