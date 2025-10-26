# Frontend Screen Structure

This document maps UI screens to their corresponding files and components.

---

## S1: Landing Page
**Route**: `/`
**File**: [app/(marketing)/page.tsx](app/(marketing)/page.tsx)

### Current Status: ✅ EXISTS
### Components Needed:
- [x] Product name and catchphrase in hero section
- [x] Log in button (top right) → Links to S8
- [x] Get started button → Should link to S2 (currently links to `/lectures`)
- [ ] GIF demo section (TODO: Add animated demo)
- [x] Features section (scrollable)
- [x] Use cases section

### Navigation Flow:
- "Sign in to craft your flow" button → `/login` (S8)
- "Preview the lecture experience" button → `/lectures` (currently - should go to `/onboarding` or `/login` for S2)

### TODO:
1. Add GIF/demo video section between hero and mission
2. Update "Get started" button to route to proper onboarding flow

---

## S2: Account Setup (Initial - Username/Password)
**Route**: `/onboarding` or `/signup`
**File**: **NEEDS TO BE CREATED** - `app/(auth)/onboarding/page.tsx`

### Current Status: ❌ MISSING (Login exists but no dedicated onboarding)
### Components Needed:
- [ ] Username and password input fields
- [ ] "Sign up with Google" button
- [ ] Progress indicator (Step 1 of 2)
- [ ] Continue button → Takes to S3

### Navigation Flow:
- After successful account creation → `/onboarding/preferences` (S3)
- "Already have an account?" link → `/login` (S8)

### TODO:
1. Create `app/(auth)/onboarding/page.tsx`
2. Add multi-step form component
3. Implement first-time user detection
4. Add progress stepper component

### Suggested File Structure:
```
app/(auth)/
  onboarding/
    page.tsx              # S2 - Initial account setup
    preferences/
      page.tsx            # S3 - Preferences setup
    layout.tsx            # Shared layout for onboarding flow
```

---

## S3: Account Setup (Preferences)
**Route**: `/onboarding/preferences`
**File**: **NEEDS TO BE CREATED** - `app/(auth)/onboarding/preferences/page.tsx`

### Current Status: ⚠️ PARTIAL (Settings page exists at `/settings` but not in onboarding flow)
### Related File: [app/(app)/settings/page.tsx](app/(app)/settings/page.tsx)

### Components Needed:
- [ ] Lecture length selector (short/medium/long)
- [ ] Tone selector (direct/warm/funny)
- [ ] Enable questions toggle
- [ ] Progress indicator (Step 2 of 2)
- [ ] Complete setup button → Takes to S4

### Navigation Flow:
- After preferences saved → `/dashboard` (S4)
- Skip button → `/dashboard` (with default preferences)

### TODO:
1. Create `app/(auth)/onboarding/preferences/page.tsx`
2. Reuse preferences UI component from settings page
3. Add completion celebration/welcome message
4. Redirect to dashboard after completion

### Reusable Component:
Extract preferences form from `settings/page.tsx` into:
```
components/preferences/
  preferences-form.tsx    # Reusable preferences form
  preference-option.tsx   # Individual preference selector
```

---

## S4: Dashboard
**Route**: `/dashboard`
**File**: [app/(app)/dashboard/page.tsx](app/(app)/dashboard/page.tsx)

### Current Status: ✅ EXISTS
### Components Needed:
- [x] Settings button (gear icon, top left) → Links to Settings (currently labeled as such)
- [x] Logout button (top right) → Should go to S1 (needs to be added to header)
- [x] "Hello, [username]!" greeting
- [x] Text box for lecture topic input
- [x] Paperclip icon for file attachment (exists in `/lectures/new`)
- [x] Lecture history section with cards
- [x] Click lecture card → Goes to S7

### Navigation Flow:
- Settings button → `/settings`
- Logout button → `/` (S1) - **NEEDS TO BE ADDED**
- "Create New Project" button → `/lectures/new` (S5)
- Lecture card click → `/lectures/[id]` (S7)

### TODO:
1. Add logout button to workspace header
2. Move topic input + file attachment from `/lectures/new` to dashboard (or keep as-is)
3. Ensure lecture cards link properly to S7

### Related Components:
- [components/layout/workspace-header.tsx](components/layout/workspace-header.tsx) - Add logout button here
- [components/lectures/lecture-card.tsx](components/lectures/lecture-card.tsx)

---

## S5: Lecture Clarification Questions
**Route**: `/lectures/new`
**File**: [app/(app)/lectures/new/page.tsx](app/(app)/lectures/new/page.tsx)

### Current Status: ✅ EXISTS
### Components Needed:
- [x] LLM-generated clarification questions
- [x] User response inputs (radio, checkbox, text)
- [x] Submit button → Takes to S6

### Navigation Flow:
- Submit button → `/lectures/new/progress?config={key}` (S6)

### TODO:
1. Ensure question generation is working properly
2. Add better error handling
3. Consider adding a "Skip questions" option

---

## S6: Loading Screen
**Route**: `/lectures/new/progress`
**File**: [app/(app)/lectures/new/progress/page.tsx](app/(app)/lectures/new/progress/page.tsx)

### Current Status: ⚠️ PARTIAL (Basic structure exists, needs enhancement)
### Components Needed:
- [x] Loading icon/spinner
- [ ] Status updates with specific phases:
  - [ ] Transcript generation status
  - [ ] Diagram generation status
  - [ ] Images status
  - [ ] Voice memo/audio status
- [ ] Progress timeline component

### Navigation Flow:
- When lecture complete → Redirect to `/lectures/[id]` (S7)

### TODO:
1. Enhance with [components/lectures/lecture-status-timeline.tsx](components/lectures/lecture-status-timeline.tsx)
2. Add real-time WebSocket status updates
3. Add individual status indicators for each asset type
4. Auto-redirect when complete

### Related Components:
- [components/lectures/lecture-status-timeline.tsx](components/lectures/lecture-status-timeline.tsx) - Already exists!

---

## S7: Lecture Display Screen
**Route**: `/lectures/[id]`
**File**: [app/(marketing)/lectures/[id]/page.tsx](app/(marketing)/lectures/[id]/page.tsx)

### Current Status: ✅ EXISTS
### Components Needed:
- [x] Video player with lecture content
- [ ] Audio playback controls
- [ ] Chat sidebar for Q&A
- [ ] Chat state management (frontend storage)

### Navigation Flow:
- Back button → `/dashboard` (S4)
- Lecture list → `/dashboard` or `/lectures`

### TODO:
1. Add chat sidebar component
2. Implement video player with proper controls
3. Add chat state management (localStorage/sessionStorage)
4. Add slide navigation
5. Integrate with LiveKit for real-time features

### Suggested Components to Create:
```
components/lectures/
  video-player.tsx        # Video player with controls
  chat-sidebar.tsx        # Q&A chat interface
  chat-message.tsx        # Individual chat message
  slide-viewer.tsx        # Slide display component
```

### Related Components:
- [components/lectures/lecture-detail.tsx](components/lectures/lecture-detail.tsx)
- [components/slides/Slide.tsx](components/slides/Slide.tsx)

---

## S8: Login Page
**Route**: `/login`
**File**: [app/login/page.tsx](app/login/page.tsx)

### Current Status: ✅ EXISTS
### Components Needed:
- [x] Email/password login form
- [x] "Sign in with Google" button
- [x] Toggle between login/register modes
- [x] Redirect to dashboard after login

### Navigation Flow:
- After successful login → `/dashboard` (S4)
- "Need an account?" → Toggles to registration mode
- From landing page (S1) → `/login`

### TODO:
1. Consider separating login/register into distinct flows for clarity
2. Add "Forgot password" functionality
3. Ensure proper redirect after Google OAuth

---

## Additional Files/Components Needed

### Layout Components
- [x] [app/(marketing)/layout.tsx](app/(marketing)/layout.tsx) - For S1, S7
- [x] [app/(app)/layout.tsx](app/(app)/layout.tsx) - For S4, S5, S6
- [ ] `app/(auth)/layout.tsx` - **CREATE** for S2, S3, S8

### Shared Components
```
components/
  auth/
    ✅ auth-provider.tsx
    ✅ protected-content.tsx
    ❌ onboarding-stepper.tsx      # CREATE - Progress indicator for S2/S3

  layout/
    ✅ site-header.tsx              # For marketing pages (S1)
    ✅ workspace-header.tsx         # For app pages (S4, S5, S6)
    ✅ site-footer.tsx
    ✅ conditional-layout.tsx

  lectures/
    ✅ lecture-card.tsx
    ✅ lecture-detail.tsx
    ✅ lecture-status-timeline.tsx
    ❌ video-player.tsx             # CREATE for S7
    ❌ chat-sidebar.tsx             # CREATE for S7
    ❌ chat-message.tsx             # CREATE for S7

  onboarding/
    ✅ preferences-modal.tsx        # Can be adapted for S3
    ❌ preferences-form.tsx         # CREATE - Extract from settings

  slides/
    ✅ Slide.tsx
```

---

## File Creation Checklist

### High Priority (Core User Flow)
- [ ] `app/(auth)/onboarding/page.tsx` - S2
- [ ] `app/(auth)/onboarding/preferences/page.tsx` - S3
- [ ] `app/(auth)/layout.tsx` - Onboarding layout
- [ ] `components/onboarding/onboarding-stepper.tsx` - Progress indicator
- [ ] `components/lectures/chat-sidebar.tsx` - Chat for S7
- [ ] `components/lectures/video-player.tsx` - Video for S7

### Medium Priority (Enhanced Experience)
- [ ] `components/preferences/preferences-form.tsx` - Reusable form
- [ ] `components/lectures/chat-message.tsx` - Chat messages
- [ ] Enhanced loading screen status components
- [ ] Add GIF demo section to landing page

### Low Priority (Nice to Have)
- [ ] Password reset flow
- [ ] Email verification flow
- [ ] Profile settings page
- [ ] Lecture export functionality

---

## Navigation Flow Summary

```
S1 (Landing)
  ├─→ Login button → S8 (Login)
  └─→ Get Started → S2 (Onboarding) [NEW USER] or S4 (Dashboard) [EXISTING USER]

S2 (Account Setup)
  ├─→ Create account → S3 (Preferences)
  └─→ Already have account → S8 (Login)

S3 (Preferences)
  └─→ Complete setup → S4 (Dashboard)

S4 (Dashboard)
  ├─→ Settings button → Settings page
  ├─→ Logout → S1 (Landing)
  ├─→ Create project → S5 (Clarification)
  └─→ Lecture card → S7 (Display)

S5 (Clarification)
  └─→ Submit → S6 (Loading)

S6 (Loading)
  └─→ Auto-redirect when complete → S7 (Display)

S7 (Lecture Display)
  └─→ Back → S4 (Dashboard)

S8 (Login)
  └─→ Success → S4 (Dashboard)
```

---

## Questions for Clarification

1. **S2 vs S8**: Should S2 (Account Setup) be a separate page from S8 (Login), or should they be combined with different modes like the current login page?

2. **Dashboard Input**: Should the topic input box with paperclip be on the Dashboard (S4) itself, or should "Create New Project" button take users directly to the clarification questions page (S5)?

3. **First-time Users**: Should new users automatically go through S2 → S3 flow, or can they skip directly to S4 with default preferences?

4. **Lecture Display**: Should the video player show generated slides as a video, or display them as navigable slides with separate audio controls?

5. **Chat Storage**: For the chat sidebar in S7, should conversations persist across sessions (database) or just within the current session (frontend only)?

Let me know if you'd like me to proceed with creating any of these missing files!
