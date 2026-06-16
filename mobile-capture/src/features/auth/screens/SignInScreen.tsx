import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Text, View } from 'react-native';
import { Button, FieldError, FieldLabel, Screen, TextInputField } from '../../../components/ui';
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
    <Screen className="pt-12">
      <View className="mb-8 gap-2">
        <Text className="text-primary text-xs font-bold uppercase tracking-widest">StudyForge</Text>
        <Text className="text-foreground text-3xl font-bold">Sign in to capture</Text>
        <Text className="text-muted-foreground text-base leading-6">
          Use the same Firebase account as the web app.
        </Text>
      </View>

      <View className="gap-2">
        <FieldLabel>Email</FieldLabel>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <>
              <TextInputField
                value={field.value}
                onChangeText={field.onChange}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <FieldError message={fieldState.error?.message} />
            </>
          )}
        />

        <FieldLabel>Password</FieldLabel>
        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <>
              <TextInputField
                value={field.value}
                onChangeText={field.onChange}
                placeholder="Password"
                secureTextEntry
              />
              <FieldError message={fieldState.error?.message} />
            </>
          )}
        />

        <FieldError message={form.formState.errors.root?.message} />

        <Button
          label={form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
          disabled={form.formState.isSubmitting}
          onPress={() => void onSubmit()}
        />
      </View>
    </Screen>
  );
}
