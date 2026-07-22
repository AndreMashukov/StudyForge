import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookOpen, Folder, Settings } from 'lucide-react';
import {
  Sidebar,
  SidebarBrand,
  SidebarNav,
  SidebarNavItem,
  SidebarProfileFooter,
  SidebarSection,
} from './Sidebar';
import { Button } from '../Button';

const meta: Meta<typeof Sidebar> = {
  title: 'Components/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const Default: Story = {
  render: () => (
    <div className="h-[480px] w-[220px]">
      <Sidebar
        header={<SidebarBrand title="StudyForge" />}
        footer={
          <SidebarProfileFooter
            avatarLabel="AM"
            primaryText="Andrey"
            secondaryText="andrey@example.com"
            action={
              <Button variant="ghost" size="sm">
                Sign out
              </Button>
            }
          />
        }
      >
        <SidebarNav>
          <SidebarSection label="Library">
            <SidebarNavItem
              isActive
              icon={<BookOpen className="h-4 w-4" />}
              label="Documents"
            />
            <SidebarNavItem
              icon={<Folder className="h-4 w-4" />}
              label="Directories"
            />
          </SidebarSection>
          <SidebarSection label="Account">
            <SidebarNavItem
              icon={<Settings className="h-4 w-4" />}
              label="Settings"
            />
          </SidebarSection>
        </SidebarNav>
      </Sidebar>
    </div>
  ),
};
