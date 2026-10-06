import { NavLink } from "react-router-dom";
import { X } from "lucide-react";

function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile / tablet overlay */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-border bg-card",
          "transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex h-full flex-col p-4">
          {/* Mobile close button */}
          <div className="flex items-start justify-between lg:block">
            <div className="px-3 py-2">
              <h1 className="text-xl font-semibold tracking-tight">
                SkillForge
              </h1>

              <p className="mt-1 text-xs text-muted-foreground">
                Adaptive learning
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close navigation"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-8 space-y-1" aria-label="Primary navigation">
            <NavLink
              to="/dashboard"
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center rounded-md px-3 py-2.5 text-sm font-medium",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                ].join(" ")
              }
            >
              Dashboard
            </NavLink>

            <NavLink
              to="/learning"
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "flex items-center rounded-md px-3 py-2.5 text-sm font-medium",
                  "transition-colors duration-150",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                ].join(" ")
              }
            >
              My Learning
            </NavLink>

            <div
              className="flex cursor-not-allowed items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
              aria-disabled="true"
            >
              Practice
            </div>

            <div
              className="flex cursor-not-allowed items-center rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/50"
              aria-disabled="true"
            >
              Progress
            </div>
          </nav>

          {/* Bottom area */}
          <div className="mt-auto border-t border-border pt-4">
            <p className="px-3 text-xs text-muted-foreground">SkillForge MVP</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
