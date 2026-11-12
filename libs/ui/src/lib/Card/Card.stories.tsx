import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '../Badge';
import { Button } from '../Button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  decorators: [
    (Story) => (
      <div className="w-96 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Cell biology</CardTitle>
        <CardDescription>12 documents · updated yesterday</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm">
          Notes, quizzes and flashcards generated from your lecture slides.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Open</Button>
        <Button size="sm" variant="ghost">
          Share
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card>
      <CardContent className="flex items-center justify-between pt-6">
        <span className="text-sm font-medium">Quiz generation</span>
        <Badge variant="secondary">Ready</Badge>
      </CardContent>
    </Card>
  ),
};
