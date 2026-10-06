import { Menu } from "lucide-react";

function Topbar({ onMenuClick }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <p className="text-sm font-medium text-muted-foreground">
          Learning workspace
        </p>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">Welcome back</p>

          <p className="text-xs text-muted-foreground">
            Keep building your knowledge
          </p>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
