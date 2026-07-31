import { Button } from '../../../shared'
import './UploadActions.css'

type UploadActionsProps = {
  disabled: boolean
  onAnalyze: () => void
}

export function UploadActions({ disabled, onAnalyze }: UploadActionsProps) {
  return (
    <div className="upload-actions">
      <Button disabled={disabled} onClick={onAnalyze}>
        Analiz Et
      </Button>
    </div>
  )
}
