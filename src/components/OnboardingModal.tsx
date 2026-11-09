import React, { useState } from 'react';
import { ArrowRight, Camera, CheckCircle2, Compass, ShieldCheck, Users } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { compressImageFile, db, handleFirestoreError } from '../firebase';
import { OperationType, UserProfile } from '../types';
import { getInitials, sanitizeString } from '../utils/validation';

interface OnboardingModalProps {
  profile: UserProfile;
  isPreviewMode?: boolean;
  onPreviewComplete?: (updates: Partial<UserProfile>) => void;
}

const SLIDES = [
  {
    title: 'Welcome to Cohert',
    subtitle: 'Cohert: grow together. Learn, build, and get placed with your people.',
    description:
      'A private digital living room built strictly for you and your 4 closest college friends — zero noise, zero strangers, zero distractions.',
    icon: ShieldCheck,
  },
  {
    title: '5 Focused Topic Channels',
    subtitle: '📚 Studies · 🏆 Hackathons · 💼 Internships · 🎯 Job Training · 💡 Ideas',
    description:
      'Tag every post by channel, track upcoming hackathon & internship countdowns, and request teammates in one tap.',
    icon: Compass,
  },
  {
    title: 'Real-Time Circle Chat',
    subtitle: '1-on-1 DMs & Group Rooms',
    description:
      'Spin up dedicated group rooms like "Hackathon Team", share study snapshots, and see who in your circle is online right now.',
    icon: Users,
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  profile,
  isPreviewMode = false,
  onPreviewComplete,
}) => {
  const [slideIndex, setSlideIndex] = useState(0);
  const [step, setStep] = useState<'slides' | 'profile'>(
    profile.onboardingCompleted ? 'profile' : 'slides'
  );

  const [name, setName] = useState(profile.name || '');
  const [branch, setBranch] = useState(profile.branch || '');
  const [year, setYear] = useState(profile.year || '');
  const [skillsText, setSkillsText] = useState(profile.skills.join(', '));
  const [bio, setBio] = useState(profile.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (profile.onboardingCompleted && profile.profileCompleted) {
    return null;
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 400, 0.8);
      setAvatarUrl(compressed);
    } catch {
      // ignore
    }
  };

  const handleFinishSlides = async () => {
    if (profile.profileCompleted) {
      if (isPreviewMode && onPreviewComplete) {
        onPreviewComplete({ onboardingCompleted: true });
        return;
      }
      try {
        await updateDoc(doc(db, 'profiles', profile.userId), {
          onboardingCompleted: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `profiles/${profile.userId}`);
      }
    } else {
      setStep('profile');
    }
  };

  const handleSaveProfileStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanedName = sanitizeString(name, 80);
    if (!cleanedName) {
      setErrorMsg('Please enter your name so your friends recognize you.');
      return;
    }

    const parsedSkills = skillsText
      .split(',')
      .map((s) => sanitizeString(s, 40))
      .filter(Boolean)
      .slice(0, 10);

    const updates = {
      name: cleanedName,
      avatarUrl: avatarUrl || '',
      branch: sanitizeString(branch, 80),
      year: sanitizeString(year, 40),
      skills: parsedSkills,
      bio: sanitizeString(bio, 300),
      onboardingCompleted: true,
      profileCompleted: true,
    };

    if (isPreviewMode && onPreviewComplete) {
      onPreviewComplete(updates);
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'profiles', profile.userId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${profile.userId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome Onboarding and Profile Setup"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FFFFFF] dark:bg-[#121212] p-6 shadow-2xl">
        {step === 'slides' ? (
          <div className="space-y-6 text-center">
            <div className="flex items-center justify-between text-xs text-[#737373] dark:text-[#A8A8A8]">
              <span>Slide {slideIndex + 1} of {SLIDES.length}</span>
              <button
                type="button"
                onClick={handleFinishSlides}
                className="font-medium hover:underline"
              >
                Skip intro
              </button>
            </div>

            {(() => {
              const current = SLIDES[slideIndex];
              const Icon = current.icon;
              return (
                <div className="py-4 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-cohert-gradient p-[2px] mx-auto">
                    <div className="w-full h-full rounded-[14px] bg-[#FFFFFF] dark:bg-[#121212] flex items-center justify-center">
                      <Icon className="w-8 h-8 text-[#833AB4] dark:text-[#FCB045]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
                      {current.title}
                    </h2>
                    <p className="text-xs font-semibold text-[#833AB4] dark:text-[#FCB045]">
                      {current.subtitle}
                    </p>
                    <p className="text-sm text-[#737373] dark:text-[#A8A8A8] leading-relaxed">
                      {current.description}
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center justify-center gap-2">
              {SLIDES.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === slideIndex
                      ? 'w-6 bg-cohert-gradient'
                      : 'w-2 bg-[#DBDBDB] dark:bg-[#262626]'
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (slideIndex < SLIDES.length - 1) {
                  setSlideIndex((prev) => prev + 1);
                } else {
                  handleFinishSlides();
                }
              }}
              className="w-full min-h-[46px] rounded-xl bg-cohert-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-98"
            >
              <span>{slideIndex < SLIDES.length - 1 ? 'Next' : 'Complete your profile'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSaveProfileStep} className="space-y-4">
            <div>
              <h2 className="text-lg font-bold font-heading text-[#262626] dark:text-[#F5F5F5]">
                Complete your profile
              </h2>
              <p className="text-xs text-[#737373] dark:text-[#A8A8A8]">
                Fill in your details so your 4 friends can collaborate with you.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#FAFAFA] dark:bg-[#1A1A1A] border border-[#DBDBDB] dark:border-[#262626] overflow-hidden flex items-center justify-center shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile preview" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-base font-bold">{getInitials(name)}</span>
                )}
              </div>
              <label
                htmlFor="onboarding-avatar-input"
                className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-xs font-medium cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#833AB4] dark:text-[#FCB045]" />
                <span>Add Profile Photo</span>
              </label>
              <input
                id="onboarding-avatar-input"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div>
              <label htmlFor="onboard-name" className="block text-xs font-medium text-[#737373] mb-1">
                Your Name *
              </label>
              <input
                id="onboard-name"
                type="text"
                required
                maxLength={80}
                placeholder="e.g., Sai Sarath"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboard-branch" className="block text-xs font-medium text-[#737373] mb-1">
                  Branch / Dept
                </label>
                <input
                  id="onboard-branch"
                  type="text"
                  maxLength={80}
                  placeholder="e.g., CSE"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>
              <div>
                <label htmlFor="onboard-year" className="block text-xs font-medium text-[#737373] mb-1">
                  Year
                </label>
                <input
                  id="onboard-year"
                  type="text"
                  maxLength={40}
                  placeholder="e.g., Final Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="onboard-skills" className="block text-xs font-medium text-[#737373] mb-1">
                Skills (comma-separated)
              </label>
              <input
                id="onboard-skills"
                type="text"
                placeholder="TypeScript, React, DSA, AI"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
              />
            </div>

            <div>
              <label htmlFor="onboard-bio" className="block text-xs font-medium text-[#737373] mb-1">
                Short Bio
              </label>
              <textarea
                id="onboard-bio"
                rows={2}
                maxLength={300}
                placeholder="Focused on hackathons & SWE placements..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-[#DBDBDB] dark:border-[#262626] bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#262626] dark:text-[#F5F5F5]"
              />
            </div>

            {errorMsg && (
              <p role="alert" className="text-xs text-red-500 font-medium">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[46px] rounded-xl bg-cohert-gradient text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{saving ? 'Saving Profile...' : 'Enter Cohert'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
