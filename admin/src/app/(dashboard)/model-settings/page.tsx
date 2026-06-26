import { redirect } from 'next/navigation';

export default function LegacyModelSettingsPage() {
  redirect('/provider-connections');
}
