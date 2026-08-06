import { redirect } from 'next/navigation';

export default async function LegacyProviderSettingsPage({
  params,
}: {
  params: Promise<{ providerType: string }>;
}) {
  const { providerType } = await params;
  redirect(`/provider-connections/${providerType}`);
}
