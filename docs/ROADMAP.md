# Create Document Page - Progressive Disclosure Migration Roadmap

## 🎯 **Migration Overview**

Transform the current tab-based Create Document Page into a modern progressive disclosure interface with card-based source selection, while preserving all existing functionality.

## 📋 **Requirements Summary**

Based on Q&A session:
- ✅ Keep existing forms unchanged (UrlScrapingForm, FileUploadForm)
- ✅ Replace tabs with card-based selection
- ✅ Add placeholder cards for future sources (Text Prompt, Video URL)
- ✅ Implement full progressive disclosure with animations
- ✅ Desktop-first approach (mobile enhancements later)
- ✅ Move state management to Redux slice
- ✅ Refactor existing CreateDocumentPageContainer
- ✅ Keep existing handler signatures
- ✅ Maintain global error handling

---

## 🗓️ **Implementation Phases**

### **Phase 1: Foundation & State Management** (Days 1-2)
*Setup Redux slice and basic component structure*

#### 1.1 Redux Slice Creation
- [ ] Create `createDocumentPageSlice.ts` in `/web/src/store/slices/`
- [ ] Define state interface for source selection
- [ ] Add actions: `setSelectedSource`, `clearSelection`, `setFormData`
- [ ] Add selectors: `selectSelectedSource`, `selectIsFormVisible`

#### 1.2 Type Definitions
- [ ] Create `/web/src/pages/CreateDocumentPage/types/ISourceTypes.ts`
- [ ] Define `SourceType` enum: `'website' | 'file' | 'textPrompt' | 'videoUrl'`
- [ ] Create `ISourceCard` interface
- [ ] Update existing interfaces to support new structure

#### 1.3 Context Refactoring
- [ ] Update `CreateDocumentPageProvider.tsx` to use Redux state
- [ ] Refactor context hooks to access Redux instead of local state
- [ ] Maintain existing handler signatures for backward compatibility

### **Phase 2: Source Cards Component** (Days 3-4)
*Create the new card-based source selection interface*

#### 2.1 SourceSelector Component
- [ ] Create `/web/src/pages/CreateDocumentPage/components/SourceSelector/`
- [ ] Build main `SourceSelector.tsx` component
- [ ] Implement responsive grid layout for cards
- [ ] Add keyboard navigation support

#### 2.2 SourceCard Component
- [ ] Create `/web/src/pages/CreateDocumentPage/components/SourceSelector/SourceCard/`
- [ ] Design card with icon, title, description, and state
- [ ] Implement selection states: default, selected, disabled
- [ ] Add hover and click animations

#### 2.3 Card Definitions
```typescript
const sourceCards = [
  {
    id: 'website',
    icon: '🌐',
    title: 'Website URL',
    description: 'Scrape web content automatically',
    status: 'active'
  },
  {
    id: 'file',
    icon: '📄',
    title: 'File Upload',
    description: 'Upload MD or text file',
    status: 'active'
  },
  {
    id: 'textPrompt',
    icon: '📝',
    title: 'Text Prompt',
    description: 'Create from description',
    status: 'coming-soon'
  },
  {
    id: 'videoUrl',
    icon: '🎥',
    title: 'Video URL',
    description: 'Extract from video',
    status: 'coming-soon'
  }
];
```

### **Phase 3: Progressive Disclosure Implementation** (Days 5-6)
*Implement the form reveal and animation system*

#### 3.1 Form Container Wrapper
- [ ] Create `/web/src/pages/CreateDocumentPage/components/FormContainer/`
- [ ] Build animated container for progressive disclosure
- [ ] Implement slide-in animations with CSS transitions
- [ ] Add form state management (show/hide/transition)

#### 3.2 Animation System
- [ ] Create `/web/src/pages/CreateDocumentPage/components/SourceSelector/animations.css`
- [ ] Card selection animations (highlight, elevation, dimming)
- [ ] Form slide-in transitions (opacity + translateY)
- [ ] Loading state animations
- [ ] Error state transitions

#### 3.3 Responsive Behavior
- [ ] Desktop: Progressive disclosure below cards
- [ ] Tablet: Adaptive behavior
- [ ] Mobile: Same progressive disclosure (slide-up panel in Phase 5)

### **Phase 4: Container Refactoring** (Days 7-8)
*Refactor existing CreateDocumentPageContainer to use new components*

#### 4.1 Container Restructure
- [ ] Replace Tabs component with SourceSelector
- [ ] Integrate FormContainer for progressive disclosure
- [ ] Update layout structure and styling
- [ ] Maintain existing error handling position

#### 4.2 Form Integration
- [ ] Wrap existing UrlScrapingForm in FormContainer
- [ ] Wrap existing FileUploadForm in FormContainer
- [ ] Ensure forms maintain current functionality
- [ ] Add form-specific loading states

#### 4.3 State Integration
- [ ] Connect SourceSelector to Redux state
- [ ] Update form visibility based on selectedSource
- [ ] Maintain existing handler prop passing

### **Phase 5: Polish & Enhancement** (Days 9-10)
*Final touches, testing, and documentation*

#### 5.1 Visual Enhancements
- [ ] Polish card designs with proper shadows and hover states
- [ ] Refine animation timing and easing
- [ ] Add loading skeletons for cards
- [ ] Implement focus indicators for accessibility

#### 5.2 User Experience
- [ ] Add smooth transitions between source selections
- [ ] Implement escape key to deselect source
- [ ] Add click-outside to collapse form
- [ ] Polish error state animations

#### 5.3 Testing & Validation
- [ ] Test all existing functionality works unchanged
- [ ] Verify responsive behavior across screen sizes
- [ ] Test keyboard navigation and accessibility
- [ ] Performance testing for animations

---

## 🏗️ **Technical Implementation Details**

### **Redux Slice Structure**
```typescript
// /web/src/store/slices/createDocumentPageSlice.ts
interface ICreateDocumentPageState {
  selectedSource: SourceType | null;
  isFormVisible: boolean;
  isAnimating: boolean;
  error: string | null;
  
  // Form-specific states (existing functionality)
  urlForm: {
    isLoading: boolean;
  };
  fileForm: {
    isLoading: boolean;
  };
}
```

### **Component Architecture**
```
CreateDocumentPage/
├─ CreateDocumentPageContainer/
│  └─ CreateDocumentPageContainer.tsx        # Refactored main container
├─ components/
│  ├─ SourceSelector/                        # NEW: Card-based selection
│  │  ├─ SourceSelector.tsx
│  │  ├─ SourceCard/
│  │  │  ├─ SourceCard.tsx
│  │  │  └─ SourceCard.styles.ts
│  │  └─ animations.css
│  ├─ FormContainer/                         # NEW: Progressive disclosure wrapper
│  │  ├─ FormContainer.tsx
│  │  └─ FormContainer.styles.ts
│  ├─ UrlScrapingForm/                       # EXISTING: Unchanged
│  └─ FileUploadForm/                        # EXISTING: Unchanged
```

### **Animation Specifications**
```css
/* Card Selection */
.source-card.selected {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(139, 92, 246, 0.2);
  border: 2px solid var(--primary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Form Slide-in */
.form-container {
  opacity: 0;
  transform: translateY(20px);
  animation: slideInUp 0.4s ease forwards;
}

/* Card Dimming */
.source-card:not(.selected) {
  opacity: 0.7;
  transition: opacity 0.3s ease;
}
```

---

## 🎯 **Success Criteria**

### **Functional Requirements**
- [ ] All existing document creation functionality works unchanged
- [ ] UrlScrapingForm and FileUploadForm maintain current behavior
- [ ] Error handling remains consistent
- [ ] Loading states work correctly
- [ ] Form validation preserved

### **UX Requirements**
- [ ] Smooth card selection with visual feedback
- [ ] Progressive disclosure reveals forms below cards
- [ ] Users can easily switch between sources
- [ ] Animations enhance rather than hinder usability
- [ ] Keyboard navigation works correctly

### **Technical Requirements**
- [ ] State management follows project Redux patterns
- [ ] Component structure follows project guidelines
- [ ] No breaking changes to existing handlers
- [ ] Code follows TypeScript strict typing
- [ ] Responsive behavior works on desktop/tablet

### **Performance Requirements**
- [ ] Animations run at 60fps
- [ ] No layout shifts during transitions
- [ ] Form rendering remains fast
- [ ] Bundle size increase < 10KB

---

## 🚀 **Future Enhancements (Post-Phase 5)**

### **Phase 6: Mobile Slide-Up Panel** (Future)
- [ ] Implement mobile-specific slide-up behavior
- [ ] Add bottom sheet component
- [ ] Mobile-optimized form layouts

### **Phase 7: New Source Types** (Future)
- [ ] Text Prompt form implementation
- [ ] Video URL processing form
- [ ] API integration sources

### **Phase 8: Advanced Features** (Future)
- [ ] Quick Actions panel
- [ ] Recent sources history
- [ ] Template system
- [ ] Batch operations

---

## 📦 **Deliverables**

### **Code Deliverables**
1. Redux slice with proper state management
2. SourceSelector component with card grid
3. SourceCard component with animations
4. FormContainer with progressive disclosure
5. Refactored CreateDocumentPageContainer
6. Updated type definitions
7. Animation CSS styles

### **Documentation Deliverables**
1. Component API documentation
2. Animation behavior guide
3. State management documentation
4. Migration notes for future developers

### **Testing Deliverables**
1. Unit tests for new components
2. Integration tests for form flows
3. E2E tests for complete user journeys
4. Accessibility testing results

---

## ⚠️ **Risk Mitigation**

### **Technical Risks**
- **Animation Performance**: Use CSS transforms instead of layout changes
- **State Management**: Incremental migration to avoid breaking changes
- **Form Integration**: Wrapper approach to preserve existing forms

### **UX Risks**
- **User Confusion**: Clear visual hierarchy and intuitive interactions
- **Accessibility**: Maintain keyboard navigation and screen reader support
- **Mobile Experience**: Progressive enhancement approach

### **Timeline Risks**
- **Scope Creep**: Strict adherence to defined requirements
- **Testing Delays**: Parallel development and testing approach
- **Integration Issues**: Regular integration checkpoints

---

## 📅 **Timeline Summary**

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1 | 2 days | Redux slice, types, context refactor |
| 2 | 2 days | SourceSelector and SourceCard components |
| 3 | 2 days | Progressive disclosure and animations |
| 4 | 2 days | Container refactoring and integration |
| 5 | 2 days | Polish, testing, and documentation |

**Total Estimated Duration: 10 days**

---

*This roadmap ensures a systematic migration to Progressive Disclosure while preserving all existing functionality and following project architectural guidelines.*
