import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';

export type ISelect = React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>;

export type ISelectGroup = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Group
>;

export type ISelectValue = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Value
>;

export type ISelectTrigger = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
>;

export type ISelectContent = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Content
>;

export type ISelectLabel = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Label
>;

export type ISelectItem = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
>;

export type ISelectSeparator = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Separator
>;

export type ISelectScrollUpButton = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.ScrollUpButton
>;

export type ISelectScrollDownButton = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.ScrollDownButton
>;
