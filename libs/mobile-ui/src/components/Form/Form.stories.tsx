import type { Meta, StoryObj } from '@storybook/react-native-web-vite';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { View } from 'react-native';
import { z } from 'zod';
import { Button } from '../Button';
import { Stack } from '../Stack';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormRootError,
} from './Form';
import { FormTextInput } from './FormTextInput';
import { TextInputField } from '../TextInputField';

const signInSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type ISignInFormValues = z.infer<typeof signInSchema>;

const meta: Meta = {
  title: 'Components/Form',
};

export default meta;
type Story = StoryObj;

function SignInFormExample() {
  const form = useForm<ISignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  return (
    <Form {...form}>
      <View className="p-4">
        <Stack gap="sm">
          <FormTextInput
            control={form.control}
            name="email"
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormDescription>Use at least 6 characters.</FormDescription>
                <FormControl>
                  <TextInputField
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="Password"
                    secureTextEntry
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormRootError />

          <Button
            label="Sign in"
            onPress={() => {
              void form.handleSubmit(() => undefined)();
            }}
          />
        </Stack>
      </View>
    </Form>
  );
}

export const SignInForm: Story = {
  render: () => <SignInFormExample />,
};
