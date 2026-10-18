import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiBookOpen, FiMail, FiRotateCcw, FiSave, FiTarget, FiUser } from 'react-icons/fi';
import { LuGraduationCap, LuSchool } from 'react-icons/lu';
import AvatarEditor from '../components/avatar/AvatarEditor';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import ProgressRing from '../components/common/ProgressRing';
import Select from '../components/common/Select';
import VoiceLanguageSettings from '../components/settings/VoiceLanguageSettings';
import { useToast } from '../context/ToastContext';
import { useUser } from '../context/UserContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const FIELDS = ['name', 'email', 'college', 'branch', 'semester', 'learningGoal'];

function toForm(user) {
  return Object.fromEntries(FIELDS.map((field) => [field, user?.[field] ?? '']));
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <Icon className="shrink-0 text-blue-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value || 'Not set yet'}</p>
      </div>
    </div>
  );
}

export default function Profile() {
  const { user, updateProfile } = useUser();
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(user));
  const [errors, setErrors] = useState({});

  const isDirty = useMemo(() => FIELDS.some((field) => form[field] !== (user?.[field] ?? '')), [form, user]);
  const completeness = useMemo(() => {
    const filled = FIELDS.filter((field) => String(user?.[field] ?? '').trim()).length;
    return (filled / FIELDS.length) * 100;
  }, [user]);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (form.name.trim().length < 2) {
      nextErrors.name = 'Name must be at least 2 characters.';
    }

    if (!EMAIL_PATTERN.test(form.email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted fields', 'Your profile was not saved.');
      return;
    }

    const trimmed = Object.fromEntries(FIELDS.map((field) => [field, form[field].trim()]));
    updateProfile(trimmed);
    setForm(trimmed);
    toast.success('Profile saved', 'Your changes are stored on this device.');
  };

  const handleReset = () => {
    setForm(toForm(user));
    setErrors({});
  };

  return (
    <motion.section
      className="section-shell py-10 lg:py-14"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <p className="eyebrow">Profile</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Your learning profile</h1>
        <p className="mt-2 text-sm text-slate-600">HIMI uses these details to personalise how it greets and teaches you.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="flex flex-col items-center text-center">
          <AvatarEditor />
          <h2 className="mt-5 text-2xl font-bold text-slate-950">{user?.name}</h2>
          <p className="mt-1 max-w-full truncate text-sm text-slate-600">{user?.email}</p>
          <Badge tone="blue" className="mt-4">
            Student account
          </Badge>

          <div className="mt-8">
            <ProgressRing value={completeness} size={120} strokeWidth={10} label="Profile completeness" caption="complete" />
          </div>

          <div className="mt-8 w-full space-y-3 text-left">
            <SummaryRow icon={LuSchool} label="College" value={user?.college} />
            <SummaryRow icon={LuGraduationCap} label="Branch" value={user?.branch} />
            <SummaryRow icon={FiBookOpen} label="Semester" value={user?.semester ? `Semester ${user.semester}` : ''} />
            <SummaryRow icon={FiTarget} label="Learning goal" value={user?.learningGoal} />
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl font-bold text-slate-950">Edit details</h2>
          <p className="mt-1 text-sm text-slate-600">Changes are saved to your browser only.</p>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Name"
                value={form.name}
                onChange={handleChange('name')}
                icon={FiUser}
                autoComplete="name"
                error={errors.name}
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={handleChange('email')}
                icon={FiMail}
                autoComplete="email"
                error={errors.email}
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="College"
                value={form.college}
                onChange={handleChange('college')}
                icon={LuSchool}
                placeholder="e.g. JNTU Hyderabad"
              />
              <Input
                label="Branch"
                value={form.branch}
                onChange={handleChange('branch')}
                icon={LuGraduationCap}
                placeholder="e.g. Computer Science"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Select label="Semester" value={form.semester} onChange={handleChange('semester')}>
                <option value="">Select semester</option>
                {SEMESTERS.map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </Select>
              <Input
                label="Learning goal"
                value={form.learningGoal}
                onChange={handleChange('learningGoal')}
                icon={FiTarget}
                placeholder="e.g. Crack campus placements"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
              <Button type="submit" disabled={!isDirty}>
                <FiSave aria-hidden="true" /> Save profile
              </Button>
              <Button variant="secondary" onClick={handleReset} disabled={!isDirty}>
                <FiRotateCcw aria-hidden="true" /> Discard changes
              </Button>
              {isDirty ? <span className="text-sm text-amber-700">You have unsaved changes.</span> : null}
            </div>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <VoiceLanguageSettings />
        </div>
      </div>
    </motion.section>
  );
}
