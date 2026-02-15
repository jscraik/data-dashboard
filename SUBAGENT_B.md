# Sub-Agent B: React 19 useOptimistic

## Objective
Implement optimistic UI updates for score submission using React 19 useOptimistic hook.

## Constraints
- React 19 useOptimistic for pending states
- Rollback on error
- Smooth UX for score submission
- Works with tauri-specta commands

## Success Criteria
- Score shows immediately (optimistic)
- Reverts on error
- Loading states handled
- Tests pass

## Files to Create/Modify
- src/hooks/useOptimisticScore.ts
- src/components/SessionScorer.tsx (update)
- src/components/OptimisticScoreCard.tsx

Report completion with demo.
