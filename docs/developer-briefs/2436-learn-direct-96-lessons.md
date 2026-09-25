# Developer Brief — Learn Direct 96-Lesson Browser

Issue: #2436

## Human intent

LEARN is a simple lookup-and-learn surface.

The active Human journey is:

Dashboard → Learn → Search/Browse 96 Lessons → Lesson

There is no intermediate Learn landing page, Journey chooser, Path chooser, or Craft Module navigation step in the active Dashboard → Learn route.

## Existing authority to preserve

The correct destination already exists in `app/skin-v1/learn-explore.tsx`.

It already consumes `/api/learn/explore`, whose contract deterministically requires:
- 96 presentation lessons
- 12 topics
- 24 Craft Modules
- unrestricted access
- the existing curriculum authority
- the existing `PPFProject.learning.completedLessonIds` progress authority

Do not create another curriculum store or lesson index.

## Implementation

### Entry

Keep the Dashboard Learn activation using the existing Learn host, but make its initial/default view All Curriculum Explore.

The old Journey code may remain as compatibility code, but it must not be reachable through the normal Dashboard → Learn flow.

### All Curriculum directory

Keep:
- search
- Topic filter
- Craft Module filter
- all 96 lesson rows
- keyboard selection
- lesson opening
- shared lesson completion state

Change:
- remove Back to Learn
- expose one Back to Dashboard action
- Escape returns to Dashboard

### Lesson detail

Keep:
- canonical lesson content
- completion action
- return to All Curriculum

Add:
- direct Back to Dashboard

## Non-goals

- no curriculum rewrite
- no lesson-body rewrite
- no redesign of search/results
- no new Learn hierarchy
- no deletion of historical Journey contracts unless required by the active regression tests
- no progress-model changes

## Verification

Focused tests must prove:
1. Learn defaults directly into Explore.
2. Explore cannot return to Journey from the active route.
3. The canonical API still enforces exactly 96 presentation lessons.
4. Search, Topic and Craft Module filters remain present.
5. Directory and lesson detail expose Dashboard return.
6. Escape from the directory uses Dashboard return.
7. Existing lesson progress ownership is unchanged.
8. No "Back to Learn" control remains on the active Explore surface.

GitHub Architecture Verification remains the full-system authority before merge.
