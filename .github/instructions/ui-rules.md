# UI Implementation Guidelines for WritTab

## 1. Interactive Component Design Philosophy

### Drag-to-Scroll Pattern

Based on the `DraggingScroll` component, follow these principles for interactive scrolling:

- **Mouse-driven interaction**: Implement drag-to-scroll using mouse events (mouseDown, mouseMove, mouseUp, mouseLeave)
- **Visual feedback**: Use `cursor-grab` class to indicate draggable areas
- **Performance optimization**: Use `useRef` for DOM manipulation instead of state updates during drag
- **Smooth scrolling**: Apply scroll speed factors (e.g., `1.5x`) for enhanced user experience
- **Responsive behavior**: Handle edge cases like mouse leave events to prevent stuck drag states

```tsx
// Example implementation pattern
const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
  if (!isDragging || !scrollRef.current) return;
  e.preventDefault();
  const x = e.pageX - scrollRef.current.offsetLeft;
  const walk = (x - startX) * 1.5; // Scroll speed factor
  scrollRef.current.scrollLeft = scrollLeft - walk;
};
```

## 2. Visual Effects & Animations

### Transition Standards

- **Duration**: Use `0.3s ease` for general transitions, `0.2s ease` for quick interactions
- **Transform animations**: Implement smooth rotations for interactive elements (e.g., chevron arrows)
- **Hover effects**: Apply subtle color transitions and background changes on hover states

### Theme-Aware Visual Effects

```css
/* Example from project patterns */
.chevron {
  transition: transform 0.3s ease;
  transform: rotate(0deg);
}

.chevron.open {
  transform: rotate(180deg);
}
```

### Scrollbar Customization

- **Width**: Use `8px` for main scrollbars, `6px` for menu containers, `2px` for custom selects
- **Theme integration**: Scrollbar colors should respect theme variables
- **Hover states**: Implement darker scrollbar thumbs on hover

## 3. Theme System Integration

### Multi-Theme Support

The project supports three themes: `light`, `dark`, and `semidark`. All components must:

- Use CSS custom properties for colors: `var(--color-*)`
- Apply theme-specific classes: `.dark`, `.light`, `.semidark`
- Leverage theme-aware Tailwind variants: `@custom-variant dark (&:where(.dark, .dark *))`

### Color Palette Usage

```css
/* Core theme variables to use */
--color-primary: #01ff00; /* Bright green accent */
--color-text: /* theme-dependent */ --color-background: /* theme-dependent */
  --color-sidebar: /* theme-dependent */ --color-dropdown: /* theme-dependent */;
```

## 4. Component Architecture Patterns

### Reusable Component Structure

- **Props interface**: Always define TypeScript interfaces with optional `className` and `children`
- **Conditional styling**: Use `cn()` utility for conditional class application
- **Ref management**: Use `useRef` for DOM manipulations, avoid direct DOM queries
- **Event handling**: Implement proper event cleanup and edge case handling

### State Management Patterns

```tsx
// Preferred pattern for interactive components
const [isDragging, setIsDragging] = useState(false);
const [startX, setStartX] = useState(0);
const [scrollLeft, setScrollLeft] = useState(0);
```

## 5. Responsive Design Standards

### Layout Principles

- **Flexbox usage**: Prefer `flex` layouts with appropriate gap spacing (`gap-6`, `gap-2`)
- **Responsive spacing**: Use responsive padding (`px-4 lg:px-5 xl:px-6`)
- **Overflow handling**: Implement `overflow-x-auto` with `scrollbar-hidden` for clean scrolling
- **Z-index management**: Use `relative z-10` for layered components

### Breakpoint Considerations

- **Mobile-first**: Start with base styles, add responsive variants
- **Touch-friendly**: Ensure adequate touch targets for mobile devices
- **Scroll behavior**: Implement both mouse drag and touch scrolling where applicable

## 6. Visual Hierarchy & Spacing

### Typography Scale

- Use semantic HTML elements with appropriate styling classes
- Implement consistent text sizing (`text-xl`, `text-sm`, etc.)
- Apply proper line heights and spacing for readability

### Component Spacing

- **Internal spacing**: Use `pt-5 pb-5` for consistent vertical rhythm
- **Component gaps**: Apply `gap-6` for larger components, `gap-2` for tight groupings
- **Container margins**: Use `max-w-full mx-auto` for centered, constrained layouts

## 7. Performance Considerations

### Optimization Strategies

- **Event throttling**: Use `preventDefault()` during drag operations
- **Selective rendering**: Avoid unnecessary re-renders during interactions
- **CSS containment**: Use `select-none` to prevent text selection during interactions
- **Smooth scrolling**: Implement `scroll-behavior: smooth` for anchor navigation

### Memory Management

- Clean up event listeners on component unmount
- Use refs instead of state for frequently updated values during interactions
- Implement proper timeout cleanup for delayed operations

## 8. Accessibility Guidelines

### Interactive Elements

- **Keyboard navigation**: Ensure all interactive elements are keyboard accessible
- **Screen reader support**: Use semantic HTML and proper ARIA attributes
- **Focus management**: Implement visible focus indicators that respect theme colors
- **Touch accessibility**: Provide adequate touch targets (minimum 44px)

### Visual Accessibility

- **Color contrast**: Ensure sufficient contrast ratios across all themes
- **Motion preferences**: Respect `prefers-reduced-motion` for users sensitive to animations
- **Text scaling**: Support browser zoom and text scaling preferences

## 9. Testing Patterns

### Component Testing

- Test all interaction states (hover, active, disabled)
- Verify theme switching doesn't break functionality
- Test responsive behavior across breakpoints
- Validate accessibility with screen readers

### Integration Testing

- Test drag interactions across different devices
- Verify smooth scrolling performance
- Test theme persistence and switching
- Validate component composition patterns

## 10. Code Quality Standards

### TypeScript Usage

- Define strict interfaces for all props
- Use proper event typing (`MouseEvent<HTMLDivElement>`)
- Implement proper null checking for refs
- Export components with explicit types

### CSS Organization

- Group related styles in logical sections
- Use consistent naming conventions
- Implement proper cascade order
- Document complex visual effects with comments

### Component Documentation

- Document complex interaction patterns
- Explain performance optimizations
- Provide usage examples
- Document theme integration requirements

## 11. Theme Switching Implementation

### Theme Architecture

Based on the `ThemeSwitcher` component, implement theme switching with:

- **Context-based state management**: Use React Context for theme state across the application
- **Local storage persistence**: Automatically save theme preferences to localStorage
- **Immediate DOM application**: Apply theme classes directly to document root (`document.documentElement`)
- **Component re-rendering**: Use context updates to trigger component re-renders

```tsx
// Example theme switching pattern
const setTheme = (newTheme: Theme) => {
  setThemeState(newTheme);
  localStorage.setItem("theme", newTheme);
  applyTheme(newTheme);
};

const applyTheme = (theme: Theme) => {
  const html = document.documentElement;
  html.classList.remove("dark", "semidark", "light");
  html.classList.add(theme);
};
```

### Theme Integration Standards

- **CSS Custom Properties**: Use CSS variables that change with theme classes
- **Component Theme Awareness**: Components should respond to theme changes without manual intervention
- **Graceful Fallbacks**: Provide fallback themes for components that may not support all theme variants
- **Theme Labels**: Use descriptive theme names ("Lumen", "Eclipse", "Code Abyss") rather than technical terms

### SVG Theme Integration

Based on the `SvgImage` component, handle SVG assets with theme awareness:

- **Dynamic SVG Loading**: Fetch and modify SVG content to prevent ID conflicts
- **Unique ID Generation**: Generate unique IDs for SVG elements to avoid conflicts
- **Class Prefixing**: Prefix SVG classes with unique identifiers
- **Accessibility**: Maintain proper ARIA labels and semantic HTML structure

```tsx
// SVG theme integration pattern
const uniqueId = `svg-${Math.random().toString(36).substr(2, 9)}`;
updatedSvg = text.replace(/id="([^"]+)"/g, (_, id) => `id="${uniqueId}-${id}"`);
```
