import { Button } from "../../ui/buttons";
import { DialogActions } from "../../ui/overlays";

export function AiResultActions({ onRegenerate, regenerateLabel, regenerateDisabled, initialGeneration = false, onApply, applyLabel = "采用建议", applyDisabled }: {
  onRegenerate: () => void;
  regenerateLabel: string;
  regenerateDisabled?: boolean;
  initialGeneration?: boolean;
  onApply?: () => void;
  applyLabel?: string;
  applyDisabled?: boolean;
}) {
  return <DialogActions>
    <Button variant={initialGeneration ? "contained" : "outlined"} disabled={regenerateDisabled} onClick={onRegenerate}>{regenerateLabel}</Button>
    {onApply && <Button variant="contained" disabled={applyDisabled} onClick={onApply}>{applyLabel}</Button>}
  </DialogActions>;
}
