import { useCallback, useOptimistic } from "react";

export interface ScoreState {
  value: number;
  lastUpdated: Date;
}

export interface OptimisticScoreActions {
  optimisticScore: ScoreState;
  updateScore: (newValue: number) => void;
  revertScore: () => void;
  isPending: boolean;
}

/**
 * React 19 useOptimistic hook for score updates.
 *
 * Provides immediate UI feedback for score changes while the actual
 * update is pending. If the update fails, the score automatically
 * reverts to the last confirmed value.
 *
 * @param initialScore - The initial confirmed score value
 * @returns Object containing optimistic state and update controls
 *
 * @example
 * ```tsx
 * function ScoreDisplay({ initialScore }: { initialScore: number }) {
 *   const { optimisticScore, updateScore, isPending } = useOptimisticScore(initialScore);
 *
 *   const handleIncrement = async () => {
 *     updateScore(optimisticScore.value + 1);
 *     try {
 *       await saveScoreToServer(optimisticScore.value + 1);
 *     } catch (error) {
 *       // Score automatically reverts on failure
 *       console.error("Failed to update score:", error);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <span className={isPending ? "opacity-50" : ""}>
 *         {optimisticScore.value}
 *       </span>
 *       <button onClick={handleIncrement}>+1</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useOptimisticScore(initialScore: number): OptimisticScoreActions {
  const initialState: ScoreState = {
    value: initialScore,
    lastUpdated: new Date(),
  };

  const [optimisticState, addOptimistic] = useOptimistic(
    initialState,
    (_state: ScoreState, newValue: number): ScoreState => ({
      value: newValue,
      lastUpdated: new Date(),
    })
  );

  const updateScore = useCallback(
    (newValue: number) => {
      addOptimistic(newValue);
    },
    [addOptimistic]
  );

  const revertScore = useCallback(() => {
    addOptimistic(initialState.value);
  }, [addOptimistic, initialState.value]);

  const isPending = optimisticState.value !== initialState.value;

  return {
    optimisticScore: optimisticState,
    updateScore,
    revertScore,
    isPending,
  };
}
