import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Form,
  FormRootError,
  FormTextInput,
  Screen,
  ScreenHeader,
  Stack,
  Text,
} from '@studyforge/mobile-ui';
import { useAuthUser } from '../hooks/useAuthUser';
import { ISignInFormValues, signInSchema } from '../schemas/authSchemas';

export function SignInScreen() {
  const { signIn } = useAuthUser();
  const form = useForm<ISignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signIn(values.email, values.password);
    } catch (error) {
      form.setError('root', {
        message: error instanceof Error ? error.message : 'Unable to sign in.',
      });
    }
  });

  return (
    <Screen className="pt-0">
      <ScreenHeader title="Sign in to capture" />

      <Text tone="muted" className="mt-6 mb-8 leading-6">
        Use the same Firebase account as the web app.
      </Text>

      <Form {...form}>
        <Stack gap="sm">
          <FormTextInput
            control={form.control}
            name="email"
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <FormTextInput
            control={form.control}
            name="password"
            label="Password"
            placeholder="Password"
            secureTextEntry
          />

          <FormRootError />

          <Button
            label={form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
            disabled={form.formState.isSubmitting}
            onPress={() => void onSubmit()}
          />
        </Stack>
      </Form>
    </Screen>
  );
}
