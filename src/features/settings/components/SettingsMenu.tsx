import { TagManager } from "./TagManager"
import { Button } from "@/components/ui/Button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

interface SettingsMenuProps {
  onClose: () => void
}

export const SettingsMenu = ({ onClose }: SettingsMenuProps) => {
  return (
    <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-background/80 p-4 backdrop-blur-sm duration-200 fade-in">
      <div className="flex max-h-[90vh] w-full max-w-md animate-in flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl duration-200 zoom-in-95">
        <div className="flex items-center justify-between border-b bg-muted/30 p-4">
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Settings
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <HugeiconsIcon icon={Cancel01Icon} size={20} />
          </Button>
        </div>

        <div className="overflow-y-auto p-6">
          <TagManager />
        </div>

        <div className="flex justify-end border-t bg-muted/30 p-4">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
